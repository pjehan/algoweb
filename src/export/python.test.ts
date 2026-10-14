import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exporterTexteEnPython } from './index.ts'

const RACINE = join(import.meta.dirname, '../..')

function exporter(source: string, graine?: bigint): string {
  const r = exporterTexteEnPython(source, { graine })
  if (!('python' in r)) throw new Error(r.diagnostics.map((d) => d.message).join('\n'))
  return r.python
}

/** Corps de l'algorithme principal exporté, sans l'en-tête ni les déclarations. */
function principal(variables: string, instructions: string): string {
  const source = `Variables\n  ${variables.replace(/\n/g, '\n  ')}\nDébut\n  ${instructions.replace(/\n/g, '\n  ')}\nFin\n`
  const lignes = exporter(source).split('\n')
  const premiere = lignes.findIndex((l, k) => k > 2 && l !== '' && !/^\w+: /.test(l))
  return lignes.slice(premiere).join('\n').trimEnd()
}

describe('export Python', () => {
  it('produit exactement l’exemple de la section 6 du plan', () => {
    const plan = readFileSync(join(RACINE, 'PLAN.md'), 'utf8')
    const attendu = /```python\n([\s\S]*?)```/.exec(plan)![1]
    const source = readFileSync(join(RACINE, 'tests/programmes/moyenne.algo'), 'utf8')
    expect(exporter(source)).toBe(attendu)
  })

  it('n’importe que les fonctions utilisées, et la graine si l’aléatoire sert', () => {
    const source = 'Variables\n  x : réel\nDébut\n  x ← sqrt(2) + floor(pi) + randint(1, 6) + log(x)\nFin\n'
    expect(exporter(source, 7n)).toContain('from math import floor, log, pi, sqrt\nfrom random import randint, seed\n\nseed(7)\n')
    expect(exporter('Début\n  Afficher 1 ↵\nFin\n', 7n)).not.toContain('seed')
  })

  it('traduit les opérateurs', () => {
    expect(principal('x : réel\nb : booléen\nn : entier', 'n ← 7 div 2 + 7 mod 2 + 2^3^2\nb ← non (n ≠ 1) et n ≤ 2 ou n dans [1, 2]\nx ← -n ^ 2'))
      .toBe('n = 7 // 2 + 7 % 2 + 2 ** 3 ** 2\nb = not (n != 1) and n <= 2 or n in [1, 2]\nx = float(-n ** 2)')
  })

  it('rend explicites les conversions d’entier en réel', () => {
    expect(principal('x : réel\nn : entier\nR : liste de réels', 'n ← 2\nx ← 0\nx ← -1\nx ← n + 1\nR ← [1, n, 2.5]\najouter(R, 3)'))
      .toBe('n = 2\nx = 0.0\nx = -1.0\nx = float(n + 1)\nR = [1.0, float(n), 2.5]\nR.append(3.0)')
  })

  it('lit chaque type de variable', () => {
    expect(principal('n : entier\nx : réel\nch : chaîne\nb : booléen\nL : liste de réels', 'Lire n, x\nLire ch\nLire b\nL ← [0]\nLire L[0]'))
      .toBe('n = int(input("n = "))\nx = float(input("x = "))\nch = input("ch = ")\nb = input("b = ") == "vrai"\nL = [0.0]\nL[0] = float(input("L[0] = "))')
  })

  it('traduit les boucles Pour avec range, en simplifiant la borne de fin', () => {
    const corps = 'Pour i de 1 à 10 faire\nFinPour\nPour i de 0 à n - 1 faire\nFinPour\nPour i de n à 0 pas de -2 faire\nFinPour\nPour i de 1 à n pas de p faire\nFinPour'
    expect(principal('i, n, p : entier', `n ← 3\np ← 1\n${corps}`)).toBe(
      [
        'n = 3',
        'p = 1',
        'for i in range(1, 11):',
        '    pass',
        'for i in range(0, n):',
        '    pass',
        'for i in range(n, -1, -2):',
        '    pass',
        'for i in range(1, n + (1 if p > 0 else -1), p):',
        '    pass',
      ].join('\n'),
    )
  })

  it('traduit Répéter, Pause, Afficher et les procédures sur les listes', () => {
    expect(principal('L : liste d\'entiers\nn : entier', 'L ← []\nRépéter\n  Lire n\nJusqu\'à n > 0\ninsérer(L, 0, n)\nsupprimer(L, -1)\nPause\nAfficher "a", n\nAfficher ↵'))
      .toBe('L = []\nwhile True:\n    n = int(input("n = "))\n    if n > 0:\n        break\nL.insert(0, n)\ndel L[-1]\ninput("Pause : appuyez sur Entrée")\nprint("a", n, end="")\nprint()')
  })

  it('conserve les commentaires', () => {
    expect(principal('n : entier', '// début\nn ← 1 // un\nSi n = 1 alors //test\nFinSi // fin'))
      .toBe('# début\nn = 1  # un\nif n == 1:  # test\n    pass\n# fin')
  })

  it('exporte les procédures avec -> None et les fonctions avec leur type', () => {
    const source = 'Procédure p(L : liste)\nDébut\nFinProcédure\n\nFonction f(a : réel, b : liste de listes de chaînes) : booléen\nDébut\n  Retourner vrai\nFinFonction\n\nDébut\nFin\n'
    expect(exporter(source)).toBe(
      '# Algorithme exporté par AlgoWeb\n\n\ndef p(L: list) -> None:\n    pass\n\n\ndef f(a: float, b: list[list[str]]) -> bool:\n    return True\n',
    )
  })

  it('rappelle la description et la date d’export dans l’en-tête', () => {
    const r = exporterTexteEnPython('Algorithme Test\nDébut\nFin\n', { description: 'Première ligne\nSeconde ligne', date: new Date(2026, 9, 14) })
    expect('python' in r && r.python).toBe('# Algorithme Test (exporté par AlgoWeb)\n# Première ligne\n# Seconde ligne\n# Exporté le 14/10/2026\n')
  })
})
