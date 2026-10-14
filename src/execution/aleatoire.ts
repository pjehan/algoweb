import { erreurExecution } from './erreurs.ts'

/** API Web Crypto, disponible dans les navigateurs et sous Node (le cœur ne dépend pas du DOM). */
declare const crypto: { getRandomValues<T extends Uint32Array>(tableau: T): T }

/**
 * Générateur Mersenne Twister (MT19937), initialisé et utilisé exactement
 * comme le module `random` de CPython : une même graine donne les mêmes
 * tirages dans AlgoWeb et dans le Python exporté (PLAN.md, section 3, point 12).
 */
export class Aleatoire {
  private readonly mt = new Uint32Array(624)
  private index = 625

  constructor(graine?: bigint) {
    if (graine === undefined) {
      const octets = new Uint32Array(4)
      crypto.getRandomValues(octets)
      this.initialiserTableau(Array.from(octets))
    } else {
      this.graine(graine)
    }
  }

  /** Équivalent de `random.seed(n)` pour un entier `n`. */
  graine(n: bigint): void {
    let reste = n < 0n ? -n : n
    const cle: number[] = []
    do {
      cle.push(Number(reste & 0xffffffffn))
      reste >>= 32n
    } while (reste > 0n)
    this.initialiserTableau(cle)
  }

  private initialiser(s: number): void {
    const mt = this.mt
    mt[0] = s >>> 0
    for (let i = 1; i < 624; i++) {
      const p = mt[i - 1] ^ (mt[i - 1] >>> 30)
      // 1812433253 * p + i, modulo 2^32, sans perte de précision.
      mt[i] = (Math.imul(1812433253, p) + i) >>> 0
    }
    this.index = 624
  }

  private initialiserTableau(cle: number[]): void {
    const mt = this.mt
    this.initialiser(19650218)
    let i = 1
    let j = 0
    for (let k = Math.max(624, cle.length); k > 0; k--) {
      const p = mt[i - 1] ^ (mt[i - 1] >>> 30)
      mt[i] = ((mt[i] ^ Math.imul(p, 1664525)) + cle[j] + j) >>> 0
      i++
      j++
      if (i >= 624) {
        mt[0] = mt[623]
        i = 1
      }
      if (j >= cle.length) j = 0
    }
    for (let k = 623; k > 0; k--) {
      const p = mt[i - 1] ^ (mt[i - 1] >>> 30)
      mt[i] = ((mt[i] ^ Math.imul(p, 1566083941)) - i) >>> 0
      i++
      if (i >= 624) {
        mt[0] = mt[623]
        i = 1
      }
    }
    mt[0] = 0x80000000
    this.index = 624
  }

  /** Entier aléatoire sur 32 bits. */
  private suivant(): number {
    const mt = this.mt
    if (this.index >= 624) {
      for (let k = 0; k < 624; k++) {
        const y = (mt[k] & 0x80000000) | (mt[(k + 1) % 624] & 0x7fffffff)
        mt[k] = mt[(k + 397) % 624] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0)
      }
      this.index = 0
    }
    let y = mt[this.index++]
    y ^= y >>> 11
    y ^= (y << 7) & 0x9d2c5680
    y ^= (y << 15) & 0xefc60000
    y ^= y >>> 18
    return y >>> 0
  }

  /** `random.random()` : réel dans [0 ; 1[ sur 53 bits. */
  reel(): number {
    const a = this.suivant() >>> 5
    const b = this.suivant() >>> 6
    return (a * 67108864 + b) / 9007199254740992
  }

  /** `random.getrandbits(k)`. */
  bits(k: number): bigint {
    if (k <= 32) return BigInt(this.suivant() >>> (32 - k))
    let resultat = 0n
    let decalage = 0n
    for (let reste = k; reste > 0; reste -= 32) {
      let r = this.suivant()
      if (reste < 32) r >>>= 32 - reste
      resultat |= BigInt(r) << decalage
      decalage += 32n
    }
    return resultat
  }

  /** `random._randbelow(n)` : entier dans [0 ; n[. */
  sous(n: bigint): bigint {
    const k = n.toString(2).length
    let r = this.bits(k)
    while (r >= n) r = this.bits(k)
    return r
  }

  /** `random.randint(a, b)`. */
  entier(a: bigint, b: bigint, nom: string): bigint {
    const largeur = b + 1n - a
    if (largeur <= 0n) throw erreurExecution('bornes-alea', nom)
    return a + this.sous(largeur)
  }

  /** Indice tiré par `random.choice` dans une séquence de longueur `n`. */
  indice(n: number): number {
    return Number(this.sous(BigInt(n)))
  }
}
