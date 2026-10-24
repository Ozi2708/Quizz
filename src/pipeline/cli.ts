import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { lireQuiz, validerSchema } from "./schema.ts";
import { estBloque, formaterControles, porte1 } from "./porte1.ts";
import { porte2 } from "./porte2.ts";
import type { Categorie, Quiz } from "./types.ts";

// Point d'entrée en ligne de commande : npm run <commande> -- <arguments>
//   valider <fichier>                     contrôle le schéma
//   qa <fichier> [--brouillon]            porte 1 (contenu)
//   generer --sujet "..." --categorie ... [--questions 10] [--angle "..."]
//   verifier <fichier>                    fact-check par un second Claude (recherche web)
//   rendu <fichier> [--debut 1 --fin 5]   rendu court 9:16 puis porte 2

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
      debut: { type: "string", default: "1" },
      fin: { type: "string", default: "5" },
      brouillon: { type: "boolean", default: false },
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
      const { rendreCourt } = await import("./rendu.ts");
      const video = await rendreCourt(quiz, { debut: Number(values.debut), fin: Number(values.fin) });
      console.log(`Vidéo : ${video}`);
      const p2 = porte2(video);
      console.log(formaterControles(p2));
      return estBloque(p2) ? 1 : 0;
    }
    default:
      console.error("Commandes : valider, qa, generer, verifier, rendu");
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
