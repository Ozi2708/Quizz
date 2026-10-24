import type { Question } from "./types.ts";

// Ordre des réponses à l'écran, recopié de choices() dans templates/rendu/template.html
// (un test vérifie que les deux restent identiques) : « Vrai » puis « Faux » pour un vrai-faux,
// sinon la bonne réponse tourne sur C, B, A, D selon le numéro de la question et les
// distracteurs gardent leur ordre. Le rendu ne lit pas parametres_video.ordre_reponses.

export interface ChoixMelanges {
  choix: string[];
  indexBonne: number;
}

export function melangerChoix(question: Question): ChoixMelanges {
  if (question.type === "vrai-faux") {
    const choix = ["Vrai", "Faux"];
    return { choix, indexBonne: Math.max(0, choix.indexOf(question.bonne_reponse)) };
  }
  const indexBonne = (question.numero * 7 + 3) % 4;
  const distracteurs = [...question.distracteurs];
  const choix = [0, 1, 2, 3].map((i) => (i === indexBonne ? question.bonne_reponse : (distracteurs.shift() ?? "")));
  return { choix, indexBonne };
}
