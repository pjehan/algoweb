import { createContext } from 'react'
import type { Modele } from '../editeur/modeles.ts'
import type { ModeleBlocs } from './modele.ts'

/** Noms proposés par l'autocomplétion des champs : variables, fonctions, mots-clés des expressions. */
export const NomsDisponibles = createContext<string[]>([])

export interface ContexteBlocs {
  modele: ModeleBlocs
  /** Applique une modification ; `regroupement` fusionne les frappes successives d'un même champ dans l'historique. */
  appliquer: (nouveau: ModeleBlocs, regroupement?: string) => void
  /** Ligne de chaque bloc dans le texte produit. */
  lignes: Map<string, number>
  /** Messages des diagnostics, par bloc. */
  erreurs: Map<string, string[]>
  pointsArret: Set<number>
  ligneCourante: number | null
  replies: Set<string>
  basculerRepli: (id: string) => void
  /** Donne le focus à la ligne d'un bloc (après une insertion, un déplacement…). */
  focaliser: (id: string, champ?: boolean) => void
}

export const Blocs = createContext<ContexteBlocs | null>(null)

/** Éditeur par blocs actif, pour la palette. */
export const blocsActif: { inserer: ((m: Modele) => void) | null } = { inserer: null }
