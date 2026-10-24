# Statistiques des vidéos

Le tableau de bord est [RAPPORT.md](RAPPORT.md), régénéré chaque matin par le workflow « Statistiques » (`.github/workflows/stats.yml`). On peut aussi le lancer à la main depuis l'onglet Actions.

## Ce qu'on mesure

| Indicateur | Pourquoi | Source |
|---|---|---|
| Vues, et vues à J+7 | Les vidéos ne se comparent qu'à âge égal | YouTube Data API (clé) |
| Likes et commentaires pour 1 000 vues | L'envie de réagir, indépendamment de la taille | YouTube Data API (clé) |
| % vu en moyenne, durée moyenne | Le premier signal de l'algorithme des Shorts | YouTube Analytics (OAuth) |
| Rétention après l'accroche et à la fin de chaque question | Où l'on perd les gens, et à quel niveau de difficulté | YouTube Analytics (OAuth) + déroulé du gabarit |
| Partages, abonnés gagnés | Ce qui fait grandir la chaîne | YouTube Analytics (OAuth) |
| Abonnés de la chaîne, sur 7 jours | La tendance générale | YouTube Data API (clé) |

Regroupements : par catégorie (film, série…), par plateforme et format. Les conclusions automatiques (« Enseignements ») n'apparaissent qu'à partir de 5 vidéos de plus de 7 jours rattachées à un quiz : en dessous, les écarts relèvent du hasard.

## Fichiers

- `releves.jsonl` : un relevé par vidéo et par jour (on garde l'historique pour suivre la courbe des vues).
- `videos.json` : correspondances manuelles `{ "identifiant de la vidéo": "id du quiz" }`, quand le titre publié ne correspond pas au titre du quiz. Sans cela, une vidéo est rattachée à son quiz par son titre (titre court ou titre YouTube).
- `tiktok.csv` : chiffres TikTok recopiés à la main depuis TikTok Studio (TikTok n'ouvre pas ses statistiques à un outil perso). Une ligne par vidéo et par relevé, par exemple une fois par semaine :
  `2026-11-01,le-seigneur-des-anneaux-10q-2d94ab,https://www.tiktok.com/@compte/video/123,2026-10-25,1200,80,12,5,21,34`
  (date du relevé, id du quiz, lien, date de publication, vues, likes, commentaires, partages, durée moyenne en secondes, % vus en entier).

## Configuration (une fois)

Tout se range dans GitHub, Settings, Secrets and variables, Actions. Jamais de clé dans le dépôt ni dans le chat.

### 1. Chiffres publics : une clé d'API (5 minutes, gratuit)

1. Sur [console.cloud.google.com](https://console.cloud.google.com), créer un projet (par exemple « top4-stats »).
2. « API et services », « Bibliothèque » : activer **YouTube Data API v3**.
3. « Identifiants », « Créer des identifiants », « Clé API ». La restreindre à « YouTube Data API v3 ».
4. Dans GitHub, secret **`YOUTUBE_API_KEY`**.
5. Facultatif : variable **`YOUTUBE_CHAINE`** si le pseudo n'est plus `@Top4pourcent` (on peut aussi mettre l'identifiant `UC…`).

Le quota gratuit (10 000 unités par jour) suffit très largement : un relevé coûte quelques unités. Seules les vidéos publiques sont vues.

### 2. Rétention et partages : accès YouTube Analytics en lecture seule (15 minutes)

1. Dans le même projet, activer **YouTube Analytics API**.
2. « Écran de consentement OAuth » : type Externe, ajouter le champ d'application `https://www.googleapis.com/auth/yt-analytics.readonly`, puis **publier l'application** (« En production »). En mode « Test », le jeton expire au bout de 7 jours.
3. « Identifiants », « ID client OAuth », type **Application Web**, URI de redirection autorisée : `https://developers.google.com/oauthplayground`.
4. Sur [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground) : roue dentée, cocher « Use your own OAuth credentials », coller l'ID et le secret du client. À gauche, saisir le champ `https://www.googleapis.com/auth/yt-analytics.readonly`, « Authorize APIs », se connecter avec le compte Google de la chaîne (Google prévient que l'application n'est pas validée : « Paramètres avancés », continuer). Puis « Exchange authorization code for tokens » et copier le **refresh token**.
5. Dans GitHub, secrets **`YOUTUBE_CLIENT_ID`**, **`YOUTUBE_CLIENT_SECRET`**, **`YOUTUBE_REFRESH_TOKEN`**.

Si ces secrets existent déjà pour un autre usage, le jeton doit avoir été obtenu avec le champ `yt-analytics.readonly`, sinon YouTube Analytics refuse. Les chiffres Analytics arrivent avec 1 à 3 jours de retard.

## En local

```sh
YOUTUBE_API_KEY=... npm run stats   # relevé du jour puis RAPPORT.md
npm run rapport                     # régénère RAPPORT.md sans nouveau relevé
```
