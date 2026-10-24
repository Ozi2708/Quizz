import { execFileSync } from "node:child_process";
import type { Controle } from "./porte1.ts";

// Porte 2 (vidéo, après rendu) : contrôles techniques automatisables via ffprobe.
// La lecture des images clés par Claude (vision) viendra s'ajouter ici.

interface Flux {
  codec_type: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
}

export interface CibleVideo {
  largeur: number;
  hauteur: number;
  fps: number;
  dureeMaxS: number;
}

// Shorts, TikTok et Reels acceptent plus long : on garde de la marge pour le temps de réflexion (storyboard court).
export const CIBLE_COURT: CibleVideo = { largeur: 1080, hauteur: 1920, fps: 30, dureeMaxS: 90 };
export const CIBLE_LONG: CibleVideo = { largeur: 1920, hauteur: 1080, fps: 30, dureeMaxS: 20 * 60 };

export function sonder(fichier: string): { flux: Flux[]; duree: number } {
  const brut = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "stream=codec_type,width,height,avg_frame_rate:format=duration", "-of", "json", fichier],
    { encoding: "utf8" },
  );
  const json = JSON.parse(brut) as { streams: Flux[]; format: { duration: string } };
  return { flux: json.streams, duree: Number(json.format.duration) };
}

export function porte2(fichier: string, cible: CibleVideo = CIBLE_COURT): Controle[] {
  const { flux, duree } = sonder(fichier);
  const video = flux.find((f) => f.codec_type === "video");
  const audio = flux.find((f) => f.codec_type === "audio");
  const [num, den] = (video?.avg_frame_rate ?? "0/1").split("/").map(Number);
  const fps = den ? num / den : 0;

  return [
    {
      regle: `Résolution ${cible.largeur}×${cible.hauteur}`,
      bloquant: true,
      ok: video?.width === cible.largeur && video?.height === cible.hauteur,
      detail: video ? `${video.width}×${video.height}` : "aucun flux vidéo",
    },
    { regle: `${cible.fps} images par seconde`, bloquant: true, ok: Math.abs(fps - cible.fps) < 0.01, detail: `${fps.toFixed(2)} i/s` },
    { regle: `Durée sous ${cible.dureeMaxS} s`, bloquant: true, ok: duree > 0 && duree < cible.dureeMaxS, detail: `${duree.toFixed(1)} s` },
    {
      regle: "Piste audio présente",
      bloquant: false,
      ok: Boolean(audio),
      detail: audio ? undefined : "aucune piste son (audio.py n'a pas tourné)",
    },
  ];
}
