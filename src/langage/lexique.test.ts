import { describe, expect, it } from 'vitest'
import { analyserLexique } from './lexique.ts'

function jetons(ligne: string) {
  const { lignes, diagnostics } = analyserLexique(ligne)
  expect(diagnostics).toEqual([])
  return lignes[0].jetons.map((j) => [j.genre, j.valeur])
}

describe('lexique', () => {
  it('normalise les mots-clés : casse et accents indifférents', () => {
    expect(jetons('Début DEBUT debut Répéter')).toEqual([
      ['mot', 'debut'],
      ['mot', 'debut'],
      ['mot', 'debut'],
      ['mot', 'repeter'],
    ])
  })

  it('conserve le texte saisi des identifiants', () => {
    const { lignes } = analyserLexique('Élève_2 ← 1')
    expect(lignes[0].jetons[0].texte).toBe('Élève_2')
  })

  it('reconnaît les équivalents ASCII des symboles', () => {
    expect(jetons('a <- b <= c >= d <> e != f == g ** h')).toEqual([
      ['mot', 'a'], ['symbole', '←'], ['mot', 'b'], ['symbole', '≤'], ['mot', 'c'], ['symbole', '≥'],
      ['mot', 'd'], ['symbole', '≠'], ['mot', 'e'], ['symbole', '≠'], ['mot', 'f'], ['symbole', '='],
      ['mot', 'g'], ['symbole', '^'], ['mot', 'h'],
    ])
  })

  it('lit les nombres entiers et réels', () => {
    expect(jetons('42 3.14 1e-3 2.5E10 7.')).toEqual([
      ['entier', '42'], ['reel', '3.14'], ['reel', '1e-3'], ['reel', '2.5E10'], ['reel', '7.'],
    ])
  })

  it('lit les chaînes avec leurs échappements, entre guillemets simples ou doubles', () => {
    expect(jetons(String.raw`"a\"b" 'l\'arbre' "x\ny\t\\"`)).toEqual([
      ['chaine', 'a"b'], ['chaine', "l'arbre"], ['chaine', 'x\ny\t\\'],
    ])
  })

  it('reconnaît « Jusqu’à » avec les deux apostrophes et sans accent', () => {
    expect(jetons("Jusqu'à x")[0]).toEqual(['mot', "jusqu'a"])
    expect(jetons('Jusqu’à x')[0]).toEqual(['mot', "jusqu'a"])
    expect(jetons("jusqu'a x")[0]).toEqual(['mot', "jusqu'a"])
  })

  it('reconnaît « d’ » dans « liste d’entiers »', () => {
    expect(jetons("liste d'entiers")).toEqual([['mot', 'liste'], ['mot', "d'"], ['mot', 'entiers']])
    expect(jetons('liste d’entiers')).toEqual([['mot', 'liste'], ['mot', "d'"], ['mot', 'entiers']])
  })

  it('traduit ↵ et \\n en fin d’instruction en retour à la ligne', () => {
    expect(jetons('Afficher x ↵')).toEqual([['mot', 'afficher'], ['mot', 'x'], ['retour', '↵']])
    expect(jetons(String.raw`Afficher x \n`)).toEqual([['mot', 'afficher'], ['mot', 'x'], ['retour', '↵']])
    expect(jetons(String.raw`Afficher x\n // fin`)).toEqual([['mot', 'afficher'], ['mot', 'x'], ['retour', '↵']])
  })

  it('isole le commentaire de fin de ligne', () => {
    const { lignes } = analyserLexique('x ← 1 // un commentaire')
    expect(lignes[0].commentaire).toBe(' un commentaire')
    expect(lignes[0].jetons).toHaveLength(3)
  })

  it('lit le nom de l’algorithme librement, apostrophes comprises', () => {
    const { lignes, diagnostics } = analyserLexique("Algorithme L'arbre de Noël // test")
    expect(diagnostics).toEqual([])
    expect(lignes[0].jetons.map((j) => j.valeur)).toEqual(['algorithme', "L'arbre de Noël"])
    expect(lignes[0].commentaire).toBe(' test')
  })

  it('donne la ligne, la colonne et les décalages de chaque jeton', () => {
    const { lignes } = analyserLexique('Début\r\n  x ← 10\n')
    const dix = lignes[1].jetons[2]
    expect(dix.etendue).toEqual({ de: 13, a: 15, ligne: 2, colonne: 7 })
    expect(lignes[1].texte).toBe('  x ← 10')
  })

  it('indique si un jeton est collé au précédent', () => {
    const { lignes } = analyserLexique('f(x) a ,b')
    expect(lignes[0].jetons.map((j) => j.colle)).toEqual([false, true, true, true, false, false, true])
  })

  it('n’accepte pas les exposants Unicode dans les identifiants', () => {
    const { diagnostics } = analyserLexique('y ← x²')
    expect(diagnostics.map((d) => d.code)).toEqual(['exposant-unicode'])
    expect(diagnostics[0].suggestion).toBe('Utilisez l’opérateur ^ : x^2.')
  })

  it('marque les lignes contenant une erreur lexicale', () => {
    const { lignes } = analyserLexique('a ← 1\nb ← 2 % 3')
    expect(lignes.map((l) => l.erreur)).toEqual([false, true])
  })
})
