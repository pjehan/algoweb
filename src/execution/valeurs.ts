import { erreurExecution } from './erreurs.ts'

/**
 * Représentation des valeurs à l'exécution (PLAN.md, section 9.4) :
 * entier → bigint, réel → number, booléen → boolean, chaîne → string,
 * liste → tableau JavaScript, partagé comme une liste Python.
 */
export type Valeur = bigint | number | string | boolean | Valeur[]

/** Conversion d'un entier en réel, arrondie comme en Python ; erreur au-delà du plus grand réel. */
export function versReel(v: bigint | number): number {
  if (typeof v === 'number') return v
  const x = Number(v)
  if (!Number.isFinite(x)) throw erreurExecution('entier-trop-grand')
  return x
}

export function estNombre(v: Valeur): v is bigint | number {
  return typeof v === 'bigint' || typeof v === 'number'
}

// ---------------------------------------------------------------- Chaînes en caractères Unicode

const SUBSTITUTS = /[\uD800-\uDFFF]/

/** Caractères Unicode d'une chaîne (et non unités UTF-16). */
export function caracteres(s: string): string[] {
  return SUBSTITUTS.test(s) ? Array.from(s) : s.split('')
}

export function longueurChaine(s: string): number {
  return SUBSTITUTS.test(s) ? Array.from(s).length : s.length
}

// ---------------------------------------------------------------- Affichage

/** Affichage d'un réel au format `repr` de Python : `3.0`, `0.1`, `1e-05`, `1e+16`. */
export function texteReel(x: number): string {
  if (Number.isNaN(x)) return 'nan'
  if (x === Infinity) return 'inf'
  if (x === -Infinity) return '-inf'
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0'
  // toExponential sans argument donne les chiffres de la plus courte écriture exacte.
  const [mantisse, exposantTexte] = x.toExponential().split('e')
  const exposant = Number(exposantTexte)
  const signe = mantisse.startsWith('-') ? '-' : ''
  const chiffres = mantisse.replace('-', '').replace('.', '')
  if (exposant >= -4 && exposant < 16) {
    if (exposant < 0) return `${signe}0.${'0'.repeat(-exposant - 1)}${chiffres}`
    const entiere = chiffres.slice(0, exposant + 1).padEnd(exposant + 1, '0')
    const decimale = chiffres.slice(exposant + 1) || '0'
    return `${signe}${entiere}.${decimale}`
  }
  const m = chiffres.length > 1 ? `${chiffres[0]}.${chiffres.slice(1)}` : chiffres
  const e = String(Math.abs(exposant)).padStart(2, '0')
  return `${signe}${m}e${exposant < 0 ? '-' : '+'}${e}`
}

/** Écriture d'une chaîne au format `repr` de Python, entre apostrophes ou guillemets. */
export function texteChaineRepr(s: string): string {
  const guillemet = s.includes("'") && !s.includes('"') ? '"' : "'"
  let resultat = guillemet
  for (const c of s) {
    const code = c.codePointAt(0)!
    if (c === '\\') resultat += '\\\\'
    else if (c === guillemet) resultat += '\\' + c
    else if (c === '\n') resultat += '\\n'
    else if (c === '\t') resultat += '\\t'
    else if (c === '\r') resultat += '\\r'
    else if (code < 0x20 || (code >= 0x7f && code < 0xa0)) resultat += '\\x' + code.toString(16).padStart(2, '0')
    else resultat += c
  }
  return resultat + guillemet
}

/** Valeur telle que l'affiche `Afficher` (comme `str` en Python, booléens en français). */
export function texte(v: Valeur): string {
  return typeof v === 'string' ? v : repr(v)
}

/** Valeur telle qu'elle apparaît dans une liste (comme `repr` en Python). */
export function repr(v: Valeur, vues: Set<Valeur[]> = new Set()): string {
  switch (typeof v) {
    case 'bigint':
      return v.toString()
    case 'number':
      return texteReel(v)
    case 'boolean':
      return v ? 'vrai' : 'faux'
    case 'string':
      return texteChaineRepr(v)
    default:
      if (vues.has(v)) return '[...]'
      vues.add(v)
      try {
        return `[${v.map((x) => repr(x, vues)).join(', ')}]`
      } finally {
        vues.delete(v)
      }
  }
}

// ---------------------------------------------------------------- Comparaisons

/** Signe de a - b pour un entier et un réel, comparés exactement comme en Python ; NaN si b est nan. */
function comparerEntierReel(a: bigint, b: number): number {
  if (Number.isNaN(b)) return NaN
  if (b === Infinity) return -1
  if (b === -Infinity) return 1
  const plancher = Math.floor(b)
  const p = BigInt(plancher)
  if (a < p) return -1
  if (a > p) return 1
  return b > plancher ? -1 : 0
}

function comparerNombres(a: bigint | number, b: bigint | number): number {
  if (typeof a === 'bigint' && typeof b === 'bigint') return a < b ? -1 : a > b ? 1 : 0
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : a === b ? 0 : NaN
  if (typeof a === 'bigint') return comparerEntierReel(a, b as number)
  return -comparerEntierReel(b as bigint, a)
}

function comparerChaines(a: string, b: string): number {
  if (!SUBSTITUTS.test(a) && !SUBSTITUTS.test(b)) return a < b ? -1 : a > b ? 1 : 0
  // Ordre des points de code, comme Python, et non des unités UTF-16.
  const ca = Array.from(a)
  const cb = Array.from(b)
  for (let i = 0; i < Math.min(ca.length, cb.length); i++) {
    const d = ca[i].codePointAt(0)! - cb[i].codePointAt(0)!
    if (d !== 0) return Math.sign(d)
  }
  return Math.sign(ca.length - cb.length)
}

/** Égalité comme `==` en Python (un entier et un réel égaux sont égaux). */
export function egales(a: Valeur, b: Valeur): boolean {
  if (estNombre(a) && estNombre(b)) return comparerNombres(a, b) === 0
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a === b) return true
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!egales(a[i], b[i])) return false
    return true
  }
  return a === b
}

/**
 * Ordre comme `<` en Python : signe de a - b, NaN si les valeurs ne sont pas
 * ordonnées (nan), `undefined` si leurs types ne se comparent pas.
 */
export function comparer(a: Valeur, b: Valeur): number | undefined {
  if (estNombre(a) && estNombre(b)) return comparerNombres(a, b)
  if (typeof a === 'string' && typeof b === 'string') return comparerChaines(a, b)
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (!egales(a[i], b[i])) return comparer(a[i], b[i])
    }
    return Math.sign(a.length - b.length)
  }
  return undefined
}

/** Type d'une valeur avec son article, pour les messages : « un entier », « une liste ». */
export function typeValeur(v: Valeur): string {
  switch (typeof v) {
    case 'bigint':
      return 'un entier'
    case 'number':
      return 'un réel'
    case 'boolean':
      return 'un booléen'
    case 'string':
      return 'une chaîne'
    default:
      return 'une liste'
  }
}
