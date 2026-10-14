import type { Aleatoire } from './aleatoire.ts'
import { texteVersEntier, texteVersReel } from './conversions.ts'
import { erreurExecution } from './erreurs.ts'
import { comparer, caracteres, estNombre, texte, typeValeur, versReel, type Valeur } from './valeurs.ts'

/**
 * Fonctions et procédures prédéfinies (PLAN.md, section 4.7), avec le
 * comportement exact de Python : arrondi au pair, somme compensée, erreurs.
 */

export interface ContexteBibliotheque {
  alea: Aleatoire
  /** Nom affiché d'une fonction prédéfinie, dans la notation de l'utilisateur. */
  nom: (python: string, nombreArguments?: number) => string
}

type Fonction = (args: Valeur[], ctx: ContexteBibliotheque) => Valeur

function nombre(v: Valeur, nom: string): bigint | number {
  if (!estNombre(v)) throw erreurExecution('operation-invalide', nom, typeValeur(v))
  return v
}

// ---------------------------------------------------------------- Arrondis

/** Arrondi de C : à l'entier le plus proche, à mi-chemin loin de zéro. */
function arrondiC(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x)
}

/** `round(x)` pour un réel : à mi-chemin vers le pair, comme CPython. */
export function arrondiEntier(x: number, nom: string): bigint {
  if (!Number.isFinite(x)) throw erreurExecution('conversion-infini', nom)
  let r = arrondiC(x)
  if (Math.abs(x - r) === 0.5) r = 2 * arrondiC(x / 2)
  return BigInt(r)
}

/** Mantisse et exposant exacts d'un réel fini non nul : x = m × 2^e. */
function decomposer(x: number): [bigint, number] {
  const vue = new DataView(new ArrayBuffer(8))
  vue.setFloat64(0, Math.abs(x))
  const haut = vue.getUint32(0)
  const bas = vue.getUint32(4)
  const exposant = (haut >>> 20) & 0x7ff
  const mantisse = (BigInt(haut & 0xfffff) << 32n) | BigInt(bas)
  if (exposant === 0) return [mantisse, -1074]
  return [mantisse | (1n << 52n), exposant - 1075]
}

/** Quotient de num par den arrondi à l'entier le plus proche, à mi-chemin vers le pair. */
function diviserAuPair(num: bigint, den: bigint): bigint {
  const q = num / den
  const r2 = (num % den) * 2n
  if (r2 > den || (r2 === den && q % 2n === 1n)) return q + 1n
  return q
}

/** `round(x, n)` pour un réel : arrondi exact de la valeur décimale, à mi-chemin vers le pair. */
export function arrondiReel(x: number, n: number): number {
  if (!Number.isFinite(x) || x === 0) return x
  if (n > 323) return x
  if (n < -308) return x < 0 ? -0 : 0
  const [m, e] = decomposer(x)
  let num = m
  let den = 1n
  if (e >= 0) num <<= BigInt(e)
  else den <<= BigInt(-e)
  if (n >= 0) num *= 10n ** BigInt(n)
  else den *= 10n ** BigInt(-n)
  const q = diviserAuPair(num, den)
  const resultat = Number.parseFloat(`${x < 0 ? '-' : ''}${q}e${-n}`)
  if (!Number.isFinite(resultat)) throw erreurExecution('resultat-trop-grand')
  return resultat
}

/** `round(n, k)` pour un entier. */
function arrondiEntierDecimales(n: bigint, k: number): bigint {
  if (k >= 0) return n
  const puissance = 10n ** BigInt(-k)
  const negatif = n < 0n
  const q = diviserAuPair(negatif ? -n : n, puissance) * puissance
  return negatif ? -q : q
}

// ---------------------------------------------------------------- Logarithmes

const BITS = (n: bigint) => n.toString(2).length

/** Logarithme d'un entier quelconque, calculé comme CPython au-delà du plus grand réel. */
function logEntier(n: bigint, f: (x: number) => number, nom: string): number {
  if (n <= 0n) throw erreurExecution('logarithme-invalide', nom)
  const x = Number(n)
  if (Number.isFinite(x)) return f(x)
  const e = BITS(n)
  const decalage = BigInt(e - 64)
  let t = n >> decalage
  if ((n & ((1n << decalage) - 1n)) !== 0n) t |= 1n
  return f(Number(t) / 2 ** 64) + f(2) * e
}

function logarithme(v: Valeur, f: (x: number) => number, nom: string): number {
  const x = nombre(v, nom)
  if (typeof x === 'bigint') return logEntier(x, f, nom)
  if (x <= 0) throw erreurExecution('logarithme-invalide', nom)
  return f(x)
}

// ---------------------------------------------------------------- Fonctions mathématiques

function reelDe(v: Valeur, nom: string): number {
  return versReel(nombre(v, nom))
}

function fonctionReelle(python: string, f: (x: number) => number, domaine?: (x: number) => boolean): Fonction {
  return ([v], ctx) => {
    const nom = ctx.nom(python)
    const x = reelDe(v, nom)
    if (domaine && !Number.isNaN(x) && !domaine(x)) throw erreurExecution('hors-domaine', nom)
    return f(x)
  }
}

/** Somme d'une liste comme `sum` en Python 3.12 et suivants (somme compensée de Neumaier pour les réels). */
function somme(liste: Valeur[], nom: string): Valeur {
  let entier = 0n
  let i = 0
  for (; i < liste.length; i++) {
    const v = liste[i]
    if (typeof v !== 'bigint') break
    entier += v
  }
  if (i === liste.length) return entier
  let total = versReel(entier)
  let compensation = 0
  for (; i < liste.length; i++) {
    const x = reelDe(liste[i], nom)
    const t = total + x
    if (Math.abs(total) >= Math.abs(x)) compensation += total - t + x
    else compensation += x - t + total
    total = t
  }
  if (compensation !== 0 && Number.isFinite(compensation)) total += compensation
  return total
}

function extremum(args: Valeur[], nom: string, signe: 1 | -1): Valeur {
  let valeurs: Valeur[] = args
  if (args.length === 1) {
    const [seule] = args
    if (typeof seule === 'string') valeurs = caracteres(seule)
    else if (Array.isArray(seule)) valeurs = seule
    else throw erreurExecution('operation-invalide', nom, typeValeur(seule))
  }
  if (valeurs.length === 0) throw erreurExecution('collection-vide', nom)
  let meilleur = valeurs[0]
  for (let k = 1; k < valeurs.length; k++) {
    const c = comparer(valeurs[k], meilleur)
    if (c === undefined) throw erreurExecution('operation-invalide', nom, `${typeValeur(valeurs[k])} et ${typeValeur(meilleur)}`)
    if (c * signe > 0) meilleur = valeurs[k]
  }
  return meilleur
}

function versEntier(v: Valeur, nom: string): bigint {
  switch (typeof v) {
    case 'bigint':
      return v
    case 'number':
      if (!Number.isFinite(v)) throw erreurExecution('conversion-infini', nom)
      return BigInt(Math.trunc(v))
    case 'boolean':
      return v ? 1n : 0n
    case 'string': {
      const n = texteVersEntier(v)
      if (n === undefined) throw erreurExecution('conversion-impossible', v, 'entier')
      return n
    }
    default:
      throw erreurExecution('operation-invalide', nom, typeValeur(v))
  }
}

function plancherOuPlafond(v: Valeur, f: (x: number) => number, nom: string): bigint {
  const x = nombre(v, nom)
  if (typeof x === 'bigint') return x
  if (!Number.isFinite(x)) throw erreurExecution('conversion-infini', nom)
  return BigInt(f(x))
}

function sequence(v: Valeur, nom: string): Valeur[] {
  if (typeof v === 'string') return caracteres(v)
  if (Array.isArray(v)) return v
  throw erreurExecution('operation-invalide', nom, typeValeur(v))
}

const FONCTIONS: Record<string, Fonction> = {
  abs: ([v], ctx) => {
    const x = nombre(v, ctx.nom('abs'))
    return typeof x === 'bigint' ? (x < 0n ? -x : x) : Math.abs(x)
  },
  round: ([v, n], ctx) => {
    const nom = ctx.nom('round')
    const x = nombre(v, nom)
    if (n === undefined) return typeof x === 'bigint' ? x : arrondiEntier(x, nom)
    if (typeof n !== 'bigint') throw erreurExecution('operation-invalide', nom, typeValeur(n))
    const k = n > 10000n ? 10000 : n < -10000n ? -10000 : Number(n)
    return typeof x === 'bigint' ? arrondiEntierDecimales(x, k) : arrondiReel(x, k)
  },
  min: (args, ctx) => extremum(args, ctx.nom('min'), -1),
  max: (args, ctx) => extremum(args, ctx.nom('max'), 1),
  sum: ([v], ctx) => somme(sequence(v, ctx.nom('sum')), ctx.nom('sum')),
  len: ([v], ctx) => BigInt(sequence(v, ctx.nom('len')).length),
  int: ([v], ctx) => versEntier(v, ctx.nom('int')),
  float: ([v], ctx) => {
    if (typeof v === 'string') {
      const x = texteVersReel(v)
      if (x === undefined) throw erreurExecution('conversion-impossible', v, 'réel')
      return x
    }
    if (typeof v === 'boolean') return v ? 1 : 0
    return reelDe(v, ctx.nom('float'))
  },
  str: ([v]) => texte(v),
  ord: ([v], ctx) => {
    const nom = ctx.nom('ord')
    if (typeof v !== 'string') throw erreurExecution('operation-invalide', nom, typeValeur(v))
    const c = caracteres(v)
    if (c.length !== 1) throw erreurExecution('caractere-attendu', nom, c.length)
    return BigInt(c[0].codePointAt(0)!)
  },
  chr: ([v], ctx) => {
    const nom = ctx.nom('chr')
    if (typeof v !== 'bigint') throw erreurExecution('operation-invalide', nom, typeValeur(v))
    if (v < 0n || v > 0x10ffffn) throw erreurExecution('code-invalide', nom)
    return String.fromCodePoint(Number(v))
  },
  sqrt: ([v], ctx) => {
    const nom = ctx.nom('sqrt')
    const x = reelDe(v, nom)
    if (x < 0) throw erreurExecution('racine-negative', nom)
    return Math.sqrt(x)
  },
  floor: ([v], ctx) => plancherOuPlafond(v, Math.floor, ctx.nom('floor')),
  ceil: ([v], ctx) => plancherOuPlafond(v, Math.ceil, ctx.nom('ceil')),
  exp: ([v], ctx) => {
    const x = reelDe(v, ctx.nom('exp'))
    const r = Math.exp(x)
    if (!Number.isFinite(r) && Number.isFinite(x)) throw erreurExecution('resultat-trop-grand')
    return r
  },
  log: (args, ctx) => {
    const nom = ctx.nom('log', args.length)
    const x = logarithme(args[0], Math.log, nom)
    if (args.length === 1) return x
    const base = logarithme(args[1], Math.log, nom)
    if (base === 0) throw erreurExecution('division-par-zero')
    return x / base
  },
  log10: ([v], ctx) => logarithme(v, Math.log10, ctx.nom('log10')),
  cos: fonctionReelle('cos', Math.cos, Number.isFinite),
  sin: fonctionReelle('sin', Math.sin, Number.isFinite),
  tan: fonctionReelle('tan', Math.tan, Number.isFinite),
  acos: fonctionReelle('acos', Math.acos, (x) => x >= -1 && x <= 1),
  asin: fonctionReelle('asin', Math.asin, (x) => x >= -1 && x <= 1),
  atan: fonctionReelle('atan', Math.atan),
  random: (_, ctx) => ctx.alea.reel(),
  randint: ([a, b], ctx) => {
    const nom = ctx.nom('randint')
    if (typeof a !== 'bigint' || typeof b !== 'bigint') throw erreurExecution('operation-invalide', nom, `${typeValeur(a)} et ${typeValeur(b)}`)
    return ctx.alea.entier(a, b, nom)
  },
  choice: ([v], ctx) => {
    const nom = ctx.nom('choice')
    const s = sequence(v, nom)
    if (s.length === 0) throw erreurExecution('collection-vide', nom)
    return s[ctx.alea.indice(s.length)]
  },
}

/** Appelle la fonction prédéfinie de nom Python `nom`. */
export function appelerFonction(nom: string, args: Valeur[], ctx: ContexteBibliotheque): Valeur {
  return FONCTIONS[nom](args, ctx)
}

export function estFonctionPredefinie(nom: string): boolean {
  return nom in FONCTIONS
}

// ---------------------------------------------------------------- Procédures sur les listes

function liste(v: Valeur, nom: string): Valeur[] {
  if (!Array.isArray(v)) throw erreurExecution('operation-invalide', nom, typeValeur(v))
  return v
}

export function ajouter(L: Valeur, x: Valeur): void {
  liste(L, 'ajouter').push(x)
}

/** `insérer(L, i, x)` : comme `list.insert`, un indice hors limites insère au début ou à la fin. */
export function inserer(L: Valeur, i: Valeur, x: Valeur): void {
  const l = liste(L, 'insérer')
  if (typeof i !== 'bigint') throw erreurExecution('operation-invalide', 'insérer', typeValeur(i))
  const n = BigInt(l.length)
  let k = i < 0n ? i + n : i
  if (k < 0n) k = 0n
  if (k > n) k = n
  l.splice(Number(k), 0, x)
}

/** `supprimer(L, i)` : comme `del L[i]`. */
export function supprimer(L: Valeur, i: Valeur): void {
  const l = liste(L, 'supprimer')
  if (typeof i !== 'bigint') throw erreurExecution('operation-invalide', 'supprimer', typeValeur(i))
  const k = i < 0n ? i + BigInt(l.length) : i
  if (k < 0n || k >= BigInt(l.length)) throw erreurExecution('indice-hors-limites', i.toString(), l.length, false)
  l.splice(Number(k), 1)
}
