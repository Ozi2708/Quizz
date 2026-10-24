import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Quiz } from "../pipeline/types.ts";
import { minutage, type FormatVideo } from "./minutage.ts";
import type { AnalyticsVideo, ChaineYoutube, PointRetention, VideoYoutube } from "./youtube.ts";

// Relevés quotidiens des chiffres, une ligne JSON par vidéo et par jour dans stats/releves.jsonl.
// On garde chaque jour (pas seulement le dernier) pour suivre la courbe J+1, J+7, J+30.

export interface ReleveVideo {
  type: "video";
  date: string;
  plateforme: "youtube" | "tiktok";
  video: string;
  url: string;
  quiz?: string;
  titre: string;
  format: FormatVideo;
  publie_le: string;
  duree_s?: number;
  vues: number;
  likes: number;
  commentaires: number;
  partages?: number;
  minutes_vues?: number;
  duree_moyenne_s?: number;
  pourcentage_moyen?: number;
  abonnes_gagnes?: number;
  /** TikTok : part des vues allées jusqu'au bout (%). */
  vus_en_entier_pct?: number;
  /** Part des spectateurs encore là à la fin de l'accroche (1 = tous). */
  retention_accroche?: number;
  /** Part des spectateurs encore là à la fin de chaque question montrée. */
  retention_questions?: number[];
}

export interface ReleveChaine {
  type: "chaine";
  date: string;
  plateforme: "youtube";
  chaine: string;
  abonnes: number;
  vues: number;
  videos: number;
}

export type Releve = ReleveVideo | ReleveChaine;

export const FICHIER_RELEVES = "stats/releves.jsonl";
export const FICHIER_CORRESPONDANCES = "stats/videos.json";
export const FICHIER_TIKTOK = "stats/tiktok.csv";

/** Au-delà de 3 minutes, YouTube ne compte plus la vidéo comme un Short. */
export const DUREE_MAX_COURT_S = 180;

export function lireReleves(fichier = FICHIER_RELEVES): Releve[] {
  if (!existsSync(fichier)) return [];
  return readFileSync(fichier, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Releve);
}

/** Ajoute les relevés du jour en remplaçant ceux déjà pris le même jour (relance du workflow). */
export function fusionnerReleves(anciens: Releve[], nouveaux: Releve[]): Releve[] {
  const cle = (r: Releve) => `${r.date}|${r.plateforme}|${r.type === "video" ? r.video : r.chaine}`;
  const remplaces = new Set(nouveaux.map(cle));
  return [...anciens.filter((r) => !remplaces.has(cle(r))), ...nouveaux];
}

export function ecrireReleves(releves: Releve[], fichier = FICHIER_RELEVES): void {
  writeFileSync(fichier, releves.map((r) => `${JSON.stringify(r)}\n`).join(""));
}

/** Correspondances manuelles « identifiant de vidéo → id du quiz », quand le titre ne suffit pas. */
export function lireCorrespondances(fichier = FICHIER_CORRESPONDANCES): Record<string, string> {
  return existsSync(fichier) ? (JSON.parse(readFileSync(fichier, "utf8")) as Record<string, string>) : {};
}

// Comparaison de titres sans casse, accents, émojis ni ponctuation.
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Quiz d'une vidéo : correspondance manuelle, sinon titre identique au titre court ou YouTube du quiz. */
export function rattacher(video: string, titre: string, quizzes: Quiz[], correspondances: Record<string, string>): Quiz | undefined {
  const manuel = correspondances[video];
  if (manuel) return quizzes.find((q) => q.id === manuel);
  const t = normaliser(titre);
  return quizzes.find((q) => {
    const m = q.metadonnees_publication;
    return [m.titre_court, m.titre_youtube].some((x) => x && normaliser(x) === t);
  });
}

/** Valeur de la courbe à un instant donné (interpolation linéaire entre les points). */
export function partA(courbe: PointRetention[], ratio: number): number | undefined {
  if (courbe.length === 0) return undefined;
  const points = [...courbe].sort((a, b) => a.ratio - b.ratio);
  if (ratio <= points[0].ratio) return points[0].part;
  for (let k = 1; k < points.length; k++) {
    const [a, b] = [points[k - 1], points[k]];
    if (ratio <= b.ratio) return a.part + ((b.part - a.part) * (ratio - a.ratio)) / (b.ratio - a.ratio);
  }
  return points[points.length - 1].part;
}

/** Part des spectateurs restants après l'accroche et à la fin de chaque question (après la révélation), d'après le déroulé du gabarit. */
export function retentionParQuestion(
  quiz: Quiz,
  format: FormatVideo,
  courbe: PointRetention[],
): { accroche: number; questions: number[] } | undefined {
  if (courbe.length === 0) return undefined;
  const { segments, duree } = minutage(quiz, format);
  const lire = (instant: number) => Math.round((partA(courbe, instant / duree) ?? 0) * 1000) / 1000;
  const premiere = segments.find((s) => s.scene === "timer");
  return {
    accroche: lire(premiere?.debut ?? 0),
    questions: segments.filter((s) => s.scene === "reveal").map((s) => lire(s.debut + s.duree)),
  };
}

export interface DonneesYoutube {
  date: string;
  chaine: ChaineYoutube;
  videos: VideoYoutube[];
  analytics?: Map<string, AnalyticsVideo>;
  retentions?: Map<string, PointRetention[]>;
}

export function relevesYoutube(d: DonneesYoutube, quizzes: Quiz[], correspondances: Record<string, string>): Releve[] {
  const releves: Releve[] = [
    { type: "chaine", date: d.date, plateforme: "youtube", chaine: d.chaine.id, abonnes: d.chaine.abonnes, vues: d.chaine.vues, videos: d.chaine.videos },
  ];
  for (const v of d.videos) {
    const quiz = rattacher(v.id, v.titre, quizzes, correspondances);
    const format: FormatVideo = v.dureeS <= DUREE_MAX_COURT_S ? "court" : "long";
    const a = d.analytics?.get(v.id);
    const courbe = d.retentions?.get(v.id) ?? [];
    const releve: ReleveVideo = {
      type: "video",
      date: d.date,
      plateforme: "youtube",
      video: v.id,
      url: format === "court" ? `https://youtube.com/shorts/${v.id}` : `https://youtu.be/${v.id}`,
      ...(quiz ? { quiz: quiz.id } : {}),
      titre: v.titre,
      format,
      publie_le: v.publieLe,
      duree_s: v.dureeS,
      vues: v.vues,
      likes: v.likes,
      commentaires: v.commentaires,
    };
    if (a) {
      Object.assign(releve, {
        partages: a.partages,
        minutes_vues: a.minutesVues,
        duree_moyenne_s: a.dureeMoyenneS,
        pourcentage_moyen: a.pourcentageMoyen,
        abonnes_gagnes: a.abonnesGagnes,
      });
    }
    const retention = quiz ? retentionParQuestion(quiz, format, courbe) : undefined;
    if (retention) {
      releve.retention_accroche = retention.accroche;
      releve.retention_questions = retention.questions;
    }
    releves.push(releve);
  }
  return releves;
}

// TikTok n'ouvre pas ses statistiques à un outil perso : Val recopie les chiffres de TikTok Studio
// dans stats/tiktok.csv (une ligne par vidéo et par relevé, en-tête obligatoire) :
// date,quiz,url,publie_le,vues,likes,commentaires,partages,duree_moyenne_s,vus_en_entier_pct
export function relevesTiktok(csv: string): ReleveVideo[] {
  const [entete, ...lignes] = csv.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
  if (!entete) return [];
  const colonnes = entete.split(",").map((c) => c.trim());
  return lignes.map((ligne) => {
    const v = Object.fromEntries(ligne.split(",").map((x, k) => [colonnes[k], x.trim()]));
    const nombre = (nom: string) => (v[nom] ? Number(v[nom].replace(/\s/g, "")) : undefined);
    const releve: ReleveVideo = {
      type: "video",
      date: v.date,
      plateforme: "tiktok",
      video: v.url.split("/").filter(Boolean).pop() ?? v.url,
      url: v.url,
      ...(v.quiz ? { quiz: v.quiz } : {}),
      titre: v.quiz ?? v.url,
      format: "court",
      publie_le: v.publie_le ?? v.date,
      vues: nombre("vues") ?? 0,
      likes: nombre("likes") ?? 0,
      commentaires: nombre("commentaires") ?? 0,
    };
    const partages = nombre("partages");
    const duree = nombre("duree_moyenne_s");
    const entier = nombre("vus_en_entier_pct");
    if (partages !== undefined) releve.partages = partages;
    if (duree !== undefined) releve.duree_moyenne_s = duree;
    if (entier !== undefined) releve.vus_en_entier_pct = entier;
    return releve;
  });
}
