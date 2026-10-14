import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { executerConsole } from '../execution/index.ts'
import { exporterTexteEnPython } from './index.ts'

/**
 * Validation croisée (PLAN.md, section 6) : chaque programme du corpus est
 * exporté, exécuté par CPython sur les mêmes entrées, et ses sorties sont
 * comparées à la référence et à celles d'AlgoWeb, hors différences documentées.
 */

const DOSSIER = join(import.meta.dirname, '../../tests/programmes')
const PROGRAMMES = readdirSync(DOSSIER).filter((f) => f.endsWith('.algo') && existsSync(join(DOSSIER, f.replace('.algo', '.sortie'))))
const python = spawnSync('python3', ['--version'], { encoding: 'utf8' })
const pythonDisponible = python.status === 0

/** Neutralise les différences documentées : booléens affichés vrai/faux, dernier chiffre des fonctions mathématiques. */
export function normaliser(sortie: string): string {
  return sortie.replace(/\bTrue\b/g, 'vrai').replace(/\bFalse\b/g, 'faux')
}

function presqueEgales(a: string, b: string): boolean {
  if (a === b) return true
  const la = a.split('\n')
  const lb = b.split('\n')
  if (la.length !== lb.length) return false
  return la.every((ligne, k) => {
    const ma = ligne.split(' ')
    const mb = lb[k].split(' ')
    if (ma.length !== mb.length) return false
    return ma.every((m, j) => {
      if (m === mb[j]) return true
      const x = Number(m)
      const y = Number(mb[j])
      return /[.e]/.test(m) && Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 4e-16 * Math.max(Math.abs(x), Math.abs(y))
    })
  })
}

describe('validation croisée avec CPython', () => {
  it('python3 est disponible (obligatoire dans la CI)', () => {
    if (process.env.CI) expect(pythonDisponible, 'python3 introuvable').toBe(true)
  })

  it.skipIf(!pythonDisponible).each(PROGRAMMES)('%s', (fichier) => {
    const base = join(DOSSIER, fichier.replace('.algo', ''))
    const source = readFileSync(`${base}.algo`, 'utf8')
    const graine = existsSync(`${base}.graine`) ? BigInt(readFileSync(`${base}.graine`, 'utf8').trim()) : undefined
    const entree = existsSync(`${base}.entree`) ? readFileSync(`${base}.entree`, 'utf8') : ''
    const reference = readFileSync(`${base}.sortie`, 'utf8')

    const export_ = exporterTexteEnPython(source, { graine })
    if (!('python' in export_)) throw new Error('export impossible')
    const dossier = mkdtempSync(join(tmpdir(), 'algoweb-'))
    const script = join(dossier, 'programme.py')
    writeFileSync(script, export_.python)
    const execution = spawnSync('python3', [script], { input: entree, encoding: 'utf8', timeout: 20_000 })
    expect(execution.stderr).toBe('')
    const sortiePython = normaliser(execution.stdout)
    expect(presqueEgales(sortiePython, reference), `Python :\n${sortiePython}\nRéférence :\n${reference}`).toBe(true)

    const entrees = entree === '' ? [] : (entree.endsWith('\n') ? entree.slice(0, -1) : entree).split('\n')
    const algoweb = executerConsole(source, entrees, { graine }).sortie
    expect(presqueEgales(algoweb, sortiePython), `AlgoWeb :\n${algoweb}\nPython :\n${sortiePython}`).toBe(true)
  })
})
