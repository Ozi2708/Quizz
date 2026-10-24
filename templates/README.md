# Templates de quiz

| Fichier | Rôle |
|---|---|
| `quiz.schema.json` | Format source d'un quiz (questions, difficulté, réponses, distracteurs, sources, fact-check, métadonnées de publication). C'est le contrat entre l'écriture, le rendu vidéo et la publication. |
| `storyboard-long-16x9.md` | Déroulé scène par scène de la vidéo YouTube longue. |
| `storyboard-court-9x16.md` | Déroulé des Shorts / TikTok / Reels, zones de sécurité. |
| `standards-qualite.md` | Checklist en 3 portes (contenu, vidéo, publication) avant toute mise en ligne. |
| `direction-visuelle.md` | Direction artistique des vidéos (style collage, couleurs par difficulté, accroche). |
| `dessins-guide.md` | Règles du dessin de chaque question : lié à l'énoncé, jamais la réponse, style maison. |
| `rendu/doodles.js` | Bibliothèque de dessins au trait (ids utilisables dans `media.doodle`) et packs d'univers (`parametres_video.habillage`). |
| `rendu/template.html` | Gabarit animé du court 9:16 et du long 16:9 : scènes, minutage, ordre des réponses, part estimée. |
| `rendu/render.js` | Capture le gabarit image par image (Playwright), assemble avec ffmpeg et ajoute le son d'`audio.py`. |
| `rendu/audio.py` | Bande son synthétisée, calée sur les événements de l'animation (provisoire, avant une musique signature). |
| `rendu/fonts/` | Polices du rendu et leurs licences libres. |
| `exemples/harry-potter-10q.json` | Exemple complet : 10 questions sur Harry Potter, de facile à impossible. |

## Cycle de vie d'un quiz

`brouillon` → fact-check → `fact-check-ok` → rendu vidéo + porte 2 → `qa-ok` → upload → `publie`

Un même fichier produit le long et les courts : on écrit une fois, on décline plusieurs fois.
