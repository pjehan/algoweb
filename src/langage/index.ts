import { analyser } from './analyse.ts'
import type { Programme } from './ast.ts'
import type { Diagnostic } from './messages.ts'
import type { Notation } from './predefinis.ts'
import { verifier, type ResultatVerification } from './verification.ts'

export { analyser } from './analyse.ts'
export { formater, formaterExpression } from './formateur.ts'
export { verifier } from './verification.ts'
export type { Diagnostic } from './messages.ts'
export type { Notation } from './predefinis.ts'

export interface ResultatCompilation {
  programme: Programme
  /** Erreurs de syntaxe, ou, en leur absence, résultats de la vérification. */
  diagnostics: Diagnostic[]
  /** Absent si le texte contient des erreurs de syntaxe. */
  verification?: ResultatVerification
}

/**
 * Analyse puis vérifie un texte. La vérification n'a lieu que si le texte est
 * syntaxiquement correct, pour éviter des erreurs en cascade sur un arbre incomplet.
 */
export function compiler(source: string, notation: Notation = 'python'): ResultatCompilation {
  const { programme, diagnostics } = analyser(source)
  if (diagnostics.length > 0) return { programme, diagnostics }
  const verification = verifier(programme, { notation })
  return { programme, diagnostics: verification.diagnostics, verification }
}

/** Le programme ne contient aucune erreur (les avertissements sont permis). */
export function estExecutable(resultat: ResultatCompilation): boolean {
  return resultat.verification !== undefined && resultat.diagnostics.every((d) => d.gravite !== 'erreur')
}
