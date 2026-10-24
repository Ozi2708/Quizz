import { openAsBlob } from "node:fs";
import path from "node:path";
import type { Categorie, Quiz } from "./types.ts";

// Étape 6 du pipeline : publication via Upload-Post (https://docs.upload-post.com).
// Le service publie en public sur YouTube, TikTok et Instagram, ce que les API
// officielles refusent à un outil perso (audit YouTube, règles TikTok).
// Secret UPLOAD_POST_API_KEY et variable UPLOAD_POST_USER (nom du profil) lus dans l'environnement.

export const PLATEFORMES = ["youtube", "tiktok", "instagram"] as const;
export type Plateforme = (typeof PLATEFORMES)[number];

export interface OptionsPublication {
  plateformes: readonly Plateforme[];
  /** Essai : privé sur YouTube, visible par soi seul sur TikTok. Instagram n'a pas de mode privé. */
  prive?: boolean;
  /** Mise en ligne programmée, date ISO 8601 lue à l'heure de Paris. */
  programme?: string;
  /** À augmenter pour relancer après un échec : à identifiant égal, Upload-Post renvoie l'envoi déjà fait. */
  tentative?: number;
}

export interface ResultatPlateforme {
  plateforme: string;
  ok: boolean;
  message?: string;
  url?: string;
}

export interface ResultatPublication {
  id: string;
  statut: string;
  resultats: ResultatPlateforme[];
}

const API = "https://api.upload-post.com/api";

// Catégories YouTube : 27 = Éducation, 24 = Divertissement.
const EDUCATIF: Categorie[] = ["histoire", "economie", "geographie", "science", "culture-generale"];

/** Identifiant stable : relancer la même publication ne crée pas de doublon chez Upload-Post. */
export function idPublication(quiz: Quiz, options: OptionsPublication): string {
  const { prive = false, tentative = 1 } = options;
  const parties = [quiz.id, ...[...options.plateformes].sort(), prive ? "essai" : "public"];
  if (tentative > 1) parties.push(`t${tentative}`);
  return parties.join("-");
}

// YouTube limite les mots-clés à 500 caractères en tout.
function motsCles(quiz: Quiz): string[] {
  const candidats = [...(quiz.theme.tags ?? []), ...quiz.metadonnees_publication.hashtags.map((h) => h.slice(1))];
  const retenus: string[] = [];
  let longueur = 0;
  for (const mot of new Set(candidats.map((m) => m.toLowerCase()))) {
    if (longueur + mot.length + 1 > 500) break;
    retenus.push(mot);
    longueur += mot.length + 1;
  }
  return retenus;
}

// Porte 3 : chaque publication précise que le quiz n'est pas officiel.
const MENTION = "Quiz non officiel, réalisé par des fans, sans lien avec les ayants droit.";

/** Champs du formulaire envoyé à Upload-Post pour un court 9:16, sans la clé ni la vidéo. */
export function champsPublication(quiz: Quiz, profil: string, options: OptionsPublication): [string, string][] {
  const { plateformes, prive = false, programme } = options;
  if (plateformes.length === 0) throw new Error("Aucune plateforme choisie");
  if (prive && plateformes.includes("instagram")) {
    throw new Error("Instagram n'a pas de mode privé : retirer instagram pour un essai privé");
  }

  // Le titre YouTube et la description parlent du quiz entier (version longue) :
  // un court, qui n'en reprend qu'une partie, utilise le titre court.
  const m = quiz.metadonnees_publication;
  const titre = m.titre_court ?? m.titre_youtube;
  const legende = `${titre}\n\n${MENTION}\n\n${m.hashtags.join(" ")}`;
  // Une voix de synthèse réaliste doit être signalée sur YouTube comme sur TikTok.
  const voixSynthetique = String(quiz.parametres_video?.voix_off === true);

  const champs: [string, string][] = [
    ["user", profil],
    ...plateformes.map((p): [string, string] => ["platform[]", p]),
    ["title", titre],
    ["async_upload", "true"],
    ["request_id", idPublication(quiz, options)],
  ];
  if (programme) champs.push(["scheduled_date", programme], ["timezone", "Europe/Paris"]);

  if (plateformes.includes("youtube")) {
    champs.push(
      ["youtube_title", titre],
      ["youtube_description", legende],
      ["privacyStatus", prive ? "private" : "public"],
      ["selfDeclaredMadeForKids", "false"],
      ["containsSyntheticMedia", voixSynthetique],
      ["categoryId", EDUCATIF.includes(quiz.theme.categorie) ? "27" : "24"],
      ...motsCles(quiz).map((mot): [string, string] => ["tags[]", mot]),
    );
  }
  if (plateformes.includes("tiktok")) {
    champs.push(
      ["tiktok_title", legende],
      ["privacy_level", prive ? "SELF_ONLY" : "PUBLIC_TO_EVERYONE"],
      ["is_aigc", voixSynthetique],
    );
  }
  if (plateformes.includes("instagram")) {
    champs.push(["instagram_title", legende], ["media_type", "REELS"], ["share_to_feed", "true"]);
  }
  return champs;
}

interface EntreeStatut {
  platform?: string;
  success?: boolean;
  status?: string;
  message?: string;
  url?: string;
  post_url?: string;
}

interface ReponseStatut {
  status?: string;
  total?: number;
  results?: EntreeStatut[];
}

class ErreurUploadPost extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

async function appeler<T>(url: string, cle: string, init: RequestInit = {}): Promise<T> {
  const reponse = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Apikey ${cle}` } });
  const corps = (await reponse.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!reponse.ok) {
    throw new ErreurUploadPost(reponse.status, `Upload-Post ${reponse.status} : ${corps.message ?? corps.error ?? reponse.statusText}`);
  }
  return corps;
}

// Une plateforme est terminée quand son statut est final ; « retryable » sera retenté par Upload-Post.
function terminee(e: EntreeStatut): boolean {
  return e.status ? ["completed", "failed", "skipped"].includes(e.status) : e.success !== undefined;
}

function lireResultat(e: EntreeStatut): ResultatPlateforme {
  // « skipped » signifie qu'aucun compte n'est connecté pour cette plateforme.
  const ok = e.success === true && e.status !== "skipped";
  const message = e.status === "skipped" ? "compte non connecté dans Upload-Post" : e.message;
  return { plateforme: e.platform ?? "?", ok, message, url: e.url ?? e.post_url };
}

export interface Reglages {
  intervalleMs: number;
  delaiMaxMs: number;
}

/** Envoie la vidéo puis suit la publication jusqu'à son résultat sur chaque plateforme. */
export async function publier(
  quiz: Quiz,
  video: string,
  options: OptionsPublication,
  { intervalleMs, delaiMaxMs }: Reglages = { intervalleMs: 10_000, delaiMaxMs: 15 * 60_000 },
): Promise<ResultatPublication> {
  const cle = process.env.UPLOAD_POST_API_KEY;
  const profil = process.env.UPLOAD_POST_USER;
  if (!cle || !profil) {
    const manquants = [cle ? "" : "secret UPLOAD_POST_API_KEY", profil ? "" : "variable UPLOAD_POST_USER"].filter(Boolean);
    throw new Error(`Publication impossible, à ajouter dans GitHub (Settings, Secrets and variables, Actions) : ${manquants.join(", ")}`);
  }

  const id = idPublication(quiz, options);
  const formulaire = new FormData();
  for (const [nom, valeur] of champsPublication(quiz, profil, options)) formulaire.append(nom, valeur);
  formulaire.append("video", await openAsBlob(video, { type: "video/mp4" }), path.basename(video));

  const envoi = await appeler<{ job_id?: string }>(`${API}/upload`, cle, {
    method: "POST",
    headers: { "Idempotency-Key": id },
    body: formulaire,
  });
  if (envoi.job_id) return { id: envoi.job_id, statut: "programme", resultats: [] };

  const limite = Date.now() + delaiMaxMs;
  for (;;) {
    let etat: ReponseStatut = {};
    try {
      etat = await appeler<ReponseStatut>(`${API}/uploadposts/status?request_id=${encodeURIComponent(id)}`, cle);
    } catch (erreur) {
      // Juste après l'envoi, le suivi peut ne pas encore connaître l'identifiant.
      if (!(erreur instanceof ErreurUploadPost && erreur.code === 404)) throw erreur;
    }
    const resultats = etat.results ?? [];
    const toutesTerminees = resultats.length >= (etat.total ?? options.plateformes.length) && resultats.every(terminee);
    if (etat.status === "completed" || etat.status === "failed" || toutesTerminees) {
      return { id, statut: etat.status ?? "termine", resultats: resultats.map(lireResultat) };
    }
    if (Date.now() > limite) throw new Error(`Publication ${id} toujours en cours (statut ${etat.status ?? "inconnu"})`);
    await new Promise((fin) => setTimeout(fin, intervalleMs));
  }
}
