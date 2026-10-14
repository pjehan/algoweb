import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyser } from './analyse.ts'
import { formater } from './formateur.ts'
import { compiler } from './index.ts'

/**
 * L'éditeur analyse le texte à chaque frappe : l'analyse ne doit jamais
 * échouer, quel que soit le texte, et le formatage d'un texte correct doit
 * rester correct et stable.
 */

const DOSSIER = join(import.meta.dirname, '../../tests/programmes')
const CORPUS = readdirSync(DOSSIER).filter((f) => f.endsWith('.algo'))
const MORCEAUX = ['(', ')', '[', ']', ',', ':', '←', '=', 'Si ', 'alors', 'FinSi', 'Pour ', 'faire', '"', "'", '↵', '\\n', '\n', ' ', 'x', '1', '-', '^', 'Fin', 'Début', 'Fonction f(', 'de', 'à', 'non ', '//', 'Répéter\n', "Jusqu'à", 'liste de', 'Variables\n', 'Retourner']

function verifierTexte(source: string): void {
  const resultat = compiler(source)
  if (resultat.diagnostics.some((d) => d.code !== 'variable-inutilisee' && d.gravite === 'erreur')) return
  const { programme, diagnostics } = analyser(source)
  if (diagnostics.length > 0) return
  const premier = formater(programme)
  const relu = analyser(premier)
  expect(relu.diagnostics).toEqual([])
  expect(formater(relu.programme)).toBe(premier)
}

describe('robustesse de l’analyse', () => {
  it.each(CORPUS)('analyse chaque début du fichier %s, comme pendant la frappe', (fichier) => {
    const source = readFileSync(join(DOSSIER, fichier), 'utf8')
    for (let i = 0; i <= source.length; i++) verifierTexte(source.slice(0, i))
  })

  it.each(CORPUS)('analyse des variantes altérées du fichier %s', (fichier) => {
    const source = readFileSync(join(DOSSIER, fichier), 'utf8')
    let graine = 7
    const hasard = (n: number) => {
      graine = (graine * 1103515245 + 12345) % 2147483648
      return graine % n
    }
    for (let essai = 0; essai < 300; essai++) {
      let texte = source
      for (let k = 0; k <= hasard(3); k++) {
        const p = hasard(texte.length + 1)
        const operation = hasard(3)
        if (operation === 0) texte = texte.slice(0, p) + texte.slice(p + 1 + hasard(5))
        else if (operation === 1) texte = texte.slice(0, p) + MORCEAUX[hasard(MORCEAUX.length)] + texte.slice(p)
        else {
          const q = hasard(texte.length + 1)
          texte = texte.slice(0, p) + texte.slice(q, q + hasard(20)) + texte.slice(p)
        }
      }
      verifierTexte(texte)
    }
  })
})
