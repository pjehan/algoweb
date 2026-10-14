import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MESSAGES_EXECUTION, type CodeExecution } from './erreurs.ts'
import { executerConsole, Machine, preparer } from './index.ts'
import { MESSAGES_SAISIE } from './saisie.ts'

const DOSSIER = join(import.meta.dirname, '../../tests/programmes')

/** Lignes d'un fichier d'entrées ; le saut de ligne final ne compte pas comme une entrée. */
function lignes(fichier: string): string[] {
  if (!existsSync(fichier)) return []
  const texte = readFileSync(fichier, 'utf8')
  return (texte.endsWith('\n') ? texte.slice(0, -1) : texte).split('\n')
}

/** Corps d'un algorithme principal, avec ses déclarations. */
function algo(variables: string, instructions: string): string {
  return `Variables\n${variables.split('\n').map((l) => '  ' + l).join('\n')}\nDébut\n${instructions.split('\n').map((l) => '  ' + l).join('\n')}\nFin\n`
}

function sortie(source: string, entrees: string[] = []): string {
  const r = executerConsole(source, entrees, { graine: 1n })
  if (r.diagnostics) throw new Error(r.diagnostics.map((d) => d.message).join('\n'))
  if (r.erreur) throw new Error(`ligne ${r.erreur.ligne} : ${r.erreur.message}`)
  return r.sortie
}

describe('corpus : sorties identiques à CPython', () => {
  const programmes = readdirSync(DOSSIER).filter((f) => f.endsWith('.algo') && existsSync(join(DOSSIER, f.replace('.algo', '.sortie'))))
  it.each(programmes)('%s', (fichier) => {
    const base = join(DOSSIER, fichier.replace('.algo', ''))
    const graine = existsSync(`${base}.graine`) ? BigInt(readFileSync(`${base}.graine`, 'utf8').trim()) : undefined
    const r = executerConsole(readFileSync(`${base}.algo`, 'utf8'), lignes(`${base}.entree`), { graine })
    expect(r.diagnostics).toBeUndefined()
    expect(r.erreur).toBeUndefined()
    expect(r.sortie).toBe(readFileSync(`${base}.sortie`, 'utf8'))
  })
})

describe('sémantique', () => {
  it('convertit un entier en réel quand il est rangé dans un réel', () => {
    expect(sortie(algo('x : réel\nR : liste de réels', 'x ← 3\nR ← [1, 2]\najouter(R, 4)\nAfficher x, R ↵')))
      .toBe('3.0 [1.0, 2.0, 4.0]\n')
  })

  it('évalue les bornes d’une boucle Pour une seule fois et garde la dernière valeur du compteur', () => {
    const source = algo('i, n : entier', 'n ← 3\nPour i de 1 à n faire\n  n ← 10\nFinPour\nAfficher i, n ↵\nPour i de 5 à 1 faire\nFinPour\nAfficher i ↵')
    expect(sortie(source)).toBe('3 10\n3\n')
  })

  it('parcourt la liste vivante dans Pour chaque, comme Python', () => {
    const source = algo('L : liste d\'entiers\nx : entier', 'L ← [1, 2]\nPour chaque x dans L faire\n  Si x < 4 alors\n    ajouter(L, x + 2)\n  FinSi\nFinPour\nAfficher L ↵')
    expect(sortie(source)).toBe('[1, 2, 3, 4, 5]\n')
  })

  it('partage les listes passées en paramètre, mais pas les autres valeurs', () => {
    const source = [
      'Procédure modifier(L : liste d\'entiers, n : entier)',
      'Début',
      '  ajouter(L, n)',
      '  n ← 0',
      'FinProcédure',
      'Variables',
      '  L : liste d\'entiers',
      '  n : entier',
      'Début',
      '  L ← []',
      '  n ← 5',
      '  modifier(L, n)',
      '  Afficher L, n ↵',
      'Fin',
    ].join('\n')
    expect(sortie(source)).toBe('[5] 5\n')
  })

  it('n’évalue le second membre de et/ou que si nécessaire', () => {
    const source = algo('L : liste d\'entiers', 'L ← []\nAfficher len(L) > 0 et L[0] = 1, len(L) = 0 ou L[0] = 1 ↵')
    expect(sortie(source)).toBe('faux vrai\n')
  })

  it('évalue une comparaison enchaînée comme Python', () => {
    expect(sortie(algo('x : entier', 'x ← 5\nAfficher 0 ≤ x < 10, 0 < x < 3, 1 < 2 < 3 < 4 ↵'))).toBe('vrai faux vrai\n')
  })

  it('affiche sans retour à la ligne, et sépare les valeurs par une espace', () => {
    expect(sortie(algo('x : entier', 'x ← 1\nAfficher "a", x\nAfficher "b" ↵\nAfficher ↵'))).toBe('a 1b\n\n')
  })

  it('manipule les chaînes en caractères Unicode', () => {
    expect(sortie(algo('ch : chaîne', 'ch ← "é😀a"\nAfficher len(ch), ch[1], ch[-1], ch[1:] ↵'))).toBe('3 😀 a 😀a\n')
  })

  it('calcule exactement avec de très grands entiers', () => {
    expect(sortie(algo('n : entier', 'n ← 2^200\nAfficher n mod 1000007, n div 10^55 ↵'))).toBe(`${(2n ** 200n) % 1000007n} ${(2n ** 200n) / 10n ** 55n}\n`)
  })

  it('reproduit les tirages de Python avec une graine', () => {
    const r = executerConsole(algo('i : entier', 'Pour i de 1 à 3 faire\n  Afficher randint(1, 100), random() ↵\nFinPour'), [], { graine: 2026n })
    // Valeurs obtenues avec CPython : random.seed(2026), puis randint(1, 100) et random().
    expect(r.sortie).toBe('16 0.31948449837055615\n66 0.6471981768310113\n14 0.8841197954362969\n')
  })
})

/** Un exemple par erreur d'exécution, avec la ligne attendue. */
const ERREURS: [CodeExecution, string, number][] = [
  ['division-par-zero', algo('n : entier', 'n ← 0\nAfficher 1 / n ↵'), 5],
  ['zero-puissance-negative', algo('x : réel', 'x ← 0.0\nAfficher x ^ -1 ↵'), 5],
  ['racine-negative', algo('x : réel', 'x ← -1\nAfficher sqrt(x) ↵'), 5],
  ['logarithme-invalide', algo('x : réel', 'x ← 0\nAfficher log(x) ↵'), 5],
  ['hors-domaine', algo('x : réel', 'x ← 2\nAfficher acos(x) ↵'), 5],
  ['puissance-non-reelle', algo('x : réel', 'x ← -8\nAfficher x ^ 0.5 ↵'), 5],
  ['exposant-negatif', algo('n : entier', 'n ← -1\nAfficher 2 ^ n ↵'), 5],
  ['resultat-trop-grand', algo('x : réel', 'x ← 10\nAfficher x ^ 400 ↵'), 5],
  ['entier-trop-grand', algo('n : entier', 'n ← 10 ^ 400\nAfficher n * 1.5 ↵'), 5],
  ['memoire-insuffisante', algo('ch : chaîne', 'ch ← "ab"\nAfficher len(ch * 10^12) ↵'), 5],
  ['indice-hors-limites', algo('L : liste d\'entiers', 'L ← [1, 2, 3]\nAfficher L[3] ↵'), 5],
  ['collection-vide', algo('L : liste d\'entiers', 'L ← []\nAfficher max(L) ↵'), 5],
  ['conversion-impossible', algo('n : entier', 'n ← int("douze")'), 4],
  ['conversion-infini', algo('x : réel', 'x ← 1e308 * 10\nAfficher floor(x) ↵'), 5],
  ['variable-sans-valeur', algo('n : entier', 'Si faux alors\n  n ← 1\nFinSi\nAfficher n ↵'), 7],
  ['recursion-trop-profonde', 'Fonction f(n : entier) : entier\nDébut\n  Retourner f(n + 1)\nFinFonction\nDébut\n  Afficher f(0) ↵\nFin\n', 3],
  ['pas-nul', algo('i, p : entier', 'p ← 0\nPour i de 1 à 3 pas de p faire\nFinPour'), 5],
  ['bornes-alea', algo('n : entier', 'n ← randint(5, 1)'), 4],
  ['caractere-attendu', algo('n : entier', 'n ← ord("ab")'), 4],
  ['code-invalide', algo('ch : chaîne', 'ch ← chr(-1)'), 4],
  ['type-incompatible', algo('L : liste\nn : entier', 'L ← ["a"]\nn ← L[0]'), 6],
  ['operation-invalide', algo('L : liste', 'L ← ["a", 1]\nAfficher L[0] + L[1] ↵'), 5],
]

describe('erreurs d’exécution', () => {
  it.each(ERREURS)('%s', (code, source, ligne) => {
    const r = executerConsole(source)
    expect(r.diagnostics, r.diagnostics?.map((d) => d.message).join(' ; ')).toBeUndefined()
    expect(r.erreur?.code).toBe(code)
    expect(r.erreur?.ligne).toBe(ligne)
    expect({ message: r.erreur!.message, suggestion: r.erreur!.suggestion }).toMatchSnapshot()
  })

  it('chaque erreur du catalogue a un cas de test', () => {
    const testees = new Set(ERREURS.map(([code]) => code))
    // fonction-sans-retour est une sécurité : l'analyse refuse une fonction qui peut se terminer sans Retourner.
    const manquantes = Object.keys(MESSAGES_EXECUTION).filter((c) => !testees.has(c as CodeExecution) && c !== 'fonction-sans-retour')
    expect(manquantes).toEqual([])
  })

  it('autorise 999 appels imbriqués, comme Python', () => {
    const source = 'Fonction p(n : entier) : entier\nDébut\n  Si n = 0 alors\n    Retourner 0\n  FinSi\n  Retourner 1 + p(n - 1)\nFinFonction\nVariables\n  n : entier\nDébut\n  Lire n\n  Afficher p(n) ↵\nFin\n'
    expect(executerConsole(source, ['998']).sortie).toBe('n = 998\n')
    expect(executerConsole(source, ['999']).erreur?.code).toBe('recursion-trop-profonde')
  })
})

describe('saisie tolérante', () => {
  const lire = (type: string) => algo(`x : ${type}`, 'Lire x\nAfficher x ↵')

  it('redemande la valeur tant qu’elle ne correspond pas au type', () => {
    const preparation = preparer(lire('entier'))
    if (preparation.genre !== 'programme') throw new Error()
    const m = new Machine(preparation.programme)
    expect(m.executer(1000)).toMatchObject({ genre: 'saisie', saisie: { invite: 'x = ' } })
    expect(m.saisir('abc')).toBe(MESSAGES_SAISIE.entier)
    expect(m.saisir('2.5')).toBe(MESSAGES_SAISIE.entierReel('2.5'))
    expect(m.saisir(' 12 ')).toBeUndefined()
    expect(m.executer(1000)).toEqual({ genre: 'termine' })
    expect(m.sortie.join('')).toBe('x = 12\n')
  })

  it.each([
    ['entier', ['-0012'], '-12'],
    ['réel', ['2,5', '2.5'], '2.5'],
    ['réel', ['1e3'], '1000.0'],
    ['chaîne', ['  du texte '], '  du texte '],
    ['booléen', ['oui', 'Vrai'], 'vrai'],
  ])('lit un %s', (type, entrees, attendu) => {
    expect(sortie(lire(type), entrees)).toBe(`x = ${attendu}\n`)
  })

  it('a un message pour chaque cas', () => {
    expect(MESSAGES_SAISIE.virgule('2.5')).toBe('Le séparateur décimal est le point : écrivez 2.5. Recommencez.')
    expect(MESSAGES_SAISIE.reel).toBe('Un réel est attendu (exemple : 2.5). Recommencez.')
    expect(MESSAGES_SAISIE.booleen).toBe('Répondez vrai ou faux. Recommencez.')
  })
})

describe('débogueur', () => {
  const source = [
    'Fonction carre(x : entier) : entier', // 1
    'Variables', // 2
    '  r : entier', // 3
    'Début', // 4
    '  r ← x * x', // 5
    '  Retourner r', // 6
    'FinFonction', // 7
    'Variables', // 8
    '  a, b : entier', // 9
    '  L : liste d\'entiers', // 10
    'Début', // 11
    '  a ← 3', // 12
    '  L ← [1, 2]', // 13
    '  b ← carre(a)', // 14
    '  Afficher b ↵', // 15
    'Fin', // 16
  ].join('\n')

  function machine(): Machine {
    const p = preparer(source)
    if (p.genre !== 'programme') throw new Error()
    return new Machine(p.programme)
  }

  it('s’arrête sur chaque ligne en entrant dans les fonctions', () => {
    const m = machine()
    const lignes: number[] = []
    m.pas('entrer')
    for (;;) {
      const e = m.executer(1000)
      if (e.genre !== 'arret') break
      lignes.push(e.ligne)
      m.pas('entrer')
    }
    expect(lignes).toEqual([12, 13, 14, 5, 6, 15])
  })

  it('passe par-dessus les appels avec le pas principal', () => {
    const m = machine()
    m.pas('passer')
    const lignes: number[] = []
    for (;;) {
      const e = m.executer(1000)
      if (e.genre !== 'arret') break
      lignes.push(e.ligne)
      m.pas('passer')
    }
    expect(lignes).toEqual([12, 13, 14, 15])
  })

  it('sort de la fonction en cours', () => {
    const m = machine()
    m.pointsArret.add(5)
    expect(m.executer(1000)).toEqual({ genre: 'arret', raison: 'point-arret', ligne: 5 })
    m.pas('sortir')
    expect(m.executer(1000)).toEqual({ genre: 'arret', raison: 'pas', ligne: 15 })
  })

  it('montre la pile des appels et les variables', () => {
    const m = machine()
    m.pointsArret.add(6)
    m.executer(1000)
    expect(m.pileAppels()).toEqual([
      {
        nom: '',
        ligne: 14,
        variables: [
          { nom: 'a', type: 'entier', valeur: '3' },
          { nom: 'b', type: 'entier' },
          { nom: 'L', type: "liste d'entiers", valeur: '[1, 2]', elements: ['1', '2'] },
        ],
      },
      {
        nom: 'carre',
        ligne: 6,
        variables: [
          { nom: 'x', type: 'entier', valeur: '3' },
          { nom: 'r', type: 'entier', valeur: '9' },
        ],
      },
    ])
  })

  it('signale un point d’arrêt atteint pendant le pas à pas', () => {
    const m = machine()
    m.pointsArret.add(13)
    m.pas('entrer')
    expect(m.executer(1000)).toEqual({ genre: 'arret', raison: 'pas', ligne: 12 })
    m.pas('entrer')
    expect(m.executer(1000)).toEqual({ genre: 'arret', raison: 'point-arret', ligne: 13 })
  })

  it('s’arrête à la demande, et sur l’instruction Pause', () => {
    const m = machine()
    m.demanderArret()
    expect(m.executer(1000)).toEqual({ genre: 'arret', raison: 'demande', ligne: 12 })
    const p = preparer(algo('n : entier', 'n ← 1\nPause\nAfficher n ↵'))
    if (p.genre !== 'programme') throw new Error()
    const m2 = new Machine(p.programme)
    expect(m2.executer(1000)).toEqual({ genre: 'arret', raison: 'pause', ligne: 5 })
    expect(m2.executer(1000)).toEqual({ genre: 'termine' })
    expect(m2.sortie.join('')).toBe('1\n')
  })

  it('s’interrompt après le budget d’instructions et reprend ensuite', () => {
    const p = preparer(algo('i, s : entier', 's ← 0\nPour i de 1 à 1000 faire\n  s ← s + i\nFinPour\nAfficher s ↵'))
    if (p.genre !== 'programme') throw new Error()
    const m = new Machine(p.programme)
    let interruptions = 0
    while (m.executer(500).genre === 'interrompu') interruptions++
    expect(interruptions).toBeGreaterThan(5)
    expect(m.sortie.join('')).toBe('500500\n')
  })
})
