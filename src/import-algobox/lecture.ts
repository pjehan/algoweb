import { lireXml, type ElementXml } from './xml.ts'

/**
 * Lecture d'un fichier `.alg` (PLAN.md, section 5.1) : configuration et
 * arbre des lignes, sans interprétation des expressions.
 */

export interface LigneAlg {
  /** Type de la ligne, premier champ de l'attribut `code`. */
  code: number
  /** Champs suivants de `code`. */
  champs: string[]
  /** Texte affiché par AlgoBox (attribut `algoitem`). */
  texte: string
  enfants: LigneAlg[]
}

export interface FichierAlg {
  description: string
  /** Expression de F1, si la fonction numérique est active. */
  f1?: string
  /** Fonction F2, si elle est active. */
  f2?: { parametres: string[]; lignes: { condition: string; valeur: string }[]; defaut: string }
  repereActif: boolean
  /** Nom de l'extension JavaScript, si elle est active. */
  extension?: string
  avecParametres: boolean
  fonctions: LigneAlg[]
  variables: LigneAlg[]
  instructions: LigneAlg[]
  /** Éléments de premier niveau non reconnus. */
  inconnus: string[]
}

export class ErreurAlg extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurAlg'
  }
}

function ligne(e: ElementXml): LigneAlg | undefined {
  const code = e.attributs.code
  if (code === undefined) return undefined
  const [type, ...champs] = code.split('#')
  return {
    code: /^\d+$/.test(type.trim()) ? Number(type) : -1,
    champs,
    texte: e.attributs.algoitem ?? '',
    enfants: lignes(e.enfants),
  }
}

function lignes(elements: ElementXml[]): LigneAlg[] {
  return elements.flatMap((e) => ligne(e) ?? [])
}

/** Lit le texte d'un fichier `.alg`. */
export function lireAlg(texte: string): FichierAlg {
  let racine: ElementXml
  try {
    racine = lireXml(texte)
  } catch (e) {
    throw new ErreurAlg(`Le fichier n’est pas un fichier AlgoBox valide : ${(e as Error).message}`)
  }
  if (racine.nom !== 'Algo') throw new ErreurAlg('Le fichier ne contient pas un algorithme AlgoBox.')

  const fichier: FichierAlg = {
    description: '',
    repereActif: false,
    avecParametres: false,
    fonctions: [],
    variables: [],
    instructions: [],
    inconnus: [],
  }
  // Les éléments de configuration se reconnaissent à leurs attributs, les blocs à leur texte.
  for (const e of racine.enfants) {
    const a = e.attributs
    if ('algoitem' in a && 'code' in a) {
      const enfants = lignes(e.enfants)
      if (a.algoitem === 'FONCTIONS_UTILISEES') fichier.fonctions = enfants
      else if (a.algoitem === 'VARIABLES') fichier.variables = enfants
      else if (a.algoitem === 'DEBUT_ALGORITHME') fichier.instructions = enfants
      else if (a.algoitem !== 'FIN_ALGORITHME') fichier.inconnus.push(a.algoitem)
    } else if ('texte' in a) {
      fichier.description = a.texte
    } else if ('extnom' in a) {
      if (a.extnom !== 'inactif' && a.extnom.trim() !== '') fichier.extension = a.extnom
    } else if ('fctetat' in a && 'fctcode' in a) {
      if (a.fctetat === 'actif' && a.fctcode.trim() !== '') fichier.f1 = a.fctcode
    } else if ('F2etat' in a && 'F2para' in a && 'F2defaut' in a) {
      if (a.F2etat === 'actif') {
        fichier.f2 = {
          parametres: a.F2para.split(',').map((p) => p.trim()).filter((p) => p !== ''),
          lignes: (a.F2lignes ?? '')
            .split('#')
            .map((l) => l.split('@'))
            .filter((l) => l.length === 2)
            .map(([condition, valeur]) => ({ condition, valeur })),
          defaut: a.F2defaut,
        }
      }
    } else if ('repetat' in a && 'repcode' in a) {
      fichier.repereActif = a.repetat === 'actif'
    } else if ('maxBoucle' in a || 'nbDecimales' in a || 'arrondiAuto' in a) {
      fichier.avecParametres = true
    }
  }
  return fichier
}
