# AlgoWeb : plan de développement

Document de référence du projet, rédigé le 13 octobre 2026 à partir de l'analyse d'AlgoBox 1.1.1 et des décisions de l'enseignant porteur du projet. Le plan complet a été validé le 14 octobre 2026.

Les choix de conception qui complètent les décisions initiales sont regroupés en section 3 et appliqués dans tout le document.

---

## 1. Vision

AlgoWeb est une application web d'apprentissage de l'algorithmique destinée aux étudiants de BTS SIO. Les étudiants y écrivent des algorithmes en pseudo-code français, les exécutent (y compris pas à pas) et les exportent en Python.

Principes directeurs :

- **Tout dans le navigateur.** Site statique hébergé sur GitHub Pages, sans serveur ni compte. Les données restent sur le poste de l'étudiant (localStorage), ce qui simplifie le RGPD.
- **Comme Python.** Les types et les calculs se comportent comme en Python, pour que le passage au code Python exporté soit direct.
- **La pédagogie d'abord.** Messages d'erreur en français, précis, avec une piste de correction. Le maximum d'erreurs est détecté avant l'exécution.
- **Indépendance vis-à-vis d'AlgoBox.** AlgoWeb s'inspire d'AlgoBox mais n'en reprend ni code, ni texte, ni exemples. Seule l'importation des fichiers `.alg` est assurée, par interopérabilité.

## 2. Décisions validées

| Sujet | Décision |
|---|---|
| Nom | AlgoWeb |
| Public | étudiants de BTS SIO |
| Hébergement | GitHub Pages (dépôt public `algoweb`, déploiement par GitHub Actions) |
| Licence | GPL-3.0 |
| Technologies | React + TypeScript + Vite |
| Notation | pseudo-code classique : `←`, `Si … alors … FinSi`, `Pour i de 1 à n faire … FinPour`, `=`, `mod` |
| Types | `entier`, `réel`, `chaîne`, `booléen`, `liste` |
| Listes | comme en Python : dynamiques, indices à partir de 0 |
| Fonctions prédéfinies | affichage au choix : noms Python (`sqrt`, `len`, `randint`…, par défaut) ou noms français (`racine`, `longueur`, `aléaEntier`…), réglé dans les préférences (section 4.7) |
| Calculs | comme en Python, sans arrondi caché |
| Format natif | JSON ; téléchargement unitaire en `.json`, groupé en `.zip` |
| Stockage | localStorage du navigateur |
| Compatibilité AlgoBox | import des fichiers `.alg` uniquement, avec conversion vers le pseudo-code AlgoWeb |
| Supprimé | graphiques (repère, tracés), fonctions `ALGOBOX_*`, F1 et F2 (converties à l'import), extensions JavaScript, export ODT, export `.alg`, exemples et liens vers le site d'AlgoBox |
| Nouveautés retenues | export Python, partage par lien, application hors ligne (PWA), thème sombre, accessibilité (RGAA), graine aléatoire, débogueur pas à pas |

## 3. Choix de conception

Ces choix complètent les décisions de la section 2. Ils ont été validés le 14 octobre 2026.

1. **Structures supplémentaires**, toutes traduisibles directement en Python :
   - `Sinon si`, `Pour … pas de …`, `Pour chaque … dans … faire`, `Répéter … Jusqu'à …` et `Procédure` ;
   - l'opérateur d'appartenance `dans` ;
   - les listes écrites directement (`[1, 2, 3]`) et les tranches (`ch[1:3]`) ;
   - les comparaisons enchaînées (`0 ≤ x < 10`).
2. **Actions en français, fonctions au choix.**
   - Les instructions restent en français : `Lire`, `Afficher`, `ajouter(L, x)`, `insérer`, `supprimer`.
   - Les fonctions qui renvoient une valeur s'affichent avec leur nom Python (`len`, `sqrt`…) ou leur nom français (`longueur`, `racine`…), selon la préférence de l'utilisateur (section 4.7).
3. **Listes typées facultatives.**
   - `notes : liste de réels` fixe le type des éléments et autorise `Lire notes[i]`.
   - `liste` seule accepte des éléments de tout type.
4. **Affichage.**
   - `Afficher a, b` sépare les valeurs par une espace, comme `print(a, b)`.
   - Le retour à la ligne est indiqué par le caractère `↵` en fin d'instruction : `Afficher a ↵` passe à la ligne (`print(a)`), `Afficher a` reste sur la même ligne (`print(a, end="")`).
   - En mode texte, on obtient `↵` en tapant `\n` en fin d'instruction (hors d'une chaîne) ; l'éditeur le remplace aussitôt. Le modèle d'instruction `Afficher` de la palette et de l'autocomplétion insère `↵` par défaut. En mode blocs, une case « retour à la ligne » ajoute ou retire `↵`.
   - Les booléens s'affichent `vrai` et `faux`, alors que Python affiche `True` et `False`.
5. **Saisie tolérante.** Si la valeur tapée ne correspond pas au type (`abc` pour un entier), AlgoWeb redemande la valeur au lieu de s'arrêter comme le ferait Python.
6. **Typage rigoureux.**
   - Une condition doit être un booléen : `Si n alors` est refusé.
   - Un réel ne peut pas être rangé dans un entier sans `int()` ou `round()`.
   - Une chaîne et un nombre ne se combinent pas sans `str()`.
7. **Fonctions isolées.** Une fonction n'accède qu'à ses paramètres et à ses variables locales, jamais aux variables de l'algorithme principal.
8. **Compteur protégé.** Le compteur d'une boucle `Pour` ne peut pas être modifié dans le corps de la boucle.
9. **Noms.**
   - Les identifiants sont sensibles à la casse et peuvent contenir des accents.
   - Sont interdits : les mots-clés AlgoWeb, les mots-clés Python et les noms Python des fonctions prédéfinies. Le code Python exporté est ainsi toujours valide, sans renommage.
   - Les noms français des fonctions prédéfinies (`somme`, `longueur`…) sont interdits comme noms de fonctions et de procédures, mais permis pour les variables et les paramètres : un appel `somme(L)` ne se confond jamais avec une variable `somme`, et le changement de notation ne crée donc pas de conflit.
10. **Mots-clés à la saisie.**
    - Casse et accents indifférents : `debut` équivaut à `Début`.
    - Variantes acceptées : `Fin Si`, `Tant que`, `Renvoyer`, `Saisir`, `Écrire`.
    - Équivalents ASCII acceptés : `<-` pour `←`, `<>` ou `!=` pour `≠`, `<=`, `>=`, `**` pour `^`, `==` pour `=`.
    - L'éditeur réécrit ensuite la forme canonique.
11. **Mise en forme.** En-tête `Algorithme <nom>` facultatif. Indentation de 2 espaces dans le pseudo-code et de 4 dans le Python exporté.
12. **Aléatoire identique à Python.** Le générateur reproduit celui de CPython (Mersenne Twister) : une même graine donne les mêmes tirages dans AlgoWeb et dans le Python exporté.
13. **Limites d'exécution.**
    - Aucune limite d'itérations par boucle : le bouton Arrêter suffit, puisque l'interface ne se fige jamais.
    - Profondeur de récursion limitée à 1 000, comme en Python.
    - La console conserve les 10 000 dernières lignes.
    - Une alerte non bloquante s'affiche après 10 secondes d'exécution.

## 4. Le langage AlgoWeb (spécification v1)

### 4.1 Exemple complet

```
Algorithme Moyenne des notes

Fonction moyenne(notes : liste de réels) : réel
Variables
  somme, note : réel
Début
  somme ← 0
  Pour chaque note dans notes faire
    somme ← somme + note
  FinPour
  Retourner somme / len(notes)
FinFonction

Variables
  n, i : entier
  x : réel
  notes : liste de réels
Début
  notes ← []
  Lire n
  Pour i de 1 à n faire
    Lire x
    ajouter(notes, x)
  FinPour
  Si n > 0 alors
    Afficher "Moyenne :", moyenne(notes) ↵
  Sinon
    Afficher "Aucune note saisie" ↵
  FinSi
Fin
```

### 4.2 Structure d'un algorithme

1. Un en-tête facultatif : `Algorithme <nom>`.
2. Les fonctions et procédures, dans un ordre quelconque.
3. L'algorithme principal : une section `Variables` facultative, puis le bloc `Début` … `Fin`.

Chaque ligne contient une seule instruction. Les lignes vides et les commentaires `// …` sont autorisés partout.

### 4.3 Lexique

**Mots-clés.** Formes canoniques et variantes acceptées à la saisie (casse et accents indifférents) :

| Forme canonique | Variantes acceptées |
|---|---|
| `Algorithme`, `Variables`, `Début`, `Fin` | `Debut` |
| `Si … alors`, `Sinon si … alors`, `Sinon`, `FinSi` | `SinonSi`, `Fin Si` |
| `Pour … de … à … [pas de …] faire`, `FinPour` | `Fin Pour` |
| `Pour chaque … dans … faire` | |
| `TantQue … faire`, `FinTantQue` | `Tant que`, `Fin TantQue`, `Fin Tant que` |
| `Répéter`, `Jusqu'à …` | `Repeter`, `Jusqu'a`, apostrophe typographique `’` |
| `Lire` | `Saisir` |
| `Afficher … [↵]` | `Écrire`, `Ecrire` ; `\n` en fin d'instruction pour `↵` |
| `Fonction … FinFonction`, `Procédure … FinProcédure` | `Procedure`, `Fin Fonction`, `Fin Procédure` |
| `Retourner` | `Renvoyer` |
| `Pause` | |
| `et`, `ou`, `non`, `mod`, `div`, `dans`, `vrai`, `faux` | |
| `entier`, `réel`, `chaîne`, `booléen`, `liste [de …]` | `reel`, `chaine`, `booleen` ; pluriels après `de` ou `d'` (`liste d'entiers`) |

Les mots `de`, `à`, `pas` et `chaque` sont contextuels : ils restent utilisables comme noms de variables hors de leur construction (une variable `pas` reste possible).

**Symboles.**

| Forme canonique | Saisies acceptées |
|---|---|
| `←` (affectation) | `<-` |
| `=` (égalité) | `==` |
| `≠` | `<>`, `!=` |
| `≤`, `≥` | `<=`, `>=` |
| `^` (puissance) | `**` |

**Identifiants.** Une lettre (accents acceptés) ou `_`, puis des lettres, des chiffres ou des `_`. Les identifiants sont sensibles à la casse. Les noms interdits sont listés en section 3, point 9.

**Littéraux.**
- Entiers : `42`.
- Réels : `3.14`, `1e-3`. Le séparateur décimal est le point ; une virgule déclenche un message explicite.
- Chaînes : `"…"` ou `'…'`, avec les échappements `\"`, `\'`, `\\`, `\n` et `\t`.
- Booléens : `vrai`, `faux`.
- Listes : `[]`, `[1, 2, 3]`.

**Commentaires.** `//` jusqu'à la fin de la ligne. Un commentaire peut suivre une instruction.

### 4.4 Types et variables

| Type | Valeurs | Python |
|---|---|---|
| `entier` | entiers sans limite de taille (`2^100` est exact) | `int` |
| `réel` | nombres à virgule flottante en double précision | `float` |
| `chaîne` | texte | `str` |
| `booléen` | `vrai`, `faux` | `bool` |
| `liste`, `liste de T` | suite modifiable, indices à partir de 0 | `list`, `list[T]` |

Règles :
- Toute variable se déclare dans une section `Variables`, sous la forme `nom1, nom2 : type`.
- Une variable déclarée n'a pas de valeur avant sa première affectation. La lire avant déclenche une erreur.
- Un entier se convertit automatiquement en réel quand le contexte l'exige. Toutes les autres conversions sont explicites : `int()`, `float()`, `str()`.

### 4.5 Instructions

| Instruction | Syntaxe AlgoWeb | Python exporté |
|---|---|---|
| Affectation | `x ← expression` | `x = expression` |
| Affectation d'un élément | `L[i] ← expression` | `L[i] = expression` |
| Lecture | `Lire x` (plusieurs : `Lire a, b`) | `x = int(input("x = "))`, `float(…)` ou `input(…)` selon le type |
| Affichage avec retour à la ligne | `Afficher e1, e2 ↵` | `print(e1, e2)` |
| Affichage sans retour à la ligne | `Afficher e1, e2` | `print(e1, e2, end="")` |
| Condition | `Si c alors` … `Sinon si c alors` … `Sinon` … `FinSi` | `if` / `elif` / `else` |
| Boucle bornée | `Pour i de a à b faire` … `FinPour` | `for i in range(a, b + 1):` |
| Boucle avec pas | `Pour i de 10 à 0 pas de -2 faire` | `for i in range(10, -1, -2):` |
| Parcours | `Pour chaque x dans L faire` … `FinPour` | `for x in L:` |
| Boucle conditionnelle | `TantQue c faire` … `FinTantQue` | `while c:` |
| Répétition | `Répéter` … `Jusqu'à c` | `while True:` … `if c: break` |
| Ajout | `ajouter(L, x)` | `L.append(x)` |
| Insertion | `insérer(L, i, x)` | `L.insert(i, x)` |
| Suppression | `supprimer(L, i)` | `del L[i]` |
| Appel de procédure | `afficherLigne(5)` | `afficherLigne(5)` |
| Retour | `Retourner expression` | `return expression` |
| Pause | `Pause` | `input("Pause : appuyez sur Entrée")` |
| Commentaire | `// texte` | `# texte` |

Le pas d'une boucle `Pour` est un entier non nul. Avec un pas positif, la boucle s'exporte en `range(a, b + 1, p)` ; avec un pas négatif, en `range(a, b - 1, p)`.

### 4.6 Opérateurs, du plus prioritaire au moins prioritaire

| Priorité | Opérateurs | Python |
|---|---|---|
| 1 | parenthèses, appel `f(x)`, indice `L[i]`, tranche `L[a:b]` | identique |
| 2 | `^` (puissance, associative à droite : `2^3^2` vaut `2^9`) | `**` |
| 3 | `-x` (opposé) | `-x` |
| 4 | `*`, `/` (division réelle), `div` (quotient entier), `mod` (reste) | `*`, `/`, `//`, `%` |
| 5 | `+`, `-` | `+`, `-` |
| 6 | `=`, `≠`, `<`, `≤`, `>`, `≥`, `dans` (enchaînables) | `==`, `!=`, `<`, `<=`, `>`, `>=`, `in` |
| 7 | `non` | `not` |
| 8 | `et` | `and` |
| 9 | `ou` | `or` |

Comme en Python :
- `+` concatène deux chaînes ou deux listes ;
- `*` répète une chaîne ou une liste (`[0] * n`) ;
- `et` et `ou` n'évaluent leur second membre que si nécessaire.

### 4.7 Fonctions prédéfinies

Chaque fonction a deux noms : son nom Python et un nom français.

| Nom Python | Nom français | Rôle | Résultat |
|---|---|---|---|
| `abs(x)` | `absolu(x)` | valeur absolue | type de `x` |
| `round(x)` | `arrondi(x)` | arrondi à l'entier le plus proche ; en cas d'égalité, vers le pair, comme Python (`round(2.5)` vaut 2) | entier |
| `round(x, n)` | `arrondi(x, n)` | arrondi à `n` décimales | réel |
| `min(…)`, `max(…)` | `min(…)`, `max(…)` | minimum, maximum de plusieurs valeurs ou d'une liste | type des valeurs |
| `sum(L)` | `somme(L)` | somme des éléments d'une liste | entier ou réel |
| `len(x)` | `longueur(x)` | longueur d'une chaîne ou d'une liste | entier |
| `int(x)` | `entier(x)` | conversion en entier (troncature d'un réel, lecture d'une chaîne) | entier |
| `float(x)` | `réel(x)` | conversion en réel | réel |
| `str(x)` | `chaîne(x)` | conversion en chaîne | chaîne |
| `ord(c)`, `chr(n)` | `code(c)`, `caractère(n)` | code Unicode d'un caractère, caractère d'un code | entier, chaîne |
| `sqrt(x)` | `racine(x)` | racine carrée | réel |
| `floor(x)`, `ceil(x)` | `plancher(x)`, `plafond(x)` | arrondi inférieur, supérieur | entier |
| `exp(x)`, `log(x)`, `log(x, b)`, `log10(x)` | `exp(x)`, `ln(x)`, `log(x, b)`, `log10(x)` | exponentielle, logarithme népérien, en base `b`, décimal | réel |
| `cos`, `sin`, `tan`, `acos`, `asin`, `atan` | identiques | trigonométrie, en radians | réel |
| `pi`, `e` | identiques | constantes | réel |
| `random()` | `aléa()` | réel aléatoire dans [0 ; 1[ | réel |
| `randint(a, b)` | `aléaEntier(a, b)` | entier aléatoire entre `a` et `b` inclus | entier |
| `choice(L)` | `choix(L)` | élément tiré au hasard dans une liste | type des éléments |

**Choix de la notation.**
- Une préférence « Noms des fonctions : Python ou français » règle l'affichage dans les deux modes d'édition, dans l'aide, la palette et l'autocomplétion. Les noms Python sont le réglage par défaut.
- À la saisie, les deux noms sont toujours acceptés ; l'éditeur réécrit le nom dans la notation choisie.
- Le texte enregistré (champ `code` du JSON) utilise toujours les noms Python. Un fichier s'ouvre donc identiquement chez tous les utilisateurs, et le changement de préférence ne modifie aucun document.
- `entier(x)`, `réel(x)` et `chaîne(x)` reprennent les noms des types ; l'analyse les distingue grâce aux parenthèses de l'appel.
- L'export Python utilise toujours les noms Python, quelle que soit la préférence.

À l'export, seules les fonctions utilisées sont importées : `from math import …`, `from random import …`. La liste pourra s'étendre selon les besoins pédagogiques (par exemple `gcd` ou `factorial`), avec un nom dans chaque notation.

### 4.8 Fonctions et procédures

```
Fonction aire(longueur : réel, largeur : réel) : réel
Début
  Retourner longueur * largeur
FinFonction

Procédure afficherLigne(n : entier)
Variables
  i : entier
Début
  Pour i de 1 à n faire
    Afficher "*"
  FinPour
  Afficher "" ↵
FinProcédure
```

Règles :
- **Déclaration.**
  - Les fonctions et procédures sont déclarées avant l'algorithme principal ; la récursivité est autorisée.
  - Les paramètres sont typés ; une fonction déclare son type de retour.
  - Une procédure ne renvoie rien ; `Retourner` seul y permet une sortie anticipée.
- **Passage des paramètres.** Les paramètres sont passés par valeur ; les listes sont partagées, comme en Python (une modification faite dans la procédure est visible par l'appelant).
- **Retour.** Une fonction doit exécuter `Retourner` sur tous les chemins. L'oubli est détecté à l'analyse quand c'est possible, sinon à l'exécution.
- **Appels.** Une fonction s'appelle dans une expression, une procédure comme une instruction. Appeler une fonction comme une instruction déclenche un avertissement (valeur ignorée).
- **Portée.** Une fonction n'accède qu'à ses paramètres et à ses variables locales (section 3, point 7).
- **Récursion.** La profondeur est limitée à 1 000.

### 4.9 Vérifications avant exécution

**Erreurs de syntaxe.** Elles sont signalées avec la ligne, la colonne et une suggestion. Exemples :
- `=` utilisé pour une affectation : « utilisez ← » ;
- virgule décimale : « utilisez le point : 2.5 » ;
- `x²` : « écrivez x^2 » ;
- `FinSi` manquant : « le Si de la ligne 4 n'est pas fermé ».

**Noms.** Variable ou fonction non déclarée (avec suggestion du nom le plus proche), déclaration en double, nom réservé.

**Types.** Sont contrôlés :
- les affectations et les opérandes ;
- les conditions, qui doivent être booléennes ;
- les bornes et le pas d'une boucle `Pour`, ainsi que les indices, qui doivent être entiers ;
- le nombre et le type des arguments ;
- le type renvoyé par chaque fonction.

**Structure.** `Retourner` hors d'une fonction, procédure utilisée dans un calcul, compteur de `Pour` modifié, fonction sans `Retourner`.

**Avertissements** (n'empêchent pas l'exécution) :
- variable jamais utilisée ;
- variable peut-être lue avant d'avoir une valeur ;
- code placé après `Retourner` ;
- résultat d'une fonction ignoré.

### 4.10 Sémantique d'exécution

- **Nombres.**
  - Les entiers sont exacts quelle que soit leur taille ; les réels sont en double précision (`0.1 + 0.2` vaut `0.30000000000000004`).
  - `/` donne toujours un réel : `7 / 2` vaut `3.5` et `6 / 2` vaut `3.0`.
  - `div` et `mod` suivent Python : `-7 div 2` vaut `-4` et `-7 mod 2` vaut `1`.
- **Erreurs d'exécution.** Les cas suivants arrêtent l'exécution avec un message en français et le numéro de ligne :
  - division par zéro, y compris entre réels ;
  - racine carrée d'un négatif, logarithme d'un nombre négatif ou nul ;
  - puissance non réelle (`(-8)^0.5`) ;
  - indice hors limites ;
  - conversion impossible ;
  - variable sans valeur ;
  - récursion trop profonde.
- **Affichage.**
  - Entiers : en chiffres.
  - Réels : au format de Python (`3.0`, `0.1`, `1e-05`, `1e+16`).
  - Listes : au format de Python (`[1, 2.5, 'a']`).
  - Booléens : `vrai`, `faux`.
- **Chaînes et listes.**
  - Indices à partir de 0 ; indices négatifs comptés depuis la fin ; tranches comme en Python.
  - Les chaînes sont immuables et se mesurent en caractères Unicode.
- **Boucle `Pour`.** Les bornes sont évaluées une seule fois. Après la boucle, le compteur garde la dernière valeur prise, comme en Python.
- **Comparaisons.** Comparer des valeurs de types différents est interdit, sauf entier avec réel.
- **Aléatoire.** Sans graine, chaque exécution donne des tirages différents. Avec une graine, réglée dans les propriétés de l'algorithme, l'exécution est reproductible.

## 5. Import des fichiers AlgoBox (`.alg`)

L'import est à sens unique : un fichier `.alg` devient un algorithme AlgoWeb en pseudo-code. AlgoWeb n'écrit jamais de fichier `.alg`.

### 5.1 Le format `.alg` (référence pour l'implémentation)

Le fichier est en XML, encodé en UTF-8 :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Algo>
    <description texte="…" courant="…"/>
    <extension extnom="inactif"/>
    <fonction fctetat="actif" fctcode="x*x-2"/>
    <F2 F2etat="inactif" F2para="" F2defaut="" F2lignes="cond@valeur#cond@valeur#"/>
    <repere repetat="inactif" repcode="-10#10#-10#10#2#2"/>
    <param arrondiAuto="vrai" maxBoucle="500000" totalBoucles="5000000" totalAffichages="1000" epaisseurLigne="2" epaisseurPoint="2" nbDecimales="8"/>
    <item algoitem="FONCTIONS_UTILISEES" code="200#declarationfonctions">…</item>
    <item algoitem="VARIABLES" code="100#declarationsvariables">…</item>
    <item algoitem="DEBUT_ALGORITHME" code="101#debutalgo">…</item>
    <item algoitem="FIN_ALGORITHME" code="102#finalgo"/>
</Algo>
```

**Lecture des éléments.**
- Les éléments de configuration se reconnaissent à leurs attributs, et non au nom de la balise.
- Dans les fichiers anciens, certains peuvent manquer : `extension`, `F2`, `param`, ainsi que le bloc `FONCTIONS_UTILISEES`.
- L'ordre des attributs varie d'un fichier à l'autre ; les éléments inconnus sont ignorés.
- Les blocs de premier niveau se reconnaissent à leur texte (`algoitem`).

**Lecture des lignes.** Chaque `<item>` porte deux attributs :
- `algoitem`, le texte affiché, qui est redondant ;
- `code`, qui fait foi : des champs séparés par `#`, le premier donnant le type de la ligne. Pour une variable qui n'est pas une liste, le rang vaut `pasliste`.

| Code | Ligne affichée | Champs après le code |
|---|---|---|
| 1 | `x EST_DU_TYPE NOMBRE` | type (`NOMBRE`, `CHAINE`, `LISTE`), nom |
| 2 | `LIRE x`, `LIRE L[r]` | nom, rang ou `pasliste` |
| 3 | `AFFICHER x` | nom, retour à la ligne (`0` ou `1`), rang ou `pasliste` |
| 4 | `AFFICHER "texte"` | texte, retour à la ligne |
| 5 | `x PREND_LA_VALEUR e` | nom, expression, rang ou `pasliste` ; avec un rang, `a:b:c` remplit plusieurs cases |
| 6, 7, 8 | `SI (c) ALORS`, `DEBUT_SI`, `FIN_SI` | condition |
| 9, 10, 11 | `SINON`, `DEBUT_SINON`, `FIN_SINON` | aucun |
| 12, 13, 14 | `POUR i ALLANT_DE a A b`, `DEBUT_POUR`, `FIN_POUR` | variable, début, fin |
| 15, 16, 17 | `TANT_QUE (c) FAIRE`, `DEBUT_TANT_QUE`, `FIN_TANT_QUE` | condition |
| 18 | `PAUSE` | aucun |
| 19 | `//texte` | texte |
| 20 | `AFFICHERCALCUL e` | expression, retour à la ligne |
| 50 | `TRACER_POINT (x,y)` | x, y, couleur |
| 51 | `TRACER_SEGMENT (x1,y1)->(x2,y2)` | x1, y1, x2, y2, couleur |
| 52 | `EFFACER_GRAPHIQUE` | aucun |
| 100, 101, 102 | `VARIABLES`, `DEBUT_ALGORITHME`, `FIN_ALGORITHME` | aucun |
| 103 | ligne vide | aucun |
| 200 | `FONCTIONS_UTILISEES` | aucun |
| 201 | `FONCTION f(p,q)` | nom, paramètres (une espace s'il n'y en a pas) |
| 202, 203, 204 | `VARIABLES_FONCTION`, `DEBUT_FONCTION`, `FIN_FONCTION` | aucun |
| 205 | `RENVOYER e` | expression |
| 206 | `APPELER_FONCTION f(x)` | appel |

**Imbrication des blocs.**
- Le `SI` a pour enfants `DEBUT_SI`, ses instructions, `FIN_SI`, puis éventuellement un `SINON`. Ce dernier contient à son tour `DEBUT_SINON`, ses instructions et `FIN_SINON`.
- `POUR` et `TANT_QUE` suivent le même schéma.
- `FONCTION` a pour enfants `VARIABLES_FONCTION` (qui contient les déclarations locales), `DEBUT_FONCTION`, les instructions et `FIN_FONCTION`.

**Expressions AlgoBox.** Elles suivent la syntaxe JavaScript, avec quelques ajouts :
- `ET` et `OU` dans les conditions ;
- les fonctions `sqrt`, `pow`, `floor`, `round`, `random`, `cos`, `sin`, `tan`, `exp`, `log`, `abs`, `acos`, `asin`, `atan`, `max`, `min`, sans préfixe et sans distinction de casse ;
- `Math.PI` et toutes les fonctions `Math.*` ;
- les fonctions `ALGOBOX_*`, `F1(x)` et `F2(…)` ;
- les méthodes de chaîne `.length`, `.substr(début, longueur)`, `.charAt`, `.charCodeAt` et `.toString()`, ainsi que `String.fromCharCode` ;
- l'accès aux listes `L[i]`.

**Différences de sémantique.** À l'exécution, AlgoBox suit JavaScript :
- tous les nombres sont des réels, arrondis par défaut à 12 chiffres significatifs ;
- `%` est le reste au sens de JavaScript et `^` le « ou exclusif » bit à bit ;
- la borne de fin d'un `POUR` est réévaluée à chaque tour ;
- les listes s'agrandissent toutes seules ;
- chaîne + nombre concatène.

### 5.2 Règles de conversion

| AlgoBox | AlgoWeb |
|---|---|
| `NOMBRE` | `entier` si la variable sert de compteur de boucle ou ne reçoit que des valeurs entières, sinon `réel` |
| `CHAINE` | `chaîne` |
| `LISTE` | `liste de réels`, créée par `L ← []` en tête d'algorithme ; chaque affectation indexée est signalée, car AlgoWeb indexe à partir de 0 et n'agrandit pas les listes |
| `LIRE x` | `Lire x` |
| `AFFICHER x`, `AFFICHER "t"`, `AFFICHERCALCUL e` | `Afficher …`, suivi de `↵` si le retour à la ligne était coché |
| `x PREND_LA_VALEUR e` | `x ← e` ; `L[r] PREND_LA_VALEUR a:b` devient `L[r] ← a` puis `L[r + 1] ← b` |
| `SI (c) ALORS … SINON …` | `Si c alors … Sinon … FinSi` |
| `POUR i ALLANT_DE a A b` | `Pour i de a à b faire … FinPour` |
| `TANT_QUE (c) FAIRE` | `TantQue c faire … FinTantQue` |
| `PAUSE`, commentaire, ligne vide | `Pause`, `//`, ligne vide |
| `FONCTION f(p)` avec `RENVOYER` | `Fonction f(p : réel) : réel` avec `Retourner` ; `Procédure` s'il n'y a aucun `RENVOYER` |
| `APPELER_FONCTION f(x)` | `f(x)` |
| F1 active | `Fonction F1(x : réel) : réel` qui retourne l'expression de F1 |
| F2 active | `Fonction F2(…) : réel` : un `Si … alors Retourner … FinSi` par ligne, puis `Retourner` la valeur par défaut |
| `TRACER_POINT`, `TRACER_SEGMENT`, `EFFACER_GRAPHIQUE` | commentaire `// [AlgoBox, non converti] …` |
| repère, extension, paramètres d'exécution et d'affichage | ignorés, mentionnés dans le rapport |

Conversion des expressions :

| AlgoBox | AlgoWeb |
|---|---|
| `==`, `!=` | `=`, `≠` |
| `%` | `mod` |
| `&&` ou `ET`, `\|\|` ou `OU`, `!` | `et`, `ou`, `non` |
| `pow(x, n)` | `x ^ n` |
| `Math.PI` | `pi` |
| `sqrt(x)`, `Math.sqrt(x)`, `SQRT(x)` (de même pour `floor`, `cos`…) | `sqrt(x)` |
| `ch.length` | `len(ch)` |
| `ch.substr(d, n)` | `ch[d:d + n]` |
| `ch.charAt(i)` | `ch[i]` |
| `ch.charCodeAt(i)` | `ord(ch[i])` |
| `String.fromCharCode(n)` | `chr(n)` |
| `x.toString()` | `str(x)` |
| `"texte" + x`, où `x` est un nombre | `"texte" + str(x)` |
| `ALGOBOX_ALEA_ENT(a, b)` | `randint(a, b)` |
| `ALGOBOX_ARRONDIR(x, n)` | `round(x, n)` |
| autres `ALGOBOX_*` | conservés tels quels et signalés comme erreurs à corriger |
| `^` (ou exclusif chez AlgoBox) | non converti et signalé, car `^` désigne la puissance dans AlgoWeb |

### 5.3 Rapport d'import

Après l'import, un rapport présente :
- le nombre de lignes converties ;
- les types déduits pour chaque variable ;
- la liste des points à vérifier, avec leur numéro de ligne : listes, éléments non convertis, différences de sémantique (borne de `POUR` modifiée dans la boucle, `round`…).

L'algorithme s'ouvre ensuite dans l'éditeur, avec ses diagnostics.

### 5.4 Tests de l'import

- Les fichiers `.alg` de test sont écrits pour le projet et couvrent tous les codes de ligne, ainsi que les variantes anciennes du format (éléments manquants). Aucun exemple d'AlgoBox n'est intégré.
- Une vérification locale sur les fichiers personnels de l'enseignant pourra s'ajouter ; ces fichiers ne seront pas versionnés.

## 6. Export Python

Règles de traduction :
- **Version.** Le code cible Python 3.10 ou plus récent.
- **En-tête et imports.**
  - L'en-tête en commentaire rappelle le nom, la description et la date d'export.
  - Seules les fonctions utilisées sont importées. Une graine éventuelle produit `seed(n)`.
- **Ordre et annotations.**
  - Les fonctions viennent avant le programme principal.
  - Les types deviennent des annotations : `int`, `float`, `str`, `bool`, `list[float]`.
  - Les déclarations deviennent des annotations sans valeur (`n: int`).
- **Conversions implicites.** La conversion d'un entier en réel est rendue explicite : `somme = 0.0`, `moyenne = float(total)`.
- **Identifiants.** Ils sont conservés tels quels, puisque AlgoWeb interdit les mots-clés et les noms prédéfinis de Python.
- **Mise en forme.** Indentation de 4 espaces, commentaires en `#`. Les correspondances sont celles des sections 4.5 et 4.6.

Exemple : l'algorithme de la section 4.1 une fois exporté.

```python
# Algorithme Moyenne des notes (exporté par AlgoWeb)


def moyenne(notes: list[float]) -> float:
    somme: float
    note: float
    somme = 0.0
    for note in notes:
        somme = somme + note
    return somme / len(notes)


n: int
i: int
x: float
notes: list[float]
notes = []
n = int(input("n = "))
for i in range(1, n + 1):
    x = float(input("x = "))
    notes.append(x)
if n > 0:
    print("Moyenne :", moyenne(notes))
else:
    print("Aucune note saisie")
```

Différences connues, documentées dans l'aide :
- les booléens s'affichent `vrai`/`faux` dans AlgoWeb et `True`/`False` en Python ;
- une saisie invalide est redemandée par AlgoWeb, alors qu'elle provoque une erreur `ValueError` en Python ;
- `Pause` devient un `input()`.

Validation : la CI exporte chaque programme du corpus de test, l'exécute avec CPython sur les mêmes entrées et compare les sorties ligne à ligne.

## 7. Formats, stockage, téléchargements et partage

### 7.1 Document JSON (format natif)

```json
{
  "format": "algoweb",
  "version": 1,
  "nom": "Moyenne des notes",
  "description": "Calcule la moyenne de n notes saisies au clavier.",
  "code": "Algorithme Moyenne des notes\n\nFonction moyenne(notes : liste de réels) : réel\n…\nFin\n",
  "graine": null,
  "creeLe": "2026-10-13T14:00:00.000Z",
  "modifieLe": "2026-10-13T14:32:00.000Z"
}
```

- **Contenu.**
  - Le pseudo-code est stocké tel quel dans `code`. Il reste lisible et modifiable à la main, et un brouillon contenant des erreurs peut être enregistré.
  - La ligne `Algorithme <nom>` et le champ `nom` restent synchronisés : modifier l'un met à jour l'autre.
- **Évolutions.** Le champ `version` permet de migrer les documents ; les champs inconnus sont ignorés.
- **Nom de fichier.** C'est le nom lisible (`Moyenne des notes.json`), débarrassé des caractères interdits.

### 7.2 Bibliothèque locale (localStorage)

**Organisation des données.** Les clés portent un préfixe versionné :

| Clé | Contenu |
|---|---|
| `algoweb:v1:index` | liste des métadonnées : id, nom, description, dates, taille, date de mise à la corbeille |
| `algoweb:v1:doc:<id>` | document JSON (section 7.1) |
| `algoweb:v1:preferences` | thème, taille du texte, mode d'édition préféré, noms des fonctions (Python ou français) |
| `algoweb:v1:dernier-export` | date du dernier téléchargement complet |

**Fonctionnalités.**
- **Enregistrement.** Sauvegarde automatique une seconde après la dernière modification, avec l'indicateur « Enregistré à 14 h 32 ». Ctrl+S force l'enregistrement.
- **Gestion.** Créer, renommer, dupliquer, supprimer. La corbeille conserve les éléments 30 jours. Recherche et tri par nom ou par date.
- **Plusieurs onglets.** La liste est synchronisée entre onglets (événement `storage`), avec une alerte si le même algorithme est ouvert deux fois.
- **Espace disponible.**
  - Environ 5 Mo, soit plusieurs centaines d'algorithmes de 1 à 5 Ko.
  - Une jauge d'occupation s'affiche, et l'erreur de quota (`QuotaExceededError`) est gérée.
  - AlgoWeb demande au navigateur un stockage persistant (`navigator.storage.persist()`).
- **Rappel de sauvegarde.** Si le dernier téléchargement complet date de plus de 7 jours et que des algorithmes ont été modifiés depuis, un bandeau invite à télécharger une sauvegarde.

**Attention :** le stockage du navigateur n'est pas une sauvegarde. Il disparaît dans plusieurs cas :
- quand l'étudiant efface ses données de navigation ;
- en navigation privée ;
- sur un poste partagé réinitialisé ;
- avec Safari, après 7 jours sans visite du site.

L'interface doit le dire clairement et faciliter les téléchargements.

### 7.3 Téléchargements et imports

- **Un algorithme :** `<nom>.json`. Le menu Exporter propose aussi `.py` et `.txt`.
- **Plusieurs algorithmes** (cases à cocher), ou tous : une archive `algoweb-AAAA-MM-JJ.zip`.
  - Elle contient un `.json` par algorithme ; les noms sont nettoyés et dédoublonnés (`nom (2).json`).
  - Les fichiers `.py` peuvent être joints en option.
- **Import :** sélection multiple ou glisser-déposer de fichiers `.json` (AlgoWeb), `.zip` (archive AlgoWeb) ou `.alg` (AlgoBox).
  - En cas de nom déjà pris, l'étudiant choisit de renommer, remplacer ou ignorer, avec l'option « appliquer à tous ».
  - Les fichiers sont lus en UTF-8 ; pour un `.alg` mal encodé, AlgoWeb se rabat sur Windows-1252.

### 7.4 Partage par lien

- **Adresse.** De la forme `https://<compte>.github.io/algoweb/#partage=<données>`, où les données sont le JSON compressé (deflate, API `CompressionStream`) puis encodé en base64url.
- **Confidentialité.** Rien ne transite par un serveur : la partie située après `#` n'est jamais envoyée.
- **Ouverture.** Le lien affiche un aperçu et propose « Ajouter à ma bibliothèque ». Il n'écrase jamais un algorithme existant.
- **Taille.** Un avertissement s'affiche si le lien dépasse environ 8 000 caractères.
- **Usage.** C'est la manière simple de distribuer un exercice à une classe.

### 7.5 Autres exports

- **Python** (`.py`) : voir la section 6.
- **Texte** (`.txt`) : le pseudo-code.
- **Image** (SVG, PNG) : le code coloré, pour des diaporamas ou des fiches.
- **Impression et PDF**, par la feuille de style d'impression : description, code numéroté et, en option, sorties de la console.
- **Copie dans le presse-papiers**, en texte brut ou en HTML coloré (pour coller dans un traitement de texte).
- **Plus tard, en option :** LaTeX, page HTML autonome exécutable.

## 8. Interface

```
┌──────────────────────────────────────────────────────────────────┐
│ AlgoWeb   Somme des pairs   Enregistré 14:32       [Blocs|Texte] │
│ [> Exécuter] [Pas à pas] [Stop]          [Exporter v] [Partager] │
├──────────┬────────────────────────────────┬──────────────────────┤
│ Mes algos│  1 Variables                   │ Console              │
│ Corbeille│  2   n, i, s : entier          │ n = 10               │
│          │  3 Début                       │ 30                   │
│ Palette  │  4   Lire n                    │                      │
│ > Entrées│  5   s ← 0                     ├──────────────────────┤
│ > Calculs│  6   Pour i de 1 à n faire     │ Variables            │
│ > Tests  │  7     Si i mod 2 = 0 alors    │ n = 10     entier    │
│ > Boucles│  8       s ← s + i             │ i = 10     entier    │
│ > Listes │  9     FinSi                   │ s = 30     entier    │
│          │ 10   FinPour                   │                      │
│          │ 11   Afficher s ↵              │                      │
│          │ 12 Fin                         │                      │
└──────────┴────────────────────────────────┴──────────────────────┘
```

**Barre supérieure.** Nom modifiable, état de l'enregistrement, choix du mode (blocs ou texte), Exécuter, Pas à pas, Arrêter, Exporter, Partager, Aide, Préférences.

**Colonne de gauche.**
- **Bibliothèque :** mes algorithmes, corbeille, import.
- **Palette d'instructions par catégories :** variables, entrées-sorties, calculs, conditions, boucles, listes, fonctions, commentaires. Un clic insère l'instruction au curseur ; on peut aussi la faire glisser.

**Éditeur, mode blocs.**
- Arbre des instructions avec repères d'indentation ; on peut replier les blocs.
- Les champs se modifient directement dans la ligne ; les expressions bénéficient de l'autocomplétion et d'une vérification immédiate.
- Points d'insertion entre les lignes, glisser-déposer.
- Annuler et rétablir, navigation complète au clavier.
- Menu contextuel : dupliquer, supprimer, commenter, déplacer.

**Éditeur, mode texte (CodeMirror 6).**
- Coloration syntaxique, diagnostics en continu.
- Autocomplétion des mots-clés, variables et fonctions dans la notation choisie, avec signature et nom dans l'autre notation.
- Modèles à champs pour `Si`, `Pour`, `TantQue`…
- Remplacement automatique de `<-` par `←`, et des autres équivalents ASCII.
- Repli des blocs, recherche et remplacement, mise en commentaire, numéros de ligne, points d'arrêt dans la marge.

**Passage d'un mode à l'autre.** Il se fait sans perte. Le mode blocs exige un texte sans erreur de syntaxe ; sinon, l'éditeur reste en mode texte et affiche les erreurs.

**Colonne de droite.**
- **Console :** sorties, saisie directement dans la console avec indication du type attendu, historique, copie, effacement.
- **Variables :** nom, type et valeur ; les listes se déplient ; les valeurs modifiées sont mises en évidence.
- **Pile d'appels**, pendant l'exécution des fonctions.

**Débogueur.**
- Commandes : « Pas à pas » démarre sur la première ligne ; puis « Pas suivant » (entre dans les fonctions), « Pas principal » (passe par-dessus les appels), « Sortir de la fonction », Continuer, Arrêter.
- Points d'arrêt ; ligne courante surlignée dans l'éditeur ; vitesse réglable pour une exécution animée.
- L'instruction `Pause` agit comme un point d'arrêt.

**Diagnostics.** Liste des erreurs et avertissements ; un clic mène à la ligne concernée.

**Préférences.** Thème (clair, sombre, réglage du système), taille du texte, mode d'édition par défaut, noms des fonctions (Python ou français).

**Aide.**
- Référence du langage avec exemples et équivalents Python ; aide contextuelle sur la palette et sur les messages d'erreur.
- Tutoriel de premiers pas et liste des raccourcis.
- Aucun lien vers le site d'AlgoBox.

**À propos.** Version, licence GPL-3.0, lien vers le dépôt GitHub, crédits.

**Accessibilité (RGAA 4.1, WCAG 2.1 niveau AA).**
- Tout est utilisable au clavier, y compris l'éditeur par blocs, avec une alternative clavier au glisser-déposer.
- Focus visible ; rôles ARIA adaptés (arbre, barre d'outils, journal pour la console).
- Annonces pour les lecteurs d'écran : déplacements, erreurs, sorties.
- Contrastes conformes dans les deux thèmes, zoom à 200 %, respect de la réduction des animations, aucune information portée par la seule couleur.

**Adaptation aux écrans.**
- À partir de 1 280 pixels de large : trois colonnes.
- Sur tablette : les panneaux deviennent des onglets.
- Sur téléphone : consultation et exécution ; l'édition reste possible mais n'est pas optimisée.

**Raccourcis.** Liste définitive en phases 4 et 5 :
- Ctrl+Entrée : exécuter ; Échap : arrêter ;
- Ctrl+S : enregistrer ; Ctrl+Z et Ctrl+Y : annuler et rétablir ;
- Ctrl+K : palette de commandes.

Les raccourcis réservés par les navigateurs (Ctrl+T, Ctrl+N, Ctrl+W, Ctrl+Q) sont exclus.

## 9. Architecture technique

### 9.1 Technologies (versions courantes en octobre 2026)

- **Base :** React 19, TypeScript 6, Vite 8.
- **Qualité :** oxlint, Vitest 5, Playwright.
- **Éditeur texte :** CodeMirror 6.
- **Éditeur par blocs :** dnd-kit (glisser-déposer accessible au clavier).
- **État de l'application :** Zustand et Immer (avec annuler/rétablir).
- **Archives zip :** fflate.
- **Hors ligne :** vite-plugin-pwa.
- **Serveur :** aucun.

### 9.2 Organisation du dépôt

```
algoweb/
├─ PLAN.md, README.md, LICENSE (GPL-3.0), CHANGELOG.md
├─ .github/workflows/     intégration continue et déploiement sur GitHub Pages
├─ public/                icônes, manifeste de l'application
├─ src/
│  ├─ langage/            lexique, analyse syntaxique, AST, vérification, formateur
│  ├─ execution/          compilateur, bibliothèque d'exécution (sémantique Python), Web Worker
│  ├─ import-algobox/     lecture XML, conversion .alg → AlgoWeb, rapport
│  ├─ export/             Python, texte, image, impression
│  ├─ stockage/           bibliothèque localStorage, zip, liens de partage
│  └─ ui/                 composants React
└─ tests/
   ├─ programmes/         algorithmes, entrées et sorties attendues
   ├─ algobox/            fichiers .alg écrits pour les tests
   └─ e2e/                scénarios Playwright
```

Les modules `langage`, `execution`, `import-algobox` et `export` sont écrits en TypeScript pur, sans dépendance au navigateur. Ils se testent directement sous Node.

### 9.3 Chaîne de traitement du langage

1. **Analyse.** Le texte passe par le lexique puis par l'analyse syntaxique (descente récursive, et précédence d'opérateurs pour les expressions). On obtient un AST dont chaque nœud porte sa position et un identifiant stable.
2. **Vérification.** Portées, types et règles de la section 4.9 produisent les diagnostics et un AST typé.
3. **Formatage.** Le formateur transforme l'AST en texte canonique. Il est stable : formater deux fois donne le même texte.
4. **Lien entre les deux éditeurs.**
   - L'éditeur par blocs modifie l'AST, le formateur produit le texte, et c'est ce texte qui est enregistré.
   - En mode texte, le texte est réanalysé en continu.

### 9.4 Moteur d'exécution

- **Compilation.** L'AST typé est compilé en JavaScript, sous forme de fonctions génératrices : chaque instruction peut suspendre l'exécution (saisie, `Pause`, pas à pas, point d'arrêt). Le code produit est construit uniquement à partir de l'AST validé ; le texte de l'utilisateur n'est jamais évalué et les identifiants sont renommés.
- **Isolement.** L'exécution a lieu dans un Web Worker dédié : l'interface ne se fige jamais, et Arrêter termine le Worker à coup sûr.
- **Représentation des valeurs.**
  - Entier : `BigInt`. Réel : `number`. Booléen : `boolean`.
  - Chaîne : `string`, mesurée en caractères Unicode.
  - Liste : tableau accompagné du type de ses éléments.
- **Bibliothèque d'exécution.** Elle implémente la sémantique Python de la section 4.10 : `div` et `mod`, `round`, puissance, format d'affichage des réels, générateur Mersenne Twister.
- **Échanges avec l'interface.**
  - De l'interface vers le Worker : `lancer` (programme, mode, points d'arrêt, graine), `saisie`, `continuer`, `pas` (entrer, passer ou sortir), `pause`, `pointsArret`.
  - Du Worker vers l'interface : `sortie` (regroupée toutes les 50 ms environ), `demandeSaisie` (variable, type), `enPause` (ligne, variables, pile), `erreur` (ligne, message), `termine` (durée, nombre d'instructions).
- **Performances visées.** Une dizaine de millions d'opérations simples en quelques secondes.

### 9.5 Sécurité

- Aucun texte saisi ou importé n'est exécuté comme du JavaScript : un fichier partagé ne peut pas lancer de code arbitraire.
- Une politique de sécurité du contenu (CSP) est déclarée dans la page.
- Aucune ressource externe n'est chargée à l'exécution : tout est embarqué, ce qui permet aussi le fonctionnement hors ligne.

## 10. Qualité et tests

- **Tests unitaires (Vitest) :**
  - lexique et analyse syntaxique, messages d'erreur compris ;
  - formateur (stabilité) et vérificateur (catalogue complet des erreurs) ;
  - opérations de la bibliothèque d'exécution, sous forme de tables de cas Python : `div` et `mod` sur des négatifs, `round`, puissance, format des réels, indices ;
  - import `.alg` et export Python (fichiers de référence).
- **Corpus d'exécution.** Chaque programme de `tests/programmes/` s'accompagne d'un fichier d'entrées et des sorties attendues. Le corpus est exécuté par le moteur AlgoWeb sous Node.
- **Validation croisée avec CPython.** La CI exporte chaque programme du corpus, l'exécute avec `python3` sur les mêmes entrées et compare les sorties.
- **Tests de bout en bout (Playwright, Chromium, Firefox, WebKit) :**
  - écriture d'un algorithme, exécution avec saisie, pas à pas ;
  - sauvegarde automatique et rechargement, corbeille ;
  - téléchargements JSON et ZIP, imports JSON, ZIP et ALG ;
  - lien de partage, mode hors ligne.
- **Accessibilité.** Contrôle automatique axe-core pendant les tests de bout en bout, complété par une revue RGAA manuelle (clavier, lecteurs d'écran NVDA et VoiceOver).
- **Navigateurs pris en charge.** Les deux dernières versions majeures de Chrome, Edge, Firefox et Safari.
- **Intégration continue (GitHub Actions).**
  - À chaque envoi : oxlint, vérification des types, tests Vitest, validation croisée CPython, construction.
  - Sur `main` uniquement : tests de bout en bout.

## 11. Déploiement

- **Dépôt.** Dépôt GitHub public `algoweb`, sous licence GPL-3.0.
- **Mise en ligne.** Un envoi sur `main` lance successivement les tests, `vite build`, `actions/upload-pages-artifact` puis `actions/deploy-pages`.
- **Adresse.** Vite est configuré avec `base: '/algoweb/'`. L'application est donc servie à `https://<compte>.github.io/algoweb/` ; un nom de domaine personnalisé reste possible plus tard.
- **Application installable.**
  - Manifeste et service worker (portée `/algoweb/`).
  - Fonctionnement hors ligne dès la deuxième visite.
  - Message « Nouvelle version disponible » lors des mises à jour.
- **Versions.** Numérotation sémantique, `CHANGELOG.md`, version affichée dans « À propos ».
- **Routage.** Aucun routage serveur n'est nécessaire : l'application tient sur une seule page et les liens de partage passent par le fragment `#`.

## 12. Phases de développement

| Phase | Contenu | Critère de fin |
|---|---|---|
| 0. Initialisation | dossier `algoweb/` et dépôt Git ; Vite, React, TypeScript, oxlint, Vitest ; CI ; déploiement d'une page d'accueil sur GitHub Pages ; LICENSE, README, ce plan | site en ligne, CI au vert |
| 1. Langage | lexique, analyse syntaxique, AST, formateur, vérification des types et des portées, catalogue des messages | toute la section 4 est reconnue ; formateur stable ; chaque message d'erreur est testé |
| 2. Exécution | compilateur, bibliothèque d'exécution (sémantique Python, `BigInt`, aléatoire), Web Worker, saisie, erreurs, arrêt, bases du pas à pas | le corpus de programmes produit les sorties attendues |
| 3. Export Python | traduction, imports, annotations ; validation croisée CPython dans la CI | sorties identiques entre AlgoWeb et Python sur tout le corpus, hors différences documentées |
| 4. Interface v1 | mise en page, éditeur texte, console, exécution, bibliothèque localStorage (sauvegarde automatique, corbeille), téléchargements JSON et ZIP, imports JSON et ZIP, thèmes | un étudiant écrit, exécute, sauvegarde, télécharge et réimporte un algorithme sans aide ; première mise en ligne de test |
| 5. Débogueur et blocs | pas à pas complet, points d'arrêt, variables, pile d'appels ; éditeur par blocs (palette, édition en place, glisser-déposer, annuler/rétablir, clavier) synchronisé avec le texte | les deux modes sont équivalents ; tout est utilisable au clavier |
| 6. Import AlgoBox | lecture XML, conversion, déduction des types entier/réel, rapport d'import, fichiers de test | tous les fichiers de test sont importés sans perte ; le rapport est exact |
| 7. Finitions | liens de partage, mode hors ligne, aide intégrée et tutoriel, exports texte, image et impression, graine aléatoire, audit d'accessibilité, performances | audit RGAA sans non-conformité bloquante ; fonctionnement hors ligne vérifié |
| 8. Pilote et version 1.0 | essai avec une classe de BTS SIO, corrections, guide de l'étudiant et guide de l'enseignant | version 1.0 en ligne |

Les deux chantiers les plus délicats doivent être prototypés tôt :
- la fidélité à la sémantique de Python (phases 2 et 3) ;
- l'éditeur par blocs (phase 5).

## 13. Risques et points d'attention

| Risque | Parade |
|---|---|
| Perte des données du localStorage | avertissements, rappel de sauvegarde, téléchargements en un clic, demande de stockage persistant |
| Écarts avec Python | validation croisée avec CPython dans la CI, différences documentées |
| Performances de `BigInt` | mesure dès la phase 2 ; chemin rapide pour les petits entiers si nécessaire |
| Complexité de l'éditeur par blocs et accessibilité du glisser-déposer | dnd-kit avec capteurs clavier, commandes « monter » et « descendre » en alternative |
| Synchronisation entre le texte et les blocs quand le texte est invalide | mode blocs réservé au texte sans erreur de syntaxe |
| Dépôt public imposé par GitHub Pages gratuit | aucune donnée sensible dans le dépôt ; licence GPL-3.0 |
| Postes de l'établissement (navigateurs anciens, Chromebooks) | navigateurs récents exigés ; test sur les postes de l'établissement dès la phase 4 |
| Import AlgoBox forcément imparfait | rapport d'import transparent, avec la liste des points à vérifier |

## 14. Règles de développement

- **Indépendance.** Ne copier ni le code, ni les textes d'aide, ni les exemples d'AlgoBox. Seul le format `.alg` est implémenté, à partir de sa description (section 5.1).
- **Langue.** Interface, messages et documentation en français. Les noms du domaine sont aussi en français dans le code (`Instruction`, `Affectation`, `verifier`…).
- **Tests.** Chaque règle du langage est couverte par des tests, et chaque message destiné à l'étudiant est testé.
- **Cœur indépendant.** Les modules du cœur ne dépendent pas du DOM.
- **Accessibilité.** Elle est prise en compte dès le premier composant.
- **Intégration.** Des modifications courtes, et une CI au vert avant toute fusion.
