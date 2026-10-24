# Storyboard : format long (YouTube 16:9)

Source : un fichier quiz conforme à `quiz.schema.json` (format_cible contient `long-16x9`).
Rendu : 1920×1080, 30 i/s, sans voix off en V1 (musique + bruitages + texte).

## Durées

| Variante | Questions | Durée cible | Usage |
|---|---|---|---|
| Classique | 10 | 2 min 30 à 3 min | Tests rapides de thèmes |
| Standard | 20 à 25 | 5 à 7 min | Format principal |
| Monétisable | 30+ (3 manches de 10) | 8 min et plus | Ouvre les pubs en milieu de vidéo sur YouTube |

Durée d'une question = annonce 1 s + timer `duree_timer_s` (8 s par défaut) + révélation `duree_reponse_s` (4 s) + transition 0,5 s ≈ 13,5 s.

## Séquence

| # | Scène | Durée | Écran | Son |
|---|---|---|---|---|
| 0 | **Accroche** | 0 à 5 s | Titre choc + promesse : « Seuls 2 % des fans ont 10/10 ». Aperçu flash de la question la plus dure. | Hit sonore + début musique |
| 1 | **Règles** | 3 s | « 1 point par bonne réponse. Note ton score ! » Barre de difficulté Facile → Impossible. | Musique |
| 2 | **Carte de manche** (si 3 manches) | 2 s | « Manche 1 : Facile » | Whoosh |
| 3 | **Question n** | 1 s | Numéro « Question 3/10 » + badge de difficulté coloré | Tic |
| 4 | **Timer** | `duree_timer_s` | Énoncé en haut, 4 réponses A/B/C/D en grille 2×2, visuel de fond flouté, compte à rebours circulaire, barre de progression globale en bas | Tic-tac qui accélère sur les 3 dernières secondes |
| 5 | **Révélation** | `duree_reponse_s` | Bonne réponse en vert (pulse), les autres s'estompent. Anecdote sous la réponse. | Ding « correct » |
| 6 | **Relance** (toutes les 5 questions) | 2 s | « T'en es à combien ? Écris ton score en commentaire » | Musique |
| 7 | **Score final** | 6 s | Barème : 0-3 Moldu, 4-6 Élève, 7-9 Préfet, 10 Directeur (adapter au thème) | Fanfare |
| 8 | **Fin d'écran** | 10 à 20 s | Zone écran de fin YouTube : 2 vidéos suggérées + abonnement | Musique de fin |

## Règles visuelles

- Texte : police sans empattement très lisible, taille énoncé ≥ 56 px, réponses ≥ 44 px, contraste AA minimum.
- Couleurs de difficulté fixes sur toute la chaîne : Facile vert, Moyen jaune, Difficile orange, Expert rouge, Impossible violet.
- Zone de sécurité : rien d'important dans les 5 % de bord.
- Fond : visuel généré depuis `media.visuel_prompt`, flouté et assombri pour que le texte reste lisible. Jamais de capture de film, d'affiche ni de logo officiel.
- L'ordre des réponses est mélangé une fois à la génération et stocké, pour que le rendu soit reproductible.

## Miniature

- Texte `texte_miniature` (3 à 5 mots), énorme, 2 couleurs max.
- Un visuel central fort lié au thème (généré), un élément de curiosité (point d'interrogation, « ??? »).
- Badge « 10/10 ? » ou « IMPOSSIBLE » en coin.
