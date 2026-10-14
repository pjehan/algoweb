/**
 * Conversion de texte en nombre, avec les règles de `int()` et `float()` de
 * Python (espaces, signe, tirets bas entre chiffres, chiffres Unicode).
 */

/** Remplace les chiffres décimaux Unicode (arabes, devanagari…) par les chiffres ASCII. */
function chiffresAscii(s: string): string {
  return s.replace(/\p{Nd}/gu, (c) => {
    const code = c.codePointAt(0)!
    if (code < 128) return c
    // Les chiffres Unicode forment des séries contiguës de 0 à 9 : on cherche le début de la série.
    let debut = code
    while (/\p{Nd}/u.test(String.fromCodePoint(debut - 1))) debut--
    return String((code - debut) % 10)
  })
}

const ENTIER = /^[+-]?\d+(?:_\d+)*$/
const REEL = /^[+-]?(?:(?:\d(?:_?\d)*)?\.\d(?:_?\d)*|\d(?:_?\d)*\.?)(?:[eE][+-]?\d(?:_?\d)*)?$/
const SPECIAL = /^([+-]?)(inf|infinity|nan)$/i

/** `int(texte)` en Python, ou `undefined` si le texte n'est pas un entier. */
export function texteVersEntier(texte: string): bigint | undefined {
  const s = chiffresAscii(texte.trim())
  if (!ENTIER.test(s)) return undefined
  return BigInt(s.replace(/_/g, ''))
}

/** `float(texte)` en Python, ou `undefined` si le texte n'est pas un réel. */
export function texteVersReel(texte: string): number | undefined {
  const s = chiffresAscii(texte.trim())
  const special = SPECIAL.exec(s)
  if (special) {
    if (special[2].toLowerCase() === 'nan') return NaN
    return special[1] === '-' ? -Infinity : Infinity
  }
  if (!REEL.test(s)) return undefined
  return Number(s.replace(/_/g, ''))
}
