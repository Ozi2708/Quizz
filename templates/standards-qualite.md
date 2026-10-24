# Standards qualité : checklist de validation

Chaque quiz passe 3 portes. Une vidéo n'est publiée que si toutes les lignes **bloquantes** sont vertes. Les lignes marquées *(auto)* sont vérifiables par script, les autres par une relecture Claude dédiée.

## Porte 1 : contenu (avant rendu)

**Bloquant**
- [ ] Le fichier est valide contre `quiz.schema.json` *(auto)*
- [ ] Les difficultés sont croissantes ou égales d'une question à la suivante *(auto)*
- [ ] Chaque bonne réponse est confirmée par au moins 2 sources indépendantes, dont l'œuvre originale quand c'est possible ; `fact_check.statut = verifie` partout *(auto pour le statut)*
- [ ] Une seule bonne réponse possible : aucun distracteur n'est aussi correct (ex. « chouette » et « hibou » ensemble)
- [ ] Pas d'ambiguïté livre / film / VF / VO non signalée dans l'énoncé
- [ ] Les distracteurs sont de même nature et de longueur comparable à la bonne réponse (la réponse ne doit pas se deviner par sa forme)
- [ ] Aucun doublon de question avec les quiz déjà publiés sur la chaîne *(auto)*
- [ ] Orthographe et grammaire françaises correctes, noms propres dans leur forme VF officielle

**Recommandé**
- [ ] Au moins 2 questions qui surprennent même un fan (anecdote « je ne savais pas »)
- [ ] La bonne réponse n'est pas toujours à la même position (répartition A/B/C/D équilibrée) *(auto)*
- [ ] Énoncés ≤ 90 caractères, réponses ≤ 40 caractères *(auto)*

## Porte 2 : vidéo (après rendu)

**Bloquant**
- [ ] Résolution et ratio corrects (1920×1080 ou 1080×1920), 30 i/s *(auto)*
- [ ] Durée dans la cible du format, court < 60 s *(auto)*
- [ ] Aucun texte hors zone de sécurité *(auto sur les coordonnées du gabarit)*
- [ ] Chaque énoncé reste affiché au moins 1 s par tranche de 15 caractères *(auto)*
- [ ] Le texte affiché correspond exactement au JSON, et la réponse surlignée est la bonne *(auto, OCR sur les images clés)*
- [ ] Son : pas de saturation, volume intégré entre -16 et -14 LUFS *(auto)*
- [ ] Aucune image, musique ou logo sous droits ; musique issue de la bibliothèque libre de droits validée

**Recommandé**
- [ ] Une action visuelle dans les 1,5 premières secondes (court) ou 5 premières (long)
- [ ] Pas de silence de plus de 1 s

## Porte 3 : publication

**Bloquant**
- [ ] Titre, description, hashtags présents et dans les limites de la plateforme *(auto)*
- [ ] Mention « quiz non officiel, réalisé par des fans » + titulaires des droits dans la description
- [ ] Déclaration de contenu généré par IA cochée quand la plateforme le demande (visuels générés)
- [ ] Miniature (long) ou couverture (Reels) générée et lisible en petit (test à 320 px de large)

**Recommandé**
- [ ] Commentaire épinglé avec la question d'engagement
- [ ] Horaire de publication selon le planning de la chaîne
- [ ] Variante A/B renseignée si le quiz fait partie d'un test (V2)

## Barème de difficulté (référence)

| Niveau | Libellé | Qui trouve ? |
|---|---|---|
| 1 | Facile | N'importe qui, même sans avoir vu l'œuvre |
| 2 | Moyen | A vu les films une fois |
| 3 | Difficile | Fan qui a revu les films |
| 4 | Expert | Lecteur des livres / fan assidu |
| 5 | Impossible | Connaît les détails, les coulisses, les noms secondaires |
