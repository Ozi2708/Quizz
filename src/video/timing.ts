// Découpage temporel du format court (templates/storyboard-court-9x16.md, variante « Rapide »).
// Partagé entre la composition Remotion et les contrôles de la porte 2.

export const FPS = 30;
export const LARGEUR_COURT = 1080;
export const HAUTEUR_COURT = 1920;

export const DUREES_COURT = {
  accroche: 1.5,
  timer: 4,
  revelation: 2,
  bonusDerniere: 1,
  appel: 2,
};

export interface Segment {
  numero: number;
  debut: number; // en images
  timer: number;
  revelation: number;
}

export interface PlanCourt {
  accroche: number;
  segments: Segment[];
  appelDebut: number;
  total: number;
}

const s = (secondes: number) => Math.round(secondes * FPS);

export function planCourt(numeros: number[]): PlanCourt {
  const accroche = s(DUREES_COURT.accroche);
  let curseur = accroche;
  const segments = numeros.map((numero, i) => {
    const derniere = i === numeros.length - 1;
    const timer = s(DUREES_COURT.timer + (derniere ? DUREES_COURT.bonusDerniere : 0));
    const revelation = s(DUREES_COURT.revelation);
    const segment = { numero, debut: curseur, timer, revelation };
    curseur += timer + revelation;
    return segment;
  });
  return { accroche, segments, appelDebut: curseur, total: curseur + s(DUREES_COURT.appel) };
}
