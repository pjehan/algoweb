import { describe, expect, it } from 'vitest'
import { canoniserLigne } from './canonique.ts'

describe('forme canonique des mots-clés', () => {
  it.each([
    ['debut', 'Début'],
    ['  si x > 0 ALORS // si', '  Si x > 0 alors // si'],
    ['fin si', 'FinSi'],
    ['Fin Tant que', 'FinTantQue'],
    ['tant que n > 0 faire', 'TantQue n > 0 faire'],
    ['sinon si n = 1 alors', 'Sinon si n = 1 alors'],
    ['SinonSi n = 1 alors', 'Sinon si n = 1 alors'],
    ['pour i de 1 a n faire', 'Pour i de 1 à n faire'],
    ['pour i de a a b pas de -1 faire', 'Pour i de a à b pas de -1 faire'],
    ['pour chaque x dans L faire', 'Pour chaque x dans L faire'],
    ["jusqu'a x > 0", "Jusqu'à x > 0"],
    ['ecrire "si alors", x', 'Afficher "si alors", x'],
    ['saisir n', 'Lire n'],
    ['renvoyer x', 'Retourner x'],
    ['n, i : ENTIER', 'n, i : entier'],
    ["L : liste d'reels", "L : liste d'réels"],
    ['x ← entier("3") + reel(2)', 'x ← entier("3") + reel(2)'],
    ['algorithme si alors', 'Algorithme si alors'],
    ['procedure p(a : chaine)', 'Procédure p(a : chaîne)'],
    ['Si a ET non b OU VRAI alors', 'Si a et non b ou vrai alors'],
  ])('%s → %s', (saisie, attendu) => {
    expect(canoniserLigne(saisie)).toBe(attendu)
  })

  it('ne touche pas aux variables nommées comme des mots contextuels', () => {
    expect(canoniserLigne('a ← de + pas')).toBe('a ← de + pas')
  })
})
