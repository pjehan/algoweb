/**
 * Vérifie l'import de fichiers AlgoBox personnels, qui ne sont pas versionnés
 * (PLAN.md, section 5.4) : conversion, rapport et diagnostics de chaque fichier.
 *
 * Usage : node scripts/import-algobox.ts <fichier.alg ou dossier>… [--detail] [--sortie <dossier>]
 *   --detail   affiche les points à vérifier et les diagnostics de chaque fichier ;
 *   --sortie   écrit le pseudo-code AlgoWeb produit (nom.algo) dans ce dossier.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { ErreurAlg, importerAlg } from '../src/import-algobox/index.ts'
import { compiler } from '../src/langage/index.ts'
import { decoderAlg } from '../src/stockage/archive.ts'

const args = process.argv.slice(2)
const detail = args.includes('--detail')
const iSortie = args.indexOf('--sortie')
const sortie = iSortie >= 0 ? args[iSortie + 1] : undefined
const chemins = args.filter((a, k) => !a.startsWith('--') && !(iSortie >= 0 && k === iSortie + 1))
if (chemins.length === 0) {
  console.error('Usage : node scripts/import-algobox.ts <fichier.alg ou dossier>… [--detail] [--sortie <dossier>]')
  process.exit(1)
}

function fichiersAlg(chemin: string): string[] {
  if (statSync(chemin).isDirectory()) return readdirSync(chemin).sort().flatMap((f) => fichiersAlg(join(chemin, f)))
  return chemin.toLowerCase().endsWith('.alg') ? [chemin] : []
}

const fichiers = chemins.flatMap(fichiersAlg)
if (sortie) mkdirSync(sortie, { recursive: true })
let illisibles = 0
let avecErreurs = 0
for (const fichier of fichiers) {
  let importe
  try {
    importe = importerAlg(decoderAlg(readFileSync(fichier)), basename(fichier))
  } catch (e) {
    if (!(e instanceof ErreurAlg)) throw e
    illisibles++
    console.log(`✗ ${fichier} : ${e.message}`)
    continue
  }
  const diagnostics = compiler(importe.code).diagnostics
  const erreurs = diagnostics.filter((d) => d.gravite === 'erreur').length
  if (erreurs > 0) avecErreurs++
  const r = importe.rapport
  console.log(
    `${erreurs > 0 ? '!' : '✓'} ${fichier} : ${r.lignes} lignes, ${r.points.length} point(s) à vérifier, ${erreurs} erreur(s), ${diagnostics.length - erreurs} avertissement(s)`,
  )
  if (detail) {
    for (const p of r.points) console.log(`    ${p.lignes.length > 0 ? `ligne${p.lignes.length > 1 ? 's' : ''} ${p.lignes.join(', ')} : ` : ''}${p.message}`)
    for (const d of diagnostics) console.log(`    [${d.gravite}] ligne ${d.etendue.ligne} : ${d.message}`)
  }
  if (sortie) writeFileSync(join(sortie, basename(fichier).replace(/\.alg$/i, '.algo')), importe.code)
}
console.log(`\n${fichiers.length} fichier(s) : ${illisibles} illisible(s), ${avecErreurs} avec des erreurs à corriger.`)
