import { compiler, estExecutable, type Diagnostic } from '../langage/index.ts'
import { exporterPython, type OptionsExportPython } from './python.ts'

export { exporterPython, type OptionsExportPython } from './python.ts'

/** Exporte un texte AlgoWeb en Python, s'il ne contient pas d'erreur. */
export function exporterTexteEnPython(source: string, options: OptionsExportPython = {}): { python: string } | { diagnostics: Diagnostic[] } {
  const resultat = compiler(source)
  if (!estExecutable(resultat)) return { diagnostics: resultat.diagnostics }
  return { python: exporterPython(resultat.programme, resultat.verification!, options) }
}
