import type { Quiz } from "../pipeline/types.ts";

// Déroulé des vidéos, recopié de build() dans templates/rendu/template.html
// (un test vérifie que les deux restent identiques). Il sert à lire la courbe de
// rétention question par question : « on perd les gens à la question 3 ».

export type FormatVideo = "court" | "long";

export interface Segment {
  scene: string;
  debut: number;
  duree: number;
  /** Rang de la question à l'écran (0 = première montrée), pour timer et reveal. */
  i?: number;
}

/** Questions montrées : toutes en long, 5 en court (une par niveau pour un quiz de 10). */
export function questionsMontrees(quiz: Quiz, format: FormatVideo): number[] {
  const nq = quiz.questions.length;
  if (format === "long") return quiz.questions.map((_, i) => i);
  return nq === 10 ? [0, 3, 5, 7, 9] : [0, 1, 2, 3, 4].map((k) => Math.round((k * (nq - 1)) / 4));
}

export function minutage(quiz: Quiz, format: FormatVideo): { segments: Segment[]; duree: number } {
  const pv = quiz.parametres_video ?? {};
  const p = format === "long" ? { timer: pv.duree_timer_s || 12, reveal: pv.duree_reponse_s || 5 } : { timer: 8, reveal: 3.5 };
  const segments: Segment[] = [];
  let t = 0;
  const push = (scene: string, duree: number, i?: number) => {
    segments.push({ scene, debut: t, duree, ...(i === undefined ? {} : { i }) });
    t += duree;
  };
  if (format === "long") {
    push("hook", 4.5);
    push("rules", 3.5);
  } else push("hook", 2.6);
  questionsMontrees(quiz, format).forEach((_, i) => {
    push("timer", p.timer, i);
    push("reveal", p.reveal, i);
    if (format === "long" && i === 4) push("relance", 3, i);
  });
  if (format === "long") {
    push("score", 6);
    push("end", 8);
  } else push("cta", 3);
  return { segments, duree: t };
}
