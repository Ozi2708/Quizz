import type Anthropic from "@anthropic-ai/sdk";
import { claude, MODELE, REPLI, verifierArret } from "./claude.ts";
import { melangerChoix } from "./melange.ts";
import { normaliser } from "./porte1.ts";
import type { Quiz, Source } from "./types.ts";

// Étape 3 du pipeline : un second Claude répond aux questions sans connaître la
// bonne réponse, en cherchant sur le web. Toute divergence rend la question « contestée ».

const LETTRES = ["A", "B", "C", "D"];

const SYSTEME = `Tu vérifies un quiz avant publication. Pour chaque question, choisis la réponse correcte parmi les choix proposés. Fais des recherches web pour confirmer chaque réponse avec au moins une source fiable et indépendante (encyclopédie, site officiel, presse), même quand tu crois la connaître.

Signale toute ambiguïté : plusieurs choix défendables, différence livre/film ou VF/VO, fait contesté ou daté.

Termine ta réponse par un unique bloc \`\`\`json contenant un tableau, un objet par question :
{"numero": 1, "choix": "texte exact du choix retenu", "certitude": "certaine" | "probable" | "incertaine", "sources": [{"reference": "nom de la page", "url": "https://..."}], "ambiguite": "explication ou null"}`;

interface Verdict {
  numero: number;
  choix: string;
  certitude: "certaine" | "probable" | "incertaine";
  sources: Source[];
  ambiguite: string | null;
}

function extraireJson(contenu: Anthropic.Beta.Messages.BetaContentBlock[]): Verdict[] {
  const texte = contenu
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const blocs = [...texte.matchAll(/```json\s*([\s\S]*?)```/g)];
  const dernier = blocs.at(-1)?.[1];
  if (!dernier) throw new Error("Vérification : aucun bloc JSON dans la réponse");
  const verdicts = JSON.parse(dernier) as Verdict[];
  if (!Array.isArray(verdicts)) throw new Error("Vérification : le JSON n'est pas un tableau");
  return verdicts;
}

export function appliquerVerdicts(quiz: Quiz, verdicts: Verdict[]): Quiz {
  const questions = quiz.questions.map((q) => {
    const v = verdicts.find((x) => x.numero === q.numero);
    if (!v) return { ...q, fact_check: { statut: "conteste" as const, note: "Question non traitée par la vérification" } };

    const urlsConnues = new Set(q.sources.map((s) => s.url).filter(Boolean));
    const nouvelles = (v.sources ?? []).filter((s) => s.url && !urlsConnues.has(s.url));
    const sources = [...q.sources, ...nouvelles.map((s) => ({ reference: s.reference, url: s.url }))];
    const concordantes = 1 + nouvelles.length; // l'auteur + chaque source web indépendante

    const fautes: string[] = [];
    if (normaliser(v.choix) !== normaliser(q.bonne_reponse)) fautes.push(`le vérificateur répond « ${v.choix} »`);
    if (v.certitude === "incertaine") fautes.push("certitude insuffisante");
    if (v.ambiguite) fautes.push(`ambiguïté : ${v.ambiguite}`);
    if (concordantes < 2) fautes.push("moins de 2 sources concordantes");

    return {
      ...q,
      sources,
      fact_check: {
        statut: fautes.length ? ("conteste" as const) : ("verifie" as const),
        nb_sources_concordantes: concordantes,
        ...(fautes.length ? { note: fautes.join(" ; ") } : {}),
      },
    };
  });
  const toutVerifie = questions.every((q) => q.fact_check.statut === "verifie");
  return { ...quiz, questions, statut: toutVerifie ? "fact-check-ok" : quiz.statut };
}

export async function verifierQuiz(quiz: Quiz): Promise<Quiz> {
  const enonces = quiz.questions
    .map((q) => {
      const { choix } = melangerChoix(quiz, q);
      return `Question ${q.numero} : ${q.enonce}\n${choix.map((c, i) => `  ${LETTRES[i]}. ${c}`).join("\n")}`;
    })
    .join("\n\n");

  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [
    { role: "user", content: `Sujet du quiz : ${quiz.theme.sujet}\n\n${enonces}` },
  ];

  let reponse: Anthropic.Beta.Messages.BetaMessage | undefined;
  // La recherche web peut mettre le tour en pause : on relance jusqu'à la fin.
  for (let tour = 0; tour < 6; tour++) {
    reponse = await claude().beta.messages.create({
      model: MODELE,
      max_tokens: 16000,
      system: SYSTEME,
      messages,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: quiz.questions.length * 2 }],
      output_config: { effort: "high" },
      ...REPLI,
    });
    if (reponse.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: reponse.content });
  }
  if (!reponse) throw new Error("Vérification : aucune réponse");
  verifierArret(reponse, "Vérification");
  if (reponse.stop_reason === "pause_turn") throw new Error("Vérification : trop de recherches, réessayer");

  return appliquerVerdicts(quiz, extraireJson(reponse.content));
}
