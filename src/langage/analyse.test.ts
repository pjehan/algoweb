import { describe, expect, it } from 'vitest'
import { analyser } from './analyse.ts'
import type { Expression, Instruction, Principal } from './ast.ts'

/** Instructions du corps principal de `source`, sans erreur de syntaxe. */
function instructions(corps: string): Instruction[] {
  const { programme, diagnostics } = analyser(`Début\n${corps}\nFin\n`)
  expect(diagnostics).toEqual([])
  const principal = programme.elements.find((e) => e.genre === 'Principal') as Principal
  return principal.corps.instructions
}

/** Arbre d'une expression, sous une forme compacte : `(+ a (* b c))`. */
function arbre(texte: string): string {
  const [i] = instructions(`x ← ${texte}`)
  if (i.genre !== 'Affectation') throw new Error(i.genre)
  return compact(i.valeur)
}

function compact(e: Expression): string {
  switch (e.genre) {
    case 'Entier':
    case 'Reel':
      return e.texte
    case 'Chaine':
      return JSON.stringify(e.valeur)
    case 'Booleen':
      return String(e.valeur)
    case 'Identifiant':
      return e.nom
    case 'Liste':
      return `[${e.elements.map(compact).join(' ')}]`
    case 'Unaire':
      return `(${e.operateur} ${compact(e.operande)})`
    case 'Binaire':
      return `(${e.operateur} ${compact(e.gauche)} ${compact(e.droite)})`
    case 'Comparaison':
      return `(${e.operandes.map((o, k) => (k === 0 ? '' : e.operateurs[k - 1] + ' ') + compact(o)).join(' ')})`
    case 'Appel':
      return `${e.nom}(${e.arguments.map(compact).join(' ')})`
    case 'Indice':
      return `${compact(e.objet)}[${compact(e.indice)}]`
    case 'Tranche':
      return `${compact(e.objet)}[${e.debut ? compact(e.debut) : ''}:${e.fin ? compact(e.fin) : ''}]`
    case 'ExpressionInvalide':
      return '?'
  }
}

describe('priorité des opérateurs (section 4.6)', () => {
  it.each([
    ['1 + 2 * 3', '(+ 1 (* 2 3))'],
    ['a - b - c', '(- (- a b) c)'],
    ['2^3^2', '(^ 2 (^ 3 2))'],
    ['-2^2', '(- (^ 2 2))'],
    ['2^-1', '(^ 2 (- 1))'],
    ['(-2)^2', '(^ (- 2) 2)'],
    ['a * -b', '(* a (- b))'],
    ['a div b mod c', '(mod (div a b) c)'],
    ['a + b = c', '((+ a b) = c)'],
    ['0 ≤ x < 10', '(0 ≤ x < 10)'],
    ['x dans L', '(x dans L)'],
    ['non a = b', '(non (a = b))'],
    ['a et b ou c et d', '(ou (et a b) (et c d))'],
    ['non a et b', '(et (non a) b)'],
    ['L[i + 1][0]', 'L[(+ i 1)][0]'],
    ['ch[1:3] + ch[:2] + ch[2:]', '(+ (+ ch[1:3] ch[:2]) ch[2:])'],
    ['[1, [2, 3], []]', '[1 [2 3] []]'],
    ['f(a, g(b))', 'f(a g(b))'],
  ])('%s', (texte, attendu) => {
    expect(arbre(texte)).toBe(attendu)
  })
})

describe('fonctions prédéfinies', () => {
  it('enregistre le nom Python, quelle que soit la notation saisie', () => {
    expect(arbre('racine(4) + ln(x) + log(x, 2) + aléaEntier(1, 6) + AleaEntier(1, 2)')).toBe(
      '(+ (+ (+ (+ sqrt(4) log(x)) log(x 2)) randint(1 6)) randint(1 2))',
    )
  })

  it('distingue les conversions entier(x), réel(x), chaîne(x) des noms de types', () => {
    expect(arbre('entier("3") + réel(2) + len(chaîne(5))')).toBe('(+ (+ int("3") float(2)) len(str(5)))')
  })

  it('reconnaît les procédures prédéfinies, accent facultatif', () => {
    const [a, b] = instructions('  insérer(L, 0, 1)\n  inserer(L, 0, 2)')
    expect(a.genre === 'AppelProcedure' && a.appel.nom).toBe('insérer')
    expect(b.genre === 'AppelProcedure' && b.appel.nom).toBe('insérer')
  })
})

describe('instructions', () => {
  it('accepte les variantes des mots-clés', () => {
    const corps = [
      'Saisir n',
      'Ecrire n',
      'Écrire n \\n',
      'Tant que n > 0 faire',
      '  n ← n - 1',
      'Fin Tant que',
      'Si n = 0 alors',
      'SinonSi n = 1 alors',
      'Sinon Si n = 2 alors',
      'Fin Si',
      'Pour i de 1 a 3 faire',
      'Fin Pour',
      'Repeter',
      "Jusqu'a vrai",
    ].join('\n')
    expect(instructions(corps).map((i) => i.genre)).toEqual([
      'Lire', 'Afficher', 'Afficher', 'TantQue', 'Si', 'Pour', 'Repeter',
    ])
  })

  it('analyse Lire avec plusieurs variables et un élément de liste', () => {
    const [i] = instructions('Lire a, L[i]')
    expect(i.genre === 'Lire' && i.cibles.map(compact)).toEqual(['a', 'L[i]'])
  })

  it('analyse Afficher avec et sans retour à la ligne', () => {
    const [a, b, c] = instructions('Afficher "x =", x ↵\nAfficher x\nAfficher ↵')
    expect(a.genre === 'Afficher' && [a.valeurs.length, a.retourLigne]).toEqual([2, true])
    expect(b.genre === 'Afficher' && [b.valeurs.length, b.retourLigne]).toEqual([1, false])
    expect(c.genre === 'Afficher' && [c.valeurs.length, c.retourLigne]).toEqual([0, true])
  })

  it('analyse une boucle Pour avec un pas', () => {
    const [i] = instructions('Pour i de 10 à 0 pas de -2 faire\nFinPour')
    expect(i.genre === 'Pour' && [i.compteur.nom, compact(i.debut), compact(i.fin), i.pas && compact(i.pas)]).toEqual([
      'i', '10', '0', '(- 2)',
    ])
  })

  it('laisse utiliser de, à, pas et chaque comme noms de variables', () => {
    const [i] = instructions('Pour i de de à pas pas de chaque faire\nFinPour')
    expect(i.genre === 'Pour' && [compact(i.debut), compact(i.fin), i.pas && compact(i.pas)]).toEqual(['de', 'pas', 'chaque'])
  })

  it('analyse Pour chaque', () => {
    const [i] = instructions('Pour chaque x dans [1, 2] faire\n  Afficher x ↵\nFinPour')
    expect(i.genre === 'PourChaque' && [i.variable.nom, compact(i.collection), i.corps.length]).toEqual(['x', '[1 2]', 1])
  })

  it('analyse Si avec plusieurs Sinon si et un Sinon', () => {
    const [i] = instructions('Si a alors\n  x ← 1\nSinon si b alors\nSinon si c alors\nSinon\n  x ← 2\n  x ← 3\nFinSi')
    expect(i.genre === 'Si' && [i.branches.length, i.sinon?.corps.length]).toEqual([3, 2])
  })

  it('rattache les commentaires de fin de ligne aux instructions et aux lignes fermantes', () => {
    const [i] = instructions('Si a alors // test\n  x ← 1 // un\nFinSi // fin')
    if (i.genre !== 'Si') throw new Error()
    expect([i.branches[0].commentaire, i.branches[0].corps[0].genre === 'Affectation' && i.branches[0].corps[0].commentaire, i.fermeture?.commentaire]).toEqual([
      ' test', ' un', ' fin',
    ])
  })

  it('conserve les lignes vides et les commentaires', () => {
    expect(instructions('x ← 1\n\n// note\nx ← 2').map((i) => i.genre)).toEqual(['Affectation', 'LigneVide', 'Commentaire', 'Affectation'])
  })
})

describe('structure du programme', () => {
  it('reconnaît l’en-tête, les sous-programmes et l’algorithme principal', () => {
    const { programme, diagnostics } = analyser(
      'Algorithme Test\n\nFonction f(a : entier, b : liste de réels) : réel\nDébut\n  Retourner 1.0\nFin Fonction\n\nProcédure p()\nDébut\nFinProcedure\n\nDébut\nFin\n',
    )
    expect(diagnostics).toEqual([])
    expect(programme.elements.map((e) => e.genre)).toEqual(['EnTete', 'LigneVide', 'Fonction', 'LigneVide', 'Procedure', 'LigneVide', 'Principal'])
    const f = programme.elements[2]
    expect(f.genre === 'Fonction' && [f.nom, f.parametres.map((p) => p.nom), f.typeRetour]).toEqual(['f', ['a', 'b'], { genre: 'reel' }])
  })

  it('lit les types de listes, au singulier ou au pluriel', () => {
    const { programme, diagnostics } = analyser("Variables\n  a : liste\n  b : liste d'entiers\n  c : liste de listes de chaînes\n  d : liste de réel\nDébut\nFin\n")
    expect(diagnostics).toEqual([])
    const p = programme.elements[0] as Principal
    const types = p.corps.variables!.lignes.map((l) => l.genre === 'Declaration' && l.type)
    expect(types).toEqual([
      { genre: 'liste' },
      { genre: 'liste', element: { genre: 'entier' } },
      { genre: 'liste', element: { genre: 'liste', element: { genre: 'chaine' } } },
      { genre: 'liste', element: { genre: 'reel' } },
    ])
  })

  it('signale un texte vide comme un algorithme sans Début', () => {
    expect(analyser('').diagnostics.map((d) => d.code)).toEqual(['debut-manquant'])
  })
})

describe('reprise après erreur', () => {
  it('signale les erreurs de plusieurs lignes', () => {
    const { diagnostics } = analyser('Début\n  x ← (1\n  y ← 2 +\n  z = 3\nFin\n')
    expect(diagnostics.map((d) => [d.etendue.ligne, d.code])).toEqual([
      [2, 'parenthese-non-fermee'],
      [3, 'expression-attendue'],
      [4, 'affectation-egal'],
    ])
  })

  it('garde le bloc ouvert quand sa condition est invalide, sans erreur en cascade', () => {
    const { diagnostics } = analyser('Début\n  Si x > alors\n    y ← 1\n  FinSi\nFin\n')
    expect(diagnostics.map((d) => d.code)).toEqual(['mot-cle-dans-expression'])
  })

  it('signale un bloc non fermé à la ligne de son ouverture', () => {
    const { diagnostics } = analyser('Début\n  Pour i de 1 à 3 faire\n    Si i = 2 alors\n  FinPour\nFin\n')
    expect(diagnostics.map((d) => [d.code, d.etendue.ligne, d.message])).toEqual([
      ['bloc-non-ferme', 3, 'Le bloc Si de la ligne 3 n’est pas fermé.'],
    ])
  })

  it('n’ajoute pas d’erreur de syntaxe sur une ligne déjà signalée par le lexique', () => {
    const { diagnostics } = analyser('Début\n  x ← 2 % 3\nFin\n')
    expect(diagnostics.map((d) => d.code)).toEqual(['symbole-etranger'])
  })

  it('indique la position exacte de l’erreur', () => {
    const { diagnostics } = analyser('Début\n  x ← 1 + * 2\nFin\n')
    expect(diagnostics[0].etendue).toMatchObject({ ligne: 2, colonne: 11 })
  })
})
