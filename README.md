# Les quizz

Pipeline automatisé de chaînes de quiz (YouTube, TikTok, Instagram) : écriture des questions avec Claude, vérification, rendu vidéo, contrôle qualité, publication et analyse des performances.

## Installation

```bash
npm install
npx playwright install chromium   # navigateur du rendu vidéo
pip install numpy                 # bande son (templates/rendu/audio.py)
cp .env.example .env              # puis renseigner ANTHROPIC_API_KEY
```

Node 20 ou plus, Python 3 et `ffmpeg` sont nécessaires.

## Utilisation

```bash
# 1. Écrire un quiz avec Claude (fichier créé dans quizzes/)
npm run generer -- --sujet "Capitales d'Europe" --categorie geographie --questions 10

# 2. Faire vérifier chaque réponse par un second Claude avec recherche web
npm run verifier -- quizzes/<id>.json

# 3. Contrôler le contenu (porte 1)
npm run qa -- quizzes/<id>.json

# 4. Rendre le court 9:16 (5 questions, une par niveau) puis contrôler la vidéo (porte 2)
npm run rendu -- quizzes/<id>.json            # --long pour le 16:9 avec toutes les questions

# 5. Publier le court via Upload-Post (--a-blanc pour voir ce qui partirait, sans rien envoyer)
npm run publier -- quizzes/<id>.json --video sortie/<id>-court.mp4 --plateformes youtube,tiktok --prive
```

Pour régler le design, ouvrir `templates/rendu/template.html` dans un navigateur ; `node templates/rendu/render.js <quiz> short <sortie>.png 30 --stills 3,12` capture des images fixes.

`--brouillon` sur `qa` et `rendu` permet un essai sans fact-check. La publication, elle, exige toujours le fact-check.

## Publication

Les vidéos partent par [Upload-Post](https://docs.upload-post.com), qui publie en public sur YouTube, TikTok et Instagram : l'API officielle de TikTok refuse les outils perso et YouTube garde en privé les vidéos d'un projet non audité. Le workflow « Publier un quiz » (onglet Actions) enchaîne rendu, portes 1 et 2 et publication, avec un essai privé par défaut.

| Nom | Type GitHub | Rôle |
|---|---|---|
| `UPLOAD_POST_API_KEY` | Secret | Clé API Upload-Post |
| `UPLOAD_POST_USER` | Variable | Nom du profil Upload-Post qui regroupe les comptes de la chaîne |

Un environnement GitHub `publication` avec relecteur obligatoire fait attendre chaque publication un feu vert manuel.

## Organisation

| Dossier | Contenu |
|---|---|
| `templates/` | Schéma du format quiz, storyboards, standards qualité, exemple |
| `src/pipeline/` | Génération, vérification, contrôles qualité, rendu, ligne de commande |
| `templates/rendu/` | Rendu vidéo : gabarit animé, dessins, polices, bande son, capture par Playwright |
| `quizzes/` | Quiz générés |
| `tests/` | Tests automatiques |

## Avancement

Phase 1 (prototype) en cours : génération, vérification, porte 1, rendu court et long, porte 2 technique, publication via Upload-Post. À venir : musique signature (la bande son actuelle est synthétisée), contrôle visuel des images clés, publication quotidienne automatique, collecte des statistiques.

Les polices du rendu sont sous licence libre (SIL OFL 1.1, Apache 2.0 pour Permanent Marker) : licences dans `templates/rendu/fonts/`.
