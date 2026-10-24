import { IDS_DESSINS } from "./dessins.ts";
import { validerSchema } from "./schema.ts";
import { melangerChoix } from "./melange.ts";
import { LIBELLES, PART_DES_FANS, type Quiz } from "./types.ts";

// Porte 1 (contenu, avant rendu) : les règles automatisables de
// templates/standards-qualite.md. Les règles de jugement (ambiguïté, qualité
// des distracteurs) sont couvertes par la vérification Claude (verifier.ts).

export interface Controle {
  regle: string;
  bloquant: boolean;
  ok: boolean;
  detail?: string;
}

export interface OptionsPorte1 {
  /** Énoncés déjà publiés sur la chaîne, pour détecter les doublons. */
  enoncesPublies?: string[];
  /** false pour contrôler un brouillon avant fact-check. */
  exigerFactCheck?: boolean;
}

export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Commandes de chemin SVG et nombres : de quoi écarter un texte glissé à la place d'un tracé.
const CHEMIN_SVG = /^\s*[Mm][\sMmLlHhVvCcSsQqTtAaZz\d.,eE+-]*$/;

export function porte1(quiz: Quiz, options: OptionsPorte1 = {}): Controle[] {
  const { enoncesPublies = [], exigerFactCheck = true } = options;
  const controles: Controle[] = [];
  const ajouter = (regle: string, bloquant: boolean, fautes: string[]) =>
    controles.push({ regle, bloquant, ok: fautes.length === 0, detail: fautes.join(" ; ") || undefined });

  const schema = validerSchema(quiz);
  ajouter("Fichier valide contre quiz.schema.json", true, schema.erreurs);
  if (!schema.ok) return controles;

  const qs = quiz.questions;

  ajouter(
    "Numéros de questions consécutifs à partir de 1",
    true,
    qs.flatMap((q, i) => (q.numero === i + 1 ? [] : [`position ${i + 1} : numéro ${q.numero}`])),
  );

  ajouter(
    "Difficultés croissantes ou égales",
    true,
    qs.slice(1).flatMap((q, i) =>
      q.difficulte < qs[i].difficulte ? [`Q${q.numero} (${q.difficulte}) après Q${qs[i].numero} (${qs[i].difficulte})`] : [],
    ),
  );

  // La part s'affiche à l'écran : elle ne doit pas contredire le badge de difficulté.
  ajouter(
    "La part estimée des fans qui trouvent tient dans le palier du niveau",
    true,
    qs.flatMap((q) => {
      const [min, max] = PART_DES_FANS[q.difficulte];
      return q.part_estimee === undefined || (q.part_estimee >= min && q.part_estimee <= max)
        ? []
        : [`Q${q.numero} (${LIBELLES[q.difficulte]}) : ${q.part_estimee} % annoncés, palier de ${min} à ${max} %`];
    }),
  );

  ajouter(
    "Nombre de distracteurs adapté au type",
    true,
    qs.flatMap((q) => {
      const attendu = q.type === "vrai-faux" ? 1 : q.type === "qcm-4" ? 3 : null;
      return attendu !== null && q.distracteurs.length !== attendu
        ? [`Q${q.numero} : ${q.distracteurs.length} au lieu de ${attendu}`]
        : [];
    }),
  );

  ajouter(
    "La bonne réponse n'apparaît pas parmi les distracteurs",
    true,
    qs.flatMap((q) =>
      q.distracteurs.some((d) => normaliser(d) === normaliser(q.bonne_reponse)) ? [`Q${q.numero}`] : [],
    ),
  );

  if (exigerFactCheck) {
    ajouter(
      "Fact-check vérifié sur chaque question",
      true,
      qs.flatMap((q) => (q.fact_check.statut === "verifie" ? [] : [`Q${q.numero} : ${q.fact_check.statut}`])),
    );
  }

  const publies = new Set(enoncesPublies.map(normaliser));
  const vus = new Set<string>();
  ajouter(
    "Aucun doublon (dans le quiz et avec les quiz publiés)",
    true,
    qs.flatMap((q) => {
      const n = normaliser(q.enonce);
      const faute = publies.has(n) ? [`Q${q.numero} déjà publiée`] : vus.has(n) ? [`Q${q.numero} en double`] : [];
      vus.add(n);
      return faute;
    }),
  );

  // Dessins : templates/dessins-guide.md. Le lien avec l'énoncé et l'absence de spoiler restent à l'œil,
  // sauf le cas flagrant d'un dessin de la bibliothèque qui porte le nom de la bonne réponse.
  ajouter(
    "Un dessin par question, de la bibliothèque ou propre à la question",
    true,
    qs.flatMap((q) => {
      const dessin = q.media?.doodle;
      if (dessin === undefined) return [`Q${q.numero} : aucun dessin`];
      if (typeof dessin === "string") {
        return IDS_DESSINS.includes(dessin) ? [] : [`Q${q.numero} : « ${dessin} » absent de templates/rendu/doodles.js`];
      }
      return dessin.traits.some(([chemin]) => !CHEMIN_SVG.test(chemin)) ? [`Q${q.numero} : chemin SVG illisible`] : [];
    }),
  );

  const dessins = new Map<string, number>();
  ajouter(
    "Aucun dessin répété dans le quiz",
    true,
    qs.flatMap((q) => {
      const dessin = q.media?.doodle;
      if (dessin === undefined) return [];
      const cle = typeof dessin === "string" ? dessin : JSON.stringify(dessin.traits);
      const premier = dessins.get(cle);
      if (premier === undefined) dessins.set(cle, q.numero);
      return premier === undefined ? [] : [`Q${q.numero} reprend le dessin de Q${premier}`];
    }),
  );

  // Pluriel ignoré : « boites » pour « Des boîtes », « cerf » pour « Un cerf ».
  const singulier = (mot: string) => mot.replace(/[sx]$/, "");
  ajouter(
    "Le dessin ne porte pas le nom de la bonne réponse",
    false,
    qs.flatMap((q) => {
      const dessin = q.media?.doodle;
      if (typeof dessin !== "string") return [];
      const mots = normaliser(q.bonne_reponse).split(" ").map(singulier);
      return mots.includes(singulier(dessin)) ? [`Q${q.numero} : « ${dessin} » pour « ${q.bonne_reponse} »`] : [];
    }),
  );

  ajouter(
    "Libellé de difficulté cohérent avec le niveau",
    false,
    qs.flatMap((q) =>
      q.libelle_difficulte && q.libelle_difficulte !== LIBELLES[q.difficulte]
        ? [`Q${q.numero} : ${q.libelle_difficulte} pour le niveau ${q.difficulte}`]
        : [],
    ),
  );

  const qcm = qs.filter((q) => q.type === "qcm-4");
  if (qcm.length >= 4) {
    const positions = [0, 0, 0, 0];
    for (const q of qcm) positions[melangerChoix(quiz, q).indexBonne]++;
    const max = Math.max(...positions);
    ajouter(
      "Bonne réponse répartie entre A, B, C et D",
      false,
      max > Math.ceil(qcm.length / 2) ? [`répartition A/B/C/D = ${positions.join("/")}`] : [],
    );
  }

  ajouter(
    "Métadonnées : titre court et question d'engagement renseignés",
    false,
    [
      ...(quiz.metadonnees_publication.titre_court ? [] : ["titre_court manquant"]),
      ...(quiz.metadonnees_publication.question_commentaire ? [] : ["question_commentaire manquante"]),
    ],
  );

  return controles;
}

export function estBloque(controles: Controle[]): boolean {
  return controles.some((c) => c.bloquant && !c.ok);
}

export function formaterControles(controles: Controle[]): string {
  return controles
    .map((c) => `${c.ok ? "OK  " : c.bloquant ? "KO  " : "WARN"} ${c.regle}${c.detail ? `\n       ${c.detail}` : ""}`)
    .join("\n");
}
