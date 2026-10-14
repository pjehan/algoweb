import { normaliser } from '../langage/normalisation.ts'
import type { Type } from '../langage/types.ts'
import { texteVersEntier, texteVersReel } from './conversions.ts'
import type { Valeur } from './valeurs.ts'

/**
 * Lecture d'une valeur saisie au clavier. Une saisie qui ne correspond pas au
 * type attendu produit un message, et la valeur est redemandée (PLAN.md,
 * section 3, point 5).
 */

export type ResultatSaisie = { valeur: Valeur } | { message: string }

export const MESSAGES_SAISIE = {
  entier: 'Un entier est attendu (exemple : 12). Recommencez.',
  entierReel: (texte: string) => `Un entier est attendu : ${texte.trim()} n’est pas un entier. Recommencez.`,
  reel: 'Un réel est attendu (exemple : 2.5). Recommencez.',
  virgule: (correct: string) => `Le séparateur décimal est le point : écrivez ${correct}. Recommencez.`,
  booleen: 'Répondez vrai ou faux. Recommencez.',
}

export function lireSaisie(texte: string, type: Type): ResultatSaisie {
  switch (type.genre) {
    case 'entier': {
      const n = texteVersEntier(texte)
      if (n !== undefined) return { valeur: n }
      if (texteVersReel(texte) !== undefined) return { message: MESSAGES_SAISIE.entierReel(texte) }
      return { message: MESSAGES_SAISIE.entier }
    }
    case 'reel': {
      const x = texteVersReel(texte)
      if (x !== undefined) return { valeur: x }
      const corrige = texte.trim().replace(',', '.')
      if (texte.includes(',') && texteVersReel(corrige) !== undefined) return { message: MESSAGES_SAISIE.virgule(corrige) }
      return { message: MESSAGES_SAISIE.reel }
    }
    case 'booleen': {
      const mot = normaliser(texte.trim())
      if (mot === 'vrai') return { valeur: true }
      if (mot === 'faux') return { valeur: false }
      return { message: MESSAGES_SAISIE.booleen }
    }
    default:
      // Une chaîne, ou un élément de liste non typée : le texte tel quel, comme input().
      return { valeur: texte }
  }
}
