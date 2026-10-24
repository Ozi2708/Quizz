import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Étape 4 du pipeline : rendu vidéo avec le gabarit animé de templates/rendu/.
// render.js ouvre template.html dans Chromium (Playwright), capture chaque image,
// assemble avec ffmpeg et ajoute la bande son d'audio.py (Python + numpy).

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** court : 9:16, 5 questions (une par niveau pour 10) ; long : 16:9, toutes les questions. */
export type Format = "court" | "long";

export function rendre(fichierQuiz: string, id: string, format: Format, sortie?: string): string {
  const fichier = path.resolve(sortie ?? path.join(racine, "sortie", `${id}-${format}.mp4`));
  mkdirSync(path.dirname(fichier), { recursive: true });
  execFileSync(
    process.execPath,
    [path.join(racine, "templates/rendu/render.js"), path.resolve(fichierQuiz), format === "court" ? "short" : "long", fichier],
    { stdio: "inherit" },
  );
  return fichier;
}
