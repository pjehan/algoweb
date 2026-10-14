import { convertirAlg, type RapportImport } from './conversion.ts'
import { lireAlg } from './lecture.ts'

export type { PointAVerifier, RapportImport, TypeDeduit } from './conversion.ts'
export { ErreurAlg } from './lecture.ts'

export interface AlgImporte {
  nom: string
  description: string
  /** Pseudo-code AlgoWeb, fonctions prédéfinies en noms Python. */
  code: string
  rapport: RapportImport
}

/** Nom de l'algorithme d'après le nom du fichier, sans extension ni caractères de contrôle. */
export function nomDepuisFichier(fichier: string): string {
  const base = fichier.split(/[\\/]/).pop() ?? fichier
  const nom = base
    .replace(/\.alg$/i, '')
    .replace(/[\p{Cc}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return nom === '' ? 'Algorithme importé' : nom
}

/**
 * Importe le texte d'un fichier `.alg` (PLAN.md, section 5). Lève ErreurAlg si
 * le fichier n'est pas un algorithme AlgoBox lisible.
 */
export function importerAlg(texte: string, fichier: string): AlgImporte {
  const lu = lireAlg(texte)
  const nom = nomDepuisFichier(fichier)
  const { code, rapport } = convertirAlg(lu, nom)
  return { nom, description: lu.description, code, rapport }
}
