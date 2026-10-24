import type { Question, Quiz } from "./types.ts";

// Mélange reproductible des réponses : la graine dépend de l'id du quiz et du
// numéro de la question, donc un même fichier donne toujours la même vidéo.

function hacher(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function generateur(graine: number): () => number {
  let a = graine;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ChoixMelanges {
  choix: string[];
  indexBonne: number;
}

export function melangerChoix(quiz: Pick<Quiz, "id" | "parametres_video">, question: Question): ChoixMelanges {
  const choix = [question.bonne_reponse, ...question.distracteurs];
  if (question.type === "vrai-faux") {
    // Toujours « Vrai » puis « Faux » à l'écran, quelle que soit la bonne réponse.
    const ordre = ["Vrai", "Faux"];
    const tries = ordre.filter((o) => choix.includes(o));
    if (tries.length === 2) return { choix: tries, indexBonne: tries.indexOf(question.bonne_reponse) };
  }
  if (quiz.parametres_video?.ordre_reponses === "tel-quel") {
    return { choix, indexBonne: 0 };
  }
  const aleatoire = generateur(hacher(`${quiz.id}#${question.numero}`));
  for (let i = choix.length - 1; i > 0; i--) {
    const j = Math.floor(aleatoire() * (i + 1));
    [choix[i], choix[j]] = [choix[j], choix[i]];
  }
  return { choix, indexBonne: choix.indexOf(question.bonne_reponse) };
}
