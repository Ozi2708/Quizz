# Les quizz : consignes pour Claude

Projet de chaînes de quiz vidéo automatisées (YouTube, TikTok, Instagram). Tout le contenu, le code et les commentaires sont en français.

## Repères

- `templates/quiz.schema.json` est le contrat entre l'écriture, le rendu et la publication. Toute évolution du format passe par ce schéma, puis par `src/pipeline/types.ts`.
- `templates/standards-qualite.md` décrit les 3 portes. Les règles automatisables sont dans `src/pipeline/porte1.ts` (contenu) et `src/pipeline/porte2.ts` (vidéo).
- `templates/storyboard-*.md` décrit le déroulé des vidéos ; `src/video/timing.ts` doit rester aligné sur le storyboard court.
- Les quiz générés vont dans `quizzes/`, les vidéos dans `sortie/` (non versionné).

## Règles

- Jamais d'image, d'extrait, de logo ou de musique sous droits dans les vidéos.
- Rien ne passe en rendu définitif sans `statut: fact-check-ok` (le drapeau `--brouillon` sert uniquement aux essais).
- Aucun secret dans le code ni dans le dépôt : `ANTHROPIC_API_KEY` et les clés des plateformes passent par l'environnement ou les secrets GitHub.
- Avant de pousser : `npm run typecheck` et `npm test`.
