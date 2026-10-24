import assert from "node:assert/strict";
import { test } from "node:test";
import { IDS_DESSINS, PACKS } from "../src/pipeline/dessins.ts";
import { assembler } from "../src/pipeline/generer.ts";
import { estBloque, porte1 } from "../src/pipeline/porte1.ts";
import { lireQuiz } from "../src/pipeline/schema.ts";
import type { Quiz } from "../src/pipeline/types.ts";

const exemple = (): Quiz => structuredClone(lireQuiz("templates/exemples/harry-potter-10q.json"));
const regle = (quiz: Quiz, debut: string) =>
  porte1(quiz, { exigerFactCheck: false }).find((c) => c.regle.startsWith(debut));

test("les dessins et les packs d'univers sont lus dans doodles.js", () => {
  assert.ok(IDS_DESSINS.includes("chateau"));
  assert.ok(PACKS.includes("sorcellerie"));
});

test("une question sans dessin bloque", () => {
  const quiz = exemple();
  delete quiz.questions[2].media?.doodle;
  assert.equal(regle(quiz, "Un dessin par question")?.ok, false);
});

test("un id hors bibliothèque ou un tracé illisible bloque", () => {
  const quiz = exemple();
  quiz.questions[0].media = { doodle: "toureiffel" };
  quiz.questions[1].media = { doodle: { traits: [["un pont sur une rivière"]] } };
  const controle = regle(quiz, "Un dessin par question");
  assert.equal(controle?.ok, false);
  assert.match(controle?.detail ?? "", /Q1 : « toureiffel » absent.*Q2 : chemin SVG illisible/);
});

test("un dessin répété bloque, qu'il vienne de la bibliothèque ou soit dessiné", () => {
  const quiz = exemple();
  quiz.questions[4].media = { doodle: "lettre" };
  quiz.questions[6].media = { doodle: { traits: [["M20 100 L180 100"]] } };
  quiz.questions[7].media = { doodle: { traits: [["M20 100 L180 100"]] } };
  assert.equal(regle(quiz, "Aucun dessin répété")?.detail, "Q5 reprend le dessin de Q2 ; Q8 reprend le dessin de Q7");
});

test("un dessin qui porte le nom de la bonne réponse est signalé sans bloquer", () => {
  const quiz = exemple();
  quiz.questions[4].media = { doodle: "houx" };
  const controle = regle(quiz, "Le dessin ne porte pas");
  assert.equal(controle?.ok, false);
  assert.equal(controle?.bloquant, false);
  assert.equal(regle(exemple(), "Le dessin ne porte pas")?.ok, true);
});

test("le générateur range chaque dessin au format du schéma", () => {
  const question = (enonce: string, dessin: { bibliotheque: string | null; traits: { chemin: string; remplissage: "paper" | null }[] }) => ({
    difficulte: 1,
    type: "vrai-faux" as const,
    enonce,
    bonne_reponse: "Vrai",
    distracteurs: ["Faux"],
    anecdote: "",
    visuel_prompt: "",
    dessin,
    sources: [{ reference: "Atlas" }],
  });
  const quiz = assembler(
    { sujet: "Capitales d'Europe", categorie: "geographie", nbQuestions: 3 },
    {
      titre: "Capitales d'Europe",
      sous_sujet: "",
      tags: ["capitales"],
      habillage: "geographie",
      questions: [
        question("Prague est traversée par la Vltava.", { bibliotheque: "pont", traits: [] }),
        question("Madrid est la capitale de l'Espagne.", {
          bibliotheque: null,
          traits: [
            { chemin: "M50 90 L150 90 L140 170 L60 170 Z", remplissage: "paper" },
            { chemin: "M40 178 L160 178", remplissage: null },
          ],
        }),
        question("Lisbonne est la capitale du Portugal.", { bibliotheque: "tram", traits: [] }),
      ],
      titre_youtube: "Capitales d'Europe",
      titre_court: "Capitales d'Europe",
      description: "Trois questions.",
      hashtags: ["#quiz"],
      texte_miniature: "Capitales",
      question_commentaire: "Ton score ?",
    },
    "capitales-d-europe-3q-test",
  );
  assert.equal(quiz.parametres_video?.habillage, "geographie");
  assert.equal(quiz.questions[0].media?.doodle, "pont");
  assert.deepEqual(quiz.questions[1].media?.doodle, {
    traits: [["M50 90 L150 90 L140 170 L60 170 Z", "paper"], ["M40 178 L160 178"]],
  });
  assert.equal(estBloque(porte1(quiz, { exigerFactCheck: false })), false);
});
