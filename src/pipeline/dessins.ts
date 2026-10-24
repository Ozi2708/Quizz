import { readFileSync } from "node:fs";
import vm from "node:vm";

// Bibliothèque de dessins du rendu (templates/rendu/doodles.js). Le fichier est écrit
// pour le navigateur (window.DOODLES, window.PACKS) : on l'évalue à part pour en lire les ids.
const bibliotheque = { window: {} as { DOODLES?: Record<string, unknown>; PACKS?: Record<string, unknown> } };
vm.runInNewContext(readFileSync(new URL("../../templates/rendu/doodles.js", import.meta.url), "utf8"), bibliotheque);

/** Dessins prêts à l'emploi, utilisables tels quels dans media.doodle. */
export const IDS_DESSINS = Object.keys(bibliotheque.window.DOODLES ?? {});

/** Packs d'univers, utilisables dans parametres_video.habillage. */
export const PACKS = Object.keys(bibliotheque.window.PACKS ?? {});
