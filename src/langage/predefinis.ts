import { normaliser } from './normalisation.ts'

export type Notation = 'python' | 'francais'

export interface Predefini {
  /** Nom Python, utilisé dans le texte enregistré et dans l'export. */
  python: string
  /** Nom affiché avec la notation française. */
  francais: string
  genre: 'fonction' | 'constante'
  /** Module Python à importer à l'export. */
  module?: 'math' | 'random'
  /** Nombre d'arguments acceptés (`max` vaut `Infinity` pour `min` et `max`). */
  min: number
  max: number
  /** Signature et rôle, pour l'aide et l'autocomplétion. */
  role: string
}

function f(
  python: string,
  francais: string,
  min: number,
  max: number,
  role: string,
  module?: 'math' | 'random',
): Predefini {
  return { python, francais, genre: 'fonction', module, min, max, role }
}

/** Fonctions prédéfinies (PLAN.md, section 4.7). */
export const PREDEFINIS: readonly Predefini[] = [
  f('abs', 'absolu', 1, 1, 'valeur absolue'),
  f('round', 'arrondi', 1, 2, 'arrondi à l’entier le plus proche, ou à n décimales'),
  f('min', 'min', 1, Infinity, 'plus petite valeur'),
  f('max', 'max', 1, Infinity, 'plus grande valeur'),
  f('sum', 'somme', 1, 1, 'somme des éléments d’une liste'),
  f('len', 'longueur', 1, 1, 'longueur d’une chaîne ou d’une liste'),
  f('int', 'entier', 1, 1, 'conversion en entier'),
  f('float', 'réel', 1, 1, 'conversion en réel'),
  f('str', 'chaîne', 1, 1, 'conversion en chaîne'),
  f('ord', 'code', 1, 1, 'code Unicode d’un caractère'),
  f('chr', 'caractère', 1, 1, 'caractère correspondant à un code Unicode'),
  f('sqrt', 'racine', 1, 1, 'racine carrée', 'math'),
  f('floor', 'plancher', 1, 1, 'arrondi à l’entier inférieur', 'math'),
  f('ceil', 'plafond', 1, 1, 'arrondi à l’entier supérieur', 'math'),
  f('exp', 'exp', 1, 1, 'exponentielle', 'math'),
  f('log', 'ln', 1, 2, 'logarithme népérien, ou en base b', 'math'),
  f('log10', 'log10', 1, 1, 'logarithme décimal', 'math'),
  f('cos', 'cos', 1, 1, 'cosinus (radians)', 'math'),
  f('sin', 'sin', 1, 1, 'sinus (radians)', 'math'),
  f('tan', 'tan', 1, 1, 'tangente (radians)', 'math'),
  f('acos', 'acos', 1, 1, 'arc cosinus', 'math'),
  f('asin', 'asin', 1, 1, 'arc sinus', 'math'),
  f('atan', 'atan', 1, 1, 'arc tangente', 'math'),
  { python: 'pi', francais: 'pi', genre: 'constante', module: 'math', min: 0, max: 0, role: 'le nombre π' },
  { python: 'e', francais: 'e', genre: 'constante', module: 'math', min: 0, max: 0, role: 'le nombre e' },
  f('random', 'aléa', 0, 0, 'réel aléatoire dans [0 ; 1[', 'random'),
  f('randint', 'aléaEntier', 2, 2, 'entier aléatoire entre a et b inclus', 'random'),
  f('choice', 'choix', 1, 1, 'élément tiré au hasard', 'random'),
]

/** Procédures prédéfinies : même nom dans les deux notations. */
export const PROCEDURES_PREDEFINIES = {
  ajouter: { min: 2, max: 2, role: 'ajouter(L, x) : ajoute x à la fin de la liste L' },
  insérer: { min: 3, max: 3, role: 'insérer(L, i, x) : insère x à l’indice i de la liste L' },
  supprimer: { min: 2, max: 2, role: 'supprimer(L, i) : supprime l’élément d’indice i de la liste L' },
} as const

export type NomProcedurePredefinie = keyof typeof PROCEDURES_PREDEFINIES

const parPython = new Map(PREDEFINIS.map((p) => [p.python, p]))
const parFrancais = new Map(PREDEFINIS.map((p) => [normaliser(p.francais), p]))
const procedures = new Map(
  (Object.keys(PROCEDURES_PREDEFINIES) as NomProcedurePredefinie[]).map((nom) => [normaliser(nom), nom]),
)

export function predefiniPython(nom: string): Predefini | undefined {
  return parPython.get(nom)
}

/**
 * Prédéfini désigné par `nom`, dans l'une ou l'autre notation. Le nom Python
 * doit être exact ; le nom français ignore la casse et les accents.
 */
export function trouverPredefini(nom: string): Predefini | undefined {
  return parPython.get(nom) ?? parFrancais.get(normaliser(nom))
}

export function trouverProcedurePredefinie(nom: string): NomProcedurePredefinie | undefined {
  return procedures.get(normaliser(nom))
}

/** Nom affiché d'une fonction prédéfinie. `log` à un argument devient `ln` en notation française. */
export function nomAffiche(python: string, notation: Notation, nombreArguments?: number): string {
  const p = parPython.get(python)
  if (!p || notation === 'python') return python
  if (python === 'log' && nombreArguments === 2) return 'log'
  return p.francais
}

// ---------------------------------------------------------------- Noms réservés

/** Mots-clés AlgoWeb, sous forme normalisée. */
export const MOTS_CLES = new Set([
  'algorithme', 'variables', 'debut', 'fin',
  'si', 'alors', 'sinon', 'sinonsi', 'finsi',
  'pour', 'faire', 'finpour', 'tantque', 'fintantque', 'repeter', "jusqu'a",
  'lire', 'saisir', 'afficher', 'ecrire',
  'fonction', 'finfonction', 'procedure', 'finprocedure', 'retourner', 'renvoyer', 'pause',
  'et', 'ou', 'non', 'mod', 'div', 'dans', 'vrai', 'faux',
  'entier', 'reel', 'chaine', 'booleen', 'liste',
])

const MOTS_CLES_PYTHON = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class',
  'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global',
  'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise',
  'return', 'try', 'while', 'with', 'yield',
])

/** Noms Python utilisés par le code exporté. */
const NOMS_EXPORT = new Set(['print', 'input', 'range', 'bool', 'list', 'seed', 'math'])

export type RaisonReservee = 'mot-cle' | 'python' | 'predefini'

/**
 * Raison pour laquelle `nom` ne peut pas servir d'identifiant, ou `undefined`.
 *
 * Les noms Python des prédéfinis sont toujours réservés, pour que le code
 * exporté reste valide. Les noms français ne le sont que pour les fonctions et
 * procédures : une variable `somme` ne se confond jamais avec l'appel `somme(L)`.
 */
export function raisonReservee(nom: string, genre: 'variable' | 'sous-programme' = 'variable'): RaisonReservee | undefined {
  if (MOTS_CLES.has(normaliser(nom))) return 'mot-cle'
  if (MOTS_CLES_PYTHON.has(nom) || NOMS_EXPORT.has(nom)) return 'python'
  if (parPython.has(nom)) return 'predefini'
  if (genre === 'sous-programme' && (trouverPredefini(nom) || trouverProcedurePredefinie(nom))) return 'predefini'
  return undefined
}

export function estMotCle(mot: string): boolean {
  return MOTS_CLES.has(normaliser(mot))
}
