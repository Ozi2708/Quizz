# Storyboard : format court (Shorts, TikTok, Reels 9:16)

Source : le même fichier quiz que le long. Un quiz de 10 questions donne en général 2 courts (questions 1 à 5 et 6 à 10) ou 1 court « que les questions dures ».
Rendu : 1080×1920, 30 i/s, durée cible 45 à 75 s. Shorts accepte jusqu'à 3 min, TikTok et Reels aussi : on ne sacrifie plus le temps de réflexion pour passer sous 60 s.

## Durées

| Variante | Questions | Timer | Révélation | Durée |
|---|---|---|---|---|
| Standard | 5 | 8 s | 3,5 s | ≈ 65 s |
| Escalade | 3 (facile, difficile, impossible) | 8 s | 3,5 s | ≈ 40 s |
| Défi unique | 1 question « impossible » | 10 s | 4 s | ≈ 17 s, pensé pour la boucle |

## Séquence

| # | Scène | Durée | Écran | Son |
|---|---|---|---|---|
| 0 | **Accroche** | 0 à 1,5 s | Texte géant : « Seuls les vrais fans ont 5/5 » ou directement la question 1 déjà à l'écran. Pas d'intro, pas de logo. | Hit sonore |
| 1 | **Question n** | `timer` | Énoncé dans le tiers haut, réponses empilées verticalement au centre, compteur « 2/5 » et timer en barre. | Tic-tac |
| 2 | **Révélation** | `révélation` | Bonne réponse en vert, anecdote en une ligne max. | Ding |
| 3 | **Dernière question** | `timer` + 1 s | Badge « IMPOSSIBLE » qui tremble. | Montée de tension |
| 4 | **Appel au commentaire** | 2 s | « Ton score ? 👇 » | Musique |
| 5 | **Boucle** | — | La dernière image s'enchaîne visuellement sur la première pour favoriser le revisionnage. | |

## Zones de sécurité (communes aux 3 plateformes)

- Haut : 220 px libres (barre de recherche, nom du compte).
- Bas : 480 px libres (légende, boutons, musique).
- Droite : 140 px libres (likes, commentaires, partages).
- Tout le texte utile tient dans le rectangle central d'environ 800×1200 px.

## Spécificités plateformes

- **YouTube Shorts** : titre = `titre_court`, lien vers la vidéo longue en commentaire épinglé / « vidéo associée ».
- **TikTok** : 3 à 5 hashtags, sous-titres natifs inutiles (texte déjà incrusté), utiliser un son tendance si disponible et libre d'usage commercial.
- **Instagram Reels** : couverture = image de la question 1 avec le texte d'accroche, légende courte + question.
