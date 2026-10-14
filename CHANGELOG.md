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
- Export Python (phase 3) : imports limités aux fonctions utilisées, annotations de type, conversions d'entier en réel explicites, `range` simplifié, graine. L'exemple du plan est reproduit à l'identique.
- Validation croisée dans la CI : les 12 programmes du corpus, exportés et exécutés par CPython 3.12, donnent les mêmes sorties qu'AlgoWeb.
- Script `npm run corpus:reference` pour produire la sortie de référence d'un programme avec CPython.
- Interface v1 (phase 4) :
  - mise en page en trois colonnes, onglets sur tablette et téléphone ;
  - éditeur CodeMirror : coloration, diagnostics en continu, autocomplétion sans tenir compte des accents, modèles à champs, indentation automatique, repli des blocs, recherche, mots-clés réécrits dans leur forme canonique, équivalents ASCII remplacés à la frappe ;
  - palette d'instructions par catégories (clic ou glisser-déposer) ;
  - console avec saisie redemandée en cas d'erreur, historique, copie, alerte après 10 secondes ;
  - liste des diagnostics, avec accès à la ligne ;
  - bibliothèque locale : sauvegarde automatique, corbeille de 30 jours, recherche et tri, jauge d'occupation, stockage plein, rappel de sauvegarde, alerte si l'algorithme est ouvert dans deux onglets ;
  - téléchargements JSON, Python, texte et ZIP ; imports JSON et ZIP avec gestion des conflits de noms ;
  - préférences (thème, taille du texte, notation des fonctions), propriétés de l'algorithme (description, graine), À propos.
- Débogueur (phase 5) : pas à pas (pas suivant, pas principal, sortir de la fonction), points d'arrêt dans la marge qui suivent les modifications du texte, ligne courante surlignée, variables (valeurs modifiées mises en évidence, listes dépliables), pile d'appels, exécution animée, suspension d'une exécution en cours.
- Palette de commandes (Ctrl+K), commande « Mettre le texte en forme ».
- Tests de bout en bout Playwright avec contrôle d'accessibilité axe-core, sur Chromium, Firefox et WebKit dans la CI (branche main).

### Modifications du plan

- La machine d'exécution remplace les fonctions génératrices prévues : récursion indépendante de la pile JavaScript, débogueur plus simple, aucun code évalué (section 9.4).
- Différences connues ajoutées : dernier chiffre des fonctions mathématiques, exposant négatif entre entiers, lecture d'un booléen, puissance non réelle (section 6).
- Les noms français des fonctions prédéfinies (`somme`, `longueur`…) restent permis pour les variables et les paramètres ; ils ne sont interdits que pour les fonctions et les procédures (section 3, point 9).
