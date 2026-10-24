import { randomBytes } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import * as z from "zod/v4";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claude, MODELE, REPLI, verifierArret } from "./claude.ts";
import { validerSchema } from "./schema.ts";
import { LIBELLES, type Categorie, type Quiz } from "./types.ts";

// Étape 2 du pipeline : Claude écrit le contenu, le code ajoute les champs
// techniques (id, statut, fact_check) puis valide contre le schéma.

const ContenuQuiz = z.object({
  titre: z.string(),
  sous_sujet: z.string(),
  tags: z.array(z.string()),
  questions: z.array(
    z.object({
      difficulte: z.number().int(),
      type: z.enum(["qcm-4", "vrai-faux"]),
      enonce: z.string(),
      bonne_reponse: z.string(),
      distracteurs: z.array(z.string()),
      anecdote: z.string(),
      visuel_prompt: z.string(),
      sources: z.array(z.object({ reference: z.string(), url: z.string().optional() })),
    }),
  ),
  titre_youtube: z.string(),
  titre_court: z.string(),
  description: z.string(),
  hashtags: z.array(z.string()),
  texte_miniature: z.string(),
  question_commentaire: z.string(),
});
type ContenuQuiz = z.infer<typeof ContenuQuiz>;

const SYSTEME = `Tu écris des quiz vidéo en français pour YouTube, TikTok et Instagram. Le spectateur joue : il lit la question, réfléchit pendant le minuteur, puis voit la réponse.

Barème de difficulté (champ difficulte) :
1 Facile : n'importe qui trouve, même sans connaître le sujet en détail.
2 Moyen : quelqu'un qui connaît le sujet une fois.
3 Difficile : un vrai fan ou un passionné.
4 Expert : un fan assidu, un lecteur des sources originales.
5 Impossible : détails, coulisses, noms secondaires.

Règles impératives :
- Questions triées par difficulté croissante, en montant régulièrement de 1 à 5.
- Énoncé de 90 caractères au plus, lisible en 4 secondes. Réponses de 40 caractères au plus.
- Une seule bonne réponse possible. Aucun distracteur ne doit être aussi correct (pas « chouette » et « hibou » ensemble).
- Distracteurs plausibles, de même nature et de longueur comparable à la bonne réponse, idéalement du même univers.
- qcm-4 : exactement 3 distracteurs. vrai-faux : bonne_reponse « Vrai » ou « Faux » et l'autre comme unique distracteur.
- Signale dans l'énoncé toute ambiguïté livre/film ou VF/VO. Noms propres dans leur forme française officielle.
- Uniquement des faits que tu connais avec certitude, chacun avec au moins une source précise (œuvre, tome, épisode, ou page web). N'invente jamais d'URL : laisse url vide si tu n'es pas sûr.
- Anecdote : une phrase de 140 caractères au plus, vraie et surprenante.
- visuel_prompt : description d'une image de fond à générer, sans personnage reconnaissable, logo ni affiche officielle.
- Métadonnées : titre_youtube accrocheur de 70 caractères au plus, titre_court pour les formats verticaux, description de 2 à 4 phrases qui mentionne que le quiz est non officiel quand le sujet est une œuvre, 3 à 6 hashtags commençant par #, texte_miniature de 3 à 5 mots, question_commentaire qui invite à donner son score.`;

export interface DemandeQuiz {
  sujet: string;
  categorie: Categorie;
  nbQuestions: number;
  sousSujet?: string;
  enoncesPublies?: string[];
  consignes?: string;
}

function slug(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function assembler(demande: DemandeQuiz, contenu: ContenuQuiz, id: string): Quiz {
  return {
    id,
    version_schema: "1.0",
    langue: "fr",
    theme: {
      categorie: demande.categorie,
      sujet: demande.sujet,
      sous_sujet: contenu.sous_sujet || undefined,
      tags: contenu.tags,
    },
    titre: contenu.titre,
    format_cible: ["court-9x16", "long-16x9"],
    statut: "brouillon",
    parametres_video: { duree_timer_s: 8, duree_reponse_s: 4, ordre_reponses: "aleatoire-fixe", voix_off: false },
    questions: contenu.questions.map((q, i) => {
      const difficulte = Math.min(5, Math.max(1, q.difficulte)) as 1 | 2 | 3 | 4 | 5;
      return {
        numero: i + 1,
        difficulte,
        libelle_difficulte: LIBELLES[difficulte],
        type: q.type,
        enonce: q.enonce,
        bonne_reponse: q.bonne_reponse,
        distracteurs: q.distracteurs,
        anecdote: q.anecdote || undefined,
        media: { visuel_prompt: q.visuel_prompt },
        sources: q.sources.map((s) => (s.url ? s : { reference: s.reference })),
        fact_check: { statut: "a-verifier" },
      };
    }),
    metadonnees_publication: {
      titre_youtube: contenu.titre_youtube,
      titre_court: contenu.titre_court,
      description: contenu.description,
      hashtags: contenu.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`).replace(/\s+/g, "")),
      texte_miniature: contenu.texte_miniature,
      question_commentaire: contenu.question_commentaire,
    },
  };
}

export async function genererQuiz(demande: DemandeQuiz): Promise<Quiz> {
  const id = `${slug(demande.sujet)}-${demande.nbQuestions}q-${randomBytes(3).toString("hex")}`;
  const consigne = [
    `Écris un quiz de ${demande.nbQuestions} questions sur : ${demande.sujet}.`,
    demande.sousSujet ? `Angle : ${demande.sousSujet}.` : "",
    `Catégorie : ${demande.categorie}.`,
    demande.consignes ?? "",
    demande.enoncesPublies?.length
      ? `Ne reprends aucune de ces questions déjà publiées :\n${demande.enoncesPublies.map((e) => `- ${e}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: consigne }];

  // Deux essais : si le résultat ne passe pas le schéma, on renvoie les erreurs à Claude.
  for (let essai = 1; essai <= 2; essai++) {
    const reponse = await claude().beta.messages.parse({
      model: MODELE,
      max_tokens: 16000,
      system: SYSTEME,
      messages,
      output_config: { effort: "high", format: betaZodOutputFormat(ContenuQuiz) },
      ...REPLI,
    });
    verifierArret(reponse, "Génération");
    const contenu = reponse.parsed_output;
    if (!contenu) throw new Error("Génération : sortie illisible");

    const quiz = assembler(demande, contenu, id);
    const schema = validerSchema(quiz);
    if (schema.ok) return quiz;
    if (essai === 2) throw new Error(`Génération : schéma invalide\n${schema.erreurs.join("\n")}`);

    messages.push(
      // Réponse renvoyée telle quelle (blocs de réflexion compris) : l'historique ne doit pas être modifié.
      { role: "assistant", content: reponse.content },
      {
        role: "user",
        content: `Ce quiz ne respecte pas le format :\n${schema.erreurs.join("\n")}\nCorrige-le en gardant les mêmes sujets de questions.`,
      },
    );
  }
  throw new Error("Génération : inatteignable");
}
