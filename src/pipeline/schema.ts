import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import type { Quiz } from "./types.ts";

const schema = JSON.parse(
  readFileSync(new URL("../../templates/quiz.schema.json", import.meta.url), "utf8"),
);

// ajv-formats est publié en CommonJS : selon le chargeur, la fonction est sur .default.
const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ??
  addFormatsModule) as unknown as (ajv: Ajv2020) => Ajv2020;

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const valider = ajv.compile<Quiz>(schema);

export interface ResultatSchema {
  ok: boolean;
  erreurs: string[];
}

export function validerSchema(donnees: unknown): ResultatSchema {
  const ok = valider(donnees);
  const erreurs = (valider.errors ?? []).map(
    (e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim(),
  );
  return { ok: Boolean(ok), erreurs };
}

export function lireQuiz(chemin: string): Quiz {
  return JSON.parse(readFileSync(chemin, "utf8")) as Quiz;
}
