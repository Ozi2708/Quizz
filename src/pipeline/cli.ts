import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { lireQuiz, validerSchema } from "./schema.ts";
import { estBloque, formaterControles, porte1 } from "./porte1.ts";
import { CIBLE_COURT, CIBLE_LONG, porte2 } from "./porte2.ts";
import { champsPublication, PLATEFORMES, publier, type OptionsPublication, type Plateforme } from "./publier.ts";
import type { Categorie, Quiz } from "./types.ts";

// Point d'entrée en ligne de commande : npm run <commande> -- <arguments>
//   valider <fichier>                     contrôle le schéma
//   qa <fichier> [--brouillon]            porte 1 (contenu)
//   generer --sujet "..." --categorie ... [--questions 10] [--angle "..."]
//   verifier <fichier>                    fact-check par un second Claude (recherche web)
//   rendu <fichier> [--long]              rendu court 9:16 (ou long 16:9) puis porte 2
//   publier <fichier> --video <mp4> [--plateformes youtube,tiktok,instagram] [--prive]
//           [--programme 2026-11-02T18:00] [--tentative 2] [--a-blanc]
//                                         portes 1 et 2, puis publication via Upload-Post

const DOSSIER_QUIZ = "quizzes";

function enregistrer(quiz: Quiz, chemin = path.join(DOSSIER_QUIZ, `${quiz.id}.json`)): string {
  writeFileSync(chemin, `${JSON.stringify(quiz, null, 2)}\n`);
  return chemin;
}

// Énoncés des quiz déjà présents dans quizzes/ (statut « publie »), pour éviter les doublons.
function enoncesPublies(exclure?: string): string[] {
  let fichiers: string[] = [];
  try {
    fichiers = readdirSync(DOSSIER_QUIZ).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  return fichiers
    .map((f) => lireQuiz(path.join(DOSSIER_QUIZ, f)))
    .filter((q) => q.statut === "publie" && q.id !== exclure)
    .flatMap((q) => q.questions.map((x) => x.enonce));
}

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      sujet: { type: "string" },
      categorie: { type: "string", default: "culture-generale" },
      questions: { type: "string", default: "10" },
      angle: { type: "string" },
      long: { type: "boolean", default: false },
      brouillon: { type: "boolean", default: false },
      video: { type: "string" },
      plateformes: { type: "string", default: PLATEFORMES.join(",") },
      prive: { type: "boolean", default: false },
      programme: { type: "string" },
      tentative: { type: "string", default: "1" },
      "a-blanc": { type: "boolean", default: false },
    },
  });
  const [commande, fichier] = positionals;

  switch (commande) {
    case "valider": {
      const r = validerSchema(lireQuiz(fichier));
      console.log(r.ok ? "Schéma valide" : `Schéma invalide :\n${r.erreurs.join("\n")}`);
      return r.ok ? 0 : 1;
    }
    case "qa": {
      const quiz = lireQuiz(fichier);
      const controles = porte1(quiz, { enoncesPublies: enoncesPublies(quiz.id), exigerFactCheck: !values.brouillon });
      console.log(formaterControles(controles));
      return estBloque(controles) ? 1 : 0;
    }
    case "generer": {
      if (!values.sujet) throw new Error("--sujet est obligatoire");
      const { genererQuiz } = await import("./generer.ts");
      const quiz = await genererQuiz({
        sujet: values.sujet,
        categorie: values.categorie as Categorie,
        nbQuestions: Number(values.questions),
        sousSujet: values.angle,
        enoncesPublies: enoncesPublies(),
      });
      console.log(`Quiz écrit : ${enregistrer(quiz)}`);
      console.log(formaterControles(porte1(quiz, { exigerFactCheck: false })));
      return 0;
    }
    case "verifier": {
      const { verifierQuiz } = await import("./verifier.ts");
      const quiz = await verifierQuiz(lireQuiz(fichier));
      enregistrer(quiz, fichier);
      for (const q of quiz.questions) {
        console.log(`Q${q.numero} ${q.fact_check.statut}${q.fact_check.note ? ` : ${q.fact_check.note}` : ""}`);
      }
      console.log(`Statut du quiz : ${quiz.statut}`);
      return quiz.statut === "fact-check-ok" ? 0 : 1;
    }
    case "rendu": {
      const quiz = lireQuiz(fichier);
      const controles = porte1(quiz, { enoncesPublies: enoncesPublies(quiz.id), exigerFactCheck: !values.brouillon });
      if (estBloque(controles)) {
        console.error(`Rendu refusé, porte 1 bloquée (ajouter --brouillon pour un essai) :\n${formaterControles(controles)}`);
        return 1;
      }
      const { rendre } = await import("./rendu.ts");
      const video = rendre(fichier, quiz.id, values.long ? "long" : "court");
      console.log(`Vidéo : ${video}`);
      const p2 = porte2(video, values.long ? CIBLE_LONG : CIBLE_COURT);
      console.log(formaterControles(p2));
      return estBloque(p2) ? 1 : 0;
    }
    case "publier": {
      if (!values.video) throw new Error("--video est obligatoire");
      const quiz = lireQuiz(fichier);
      const plateformes = values.plateformes.split(",").map((p) => p.trim()) as Plateforme[];
      const inconnues = plateformes.filter((p) => !PLATEFORMES.includes(p));
      if (inconnues.length > 0) throw new Error(`Plateformes inconnues : ${inconnues.join(", ")} (possibles : ${PLATEFORMES.join(", ")})`);
      const options: OptionsPublication = {
        plateformes,
        prive: values.prive,
        programme: values.programme,
        tentative: Number(values.tentative),
      };

      // Rien ne part sans fact-check : mêmes contrôles que pour le rendu, plus la porte 2 sur la vidéo envoyée.
      const controles = [...porte1(quiz, { enoncesPublies: enoncesPublies(quiz.id) }), ...porte2(values.video)];
      console.log(formaterControles(controles));
      if (estBloque(controles)) {
        console.error("Publication refusée : un contrôle bloquant a échoué");
        return 1;
      }
      if (quiz.statut === "publie" && !options.prive && options.tentative === 1) {
        console.error(`${quiz.id} est déjà publié (--tentative 2 pour relancer une plateforme en échec)`);
        return 1;
      }
      if (values["a-blanc"]) {
        // Aperçu de ce qui serait envoyé : aucun appel, aucune clé lue.
        for (const [nom, valeur] of champsPublication(quiz, process.env.UPLOAD_POST_USER ?? "<profil>", options)) {
          console.log(`${nom} = ${valeur}`);
        }
        return 0;
      }

      const resultat = await publier(quiz, values.video, options);
      if (resultat.statut === "programme") console.log(`Publication programmée (${resultat.id})`);
      for (const r of resultat.resultats) {
        console.log(`${r.plateforme} : ${r.ok ? "publié" : "échec"}${r.url ? ` ${r.url}` : ""}${r.message ? ` (${r.message})` : ""}`);
      }
      const reussies = resultat.statut === "programme" ? plateformes.length : resultat.resultats.filter((r) => r.ok).length;
      // Dès qu'une plateforme a publié en public, les questions comptent comme publiées (anti-doublon).
      if (!options.prive && reussies > 0) {
        quiz.statut = "publie";
        enregistrer(quiz, fichier);
      }
      return reussies === plateformes.length ? 0 : 1;
    }
    default:
      console.error("Commandes : valider, qa, generer, verifier, rendu, publier");
      return 1;
  }
}

main().then(
  (code) => process.exit(code),
  (erreur: unknown) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exit(1);
  },
);
