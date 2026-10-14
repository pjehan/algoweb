import { compiler, estExecutable, type Diagnostic, type Notation } from '../langage/index.ts'
import { compilerProgramme } from './compilateur.ts'
import type { ProgrammeCompile } from './code.ts'
import type { ErreurExecution } from './erreurs.ts'
import { Machine } from './machine.ts'

export { Machine, type CadreAffiche, type EtatMachine, type ModePas, type VariableAffichee } from './machine.ts'
export { ErreurExecution } from './erreurs.ts'

export type Preparation =
  | { genre: 'programme'; programme: ProgrammeCompile; avertissements: Diagnostic[] }
  | { genre: 'diagnostics'; diagnostics: Diagnostic[] }

/** Analyse, vérifie et compile un texte. Les erreurs empêchent l'exécution, pas les avertissements. */
export function preparer(source: string, notation: Notation = 'python'): Preparation {
  const resultat = compiler(source, notation)
  if (!estExecutable(resultat)) return { genre: 'diagnostics', diagnostics: resultat.diagnostics }
  return {
    genre: 'programme',
    programme: compilerProgramme(resultat.programme, resultat.verification!),
    avertissements: resultat.diagnostics,
  }
}

export interface ResultatConsole {
  /** Tout ce qu'a affiché le programme, invites de saisie comprises. */
  sortie: string
  erreur?: ErreurExecution
  diagnostics?: Diagnostic[]
  /** Le programme a demandé une saisie alors que toutes les entrées étaient consommées. */
  entreesEpuisees?: boolean
  instructions: number
}

/**
 * Exécute un programme comme Python lancé avec une entrée redirigée : les
 * invites de saisie sont écrites dans la sortie, les valeurs saisies ne le
 * sont pas, et `Pause` lit une ligne après avoir affiché son invite.
 * Sert aux tests et à la comparaison avec CPython.
 */
export function executerConsole(
  source: string,
  entrees: string[] = [],
  options: { graine?: bigint; notation?: Notation; budget?: number } = {},
): ResultatConsole {
  const preparation = preparer(source, options.notation)
  if (preparation.genre === 'diagnostics') return { sortie: '', diagnostics: preparation.diagnostics, instructions: 0 }
  const machine = new Machine(preparation.programme, options)
  const restantes = [...entrees]
  let budget = options.budget ?? Infinity
  let sortie = ''
  const vider = () => {
    sortie += machine.sortie.join('')
    machine.sortie = []
  }
  for (;;) {
    const etat = machine.executer(Math.min(budget, 1_000_000))
    budget -= 1_000_000
    vider()
    switch (etat.genre) {
      case 'termine':
        return { sortie, instructions: machine.instructions }
      case 'erreur':
        return { sortie, erreur: etat.erreur, instructions: machine.instructions }
      case 'saisie': {
        // Une saisie invalide est redemandée avec la ligne suivante, sans réafficher l'invite.
        for (;;) {
          const texte = restantes.shift()
          if (texte === undefined) return { sortie, entreesEpuisees: true, instructions: machine.instructions }
          if (machine.saisir(texte) === undefined) break
        }
        break
      }
      case 'arret':
        if (etat.raison === 'pause') {
          sortie += 'Pause : appuyez sur Entrée'
          restantes.shift()
        }
        break
      case 'interrompu':
        if (budget <= 0) return { sortie, instructions: machine.instructions }
        break
    }
  }
}
