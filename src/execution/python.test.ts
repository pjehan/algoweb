import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Aleatoire } from './aleatoire.ts'
import { appelerFonction, type ContexteBibliotheque } from './bibliotheque.ts'
import { texteVersEntier, texteVersReel } from './conversions.ts'
import { ErreurExecution } from './erreurs.ts'
import { comparaison, division, puissance, quotient, reste } from './operations.ts'
import { egales, repr, texteChaineRepr, texteReel, versReel, type Valeur } from './valeurs.ts'

/**
 * Comparaison avec les tables produites par CPython (tests/python/generer.py).
 */

type Attendu = { entier: string } | { reel: string } | { chaine: string } | { booleen: boolean } | { erreur: string }

const REF = JSON.parse(readFileSync(join(import.meta.dirname, '../../tests/python/reference.json'), 'utf8'))

const ctx: ContexteBibliotheque = { alea: new Aleatoire(0n), nom: (n) => n }

/** Lit un réel écrit par `repr` en Python. */
function reel(t: string): number {
  if (t === 'inf') return Infinity
  if (t === '-inf') return -Infinity
  if (t === 'nan') return NaN
  return Number(t)
}

/** Nombre de réels représentables entre a et b (0 si égaux). */
function ecartUlp(a: number, b: number): number {
  if (a === b || (Number.isNaN(a) && Number.isNaN(b))) return 0
  const vue = new DataView(new ArrayBuffer(16))
  vue.setFloat64(0, a)
  vue.setFloat64(8, b)
  return Number(vue.getBigInt64(0) - vue.getBigInt64(8)) * (a < 0 === b < 0 ? 1 : Infinity)
}

/** Résultat de `f` sous la forme des tables Python. */
function resultat(f: () => Valeur): Attendu {
  try {
    const v = f()
    if (typeof v === 'bigint') return { entier: v.toString() }
    if (typeof v === 'number') return { reel: texteReel(v) }
    if (typeof v === 'boolean') return { booleen: v }
    if (typeof v === 'string') return { chaine: v }
    throw new Error('liste inattendue')
  } catch (e) {
    if (e instanceof ErreurExecution) return { erreur: e.code }
    throw e
  }
}

/** Les erreurs Python et leurs équivalents AlgoWeb. */
const ERREURS: Record<string, string[]> = {
  ZeroDivisionError: ['division-par-zero', 'zero-puissance-negative'],
  ValueError: ['conversion-impossible', 'conversion-infini', 'racine-negative', 'logarithme-invalide', 'hors-domaine', 'bornes-alea'],
  OverflowError: ['resultat-trop-grand', 'entier-trop-grand', 'conversion-infini'],
  complex: ['puissance-non-reelle'],
}

function verifier(obtenu: Attendu, attendu: Attendu, contexte: string): void {
  if ('erreur' in attendu) {
    expect('erreur' in obtenu ? obtenu.erreur : obtenu, contexte).toBeOneOf(ERREURS[attendu.erreur])
  } else {
    expect(obtenu, contexte).toEqual(attendu)
  }
}

describe('affichage comme Python', () => {
  it.each(REF.repr as [string, string][])('repr(%s)', (x, attendu) => {
    expect(texteReel(reel(x))).toBe(attendu)
  })

  it.each(REF.repr_chaines as [string, string][])('repr(%j)', (s, attendu) => {
    expect(texteChaineRepr(s)).toBe(attendu)
  })

  it('affiche les listes et les booléens', () => {
    expect(repr([1n, 2.5, 'a', [true, false], []])).toBe("[1, 2.5, 'a', [vrai, faux], []]")
    const L: Valeur[] = [1n]
    L.push(L)
    expect(repr(L)).toBe('[1, [...]]')
  })
})

describe('arithmétique comme Python', () => {
  it('div et mod sur les entiers', () => {
    for (const [a, b, q, r] of REF.div_mod_entiers) {
      verifier(resultat(() => quotient(BigInt(a), BigInt(b))), q, `${a} // ${b}`)
      verifier(resultat(() => reste(BigInt(a), BigInt(b))), r, `${a} % ${b}`)
    }
  })

  it('div et mod sur les réels', () => {
    for (const [a, b, q, r] of REF.div_mod_reels) {
      verifier(resultat(() => quotient(reel(a), reel(b))), q, `${a} // ${b}`)
      verifier(resultat(() => reste(reel(a), reel(b))), r, `${a} % ${b}`)
    }
  })

  it('division réelle de deux entiers, même très grands', () => {
    for (const [a, b, q] of REF.division) verifier(resultat(() => division(BigInt(a), BigInt(b))), q, `${a} / ${b}`)
  })

  it('puissance', () => {
    for (const [a, b, r] of REF.puissance_reels) verifier(resultat(() => puissance(reel(a), reel(b), false)), r, `${a} ** ${b}`)
    for (const [a, b, r] of REF.puissance_entiers) verifier(resultat(() => puissance(BigInt(a), BigInt(b), false)), r, `${a} ** ${b}`)
  })

  it('refuse un exposant négatif quand un entier est attendu', () => {
    expect(resultat(() => puissance(2n, -1n, true))).toEqual({ erreur: 'exposant-negatif' })
  })

  it('compare exactement entiers et réels', () => {
    for (const [a, b, egal, inf, sup] of REF.comparaisons) {
      expect(egales(BigInt(a), reel(b)), `${a} == ${b}`).toBe(egal)
      expect(comparaison('<', BigInt(a), reel(b)), `${a} < ${b}`).toBe(inf)
      expect(comparaison('>', BigInt(a), reel(b)), `${a} > ${b}`).toBe(sup)
    }
  })

  it('convertit un entier en réel', () => {
    for (const [n, r] of REF.entier_vers_reel) verifier(resultat(() => versReel(BigInt(n))), r, `float(${n})`)
  })
})

describe('fonctions prédéfinies comme Python', () => {
  const appel = (nom: string, ...args: Valeur[]) => () => appelerFonction(nom, args, ctx)

  it('round(x)', () => {
    for (const [x, r] of REF.round) verifier(resultat(appel('round', reel(x))), r, `round(${x})`)
  })

  it('round(x, n)', () => {
    for (const [x, n, r] of REF.round_n) verifier(resultat(appel('round', reel(x), BigInt(n))), r, `round(${x}, ${n})`)
    for (const [x, n, r] of REF.round_entier_n) verifier(resultat(appel('round', BigInt(x), BigInt(n))), r, `round(${x}, ${n})`)
  })

  it('sum, avec la somme compensée de Python 3.12', () => {
    for (const [liste, r] of REF.sum as [Attendu[], Attendu][]) {
      const valeurs = liste.map((v) => ('entier' in v ? BigInt(v.entier) : reel((v as { reel: string }).reel)))
      verifier(resultat(appel('sum', valeurs)), r, `sum(${JSON.stringify(liste)})`)
    }
  })

  it('int(chaîne) et float(chaîne)', () => {
    for (const [s, r] of REF.int_chaine) {
      verifier(resultat(() => {
        const n = texteVersEntier(s)
        if (n === undefined) return appelerFonction('int', [s], ctx)
        return n
      }), r, `int(${JSON.stringify(s)})`)
    }
    for (const [s, r] of REF.float_chaine) {
      verifier(resultat(() => {
        const x = texteVersReel(s)
        if (x === undefined) return appelerFonction('float', [s], ctx)
        return x
      }), r, `float(${JSON.stringify(s)})`)
    }
  })

  it('int(réel), floor et ceil', () => {
    for (const [x, r] of REF.int_reel) verifier(resultat(appel('int', reel(x))), r, `int(${x})`)
    for (const [x, f, c] of REF.floor_ceil) {
      verifier(resultat(appel('floor', reel(x))), f, `floor(${x})`)
      verifier(resultat(appel('ceil', reel(x))), c, `ceil(${x})`)
    }
  })

  it('fonctions mathématiques, à une unité près sur le dernier bit (sauf sqrt, exacte)', () => {
    for (const [nom, x, r] of REF.math) {
      const obtenu = resultat(appel(nom, reel(x)))
      if (nom !== 'sqrt' && 'reel' in r && 'reel' in obtenu && Math.abs(ecartUlp(reel(obtenu.reel), reel(r.reel))) <= 1) continue
      verifier(obtenu, r, `${nom}(${x})`)
    }
    for (const [n, ln, lg] of REF.log_entiers) {
      verifier(resultat(appel('log', BigInt(n))), ln, `log(${n})`)
      verifier(resultat(appel('log10', BigInt(n))), lg, `log10(${n})`)
    }
  })
})

describe('aléatoire identique à Python', () => {
  it.each(REF.aleatoire as { graine: string; reels: string[]; des: number[]; grand: string; negatif: number; choix: string }[])(
    'graine $graine',
    ({ graine, reels, des, grand, negatif, choix }) => {
      const alea = new Aleatoire(BigInt(graine))
      expect(reels.map(() => texteReel(alea.reel()))).toEqual(reels)
      expect(des.map(() => Number(alea.entier(1n, 6n, 'randint')))).toEqual(des)
      expect(alea.entier(0n, 2n ** 70n, 'randint').toString()).toBe(grand)
      expect(Number(alea.entier(-100n, -50n, 'randint'))).toBe(negatif)
      expect(['a', 'b', 'c', 'd', 'e', 'f', 'g'][alea.indice(7)]).toBe(choix)
    },
  )
})
