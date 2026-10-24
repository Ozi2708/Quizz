// Collecte des chiffres YouTube.
// - Data API v3 avec une simple clé (secret YOUTUBE_API_KEY) : vues, likes, commentaires
//   des vidéos publiques et abonnés de la chaîne. Aucun accès au compte.
// - Analytics API avec OAuth en lecture seule (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET,
//   YOUTUBE_REFRESH_TOKEN) : durée de visionnage, pourcentage vu, partages, abonnés gagnés
//   et courbe de rétention. Facultatif : sans ces secrets, on garde les chiffres publics.

const DATA = "https://www.googleapis.com/youtube/v3";
const ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports";

export interface VideoYoutube {
  id: string;
  titre: string;
  publieLe: string;
  dureeS: number;
  vues: number;
  likes: number;
  commentaires: number;
}

export interface ChaineYoutube {
  id: string;
  abonnes: number;
  vues: number;
  videos: number;
}

export interface AnalyticsVideo {
  vues: number;
  minutesVues: number;
  dureeMoyenneS: number;
  pourcentageMoyen: number;
  partages: number;
  abonnesGagnes: number;
}

/** Point de la courbe de rétention : à `ratio` de la vidéo (0,01 à 1), part des vues encore là (peut dépasser 1 avec les boucles). */
export interface PointRetention {
  ratio: number;
  part: number;
}

async function lireJson<T>(url: string, init?: RequestInit): Promise<T> {
  const reponse = await fetch(url, init);
  const corps = (await reponse.json().catch(() => ({}))) as T & { error?: { message?: string } | string; error_description?: string };
  if (!reponse.ok) {
    const e = corps.error;
    const detail = typeof e === "string" ? (corps.error_description ?? e) : (e?.message ?? reponse.statusText);
    throw new Error(`Google ${reponse.status} : ${detail}`);
  }
  return corps;
}

/** Durée ISO 8601 (PT1M5S) en secondes. */
export function dureeIso(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const [, j = "0", h = "0", min = "0", s = "0"] = m;
  return Number(j) * 86400 + Number(h) * 3600 + Number(min) * 60 + Number(s);
}

interface ReponseChaines {
  items?: { id: string; statistics: Record<string, string>; contentDetails: { relatedPlaylists: { uploads: string } } }[];
}

/** Chaîne par son identifiant (UC…) ou son pseudo (@Top4pourcent). */
export async function lireChaine(cle: string, chaine: string): Promise<ChaineYoutube & { uploads: string }> {
  const filtre = chaine.startsWith("@") ? `forHandle=${encodeURIComponent(chaine)}` : `id=${encodeURIComponent(chaine)}`;
  const r = await lireJson<ReponseChaines>(`${DATA}/channels?part=statistics,contentDetails&${filtre}&key=${cle}`);
  const c = r.items?.[0];
  if (!c) throw new Error(`Chaîne YouTube introuvable : ${chaine}`);
  return {
    id: c.id,
    abonnes: Number(c.statistics.subscriberCount ?? 0),
    vues: Number(c.statistics.viewCount ?? 0),
    videos: Number(c.statistics.videoCount ?? 0),
    uploads: c.contentDetails.relatedPlaylists.uploads,
  };
}

interface ReponsePlaylist {
  nextPageToken?: string;
  items?: { contentDetails: { videoId: string } }[];
}

interface ReponseVideos {
  items?: {
    id: string;
    snippet: { title: string; publishedAt: string };
    contentDetails: { duration: string };
    statistics: Record<string, string>;
  }[];
}

/** Toutes les vidéos publiques de la chaîne avec leurs compteurs (2 unités de quota par tranche de 50). */
export async function lireVideos(cle: string, uploads: string): Promise<VideoYoutube[]> {
  const ids: string[] = [];
  let page: string | undefined;
  do {
    const suite = page ? `&pageToken=${page}` : "";
    const r = await lireJson<ReponsePlaylist>(`${DATA}/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}${suite}&key=${cle}`);
    ids.push(...(r.items ?? []).map((x) => x.contentDetails.videoId));
    page = r.nextPageToken;
  } while (page);

  const videos: VideoYoutube[] = [];
  for (let k = 0; k < ids.length; k += 50) {
    const lot = ids.slice(k, k + 50).join(",");
    const r = await lireJson<ReponseVideos>(`${DATA}/videos?part=snippet,contentDetails,statistics&id=${lot}&key=${cle}`);
    for (const v of r.items ?? []) {
      videos.push({
        id: v.id,
        titre: v.snippet.title,
        publieLe: v.snippet.publishedAt,
        dureeS: dureeIso(v.contentDetails.duration),
        vues: Number(v.statistics.viewCount ?? 0),
        likes: Number(v.statistics.likeCount ?? 0),
        commentaires: Number(v.statistics.commentCount ?? 0),
      });
    }
  }
  return videos;
}

/** Jeton d'accès de courte durée à partir du jeton de rafraîchissement. */
export async function jetonAcces(clientId: string, secret: string, refresh: string): Promise<string> {
  const r = await lireJson<{ access_token: string }>("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }),
  });
  return r.access_token;
}

interface ReponseRapport {
  columnHeaders?: { name: string }[];
  rows?: (string | number)[][];
}

function lignes(r: ReponseRapport): Record<string, string | number>[] {
  const noms = (r.columnHeaders ?? []).map((c) => c.name);
  return (r.rows ?? []).map((ligne) => Object.fromEntries(noms.map((n, k) => [n, ligne[k]])));
}

function requete(params: Record<string, string>): string {
  return `${ANALYTICS}?${new URLSearchParams({ ids: "channel==MINE", startDate: "2026-01-01", ...params })}`;
}

/** Totaux depuis la mise en ligne, par vidéo. Les chiffres YouTube Analytics arrivent avec 1 à 3 jours de retard. */
export async function lireAnalytics(jeton: string, ids: string[], jusquau: string): Promise<Map<string, AnalyticsVideo>> {
  const resultat = new Map<string, AnalyticsVideo>();
  for (let k = 0; k < ids.length; k += 200) {
    const r = await lireJson<ReponseRapport>(
      requete({
        endDate: jusquau,
        dimensions: "video",
        metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,shares,subscribersGained",
        filters: `video==${ids.slice(k, k + 200).join(",")}`,
        sort: "-views",
        maxResults: "200",
      }),
      { headers: { Authorization: `Bearer ${jeton}` } },
    );
    for (const l of lignes(r)) {
      resultat.set(String(l.video), {
        vues: Number(l.views),
        minutesVues: Number(l.estimatedMinutesWatched),
        dureeMoyenneS: Number(l.averageViewDuration),
        pourcentageMoyen: Number(l.averageViewPercentage),
        partages: Number(l.shares),
        abonnesGagnes: Number(l.subscribersGained),
      });
    }
  }
  return resultat;
}

/** Courbe de rétention d'une vidéo (100 points). */
export async function lireRetention(jeton: string, id: string, jusquau: string): Promise<PointRetention[]> {
  const r = await lireJson<ReponseRapport>(
    requete({ endDate: jusquau, dimensions: "elapsedVideoTimeRatio", metrics: "audienceWatchRatio", filters: `video==${id}` }),
    { headers: { Authorization: `Bearer ${jeton}` } },
  );
  return lignes(r).map((l) => ({ ratio: Number(l.elapsedVideoTimeRatio), part: Number(l.audienceWatchRatio) }));
}
