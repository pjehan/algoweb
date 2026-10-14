import type { TypeDeclare } from './ast.ts'

/**
 * Types manipulés par le vérificateur. `quelconque` désigne un type inconnu :
 * éléments d'une liste non typée, ou expression déjà signalée comme erronée.
 * Il est compatible avec tout, pour éviter les erreurs en cascade.
 */
export type Type =
  | { genre: 'entier' }
  | { genre: 'reel' }
  | { genre: 'chaine' }
  | { genre: 'booleen' }
  | { genre: 'liste'; element: Type }
  | { genre: 'quelconque' }
  | { genre: 'rien' }

export const T = {
  entier: { genre: 'entier' },
  reel: { genre: 'reel' },
  chaine: { genre: 'chaine' },
  booleen: { genre: 'booleen' },
  quelconque: { genre: 'quelconque' },
  rien: { genre: 'rien' },
  liste: (element: Type): Type => ({ genre: 'liste', element }),
} as const satisfies Record<string, Type | ((t: Type) => Type)>

export function depuisDeclare(type: TypeDeclare): Type {
  if (type.genre === 'liste') {
    return T.liste(type.element ? depuisDeclare(type.element) : T.quelconque)
  }
  return T[type.genre]
}

export function egaux(a: Type, b: Type): boolean {
  if (a.genre === 'liste' && b.genre === 'liste') return egaux(a.element, b.element)
  return a.genre === b.genre
}

export function estNumerique(t: Type): boolean {
  return t.genre === 'entier' || t.genre === 'reel'
}

export function estQuelconque(t: Type): boolean {
  return t.genre === 'quelconque'
}

/** Une valeur de type `source` peut-elle être rangée dans une variable de type `cible` ? */
export function affectable(source: Type, cible: Type): boolean {
  if (source.genre === 'quelconque' || cible.genre === 'quelconque') return true
  if (source.genre === 'entier' && cible.genre === 'reel') return true
  if (source.genre === 'liste' && cible.genre === 'liste') {
    return (
      source.element.genre === 'quelconque' ||
      cible.element.genre === 'quelconque' ||
      egaux(source.element, cible.element)
    )
  }
  return source.genre === cible.genre
}

/** Type commun à deux valeurs (éléments d'une liste, arguments de `min`) ; `undefined` s'il n'y en a pas. */
export function unifier(a: Type, b: Type): Type | undefined {
  if (a.genre === 'quelconque' || b.genre === 'quelconque') return T.quelconque
  if (estNumerique(a) && estNumerique(b)) return a.genre === b.genre ? a : T.reel
  if (a.genre === 'liste' && b.genre === 'liste') {
    return T.liste(unifier(a.element, b.element) ?? T.quelconque)
  }
  return egaux(a, b) ? a : undefined
}

/** Nom du type tel qu'on l'écrit dans une déclaration : `réel`, `liste de réels`. */
export function texteType(t: Type): string {
  switch (t.genre) {
    case 'entier':
      return 'entier'
    case 'reel':
      return 'réel'
    case 'chaine':
      return 'chaîne'
    case 'booleen':
      return 'booléen'
    case 'liste':
      return t.element.genre === 'quelconque' ? 'liste' : `liste ${complementPluriel(t.element)}`
    case 'quelconque':
      return 'valeur'
    case 'rien':
      return 'rien'
  }
}

/** `de réels`, `d'entiers`, `de listes de chaînes`. */
export function complementPluriel(t: Type): string {
  const pluriel = pluriels(t)
  return /^[aeiouyéè]/i.test(pluriel) ? `d'${pluriel}` : `de ${pluriel}`
}

function pluriels(t: Type): string {
  switch (t.genre) {
    case 'entier':
      return 'entiers'
    case 'reel':
      return 'réels'
    case 'chaine':
      return 'chaînes'
    case 'booleen':
      return 'booléens'
    case 'liste':
      return t.element.genre === 'quelconque' ? 'listes' : `listes ${complementPluriel(t.element)}`
    default:
      return 'valeurs'
  }
}

/** Le type précédé de son article, pour les messages : `un entier`, `une liste de réels`. */
export function avecArticle(t: Type): string {
  const feminin = t.genre === 'chaine' || t.genre === 'liste' || t.genre === 'quelconque'
  if (t.genre === 'rien') return 'aucune valeur'
  return `${feminin ? 'une' : 'un'} ${texteType(t)}`
}
