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

# Prévisualiser et ajuster le template dans le navigateur
npm run studio
```

`--brouillon` sur `qa` et `rendu` permet un essai sans fact-check.

## Organisation

| Dossier | Contenu |
|---|---|
| `templates/` | Schéma du format quiz, storyboards, standards qualité, exemple |
| `src/pipeline/` | Génération, vérification, contrôles qualité, rendu, ligne de commande |
| `src/video/` | Templates vidéo Remotion (court 9:16 pour l'instant) |
| `quizzes/` | Quiz générés |
| `tests/` | Tests automatiques |

## Avancement

Phase 1 (prototype) en cours : génération, vérification, porte 1, template court et porte 2 technique. À venir : format long 16:9, musique et bruitages, contrôle visuel des images clés, publication par API, collecte des statistiques.

Remotion est gratuit pour un particulier ou une entreprise de 3 personnes au plus ; au-delà, une licence est nécessaire.
