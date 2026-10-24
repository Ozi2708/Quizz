import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { lireQuiz } from "../src/pipeline/schema.ts";
import { champsPublication, idPublication, publier } from "../src/pipeline/publier.ts";
import type { Quiz } from "../src/pipeline/types.ts";

const exemple = (): Quiz => structuredClone(lireQuiz("templates/exemples/harry-potter-10q.json"));
const valeurs = (champs: [string, string][], nom: string) => champs.filter(([n]) => n === nom).map(([, v]) => v);

test("un court publié sur YouTube reprend le titre court et n'est pas déclaré pour enfants", () => {
  const champs = champsPublication(exemple(), "quizz", { plateformes: ["youtube"] });
  assert.deepEqual(valeurs(champs, "youtube_title"), ["Seuls les vrais fans de Harry Potter ont 5/5 🧙"]);
  assert.deepEqual(valeurs(champs, "privacyStatus"), ["public"]);
  assert.deepEqual(valeurs(champs, "selfDeclaredMadeForKids"), ["false"]);
  assert.deepEqual(valeurs(champs, "categoryId"), ["24"]);
  assert.ok(valeurs(champs, "tags[]").includes("poudlard"));
});

test("un essai privé reste privé sur YouTube et TikTok, et écarte Instagram", () => {
  const quiz = exemple();
  const champs = champsPublication(quiz, "quizz", { plateformes: ["youtube", "tiktok"], prive: true });
  assert.deepEqual(valeurs(champs, "privacyStatus"), ["private"]);
  assert.deepEqual(valeurs(champs, "privacy_level"), ["SELF_ONLY"]);
  assert.throws(() => champsPublication(quiz, "quizz", { plateformes: ["instagram"], prive: true }), /Instagram/);
});

test("la légende reprend le titre court, la mention non officielle et les hashtags", () => {
  const champs = champsPublication(exemple(), "quizz", { plateformes: ["youtube", "tiktok", "instagram"] });
  const legende =
    "Seuls les vrais fans de Harry Potter ont 5/5 🧙\n\nQuiz non officiel, réalisé par des fans, sans lien avec les ayants droit.\n\n#harrypotter #quiz #poudlard #quizcinema";
  assert.deepEqual(valeurs(champs, "youtube_description"), [legende]);
  assert.deepEqual(valeurs(champs, "tiktok_title"), [legende]);
  assert.deepEqual(valeurs(champs, "instagram_title"), [legende]);
  assert.deepEqual(valeurs(champs, "media_type"), ["REELS"]);
});

test("une voix de synthèse est signalée sur YouTube et TikTok", () => {
  const quiz = exemple();
  quiz.parametres_video = { ...quiz.parametres_video, voix_off: true };
  const champs = champsPublication(quiz, "quizz", { plateformes: ["youtube", "tiktok"] });
  assert.deepEqual(valeurs(champs, "containsSyntheticMedia"), ["true"]);
  assert.deepEqual(valeurs(champs, "is_aigc"), ["true"]);
});

test("l'identifiant de publication ne change qu'avec les plateformes, l'essai ou la tentative", () => {
  const quiz = exemple();
  const id = idPublication(quiz, { plateformes: ["tiktok", "youtube"] });
  assert.equal(id, idPublication(quiz, { plateformes: ["youtube", "tiktok"] }));
  assert.notEqual(id, idPublication(quiz, { plateformes: ["youtube", "tiktok"], prive: true }));
  assert.notEqual(id, idPublication(quiz, { plateformes: ["youtube", "tiktok"], tentative: 2 }));
});

test("la publication refuse de partir sans la clé et le profil Upload-Post", async () => {
  delete process.env.UPLOAD_POST_API_KEY;
  delete process.env.UPLOAD_POST_USER;
  await assert.rejects(
    publier(exemple(), "absente.mp4", { plateformes: ["youtube"] }),
    /UPLOAD_POST_API_KEY.*UPLOAD_POST_USER/,
  );
});

test("la publication envoie la vidéo puis suit chaque plateforme jusqu'au résultat", async (t) => {
  const video = path.join(mkdtempSync(path.join(tmpdir(), "quizz-")), "court.mp4");
  writeFileSync(video, Buffer.alloc(16));
  process.env.UPLOAD_POST_API_KEY = "cle-test";
  process.env.UPLOAD_POST_USER = "quizz";
  t.after(() => {
    delete process.env.UPLOAD_POST_API_KEY;
    delete process.env.UPLOAD_POST_USER;
  });

  const reponses = [
    Response.json({ success: true, request_id: "envoi" }),
    Response.json({ message: "inconnu" }, { status: 404 }),
    Response.json({ status: "processing", total: 2, results: [] }),
    Response.json({
      status: "completed",
      total: 2,
      results: [
        { platform: "youtube", success: true, status: "completed", url: "https://youtu.be/abc" },
        { platform: "tiktok", success: true, status: "skipped" },
      ],
    }),
  ];
  const appels: { url: string; init?: RequestInit }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    appels.push({ url, init });
    return reponses.shift();
  });

  const resultat = await publier(exemple(), video, { plateformes: ["youtube", "tiktok"] }, { intervalleMs: 1, delaiMaxMs: 5_000 });

  assert.equal(appels.length, 4);
  assert.match(appels[0].url, /\/api\/upload$/);
  assert.equal(new Headers(appels[0].init?.headers).get("authorization"), "Apikey cle-test");
  assert.ok((appels[0].init?.body as FormData).get("video") instanceof Blob);
  assert.match(appels[3].url, /request_id=harry-potter-10q-001-tiktok-youtube-public$/);
  assert.deepEqual(resultat.resultats, [
    { plateforme: "youtube", ok: true, message: undefined, url: "https://youtu.be/abc" },
    { plateforme: "tiktok", ok: false, message: "compte non connecté dans Upload-Post", url: undefined },
  ]);
});
