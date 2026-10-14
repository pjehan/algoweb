import type { Type } from '../langage/types.ts'
import type { Valeur } from './valeurs.ts'

/**
 * Code de la machine d'exécution. Chaque instruction occupe trois cases du
 * tableau `code` : le code d'opération et deux arguments.
 */
export const OP = {
  CONST: 1, // a : indice de la constante
  LOAD: 2, // a : case de la variable
  STORE: 3, // a : case de la variable
  POP: 4,
  CONV: 5, // a : indice de la conversion
  ADD: 6,
  SUB: 7,
  MUL: 8,
  DIV: 9,
  IDIV: 10,
  MOD: 11,
  POW: 12, // a : 1 si le résultat doit être un entier
  NEG: 13,
  NOT: 14,
  EQ: 15,
  NE: 16,
  LT: 17,
  LE: 18,
  GT: 19,
  GE: 20,
  IN: 21,
  JUMP: 22, // a : cible
  JUMP_FAUX: 23, // a : cible ; dépile la condition
  JUMP_FAUX_GARDE: 24, // a : cible ; garde faux sur la pile et saute, sinon dépile
  JUMP_VRAI_GARDE: 25, // a : cible ; garde vrai sur la pile et saute, sinon dépile
  INDEX: 26,
  TRANCHE: 27, // a : 1 si début présent + 2 si fin présente
  STORE_INDEX: 28, // pile : valeur, objet, indice
  LISTE: 29, // a : nombre d'éléments
  PREDEF: 30, // a : indice du nom de la fonction prédéfinie ; b : nombre d'arguments
  AJOUTER: 31,
  INSERER: 32,
  SUPPRIMER: 33,
  APPEL: 34, // a : indice du sous-programme ; b : nombre d'arguments
  RETOUR: 35,
  RETOUR_RIEN: 36,
  FIN: 37,
  FIN_SANS_RETOUR: 38,
  AFFICHER: 39, // a : nombre de valeurs ; b : 1 pour un retour à la ligne
  LIRE: 40, // a : indice de la saisie
  PAUSE: 41,
  LIGNE: 42, // a : numéro de ligne
  POUR_PAS: 43, // a : première case de la boucle (courant, fin, pas)
  POUR_TEST: 44, // a : première case ; b : cible de sortie
  POUR_INC: 45, // a : première case
  PARCOURS_INIT: 46, // a : première case (éléments, position)
  PARCOURS_SUIVANT: 47, // a : première case ; b : cible de sortie
} as const

export interface VariableCompilee {
  nom: string
  type: Type
  case: number
}

export interface SousProgrammeCompile {
  /** Nom du sous-programme ; vide pour l'algorithme principal. */
  nom: string
  genre: 'principal' | 'fonction' | 'procedure'
  code: number[]
  nombreParametres: number
  nombreCases: number
  /** Variables visibles (paramètres et variables déclarées), pour le débogueur. */
  variables: VariableCompilee[]
}

export interface Conversion {
  type: Type
  /** Texte de la cible, pour les messages. */
  cible: string
}

export interface Saisie {
  /** Texte affiché avant la saisie, comme `input("x = ")` en Python. */
  invite: string
  /** Variable ou élément lu. */
  cible: string
  type: Type
}

export interface ProgrammeCompile {
  /** L'algorithme principal est à l'indice 0. */
  sousProgrammes: SousProgrammeCompile[]
  constantes: Valeur[]
  conversions: Conversion[]
  saisies: Saisie[]
  /** Noms Python des fonctions prédéfinies appelées. */
  predefinis: string[]
}
