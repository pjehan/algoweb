import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Principal } from './ast.ts'
import { compiler, estExecutable } from './index.ts'
import { texteType } from './types.ts'

const DOSSIER = join(import.meta.dirname, '../../tests/programmes')
const CORPUS = readdirSync(DOSSIER).filter((f) => f.endsWith('.algo'))

/** Codes des diagnostics de `source`. */
function codes(source: string, notation: 'python' | 'francais' = 'python'): string[] {
  return compiler(source, notation).diagnostics.map((d) => d.code)
}

/** Type de l'expression affectée par la dernière instruction de `instructions`. */
function typeDe(expression: string, variables = 'n : entier\n  x : réel\n  ch : chaîne\n  L : liste d\'entiers'): string {
  const source = `Variables\n  ${variables}\n  r : liste\nDébut\n  n ← 1\n  x ← 1.0\n  ch ← "a"\n  L ← [1]\n  r ← [${expression}]\n  Afficher n, x, ch, L, r ↵\nFin\n`
  const resultat = compiler(source)
  expect(resultat.diagnostics).toEqual([])
  const principal = resultat.programme.elements.find((e) => e.genre === 'Principal') as Principal
  const affectation = principal.corps.instructions.at(-2)!
  if (affectation.genre !== 'Affectation' || affectation.valeur.genre !== 'Liste') throw new Error()
  return texteType(resultat.verification!.types.get(affectation.valeur.elements[0].id)!)
}

describe('vérification du corpus', () => {
  it.each(CORPUS)('%s ne produit aucun diagnostic', (fichier) => {
    const resultat = compiler(readFileSync(join(DOSSIER, fichier), 'utf8'))
    expect(resultat.diagnostics).toEqual([])
    expect(estExecutable(resultat)).toBe(true)
  })
})

describe('types des expressions (comme Python)', () => {
  it.each([
    ['7 / 2', 'réel'],
    ['6 / 2', 'réel'],
    ['7 div 2', 'entier'],
    ['-7 mod 2', 'entier'],
    ['x div 2', 'réel'],
    ['2^n', 'entier'],
    ['2^-1', 'réel'],
    ['2^0.5', 'réel'],
    ['n + x', 'réel'],
    ['"ab" * 3', 'chaîne'],
    ['[0] * n', "liste d'entiers"],
    ['[1, 2.5]', 'liste de réels'],
    ["[1, 'a']", 'liste'],
    ['L + [3]', "liste d'entiers"],
    ['L[0]', 'entier'],
    ['L[1:]', "liste d'entiers"],
    ['ch[0]', 'chaîne'],
    ['n < x', 'booléen'],
    ['0 ≤ n < 10', 'booléen'],
    ['n dans L', 'booléen'],
    ['"a" dans ch', 'booléen'],
    ['round(x)', 'entier'],
    ['round(x, 2)', 'réel'],
    ['abs(n)', 'entier'],
    ['abs(x)', 'réel'],
    ['max(n, x)', 'réel'],
    ['min(L)', 'entier'],
    ['sum(L)', 'entier'],
    ['sqrt(n)', 'réel'],
    ['floor(x)', 'entier'],
    ['int(ch)', 'entier'],
    ['str(x)', 'chaîne'],
    ['choice(L)', 'entier'],
    ['pi', 'réel'],
  ])('%s est de type %s', (expression, type) => {
    expect(typeDe(expression)).toBe(type)
  })
})

describe('règles de typage', () => {
  const avec = (instructions: string, variables = 'n : entier\n  x : réel\n  R : liste de réels') =>
    codes(`Variables\n  ${variables}\nDébut\n  n ← 1\n  x ← 1.0\n  R ← []\n  ${instructions}\n  Afficher n, x, R ↵\nFin\n`)

  it('convertit implicitement un entier en réel', () => {
    expect(avec('x ← n')).toEqual([])
    expect(avec('R ← [1, 2]')).toEqual([])
    expect(avec('ajouter(R, 3)')).toEqual([])
  })

  it('refuse un réel dans un entier', () => {
    expect(avec('n ← n / 1')).toEqual(['type-affectation'])
  })

  it('compare un entier et un réel', () => {
    expect(avec('Si n < x alors\n  FinSi')).toEqual([])
  })

  it('refuse un booléen comme indice', () => {
    expect(avec('x ← R[vrai]')).toEqual(['indice-non-entier'])
  })

  it('ne cumule pas les erreurs sur une valeur déjà fausse', () => {
    expect(avec('x ← inconnu + 1 * inconnu')).toEqual(['nom-non-declare', 'nom-non-declare'])
  })
})

describe('fonctions et procédures', () => {
  it('autorise les appels dans un ordre quelconque et la récursivité', () => {
    const source = [
      'Fonction pair(n : entier) : booléen',
      'Début',
      '  Si n = 0 alors',
      '    Retourner vrai',
      '  FinSi',
      '  Retourner impair(n - 1)',
      'FinFonction',
      'Fonction impair(n : entier) : booléen',
      'Début',
      '  Si n = 0 alors',
      '    Retourner faux',
      '  FinSi',
      '  Retourner pair(n - 1)',
      'FinFonction',
      'Début',
      '  Afficher pair(4) ↵',
      'Fin',
    ].join('\n')
    expect(codes(source)).toEqual([])
  })

  it('accepte une fonction dont toutes les branches retournent', () => {
    const source = 'Fonction signe(x : réel) : entier\nDébut\n  Si x < 0 alors\n    Retourner -1\n  Sinon si x = 0 alors\n    Retourner 0\n  Sinon\n    Retourner 1\n  FinSi\nFinFonction\nDébut\n  Afficher signe(2.5) ↵\nFin\n'
    expect(codes(source)).toEqual([])
  })

  it('accepte une boucle TantQue vrai qui se termine par Retourner', () => {
    const source = 'Fonction f() : entier\nDébut\n  TantQue vrai faire\n    Retourner 1\n  FinTantQue\nFinFonction\nDébut\n  Afficher f() ↵\nFin\n'
    expect(codes(source)).toEqual([])
  })

  it('vérifie le nombre et le type des paramètres', () => {
    const debut = 'Fonction aire(l : réel, h : réel) : réel\nDébut\n  Retourner l * h\nFinFonction\nDébut\n'
    expect(codes(`${debut}  Afficher aire(2, 3) ↵\nFin\n`)).toEqual([])
    expect(codes(`${debut}  Afficher aire(2) ↵\nFin\n`)).toEqual(['arguments-nombre'])
    expect(codes(`${debut}  Afficher aire("2", 3) ↵\nFin\n`)).toEqual(['argument-type'])
  })

  it('réserve les noms français des prédéfinis aux variables', () => {
    expect(codes('Variables\n  somme, longueur : entier\nDébut\n  somme ← 1\n  longueur ← somme\n  Afficher longueur ↵\nFin\n')).toEqual([])
    expect(codes('Fonction somme(x : entier) : entier\nDébut\n  Retourner x\nFinFonction\nDébut\nFin\n')).toEqual(['nom-reserve'])
    expect(codes('Variables\n  sum : entier\nDébut\nFin\n')).toEqual(['nom-reserve'])
    expect(codes('Variables\n  Si : entier\nDébut\nFin\n')).toEqual(['nom-reserve'])
    expect(codes('Variables\n  list : entier\nDébut\nFin\n')).toEqual(['nom-reserve'])
  })

  it('interdit une variable portant le nom d’une fonction', () => {
    expect(codes('Fonction f() : entier\nDébut\n  Retourner 1\nFinFonction\nVariables\n  f : entier\nDébut\nFin\n')).toEqual(['declaration-double'])
  })

  it('partage les listes passées en paramètre', () => {
    const source = 'Procédure vider(L : liste)\nDébut\n  supprimer(L, 0)\nFinProcédure\nVariables\n  M : liste\nDébut\n  M ← [1]\n  vider(M)\n  Afficher M ↵\nFin\n'
    expect(codes(source)).toEqual([])
  })
})

describe('analyse du flot', () => {
  const programme = (instructions: string) => `Variables\n  n, y : entier\nDébut\n  Lire n\n${instructions}\n  Afficher y ↵\nFin\n`

  it('sait qu’une variable a une valeur après un Si dont toutes les branches l’affectent', () => {
    expect(codes(programme('  Si n > 0 alors\n    y ← 1\n  Sinon\n    y ← 2\n  FinSi'))).toEqual([])
  })

  it('avertit si une branche n’affecte pas la variable', () => {
    expect(codes(programme('  Si n > 0 alors\n    y ← 1\n  FinSi'))).toEqual(['variable-sans-valeur'])
  })

  it('considère que le corps d’une boucle Pour peut ne pas s’exécuter', () => {
    expect(codes(programme('  Pour n de 1 à 3 faire\n    y ← n\n  FinPour'))).toEqual(['variable-sans-valeur'])
  })

  it('considère que le corps d’un Répéter s’exécute au moins une fois', () => {
    expect(codes(programme('  Répéter\n    y ← n\n  Jusqu\'à y > 0'))).toEqual([])
  })

  it('n’avertit qu’une fois par variable', () => {
    expect(codes('Variables\n  n : entier\nDébut\n  Afficher n, n ↵\n  Afficher n ↵\nFin\n')).toEqual(['variable-sans-valeur'])
  })
})

describe('notation des messages', () => {
  it('nomme les fonctions prédéfinies dans la notation choisie', () => {
    const source = 'Variables\n  n : entier\nDébut\n  n ← sqrt(4)\nFin\n'
    const [d] = compiler(source, 'francais').diagnostics
    expect(d.suggestion).toBe('Convertissez avec entier(…) ou arrondi(…).')
  })
})
