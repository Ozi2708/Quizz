import assert from "node:assert/strict";
import { test } from "node:test";
import { fautesDifficulte } from "../src/pipeline/generer.ts";
import { lireQuiz } from "../src/pipeline/schema.ts";
import { melangerChoix } from "../src/pipeline/melange.ts";
import { estBloque, porte1 } from "../src/pipeline/porte1.ts";
import { appliquerVerdicts } from "../src/pipeline/verifier.ts";
import { planCourt } from "../src/video/timing.ts";
import type { Quiz } from "../src/pipeline/types.ts";

const exemple = (): Quiz => structuredClone(lireQuiz("templates/exemples/harry-potter-10q.json"));
const regle = (quiz: Quiz, debut: string, options = {}) =>
  porte1(quiz, options).find((c) => c.regle.startsWith(debut));

test("l'exemple passe la porte 1 en mode brouillon", () => {
  assert.equal(estBloque(porte1(exemple(), { exigerFactCheck: false })), false);
});

test("un quiz non vérifié est bloqué avant rendu", () => {
  assert.equal(regle(exemple(), "Fact-check")?.ok, false);
});

test("une difficulté qui redescend bloque", () => {
  const quiz = exemple();
  quiz.questions[3].difficulte = 1;
  assert.equal(regle(quiz, "Difficultés croissantes")?.ok, false);
});

test("une question déjà publiée est détectée, accents et ponctuation ignorés", () => {
  const quiz = exemple();
  const publie = quiz.questions[0].enonce.toUpperCase().replace("?", "").replace("é", "e");
  assert.equal(regle(quiz, "Aucun doublon", { enoncesPublies: [publie] })?.ok, false);
});

test("la bonne réponse parmi les distracteurs bloque", () => {
  const quiz = exemple();
  quiz.questions[0].distracteurs[0] = quiz.questions[0].bonne_reponse;
  assert.equal(regle(quiz, "La bonne réponse")?.ok, false);
});

test("le mélange des réponses est reproductible et garde la bonne réponse", () => {
  const quiz = exemple();
  for (const q of quiz.questions) {
    const a = melangerChoix(quiz, q);
    assert.deepEqual(a, melangerChoix(quiz, q));
    assert.equal(a.choix[a.indexBonne], q.bonne_reponse);
    assert.equal(a.choix.length, q.distracteurs.length + 1);
  }
});

test("le fact-check marque vérifié seulement si la réponse concorde avec une source web", () => {
  const quiz = exemple();
  const resultat = appliquerVerdicts(
    quiz,
    quiz.questions.map((q) => ({
      numero: q.numero,
      choix: q.numero === 2 ? "Un corbeau" : q.bonne_reponse,
      certitude: "certaine" as const,
      sources: [{ reference: "Source", url: `https://exemple.org/${q.numero}` }],
      ambiguite: null,
    })),
  );
  assert.equal(resultat.questions[0].fact_check.statut, "verifie");
  assert.equal(resultat.questions[1].fact_check.statut, "conteste");
  assert.equal(resultat.statut, "brouillon");
});

test("un court de 5 questions dure moins de 60 s", () => {
  const plan = planCourt([1, 2, 3, 4, 5]);
  assert.ok(plan.total / 30 < 60);
  assert.equal(plan.segments.length, 5);
});

test("une simple remarque du vérificateur ne conteste pas la question", () => {
  const quiz = exemple();
  const q = quiz.questions[0];
  const resultat = appliquerVerdicts(quiz, [
    {
      numero: 1,
      choix: q.bonne_reponse,
      certitude: "certaine",
      sources: [{ reference: "Source", url: "https://exemple.org/1" }],
      ambiguite: null,
      remarque: "nom historique également correct",
    },
  ]);
  assert.equal(resultat.questions[0].fact_check.statut, "verifie");
  assert.match(resultat.questions[0].fact_check.note ?? "", /remarque/);
});

test("la difficulté générée doit tenir le barème et monter à parts égales", () => {
  const parts = [98, 95, 85, 75, 60, 45, 30, 15, 4, 2];
  const quiz = parts.map((fans_qui_trouvent, i) => ({ difficulte: Math.floor(i / 2) + 1, fans_qui_trouvent }));
  assert.deepEqual(fautesDifficulte(quiz), []);

  quiz[4].fans_qui_trouvent = 85;
  quiz[8].difficulte = 4;
  assert.deepEqual(fautesDifficulte(quiz), [
    "Q5 (Difficile) : 85 % des fans trouvent, il en faut de 35 à 70 % : change la question ou son niveau",
    "Q9 (Expert) : 4 % des fans trouvent, il en faut de 5 à 35 % : change la question ou son niveau",
    "Questions par niveau, de Facile à Impossible : 2/2/2/3/1 au lieu de 2 chacun",
  ]);
});
