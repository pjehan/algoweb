/**
 * Produit avec CPython la sortie de référence d'un programme du corpus.
 *
 * Usage : node scripts/reference.ts tests/programmes/nom.algo
 * Lit nom.entree et nom.graine s'ils existent, et écrit nom.sortie.
 * Les booléens sont écrits vrai/faux, comme dans AlgoWeb (différence documentée).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { exporterTexteEnPython } from '../src/export/index.ts'

const fichier = process.argv[2]
if (!fichier?.endsWith('.algo')) {
  console.error('Usage : node scripts/reference.ts tests/programmes/nom.algo')
  process.exit(1)
}
const base = fichier.slice(0, -'.algo'.length)
const graine = existsSync(`${base}.graine`) ? BigInt(readFileSync(`${base}.graine`, 'utf8').trim()) : undefined
const resultat = exporterTexteEnPython(readFileSync(fichier, 'utf8'), { graine })
if (!('python' in resultat)) {
  for (const d of resultat.diagnostics) console.error(`ligne ${d.etendue.ligne} : ${d.message}`)
  process.exit(1)
}
const entree = existsSync(`${base}.entree`) ? readFileSync(`${base}.entree`, 'utf8') : ''
const execution = spawnSync('python3', ['-c', resultat.python], { input: entree, encoding: 'utf8' })
if (execution.status !== 0) {
  console.error(execution.stderr)
  process.exit(1)
}
const sortie = execution.stdout.replace(/\bTrue\b/g, 'vrai').replace(/\bFalse\b/g, 'faux')
writeFileSync(`${base}.sortie`, sortie)
console.log(`${base}.sortie écrit (${sortie.split('\n').length - 1} lignes).`)
