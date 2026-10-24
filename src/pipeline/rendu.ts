import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { Quiz } from "./types.ts";

// Étape 4 du pipeline : rendu d'un format court avec Remotion.

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export interface OptionsRendu {
  debut: number;
  fin: number;
  sortie?: string;
}

export async function rendreCourt(quiz: Quiz, { debut, fin, sortie }: OptionsRendu): Promise<string> {
  const fichier = sortie ?? path.join(racine, "sortie", `${quiz.id}-court-q${debut}-${fin}.mp4`);
  mkdirSync(path.dirname(fichier), { recursive: true });

  const serveUrl = await bundle({ entryPoint: path.join(racine, "src/video/index.ts") });
  const inputProps = { quiz, debut, fin };
  const browserExecutable = process.env.REMOTION_BROWSER || null;
  const composition = await selectComposition({ serveUrl, id: "QuizCourt", inputProps, browserExecutable });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: fichier,
    inputProps,
    browserExecutable,
  });
  return fichier;
}
