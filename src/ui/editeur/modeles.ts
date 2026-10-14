import { nomAffiche, type Notation } from '../../langage/predefinis.ts'

/**
 * Modèles d'instructions, partagés par la palette et l'autocomplétion.
 * Syntaxe des champs de CodeMirror : `${nom}` est un champ à remplir (Tab
 * pour passer au suivant), `${}` la position finale ; `\t` est une indentation.
 */

export type Categorie =
  | 'Variables'
  | 'Entrées et sorties'
  | 'Calculs'
  | 'Conditions'
  | 'Boucles'
  | 'Listes'
  | 'Fonctions'
  | 'Commentaires'

export interface Modele {
  categorie: Categorie
  libelle: string
  /** Texte inséré, avec ses champs. */
  modele: string
  description: string
  /** Le modèle occupe des lignes entières (instruction ou bloc), et non une partie d'expression. */
  bloc: boolean
}

export const CATEGORIES: Categorie[] = ['Variables', 'Entrées et sorties', 'Calculs', 'Conditions', 'Boucles', 'Listes', 'Fonctions', 'Commentaires']

export function modeles(notation: Notation): Modele[] {
  const f = (python: string, n?: number) => nomAffiche(python, notation, n)
  const m = (categorie: Categorie, libelle: string, modele: string, description: string, bloc = true): Modele => ({ categorie, libelle, modele, description, bloc })
  return [
    m('Variables', 'Section Variables', 'Variables\n\t${nom} : ${entier}', 'Section de déclaration, avant Début.'),
    m('Variables', 'Déclarer une variable', '${nom} : ${entier}', 'À placer dans la section Variables. Types : entier, réel, chaîne, booléen, liste.'),
    m('Variables', 'Affecter une valeur', '${variable} ← ${valeur}', 'Range une valeur dans une variable.'),
    m('Entrées et sorties', 'Lire', 'Lire ${variable}', 'Demande une valeur au clavier.'),
    m('Entrées et sorties', 'Afficher', 'Afficher ${valeur} ↵', 'Affiche une ou plusieurs valeurs, puis passe à la ligne.'),
    m('Entrées et sorties', 'Afficher sans retour', 'Afficher ${valeur}', 'Affiche sans passer à la ligne.'),
    m('Entrées et sorties', 'Pause', 'Pause', 'Interrompt l’exécution jusqu’à ce qu’on la reprenne.'),
    m('Calculs', 'Racine carrée', `${f('sqrt')}(\${x})`, 'Racine carrée d’un nombre.', false),
    m('Calculs', 'Arrondi', `${f('round')}(\${x}, \${2})`, 'Arrondi à n décimales.', false),
    m('Calculs', 'Valeur absolue', `${f('abs')}(\${x})`, 'Valeur absolue.', false),
    m('Calculs', 'Entier aléatoire', `${f('randint')}(\${1}, \${6})`, 'Entier tiré au hasard entre a et b inclus.', false),
    m('Calculs', 'Quotient entier', '${a} div ${b}', 'Quotient de la division entière.', false),
    m('Calculs', 'Reste', '${a} mod ${b}', 'Reste de la division entière.', false),
    m('Calculs', 'Conversion en chaîne', `${f('str')}(\${x})`, 'Convertit une valeur en chaîne.', false),
    m('Conditions', 'Si', 'Si ${condition} alors\n\t${}\nFinSi', 'Exécute des instructions si la condition est vraie.'),
    m('Conditions', 'Si … Sinon', 'Si ${condition} alors\n\t${}\nSinon\n\t\nFinSi', 'Deux cas : la condition est vraie, ou fausse.'),
    m('Conditions', 'Sinon si', 'Sinon si ${condition} alors\n\t${}', 'Cas supplémentaire dans un Si.'),
    m('Boucles', 'Pour', 'Pour ${i} de ${1} à ${n} faire\n\t${}\nFinPour', 'Répète pour chaque valeur du compteur.'),
    m('Boucles', 'Pour avec un pas', 'Pour ${i} de ${10} à ${0} pas de ${-2} faire\n\t${}\nFinPour', 'Compteur qui avance d’un pas donné.'),
    m('Boucles', 'Pour chaque', 'Pour chaque ${x} dans ${L} faire\n\t${}\nFinPour', 'Parcourt les éléments d’une liste ou d’une chaîne.'),
    m('Boucles', 'TantQue', 'TantQue ${condition} faire\n\t${}\nFinTantQue', 'Répète tant que la condition est vraie.'),
    m('Boucles', 'Répéter', 'Répéter\n\t${}\nJusqu\'à ${condition}', 'Répète au moins une fois, jusqu’à ce que la condition soit vraie.'),
    m('Listes', 'Liste vide', '${L} ← []', 'Crée une liste vide.'),
    m('Listes', 'Ajouter', 'ajouter(${L}, ${x})', 'Ajoute un élément à la fin de la liste.'),
    m('Listes', 'Insérer', 'insérer(${L}, ${i}, ${x})', 'Insère un élément à l’indice i.'),
    m('Listes', 'Supprimer', 'supprimer(${L}, ${i})', 'Supprime l’élément d’indice i.'),
    m('Listes', 'Longueur', `${f('len')}(\${L})`, 'Nombre d’éléments d’une liste ou de caractères d’une chaîne.', false),
    m('Listes', 'Élément', '${L}[${i}]', 'Élément d’indice i (le premier a l’indice 0).', false),
    m('Fonctions', 'Fonction', 'Fonction ${nom}(${x} : ${entier}) : ${entier}\nDébut\n\t${}\n\tRetourner ${resultat}\nFinFonction', 'Sous-programme qui renvoie une valeur. À placer avant l’algorithme principal.'),
    m('Fonctions', 'Procédure', 'Procédure ${nom}(${x} : ${entier})\nDébut\n\t${}\nFinProcédure', 'Sous-programme qui ne renvoie rien. À placer avant l’algorithme principal.'),
    m('Fonctions', 'Retourner', 'Retourner ${valeur}', 'Renvoie le résultat d’une fonction.'),
    m('Commentaires', 'Commentaire', '// ${commentaire}', 'Texte ignoré à l’exécution.'),
  ]
}

/** Texte d'un modèle sans ses champs, pour le glisser-déposer. */
export function texteSimple(modele: string): string {
  return modele.replace(/\$\{([^}]*)\}/g, '$1').replace(/\t/g, '  ')
}
