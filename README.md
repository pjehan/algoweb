# AlgoWeb

AlgoWeb est une application web d'apprentissage de l'algorithmique destinée aux étudiants de BTS SIO. On y écrit des algorithmes en pseudo-code français, on les exécute (y compris pas à pas) et on les exporte en Python.

Tout fonctionne dans le navigateur, sans serveur ni compte : les algorithmes restent sur le poste de l'étudiant.

> Projet en cours de développement. La spécification complète et les phases sont décrites dans [PLAN.md](PLAN.md).

## Développement

Prérequis : Node.js 24 ou plus récent.

```sh
npm install
npm run dev        # serveur de développement
npm test           # tests unitaires (Vitest)
npm run lint       # oxlint
npm run typecheck  # vérification des types
npm run build      # construction dans dist/
npm run e2e        # tests de bout en bout (Playwright, Chromium)
```

Avant le premier `npm run e2e` : `npx playwright install chromium`. La CI exécute aussi les tests sous Firefox et WebKit, sur la branche `main`.

Les tests de validation croisée exécutent le Python exporté : ils nécessitent `python3` (3.12 ou plus récent), et sont ignorés en local s'il est absent.

Pour ajouter un programme au corpus (`tests/programmes/`) : écrire `nom.algo`, éventuellement `nom.entree` (une saisie par ligne) et `nom.graine`, puis produire la sortie de référence avec CPython :

```sh
npm run corpus:reference tests/programmes/nom.algo
```

## Organisation

| Dossier | Contenu |
|---|---|
| `src/langage/` | lexique, analyse syntaxique, AST, vérification, formateur |
| `src/execution/` | compilateur, bibliothèque d'exécution, Web Worker |
| `src/import-algobox/` | conversion des fichiers `.alg` |
| `src/export/` | export Python, texte, image, impression |
| `src/stockage/` | bibliothèque locale, archives zip, liens de partage |
| `src/ui/` | composants React |
| `tests/` | corpus de programmes, fichiers `.alg` de test, tests de bout en bout |

## Déploiement

Chaque envoi sur `main` lance les vérifications puis publie le site sur GitHub Pages, à l'adresse `https://<compte>.github.io/algoweb/`.

## Licence

AlgoWeb est un logiciel libre distribué sous licence [GPL-3.0](LICENSE). Il s'inspire d'AlgoBox mais n'en reprend ni le code, ni les textes, ni les exemples ; seul l'import des fichiers `.alg` est assuré.
