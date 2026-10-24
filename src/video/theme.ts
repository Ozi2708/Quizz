import type { LibelleDifficulte } from "../pipeline/types.ts";

// Couleurs de difficulté fixes sur toute la chaîne (storyboard long, règles visuelles).
export const COULEURS_DIFFICULTE: Record<LibelleDifficulte, string> = {
  Facile: "#2ecc71",
  Moyen: "#f1c40f",
  Difficile: "#e67e22",
  Expert: "#e74c3c",
  Impossible: "#9b59b6",
};

export interface Habillage {
  fondHaut: string;
  fondBas: string;
  carte: string;
  texte: string;
  accent: string;
  correct: string;
}

// Un habillage par pack d'univers (`parametres_video.habillage`, voir templates/rendu/doodles.js) ; « defaut » sinon.
export const HABILLAGES: Record<string, Habillage> = {
  defaut: { fondHaut: "#1b1f3b", fondBas: "#0b0d1a", carte: "#262b52", texte: "#ffffff", accent: "#ffd166", correct: "#2ecc71" },
  sorcellerie: { fondHaut: "#3a1c1c", fondBas: "#120808", carte: "#4a2626", texte: "#fff6e5", accent: "#e8b04b", correct: "#2ecc71" },
  geographie: { fondHaut: "#0f3d4c", fondBas: "#06161c", carte: "#16566a", texte: "#ffffff", accent: "#7fdbca", correct: "#2ecc71" },
};

export const POLICE = "Inter, 'Helvetica Neue', Arial, 'DejaVu Sans', sans-serif";

// Zones de sécurité communes aux trois plateformes (storyboard court).
export const ZONE = { haut: 220, bas: 480, droite: 140, gauche: 60 };
