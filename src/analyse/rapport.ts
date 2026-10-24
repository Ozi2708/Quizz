import type { LibelleDifficulte, Quiz } from "../pipeline/types.ts";
import { LIBELLES } from "../pipeline/types.ts";
import { questionsMontrees } from "./minutage.ts";
import type { Releve, ReleveChaine, ReleveVideo } from "./releves.ts";

// Tableau de bord en Markdown (stats/RAPPORT.md, lisible sur GitHub depuis le téléphone)
// et enseignements à donner au générateur de quiz.
// Les vidéos ne se comparent qu'à âge égal : on prend les vues à J+7 quand elles existent.

/** En dessous, les écarts entre catégories relèvent du hasard : on ne tire pas de conclusion. */
export const MIN_VIDEOS_POUR_CONCLURE = 5;
const JOURS_COMPARAISON = 7;

const JOUR_MS = 86_400_000;
// En jours calendaires : une vidéo mise en ligne le 24 a 7 jours le 31, quelle que soit l'heure.
const age = (publieLe: string, date: string) => Math.round((Date.parse(date.slice(0, 10)) - Date.parse(publieLe.slice(0, 10))) / JOUR_MS);

function mediane(valeurs: number[]): number | undefined {
  if (valeurs.length === 0) return undefined;
  const v = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const nombre = (n: number | undefined) => (n === undefined ? "—" : Math.round(n).toLocaleString("fr-FR").replace(/ /g, " "));
const pct = (n: number | undefined, decimales = 0) => (n === undefined ? "—" : `${n.toFixed(decimales).replace(".", ",")} %`);
/** Pour 1 000 vues : comparable entre vidéos de tailles différentes. */
const pourMille = (n: number, vues: number) => (vues > 0 ? (n * 1000) / vues : undefined);

export interface SuiviVideo {
  dernier: ReleveVideo;
  /** Vues au premier relevé pris au moins 7 jours après la mise en ligne. */
  vuesJ7?: number;
  quiz?: Quiz;
}

/** Une entrée par vidéo : son dernier relevé et ses vues à J+7. */
export function suivreVideos(releves: Releve[], quizzes: Quiz[]): SuiviVideo[] {
  const parVideo = new Map<string, ReleveVideo[]>();
  for (const r of releves) {
    if (r.type !== "video") continue;
    const cle = `${r.plateforme}|${r.video}`;
    parVideo.set(cle, [...(parVideo.get(cle) ?? []), r]);
  }
  return [...parVideo.values()].map((liste) => {
    const tries = liste.sort((a, b) => a.date.localeCompare(b.date));
    const dernier = tries[tries.length - 1];
    const j7 = tries.find((r) => age(r.publie_le, r.date) >= JOURS_COMPARAISON);
    const quizId = [...tries].reverse().find((r) => r.quiz)?.quiz;
    return { dernier, vuesJ7: j7?.vues, quiz: quizzes.find((q) => q.id === quizId) };
  });
}

interface Groupe {
  nom: string;
  videos: number;
  vuesJ7?: number;
  likes?: number;
  vu?: number;
}

function grouper(suivis: SuiviVideo[], cle: (s: SuiviVideo) => string | undefined): Groupe[] {
  const groupes = new Map<string, SuiviVideo[]>();
  for (const s of suivis) {
    const k = cle(s);
    if (k) groupes.set(k, [...(groupes.get(k) ?? []), s]);
  }
  return [...groupes.entries()]
    .map(([nom, liste]) => ({
      nom,
      videos: liste.length,
      vuesJ7: mediane(liste.flatMap((s) => (s.vuesJ7 === undefined ? [] : [s.vuesJ7]))),
      likes: mediane(liste.flatMap((s) => pourMille(s.dernier.likes, s.dernier.vues) ?? [])),
      vu: mediane(liste.flatMap((s) => (s.dernier.pourcentage_moyen === undefined ? [] : [s.dernier.pourcentage_moyen]))),
    }))
    .sort((a, b) => (b.vuesJ7 ?? -1) - (a.vuesJ7 ?? -1));
}

export interface ChuteParNiveau {
  niveau: LibelleDifficulte;
  questions: number;
  /** Part moyenne des spectateurs perdus pendant une question de ce niveau (points de %). */
  chute: number;
}

/** Spectateurs perdus pendant chaque question, regroupés par niveau de difficulté. */
export function chutesParNiveau(suivis: SuiviVideo[]): ChuteParNiveau[] {
  const chutes = new Map<number, number[]>();
  for (const { dernier, quiz } of suivis) {
    const r = dernier.retention_questions;
    if (!quiz || !r) continue;
    const montrees = questionsMontrees(quiz, dernier.format);
    r.forEach((part, i) => {
      const avant = i === 0 ? (dernier.retention_accroche ?? 1) : r[i - 1];
      const niveau = quiz.questions[montrees[i]]?.difficulte;
      if (niveau) chutes.set(niveau, [...(chutes.get(niveau) ?? []), (avant - part) * 100]);
    });
  }
  return [...chutes.entries()]
    .sort(([a], [b]) => a - b)
    .map(([n, liste]) => ({ niveau: LIBELLES[n], questions: liste.length, chute: liste.reduce((x, y) => x + y, 0) / liste.length }));
}

/** Quelques lignes pour orienter les prochains quiz, ou rien tant qu'il y a trop peu de vidéos comparables. */
export function enseignements(suivis: SuiviVideo[]): string[] {
  const comparables = suivis.filter((s) => s.quiz && s.vuesJ7 !== undefined);
  if (comparables.length < MIN_VIDEOS_POUR_CONCLURE) return [];
  const lignes: string[] = [];
  const categories = grouper(comparables, (s) => s.quiz?.theme.categorie).filter((g) => g.videos >= 2);
  if (categories.length >= 2) {
    const [haut, bas] = [categories[0], categories[categories.length - 1]];
    lignes.push(`Catégorie la plus vue : ${haut.nom} (${nombre(haut.vuesJ7)} vues médianes à J+7), la moins vue : ${bas.nom} (${nombre(bas.vuesJ7)}).`);
  }
  const tries = [...comparables].sort((a, b) => (b.vuesJ7 ?? 0) - (a.vuesJ7 ?? 0));
  const meilleurs = tries.slice(0, 3).map((s) => `« ${s.quiz?.theme.sujet} »`);
  lignes.push(`Sujets qui marchent le mieux : ${meilleurs.join(", ")}. Creuser des sujets voisins ou d'autres angles sur ceux-là.`);
  const chutes = chutesParNiveau(comparables).filter((c) => c.questions >= 3);
  if (chutes.length >= 2) {
    const pire = chutes.reduce((a, b) => (b.chute > a.chute ? b : a));
    lignes.push(`Les spectateurs décrochent le plus pendant les questions ${pire.niveau} (${pct(pire.chute, 1)} perdus en moyenne).`);
  }
  return lignes;
}

function derniereChaine(releves: Releve[]): { dernier?: ReleveChaine; ilYa7j?: ReleveChaine } {
  const chaine = releves.filter((r): r is ReleveChaine => r.type === "chaine").sort((a, b) => a.date.localeCompare(b.date));
  const dernier = chaine[chaine.length - 1];
  const ilYa7j = dernier && [...chaine].reverse().find((r) => age(r.date, dernier.date) >= 7);
  return { dernier, ilYa7j };
}

function retentionTexte(s: SuiviVideo): string {
  const r = s.dernier.retention_questions;
  if (!r || r.length === 0) return "";
  const accroche = s.dernier.retention_accroche ?? 1;
  const chutes = r.map((p, i) => (i === 0 ? accroche : r[i - 1]) - p);
  const pire = chutes.indexOf(Math.max(...chutes));
  const etapes = [`accroche ${pct(accroche * 100)}`, ...r.map((p, i) => `Q${i + 1} ${pct(p * 100)}`)].join(" → ");
  const q = s.quiz?.questions[questionsMontrees(s.quiz, s.dernier.format)[pire]];
  const detail = q ? ` (${LIBELLES[q.difficulte]} : « ${q.enonce} »)` : "";
  return `- **${s.dernier.titre}** : ${etapes}. Plus forte chute à la question ${pire + 1}${detail}.`;
}

export function rapport(releves: Releve[], quizzes: Quiz[], aujourdhui: string): string {
  const suivis = suivreVideos(releves, quizzes).sort((a, b) => b.dernier.vues - a.dernier.vues);
  const md: string[] = ["# Tableau de bord Top 4 %", "", `_Mis à jour le ${aujourdhui}. Fichier régénéré par le workflow « Statistiques », ne pas modifier à la main._`, ""];

  const { dernier, ilYa7j } = derniereChaine(releves);
  md.push("## La chaîne YouTube", "");
  if (dernier) {
    const evolution = ilYa7j ? ` (${dernier.abonnes - ilYa7j.abonnes >= 0 ? "+" : ""}${dernier.abonnes - ilYa7j.abonnes} en 7 jours)` : "";
    md.push(`${nombre(dernier.abonnes)} abonnés${evolution}, ${nombre(dernier.vues)} vues au total, ${dernier.videos} vidéos publiques.`, "");
  } else md.push("Pas encore de relevé : il faut le secret `YOUTUBE_API_KEY` (voir le [mode d'emploi](README.md)).", "");

  md.push("## Vidéos", "");
  if (suivis.length === 0) md.push("Aucune vidéo publique relevée pour l'instant.", "");
  else {
    md.push(
      "| Vidéo | Plateforme | Format | Âge (j) | Vues | Vues J+7 | Likes / 1 000 vues | Comm. / 1 000 vues | % vu en moyenne | Abonnés gagnés |",
      "|---|---|---|---:|---:|---:|---:|---:|---:|---:|",
    );
    for (const { dernier: v, vuesJ7 } of suivis) {
      const vu = v.pourcentage_moyen ?? v.vus_en_entier_pct;
      md.push(
        `| [${v.titre.replace(/\|/g, "/")}](${v.url}) | ${v.plateforme} | ${v.format} | ${age(v.publie_le, aujourdhui)} | ${nombre(v.vues)} | ${nombre(vuesJ7)} | ${nombre(pourMille(v.likes, v.vues))} | ${nombre(pourMille(v.commentaires, v.vues))} | ${pct(vu)} | ${nombre(v.abonnes_gagnes)} |`,
      );
    }
    md.push("");
  }

  const retentions = suivis.map(retentionTexte).filter(Boolean);
  md.push("## Où les spectateurs décrochent", "");
  if (retentions.length > 0) {
    md.push("Part des spectateurs encore là après l'accroche puis à la fin de chaque question (la boucle des Shorts peut faire dépasser 100 %).", "", ...retentions, "");
  } else md.push("Il faut l'accès YouTube Analytics (OAuth, voir le [mode d'emploi](README.md)) pour la courbe de rétention question par question.", "");

  const chutes = chutesParNiveau(suivis);
  if (chutes.length > 0) {
    md.push("| Niveau | Questions vues | Spectateurs perdus pendant la question |", "|---|---:|---:|");
    for (const c of chutes) md.push(`| ${c.niveau} | ${c.questions} | ${pct(c.chute, 1)} |`);
    md.push("");
  }

  const avecQuiz = suivis.filter((s) => s.quiz);
  if (avecQuiz.length > 0) {
    md.push("## Par catégorie et par format", "", "Médianes : une vidéo virale ne fausse pas la moyenne.", "");
    md.push("| Groupe | Vidéos | Vues J+7 | Likes / 1 000 vues | % vu |", "|---|---:|---:|---:|---:|");
    const groupes = [
      ...grouper(avecQuiz, (s) => s.quiz?.theme.categorie),
      ...grouper(suivis, (s) => `${s.dernier.plateforme} ${s.dernier.format}`),
    ];
    for (const g of groupes) md.push(`| ${g.nom} | ${g.videos} | ${nombre(g.vuesJ7)} | ${nombre(g.likes)} | ${pct(g.vu)} |`);
    md.push("");
  }

  md.push("## Enseignements pour les prochains quiz", "");
  const lecons = enseignements(suivis);
  const comparables = suivis.filter((s) => s.quiz && s.vuesJ7 !== undefined).length;
  md.push(
    ...(lecons.length > 0
      ? lecons.map((l) => `- ${l}`)
      : [`Pas encore assez de recul : ${comparables} vidéo(s) rattachée(s) à un quiz avec 7 jours d'ancienneté, il en faut ${MIN_VIDEOS_POUR_CONCLURE}.`]),
    "",
  );

  const orphelines = suivis.filter((s) => !s.quiz);
  if (orphelines.length > 0) {
    md.push(
      "## Vidéos sans quiz rattaché",
      "",
      "Leur titre ne correspond à aucun quiz de `quizzes/`. Ajouter « identifiant : id du quiz » dans `stats/videos.json` pour les compter.",
      "",
      ...orphelines.map((s) => `- ${s.dernier.plateforme} \`${s.dernier.video}\` : ${s.dernier.titre}`),
      "",
    );
  }
  return md.join("\n");
}
