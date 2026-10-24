import { validerSchema } from "./schema.ts";
import { melangerChoix } from "./melange.ts";
import { LIBELLES, type Quiz } from "./types.ts";

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
