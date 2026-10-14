import { erreurExecution } from './erreurs.ts'
import { caracteres, comparer, egales, estNombre, typeValeur, versReel, type Valeur } from './valeurs.ts'

/**
 * Opérations de base avec la sémantique de Python (PLAN.md, section 4.10).
 * Les types sont vérifiés à l'analyse, mais les opérations restent sûres pour
 * les valeurs venant d'une liste non typée.
 */

function invalide(operateur: string, a: Valeur, b?: Valeur): never {
  throw erreurExecution('operation-invalide', operateur, b === undefined ? typeValeur(a) : `${typeValeur(a)} et ${typeValeur(b)}`)
}

/** Exécute `f` en traduisant le dépassement de mémoire de JavaScript. */
function memoire<T>(f: () => T): T {
  try {
    return f()
  } catch (e) {
    if (e instanceof RangeError) throw erreurExecution('memoire-insuffisante')
    throw e
  }
}

// ---------------------------------------------------------------- Arithmétique

export function addition(a: Valeur, b: Valeur): Valeur {
  if (typeof a === 'bigint' && typeof b === 'bigint') return a + b
  if (estNombre(a) && estNombre(b)) return versReel(a) + versReel(b)
  if (typeof a === 'string' && typeof b === 'string') return memoire(() => a + b)
  if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b]
  return invalide('+', a, b)
}

export function soustraction(a: Valeur, b: Valeur): Valeur {
  if (typeof a === 'bigint' && typeof b === 'bigint') return a - b
  if (estNombre(a) && estNombre(b)) return versReel(a) - versReel(b)
  return invalide('-', a, b)
}

export function multiplication(a: Valeur, b: Valeur): Valeur {
  if (typeof a === 'bigint' && typeof b === 'bigint') return a * b
  if (estNombre(a) && estNombre(b)) return versReel(a) * versReel(b)
  if (typeof b === 'bigint' && (typeof a === 'string' || Array.isArray(a))) return repeter(a, b)
  if (typeof a === 'bigint' && (typeof b === 'string' || Array.isArray(b))) return repeter(b, a)
  return invalide('*', a, b)
}

function repeter(v: string | Valeur[], n: bigint): Valeur {
  if (n <= 0n) return typeof v === 'string' ? '' : []
  if (n > 2n ** 32n) throw erreurExecution('memoire-insuffisante')
  const fois = Number(n)
  if (typeof v === 'string') return memoire(() => v.repeat(fois))
  return memoire(() => {
    const resultat: Valeur[] = new Array(v.length * fois)
    for (let k = 0; k < fois; k++) for (let i = 0; i < v.length; i++) resultat[k * v.length + i] = v[i]
    return resultat
  })
}

/** Division réelle `/` : toujours un réel, arrondi correctement comme en Python. */
export function division(a: Valeur, b: Valeur): Valeur {
  if (!estNombre(a) || !estNombre(b)) return invalide('/', a, b)
  if (typeof a === 'bigint' && typeof b === 'bigint') return divisionEntiers(a, b)
  const y = versReel(b)
  if (y === 0) throw erreurExecution('division-par-zero')
  return versReel(a) / y
}

const LIMITE_EXACTE = 2n ** 53n

function longueurBits(n: bigint): number {
  return n.toString(2).length
}

/** Quotient de deux entiers arrondi au réel le plus proche, même pour de très grands entiers. */
function divisionEntiers(a: bigint, b: bigint): number {
  if (b === 0n) throw erreurExecution('division-par-zero')
  const absA = a < 0n ? -a : a
  const absB = b < 0n ? -b : b
  if (absA <= LIMITE_EXACTE && absB <= LIMITE_EXACTE) return Number(a) / Number(b)
  if (absA === 0n) return (a < 0n) !== (b < 0n) ? -0 : 0
  // Quotient sur au moins 55 bits, plus un bit « collant » pour un arrondi exact.
  const decalage = 55 - (longueurBits(absA) - longueurBits(absB))
  const numerateur = decalage >= 0 ? absA << BigInt(decalage) : absA
  const denominateur = decalage >= 0 ? absB : absB << BigInt(-decalage)
  let q = numerateur / denominateur
  if (numerateur % denominateur !== 0n) q |= 1n
  let x = Number(q)
  let e = -decalage
  while (e > 0) {
    const pas = Math.min(e, 1000)
    x *= 2 ** pas
    e -= pas
  }
  while (e < 0) {
    const pas = Math.max(e, -1000)
    x *= 2 ** pas
    e -= pas
  }
  if (!Number.isFinite(x)) throw erreurExecution('resultat-trop-grand')
  return (a < 0n) !== (b < 0n) ? -x : x
}

function zeroSigne(modele: number): number {
  return modele < 0 || Object.is(modele, -0) ? -0 : 0
}

/** Quotient et reste de deux réels, selon l'algorithme de CPython. */
function divmodReels(x: number, y: number): [number, number] {
  if (y === 0) throw erreurExecution('division-par-zero')
  let reste = x % y
  let quotient = (x - reste) / y
  if (reste) {
    if (y < 0 !== reste < 0) {
      reste += y
      quotient -= 1
    }
  } else {
    reste = zeroSigne(y)
  }
  let plancher: number
  if (quotient) {
    plancher = Math.floor(quotient)
    if (quotient - plancher > 0.5) plancher += 1
  } else {
    plancher = zeroSigne(x / y)
  }
  return [plancher, reste]
}

/** Quotient entier `div`, arrondi vers le bas comme `//` en Python. */
export function quotient(a: Valeur, b: Valeur): Valeur {
  if (typeof a === 'bigint' && typeof b === 'bigint') {
    if (b === 0n) throw erreurExecution('division-par-zero')
    const q = a / b
    return a % b !== 0n && (a < 0n) !== (b < 0n) ? q - 1n : q
  }
  if (estNombre(a) && estNombre(b)) return divmodReels(versReel(a), versReel(b))[0]
  return invalide('div', a, b)
}

/** Reste `mod`, du signe du diviseur comme `%` en Python. */
export function reste(a: Valeur, b: Valeur): Valeur {
  if (typeof a === 'bigint' && typeof b === 'bigint') {
    if (b === 0n) throw erreurExecution('division-par-zero')
    const r = a % b
    return r !== 0n && (r < 0n) !== (b < 0n) ? r + b : r
  }
  if (estNombre(a) && estNombre(b)) return divmodReels(versReel(a), versReel(b))[1]
  return invalide('mod', a, b)
}

/**
 * Puissance `^`. Entre deux entiers, le résultat est un entier ; un exposant
 * négatif donne un réel comme en Python, sauf si l'analyse a déterminé que le
 * résultat devait être un entier (`entierAttendu`).
 */
export function puissance(a: Valeur, b: Valeur, entierAttendu: boolean): Valeur {
  if (typeof a === 'bigint' && typeof b === 'bigint') {
    if (b >= 0n) return memoire(() => a ** b)
    if (entierAttendu) throw erreurExecution('exposant-negatif')
    if (a === 0n) throw erreurExecution('zero-puissance-negative')
    return puissanceReels(versReel(a), versReel(b))
  }
  if (estNombre(a) && estNombre(b)) return puissanceReels(versReel(a), versReel(b))
  return invalide('^', a, b)
}

export function puissanceReels(x: number, y: number): number {
  if (y === 0) return 1
  if (Number.isNaN(y)) return x === 1 ? 1 : NaN
  if (Number.isNaN(x)) return NaN
  if (x === 0 && y < 0) throw erreurExecution('zero-puissance-negative')
  if (x < 0 && Number.isFinite(x) && Number.isFinite(y) && !Number.isInteger(y)) throw erreurExecution('puissance-non-reelle')
  if (x === 1) return 1
  if (x === -1 && !Number.isFinite(y)) return 1
  const r = x ** y
  if (!Number.isFinite(r) && Number.isFinite(x) && Number.isFinite(y)) throw erreurExecution('resultat-trop-grand')
  return r
}

export function oppose(a: Valeur): Valeur {
  if (typeof a === 'bigint') return -a
  if (typeof a === 'number') return -a
  return invalide('-', a)
}

// ---------------------------------------------------------------- Comparaisons

export function comparaison(operateur: '<' | '≤' | '>' | '≥', a: Valeur, b: Valeur): boolean {
  const c = comparer(a, b)
  if (c === undefined) return invalide(operateur, a, b)
  switch (operateur) {
    case '<':
      return c < 0
    case '≤':
      return c <= 0
    case '>':
      return c > 0
    case '≥':
      return c >= 0
  }
}

export function appartient(x: Valeur, collection: Valeur): boolean {
  if (typeof collection === 'string') {
    if (typeof x !== 'string') return invalide('dans', x, collection)
    return collection.includes(x)
  }
  if (Array.isArray(collection)) return collection.some((e) => egales(x, e))
  return invalide('dans', x, collection)
}

// ---------------------------------------------------------------- Indices et tranches

function position(indice: Valeur, longueur: number, chaine: boolean): number {
  if (typeof indice !== 'bigint') throw erreurExecution('operation-invalide', '[ ]', `${typeValeur(indice)} utilisé comme indice`)
  const i = indice < 0n ? indice + BigInt(longueur) : indice
  if (i < 0n || i >= BigInt(longueur)) throw erreurExecution('indice-hors-limites', indice.toString(), longueur, chaine)
  return Number(i)
}

export function element(objet: Valeur, indice: Valeur): Valeur {
  if (Array.isArray(objet)) return objet[position(indice, objet.length, false)]
  if (typeof objet === 'string') {
    const c = caracteres(objet)
    return c[position(indice, c.length, true)]
  }
  return invalide('[ ]', objet)
}

export function modifierElement(objet: Valeur, indice: Valeur, valeur: Valeur): void {
  if (!Array.isArray(objet)) return invalide('[ ]', objet)
  objet[position(indice, objet.length, false)] = valeur
}

/** Borne d'une tranche, ramenée dans [0 ; longueur] comme en Python. */
function borne(v: Valeur | undefined, longueur: number, defaut: number): number {
  if (v === undefined) return defaut
  if (typeof v !== 'bigint') throw erreurExecution('operation-invalide', '[ : ]', `${typeValeur(v)} utilisé comme borne`)
  const n = BigInt(longueur)
  const i = v < 0n ? v + n : v
  return Number(i < 0n ? 0n : i > n ? n : i)
}

export function tranche(objet: Valeur, debut: Valeur | undefined, fin: Valeur | undefined): Valeur {
  if (Array.isArray(objet)) {
    return objet.slice(borne(debut, objet.length, 0), borne(fin, objet.length, objet.length))
  }
  if (typeof objet === 'string') {
    const c = caracteres(objet)
    const d = borne(debut, c.length, 0)
    const f = borne(fin, c.length, c.length)
    return f > d ? c.slice(d, f).join('') : ''
  }
  return invalide('[ : ]', objet)
}
