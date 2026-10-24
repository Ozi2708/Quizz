# Dessins par question : règles

Chaque question a **son** dessin, qui évoque le sujet de la question sans donner la réponse. Un dessin générique (étoile, livre, horloge) n'est jamais acceptable sur une question.

## Comment choisir
1. **Lire la question, pas la réponse.** « Quelle capitale est traversée par la Vltava ? » → un pont sur une rivière. « Capitale de l'Espagne ? » → un éventail. On dessine l'indice que la question donne déjà.
2. **Ne jamais spoiler.** Pas de tour Eiffel sur « capitale de la France ? », pas de croix de Malte sur « La Valette doit son nom à… (les Hospitaliers) ». Test : quelqu'un qui voit seulement le dessin ne doit pas pouvoir deviner la bonne réponse parmi les 4.
3. **Reconnaissable en 1 seconde** à 270 px : un seul objet, une silhouette simple.
4. **Évoquer sans copier** : jamais de logo, personnage, affiche ou visuel officiel. Un château générique, pas Poudlard tel que dans les films.

## Où le mettre dans le JSON
- `media.doodle` = un id de `rendu/doodles.js` si un dessin existant colle vraiment à la question ;
- sinon un dessin propre à la question :
```json
"media": { "doodle": { "traits": [
  ["M100 30 A70 70 0 1 1 99.9 30 Z", "paper"],
  ["M30 100 L170 100"],
  ["M70 58 C86 48 102 64 94 80 Z", "acc"]
] } }
```
Chaque trait = `[chemin SVG, remplissage, épaisseur optionnelle]`, dans un carré 0-200.
Remplissages : `"paper"` (blanc), `"acc"` (couleur du pack), `"ink"` (noir), `"accline"` (trait couleur sans remplissage), rien = trait noir seul.

## Style maison (ce qui rend les vidéos reconnaissables)
- Trait noir épais et rond (7 par défaut), 3 à 7 traits maximum.
- Une seule touche de couleur d'accent, le reste blanc et noir.
- Formes simples et fermées pour les volumes (`paper`), détails en traits ouverts.
- Le moteur ajoute seul la découpe sticker, l'ombre, le tracé animé et le léger tremblement « dessin fait main ».
- Un dessin réussi qui servira encore est ajouté à la bibliothèque `doodles.js`, rangé dans le pack de son univers.

## Contrôle qualité (porte 1)
- [ ] Chaque question a un dessin lié à son énoncé, et aucun dessin n'est répété dans le même quiz.
- [ ] Aucun dessin ne donne la réponse.
