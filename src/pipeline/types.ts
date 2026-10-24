// Types TypeScript du format source, alignés sur templates/quiz.schema.json.
// Le schéma JSON reste la référence : ces types servent au confort du code.

export type Categorie =
  | "film"
  | "serie"
  | "musique"
  | "jeu-video"
  | "anime"
  | "mix-pop-culture"
  | "histoire"
  | "economie"
  | "geographie"
  | "science"
  | "culture-generale";

export type StatutQuiz = "brouillon" | "fact-check-ok" | "qa-ok" | "publie" | "rejete";
export type TypeQuestion = "qcm-4" | "vrai-faux" | "image" | "son" | "intrus";
export type LibelleDifficulte = "Facile" | "Moyen" | "Difficile" | "Expert" | "Impossible";

export const LIBELLES: Record<number, LibelleDifficulte> = {
  1: "Facile",
  2: "Moyen",
  3: "Difficile",
  4: "Expert",
  5: "Impossible",
};

export interface Source {
  reference: string;
  url?: string;
}

// paper : volume blanc, acc : couleur du pack, ink : noir plein, accline : trait de couleur sans remplissage.
export const REMPLISSAGES = ["paper", "acc", "ink", "accline"] as const;
export type Remplissage = (typeof REMPLISSAGES)[number];

/** Trait d'un dessin : chemin SVG dans un carré 0-200, remplissage (aucun = trait noir seul), épaisseur (7 par défaut). */
export type Trait = [chemin: string, remplissage?: Remplissage | null, epaisseur?: number];

/** Id de templates/rendu/doodles.js, ou dessin propre à la question (templates/dessins-guide.md). */
export type Dessin = string | { traits: Trait[] };

export interface FactCheck {
  statut: "a-verifier" | "verifie" | "conteste";
  nb_sources_concordantes?: number;
  note?: string;
}

export interface Question {
  numero: number;
  difficulte: 1 | 2 | 3 | 4 | 5;
  libelle_difficulte?: LibelleDifficulte;
  type: TypeQuestion;
  enonce: string;
  bonne_reponse: string;
  distracteurs: string[];
  anecdote?: string;
  media?: { visuel_prompt?: string; extrait_audio?: string; doodle?: Dessin };
  sources: Source[];
  fact_check: FactCheck;
}

export interface Quiz {
  id: string;
  version_schema: "1.0";
  langue: "fr" | "en" | "es";
  theme: { categorie: Categorie; sujet: string; sous_sujet?: string; tags?: string[] };
  titre: string;
  format_cible: ("long-16x9" | "court-9x16")[];
  statut: StatutQuiz;
  variante_ab?: string;
  parametres_video?: {
    duree_timer_s?: number;
    duree_reponse_s?: number;
    ordre_reponses?: "aleatoire-fixe" | "tel-quel";
    /** Pack d'univers de templates/rendu/doodles.js (PACKS). */
    habillage?: string;
    musique?: string;
    voix_off?: boolean;
  };
  questions: Question[];
  metadonnees_publication: {
    titre_youtube: string;
    titre_court?: string;
    description: string;
    hashtags: string[];
    texte_miniature?: string;
    question_commentaire?: string;
  };
}
