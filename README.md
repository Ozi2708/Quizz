# Les quizz

Pipeline automatisé de chaînes de quiz (YouTube, TikTok, Instagram) : écriture des questions avec Claude, vérification, rendu vidéo, contrôle qualité, publication et analyse des performances.

## Installation

```bash
npm install
cp .env.example .env   # puis renseigner ANTHROPIC_API_KEY
```

Node 20 ou plus et `ffmpeg` (pour `ffprobe`) sont nécessaires.

## Utilisation

```bash
# 1. Écrire un quiz avec Claude (fichier créé dans quizzes/)
npm run generer -- --sujet "Capitales d'Europe" --categorie geographie --questions 10

# 2. Faire vérifier chaque réponse par un second Claude avec recherche web
npm run verifier -- quizzes/<id>.json

# 3. Contrôler le contenu (porte 1)
npm run qa -- quizzes/<id>.json

# 4. Rendre un court 9:16 (questions 1 à 5) puis contrôler la vidéo (porte 2)
npm run rendu -- quizzes/<id>.json --debut 1 --fin 5

# 5. Publier le court via Upload-Post (--a-blanc pour voir ce qui partirait, sans rien envoyer)
npm run publier -- quizzes/<id>.json --video sortie/<id>-court-q1-5.mp4 --plateformes youtube,tiktok --prive

# Prévisualiser et ajuster le template dans le navigateur
npm run studio
```

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
| `src/video/` | Templates vidéo Remotion (court 9:16 pour l'instant) |
| `quizzes/` | Quiz générés |
| `tests/` | Tests automatiques |

## Avancement

Phase 1 (prototype) en cours : génération, vérification, porte 1, template court et porte 2 technique. À venir : format long 16:9, musique et bruitages, contrôle visuel des images clés, publication quotidienne automatique, collecte des statistiques.

Remotion est gratuit pour un particulier ou une entreprise de 3 personnes au plus ; au-delà, une licence est nécessaire.
