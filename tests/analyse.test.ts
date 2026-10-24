import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { minutage } from "../src/analyse/minutage.ts";
import { chutesParNiveau, enseignements, rapport, suivreVideos } from "../src/analyse/rapport.ts";
import {
  fusionnerReleves,
  rattacher,
  relevesTiktok,
  relevesYoutube,
  retentionParQuestion,
  type Releve,
  type ReleveVideo,
} from "../src/analyse/releves.ts";
import { dureeIso, lireChaine, lireVideos } from "../src/analyse/youtube.ts";
import { lireQuiz } from "../src/pipeline/schema.ts";
import type { Quiz } from "../src/pipeline/types.ts";

const exemple = (): Quiz => structuredClone(lireQuiz("templates/exemples/harry-potter-10q.json"));

test("le déroulé recopié est celui de build() dans le gabarit de rendu", () => {
  // build() est extraite en suivant ses accolades puis exécutée avec un faux document.
  const gabarit = readFileSync("templates/rendu/template.html", "utf8");
  const debut = gabarit.indexOf("function build(quiz,fmt){");
  assert.ok(debut >= 0, "build() introuvable dans template.html");
  let fin = gabarit.indexOf("{", debut);
  for (let profondeur = 0; ; fin++) {
    if (gabarit[fin] === "{") profondeur++;
    if (gabarit[fin] === "}" && --profondeur === 0) break;
  }
  for (const format of ["court", "long"] as const) {
    const quiz = exemple();
    const contexte = {
      TL: [] as { scene: string; start: number; dur: number; i?: number }[],
      EV: [],
      window: {} as { DURATION?: number },
      document: { body: {}, createElement: () => ({}) },
      $: () => ({ appendChild() {} }),
      quiz,
    };
    vm.runInNewContext(`${gabarit.slice(debut, fin + 1)}\nbuild(quiz, ${JSON.stringify(format === "court" ? "short" : "long")})`, contexte);
    const attendu = minutage(quiz, format);
    assert.equal(attendu.duree, contexte.window.DURATION, format);
    assert.deepEqual(
      attendu.segments,
      contexte.TL.map(({ scene, start, dur, i }) => ({ scene, debut: start, duree: dur, ...(i === undefined ? {} : { i }) })),
    );
  }
});

test("les durées ISO de YouTube sont lues en secondes", () => {
  assert.equal(dureeIso("PT58S"), 58);
  assert.equal(dureeIso("PT1M5S"), 65);
  assert.equal(dureeIso("PT1H2M"), 3720);
});

test("une vidéo est rattachée à son quiz par le titre, sans tenir compte des émojis ni de la casse", () => {
  const quiz = exemple();
  assert.equal(rattacher("abc", "SEULS les vrais fans de Harry Potter ont 5/5", [quiz], {})?.id, quiz.id);
  assert.equal(rattacher("abc", "Autre vidéo", [quiz], {}), undefined);
  assert.equal(rattacher("abc", "Autre vidéo", [quiz], { abc: quiz.id })?.id, quiz.id);
});

test("la rétention est lue à la fin de chaque question montrée", () => {
  const quiz = exemple();
  // Courbe qui descend régulièrement de 100 % à 50 %.
  const courbe = Array.from({ length: 100 }, (_, k) => ({ ratio: (k + 1) / 100, part: 1 - ((k + 1) / 100) * 0.5 }));
  const retention = retentionParQuestion(quiz, "court", courbe);
  assert.ok(retention && retention.accroche > 0.97);
  const r = retention?.questions;
  assert.equal(r?.length, 5);
  assert.ok(r!.every((p, i) => i === 0 || p < r![i - 1]));
  assert.ok(r![4] > 0.5 && r![4] < 0.55, "la dernière révélation finit juste avant l'appel au commentaire");
});

test("les lignes TikTok saisies à la main deviennent des relevés", () => {
  const csv = "date,quiz,url,publie_le,vues,likes,commentaires,partages,duree_moyenne_s,vus_en_entier_pct\n# exemple\n2026-10-30,hp,https://www.tiktok.com/@top4/video/123,2026-10-25,1 200,80,12,5,21,34\n";
  const [r] = relevesTiktok(csv);
  assert.equal(r.video, "123");
  assert.equal(r.vues, 1200);
  assert.equal(r.vus_en_entier_pct, 34);
  assert.equal(r.quiz, "hp");
});

test("un relevé repris le même jour remplace l'ancien", () => {
  const releve = (date: string, vues: number): Releve => ({
    type: "video", date, plateforme: "youtube", video: "a", url: "", titre: "", format: "court", publie_le: "2026-10-20", vues, likes: 0, commentaires: 0,
  });
  const fusion = fusionnerReleves([releve("2026-10-24", 10), releve("2026-10-25", 20)], [releve("2026-10-25", 30)]);
  assert.deepEqual(fusion.map((r) => (r as ReleveVideo).vues), [10, 30]);
});

test("la collecte YouTube lit la chaîne puis ses vidéos avec la clé", async (t) => {
  const appels: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    appels.push(url);
    const corps = url.includes("/channels")
      ? { items: [{ id: "UC1", statistics: { subscriberCount: "12", viewCount: "300", videoCount: "1" }, contentDetails: { relatedPlaylists: { uploads: "UU1" } } }] }
      : url.includes("/playlistItems")
        ? { items: [{ contentDetails: { videoId: "v1" } }] }
        : { items: [{ id: "v1", snippet: { title: "Titre", publishedAt: "2026-10-24T10:00:00Z" }, contentDetails: { duration: "PT1M5S" }, statistics: { viewCount: "300", likeCount: "20", commentCount: "4" } }] };
    return new Response(JSON.stringify(corps));
  });
  const chaine = await lireChaine("CLE", "@Top4pourcent");
  assert.equal(chaine.abonnes, 12);
  assert.ok(appels[0].includes("forHandle=%40Top4pourcent"));
  const videos = await lireVideos("CLE", chaine.uploads);
  assert.deepEqual(videos, [{ id: "v1", titre: "Titre", publieLe: "2026-10-24T10:00:00Z", dureeS: 65, vues: 300, likes: 20, commentaires: 4 }]);
});

function jeuDeDonnees(): { releves: Releve[]; quizzes: Quiz[] } {
  const quizzes: Quiz[] = [];
  const releves: Releve[] = [];
  for (let k = 0; k < 6; k++) {
    const quiz = exemple();
    quiz.id = `quiz-${k}`;
    quiz.theme.sujet = `Sujet ${k}`;
    quiz.theme.categorie = k % 2 ? "film" : "serie";
    quiz.metadonnees_publication.titre_court = `Titre ${k}`;
    quizzes.push(quiz);
    for (const [date, facteur] of [["2026-10-25", 1], ["2026-10-31", 2], ["2026-11-02", 3]] as const) {
      const donnees = {
        date,
        chaine: { id: "UC1", abonnes: 10 * facteur, vues: 1000, videos: 6 },
        videos: [{ id: `v${k}`, titre: `Titre ${k}`, publieLe: "2026-10-24T10:00:00Z", dureeS: 65, vues: 100 * (k + 1) * facteur, likes: 5 * facteur, commentaires: 1 }],
        retentions: new Map([[`v${k}`, [{ ratio: 0.01, part: 1 }, { ratio: 0.3, part: 0.6 }, { ratio: 1, part: 0.4 }]]]),
      };
      releves.push(...relevesYoutube(donnees, quizzes, {}));
    }
  }
  return { releves, quizzes };
}

test("les vidéos se comparent à J+7 et la chute est rangée par niveau", () => {
  const { releves, quizzes } = jeuDeDonnees();
  const suivis = suivreVideos(releves, quizzes);
  assert.equal(suivis.length, 6);
  assert.equal(suivis.find((s) => s.dernier.video === "v0")?.vuesJ7, 200);
  assert.equal(suivis.find((s) => s.dernier.video === "v0")?.dernier.vues, 300);
  const chutes = chutesParNiveau(suivis);
  assert.ok(chutes.length >= 2);
  assert.ok(chutes[0].chute > 0);
});

test("le tableau de bord ne tire de conclusion qu'avec assez de vidéos", () => {
  const { releves, quizzes } = jeuDeDonnees();
  assert.ok(enseignements(suivreVideos(releves, quizzes)).some((l) => l.includes("Sujet 5")));
  const peu = releves.filter((r) => r.type === "chaine" || ["v0", "v1"].includes(r.video));
  assert.deepEqual(enseignements(suivreVideos(peu, quizzes)), []);

  const md = rapport(releves, quizzes, "2026-11-02");
  assert.match(md, /30 abonnés \(\+20 en 7 jours\)/);
  assert.match(md, /\[Titre 5\]\(https:\/\/youtube\.com\/shorts\/v5\)/);
  assert.match(md, /Plus forte chute à la question 1/);
  assert.match(md, /## Enseignements pour les prochains quiz\n\n- Catégorie la plus vue/);
});
