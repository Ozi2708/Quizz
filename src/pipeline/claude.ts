import Anthropic from "@anthropic-ai/sdk";

// Client partagé, créé au premier appel. La clé est lue dans ANTHROPIC_API_KEY (jamais dans le code).
let instance: Anthropic | undefined;
export function claude(): Anthropic {
  instance ??= new Anthropic();
  return instance;
}

export const MODELE = process.env.QUIZZ_MODELE ?? "claude-opus-5-5";

// Si le modèle refuse une requête, l'API la rejoue sur un modèle de repli
// choisi selon la catégorie du refus (paramètre `fallbacks: "default"`).
export const REPLI: { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: "default" } = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

export function verifierArret(reponse: { stop_reason: string | null }, etape: string): void {
  if (reponse.stop_reason === "refusal") throw new Error(`${etape} : requête refusée par le modèle`);
  if (reponse.stop_reason === "max_tokens") throw new Error(`${etape} : réponse tronquée (max_tokens)`);
}
