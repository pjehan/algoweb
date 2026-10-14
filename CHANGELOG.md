# Journal des modifications

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet adopte la [numérotation sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouts

- Initialisation du projet : Vite, React, TypeScript, oxlint, Vitest.
- Page d'accueil provisoire.
- Intégration continue et déploiement sur GitHub Pages.
- Langage AlgoWeb (phase 1) : lexique, analyse syntaxique avec reprise sur erreur, AST, formateur stable (notations Python et française), vérification des portées et des types, avertissements, catalogue de 75 messages en français.
- Corpus de programmes de test couvrant la section 4 du plan.
- Exécution (phase 2) : compilateur vers une machine à pile, bibliothèque d'exécution fidèle à Python (entiers exacts, `div` et `mod`, `round` au pair, affichage des réels, somme compensée, Mersenne Twister de CPython), saisie tolérante, 23 erreurs d'exécution en français, pas à pas, points d'arrêt, pile des appels, Web Worker.
- Tables de référence produites par CPython (`tests/python/`) et sorties du corpus identiques à CPython.
- Démonstration provisoire de l'exécution sur la page d'accueil.
- Export Python (phase 3) : imports limités aux fonctions utilisées, annotations de type, conversions d'entier en réel explicites, `range` simplifié, graine. L'exemple du plan est reproduit à l'identique.
- Validation croisée dans la CI : les 12 programmes du corpus, exportés et exécutés par CPython 3.12, donnent les mêmes sorties qu'AlgoWeb.
- Script `npm run corpus:reference` pour produire la sortie de référence d'un programme avec CPython.

### Modifications du plan

- La machine d'exécution remplace les fonctions génératrices prévues : récursion indépendante de la pile JavaScript, débogueur plus simple, aucun code évalué (section 9.4).
- Différences connues ajoutées : dernier chiffre des fonctions mathématiques, exposant négatif entre entiers, lecture d'un booléen, puissance non réelle (section 6).
- Les noms français des fonctions prédéfinies (`somme`, `longueur`…) restent permis pour les variables et les paramètres ; ils ne sont interdits que pour les fonctions et les procédures (section 3, point 9).
