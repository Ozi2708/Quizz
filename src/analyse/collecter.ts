import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { lireQuiz } from "../pipeline/schema.ts";
import type { Quiz } from "../pipeline/types.ts";
import { rapport } from "./rapport.ts";
import {
  ecrireReleves,
  FICHIER_RELEVES,
  FICHIER_TIKTOK,
  fusionnerReleves,
  lireCorrespondances,
  lireReleves,
  relevesTiktok,
  relevesYoutube,
  type Releve,
} from "./releves.ts";
import { jetonAcces, lireAnalytics, lireChaine, lireRetention, lireVideos, type PointRetention } from "./youtube.ts";

export const FICHIER_RAPPORT = "stats/RAPPORT.md";

export function lireQuizzes(dossier = "quizzes"): Quiz[] {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier)
    .filter((f) => f.endsWith(".json"))
    .map((f) => lireQuiz(path.join(dossier, f)));
}

/** Relevé du jour : YouTube (si la clé est là) et les lignes TikTok saisies à la main. */
export async function collecter(date: string): Promise<{ releves: Releve[]; messages: string[] }> {
  const messages: string[] = [];
  const quizzes = lireQuizzes();
  const nouveaux: Releve[] = [];

  const cle = process.env.YOUTUBE_API_KEY;
  if (!cle) messages.push("YouTube ignoré : secret YOUTUBE_API_KEY absent (voir stats/README.md).");
  else {
    const { uploads, ...chaine } = await lireChaine(cle, process.env.YOUTUBE_CHAINE || "@Top4pourcent");
    const videos = await lireVideos(cle, uploads);
    let analytics;
    const retentions = new Map<string, PointRetention[]>();
    const { YOUTUBE_CLIENT_ID: id, YOUTUBE_CLIENT_SECRET: secret, YOUTUBE_REFRESH_TOKEN: refresh } = process.env;
    if (id && secret && refresh) {
      // Un souci d'OAuth (jeton expiré…) ne doit pas faire perdre les chiffres publics du jour.
      try {
        const jeton = await jetonAcces(id, secret, refresh);
        analytics = await lireAnalytics(jeton, videos.map((v) => v.id), date);
        for (const v of videos) retentions.set(v.id, await lireRetention(jeton, v.id, date));
      } catch (erreur) {
        messages.push(`YouTube Analytics indisponible, chiffres publics seulement : ${erreur instanceof Error ? erreur.message : erreur}`);
      }
    } else messages.push("Rétention et partages ignorés : secrets OAuth YouTube absents (voir stats/README.md).");
    nouveaux.push(...relevesYoutube({ date, chaine, videos, analytics, retentions }, quizzes, lireCorrespondances()));
    messages.push(`YouTube : ${videos.length} vidéo(s) publique(s), ${chaine.abonnes} abonné(s).`);
  }

  if (existsSync(FICHIER_TIKTOK)) {
    const tiktok = relevesTiktok(readFileSync(FICHIER_TIKTOK, "utf8"));
    nouveaux.push(...tiktok);
    if (tiktok.length > 0) messages.push(`TikTok : ${tiktok.length} ligne(s) reprise(s) de ${FICHIER_TIKTOK}.`);
  }

  const releves = fusionnerReleves(lireReleves(), nouveaux);
  ecrireReleves(releves, FICHIER_RELEVES);
  return { releves, messages };
}

export function ecrireRapport(date: string, releves = lireReleves()): string {
  const texte = rapport(releves, lireQuizzes(), date);
  writeFileSync(FICHIER_RAPPORT, texte);
  return texte;
}
