import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyser } from './analyse.ts'
import type { Expression } from './ast.ts'
import { formater, formaterExpression } from './formateur.ts'

const DOSSIER = join(import.meta.dirname, '../../tests/programmes')
const CORPUS = readdirSync(DOSSIER).filter((f) => f.endsWith('.algo'))

function formaterTexte(source: string, notation: 'python' | 'francais' = 'python'): string {
  const { programme, diagnostics } = analyser(source)
  expect(diagnostics).toEqual([])
  return formater(programme, { notation })
}

/** Formate le corps de l'algorithme principal. */
function corps(lignes: string, notation: 'python' | 'francais' = 'python'): string {
  const texte = formaterTexte(`Début\n${lignes}\nFin\n`, notation)
  return texte.split('\n').slice(1, -2).join('\n')
}

describe('formateur', () => {
  it.each(CORPUS)('laisse inchangé le programme canonique %s', (fichier) => {
    const source = readFileSync(join(DOSSIER, fichier), 'utf8')
    expect(formaterTexte(source)).toBe(source)
  })

  it.each(CORPUS)('est stable en notation française : %s', (fichier) => {
    const source = readFileSync(join(DOSSIER, fichier), 'utf8')
    const francais = formaterTexte(source, 'francais')
    expect(formaterTexte(francais, 'francais')).toBe(francais)
    // Le texte français se relit en noms Python à l'identique.
    expect(formaterTexte(francais, 'python')).toBe(source)
  })

  it('réécrit les variantes de saisie dans la forme canonique', () => {
    const saisie = [
      'saisir x',
      'ecrire "a", x \\n',
      'x <- x ** 2 + (1)',
      'si x == 1 et x != 2 ou x <> 3 alors',
      'sinonsi x <= 1 ou x >= 2 alors',
      'fin si',
      'tant que non faux faire',
      'fin tant que',
      'repeter',
      "jusqu’a vrai",
      "Ecrire 'l\\'arbre'",
    ].join('\n')
    expect(corps(saisie)).toBe(
      [
        '  Lire x',
        '  Afficher "a", x ↵',
        '  x ← x^2 + (1)',
        '  Si x = 1 et x ≠ 2 ou x ≠ 3 alors',
        '  Sinon si x ≤ 1 ou x ≥ 2 alors',
        '  FinSi',
        '  TantQue non faux faire',
        '  FinTantQue',
        '  Répéter',
        "  Jusqu'à vrai",
        '  Afficher "l\'arbre"',
      ].join('\n'),
    )
  })

  it('réindente les blocs de deux espaces', () => {
    expect(corps('Pour i de 1 à 2 faire\nSi i = 1 alors\nAfficher i ↵\nFinSi\nFinPour')).toBe(
      '  Pour i de 1 à 2 faire\n    Si i = 1 alors\n      Afficher i ↵\n    FinSi\n  FinPour',
    )
  })

  it('affiche les fonctions prédéfinies dans la notation choisie', () => {
    const lignes = 'x ← sqrt(len(L)) + log(x) + log(x, 2) + randint(1, 6) + int("3")'
    expect(corps(lignes, 'francais')).toBe('  x ← racine(longueur(L)) + ln(x) + log(x, 2) + aléaEntier(1, 6) + entier("3")')
    expect(corps('x ← racine(longueur(L)) + ln(x)', 'python')).toBe('  x ← sqrt(len(L)) + log(x)')
  })

  it('conserve les parenthèses écrites par l’étudiant', () => {
    expect(corps('x ← (a + b) * c + (d * e)')).toBe('  x ← (a + b) * c + (d * e)')
  })

  it('ajoute les parenthèses imposées par la priorité dans un arbre construit', () => {
    const e = (genre: 'Identifiant', nom: string): Expression => ({ genre, nom, id: 0, etendue: { de: 0, a: 0, ligne: 1, colonne: 1 } })
    const somme: Expression = { genre: 'Binaire', operateur: '+', gauche: e('Identifiant', 'a'), droite: e('Identifiant', 'b'), id: 0, etendue: e('Identifiant', '').etendue }
    const produit: Expression = { ...somme, operateur: '*', gauche: somme, droite: somme }
    const difference: Expression = { ...somme, operateur: '-', gauche: e('Identifiant', 'a'), droite: somme }
    const puissance: Expression = { ...somme, operateur: '^', gauche: { genre: 'Unaire', operateur: '-', operande: e('Identifiant', 'a'), id: 0, etendue: somme.etendue }, droite: e('Identifiant', 'b') }
    expect(formaterExpression(produit)).toBe('(a + b) * (a + b)')
    expect(formaterExpression(difference)).toBe('a - (a + b)')
    expect(formaterExpression(puissance)).toBe('(-a)^b')
  })

  it('conserve les commentaires, les lignes vides et le nom de l’algorithme', () => {
    const source = "Algorithme L'arbre de Noël // nom\n\n// Fonctions\n\nDébut // début\n  x ← 1 //fin\n\n  //  seul\nFin\n"
    expect(formaterTexte(source)).toBe(source)
  })
})
