import type { Notation } from '../langage/predefinis.ts'
import { nomAffiche } from '../langage/predefinis.ts'
import { avecArticle, texteType, type Type } from '../langage/types.ts'
import { Aleatoire } from './aleatoire.ts'
import { ajouter, appelerFonction, inserer, supprimer, type ContexteBibliotheque } from './bibliotheque.ts'
import { OP, type ProgrammeCompile, type Saisie, type SousProgrammeCompile } from './code.ts'
import { erreurExecution, ErreurExecution } from './erreurs.ts'
import {
  addition,
  appartient,
  comparaison,
  division,
  element,
  modifierElement,
  multiplication,
  oppose,
  puissance,
  quotient,
  reste,
  soustraction,
  tranche,
} from './operations.ts'
import { lireSaisie } from './saisie.ts'
import { caracteres, egales, repr, typeValeur, versReel, type Valeur } from './valeurs.ts'

/**
 * Machine d'exécution à pile. Elle gère elle-même la pile des appels : la
 * profondeur de récursion ne dépend pas de celle de JavaScript, et
 * l'exécution peut s'interrompre à toute instruction (saisie, pause, pas à
 * pas, point d'arrêt), puis reprendre.
 */

export const PROFONDEUR_MAXIMALE = 1000

export type ModePas = 'entrer' | 'passer' | 'sortir'

export type EtatMachine =
  | { genre: 'termine' }
  | { genre: 'saisie'; saisie: Saisie }
  | { genre: 'arret'; raison: 'pas' | 'point-arret' | 'pause' | 'demande'; ligne: number }
  | { genre: 'erreur'; erreur: ErreurExecution }
  | { genre: 'interrompu' }

export interface OptionsMachine {
  graine?: bigint
  notation?: Notation
}

interface Cadre {
  sousProgramme: SousProgrammeCompile
  pc: number
  cases: (Valeur | undefined)[]
  /** Ligne en cours dans ce cadre. */
  ligne: number
}

export interface VariableAffichee {
  nom: string
  type: string
  /** Absente si la variable n'a pas encore de valeur. */
  valeur?: string
  /** Éléments d'une liste, pour les déplier. */
  elements?: string[]
}

export interface CadreAffiche {
  nom: string
  ligne: number
  variables: VariableAffichee[]
}

export class Machine {
  /** Textes affichés depuis la dernière lecture de `sortie`. */
  sortie: string[] = []
  /** Nombre d'instructions exécutées. */
  instructions = 0
  /** Lignes des points d'arrêt. */
  pointsArret = new Set<number>()

  private readonly programme: ProgrammeCompile
  private readonly cadres: Cadre[] = []
  private readonly pile: Valeur[] = []
  private readonly bibliotheque: ContexteBibliotheque
  private etat: EtatMachine | undefined
  private mode: ModePas | undefined
  private profondeurReference = 0
  private arretDemande = false

  constructor(programme: ProgrammeCompile, options: OptionsMachine = {}) {
    this.programme = programme
    const notation = options.notation ?? 'python'
    this.bibliotheque = {
      alea: new Aleatoire(options.graine),
      nom: (python, n) => nomAffiche(python, notation, n),
    }
    const principal = programme.sousProgrammes[0]
    this.cadres.push({ sousProgramme: principal, pc: 0, cases: new Array(principal.nombreCases), ligne: 0 })
  }

  get ligne(): number {
    return this.cadres.at(-1)?.ligne ?? 0
  }

  get termine(): boolean {
    return this.etat?.genre === 'termine' || this.etat?.genre === 'erreur'
  }

  /** Active le pas à pas : la machine s'arrête à la prochaine ligne selon `mode`. */
  pas(mode: ModePas): void {
    this.mode = mode
    this.profondeurReference = this.cadres.length
  }

  /** Reprend l'exécution continue (jusqu'au prochain point d'arrêt). */
  continuer(): void {
    this.mode = undefined
  }

  /** Demande un arrêt à la prochaine ligne. */
  demanderArret(): void {
    this.arretDemande = true
  }

  /**
   * Transmet le texte saisi. Renvoie un message si la valeur ne convient pas :
   * la saisie reste alors en attente.
   */
  saisir(texte: string): string | undefined {
    if (this.etat?.genre !== 'saisie') throw new Error('Aucune saisie en attente.')
    const resultat = lireSaisie(texte, this.etat.saisie.type)
    if ('message' in resultat) return resultat.message
    this.pile.push(resultat.valeur)
    this.etat = undefined
    return undefined
  }

  /** Exécute au plus `budget` instructions. */
  executer(budget: number): EtatMachine {
    if (this.etat) return this.etat
    let cadre = this.cadres.at(-1)!
    let code = cadre.sousProgramme.code
    let cases = cadre.cases
    let pc = cadre.pc
    const pile = this.pile
    const programme = this.programme
    let n = 0
    try {
      for (; n < budget; n++) {
        const op = code[pc]
        const a = code[pc + 1]
        pc += 3
        switch (op) {
          case OP.CONST:
            pile.push(programme.constantes[a])
            break
          case OP.LOAD: {
            const v = cases[a]
            if (v === undefined) throw erreurExecution('variable-sans-valeur', this.nomCase(cadre, a))
            pile.push(v)
            break
          }
          case OP.STORE:
            cases[a] = pile.pop()!
            break
          case OP.POP:
            pile.pop()
            break
          case OP.CONV: {
            const conversion = programme.conversions[a]
            pile.push(adapter(pile.pop()!, conversion.type, conversion.cible))
            break
          }
          case OP.ADD: {
            const b = pile.pop()!
            pile.push(addition(pile.pop()!, b))
            break
          }
          case OP.SUB: {
            const b = pile.pop()!
            pile.push(soustraction(pile.pop()!, b))
            break
          }
          case OP.MUL: {
            const b = pile.pop()!
            pile.push(multiplication(pile.pop()!, b))
            break
          }
          case OP.DIV: {
            const b = pile.pop()!
            pile.push(division(pile.pop()!, b))
            break
          }
          case OP.IDIV: {
            const b = pile.pop()!
            pile.push(quotient(pile.pop()!, b))
            break
          }
          case OP.MOD: {
            const b = pile.pop()!
            pile.push(reste(pile.pop()!, b))
            break
          }
          case OP.POW: {
            const b = pile.pop()!
            pile.push(puissance(pile.pop()!, b, a === 1))
            break
          }
          case OP.NEG:
            pile.push(oppose(pile.pop()!))
            break
          case OP.NOT: {
            const v = pile.pop()!
            if (typeof v !== 'boolean') throw erreurExecution('operation-invalide', 'non', typeValeur(v))
            pile.push(!v)
            break
          }
          case OP.EQ: {
            const b = pile.pop()!
            pile.push(egales(pile.pop()!, b))
            break
          }
          case OP.NE: {
            const b = pile.pop()!
            pile.push(!egales(pile.pop()!, b))
            break
          }
          case OP.LT: {
            const b = pile.pop()!
            pile.push(comparaison('<', pile.pop()!, b))
            break
          }
          case OP.LE: {
            const b = pile.pop()!
            pile.push(comparaison('≤', pile.pop()!, b))
            break
          }
          case OP.GT: {
            const b = pile.pop()!
            pile.push(comparaison('>', pile.pop()!, b))
            break
          }
          case OP.GE: {
            const b = pile.pop()!
            pile.push(comparaison('≥', pile.pop()!, b))
            break
          }
          case OP.IN: {
            const b = pile.pop()!
            pile.push(appartient(pile.pop()!, b))
            break
          }
          case OP.JUMP:
            pc = a
            break
          case OP.JUMP_FAUX:
            if (!condition(pile.pop()!)) pc = a
            break
          case OP.JUMP_FAUX_GARDE:
            if (!condition(pile[pile.length - 1])) pc = a
            else pile.pop()
            break
          case OP.JUMP_VRAI_GARDE:
            if (condition(pile[pile.length - 1])) pc = a
            else pile.pop()
            break
          case OP.INDEX: {
            const i = pile.pop()!
            pile.push(element(pile.pop()!, i))
            break
          }
          case OP.TRANCHE: {
            const fin = a & 2 ? pile.pop()! : undefined
            const debut = a & 1 ? pile.pop()! : undefined
            pile.push(tranche(pile.pop()!, debut, fin))
            break
          }
          case OP.STORE_INDEX: {
            const i = pile.pop()!
            const objet = pile.pop()!
            modifierElement(objet, i, pile.pop()!)
            break
          }
          case OP.LISTE:
            pile.push(a === 0 ? [] : pile.splice(pile.length - a, a))
            break
          case OP.PREDEF: {
            const args = code[pc - 1] === 0 ? [] : pile.splice(pile.length - code[pc - 1], code[pc - 1])
            pile.push(appelerFonction(programme.predefinis[a], args, this.bibliotheque))
            break
          }
          case OP.AJOUTER: {
            const x = pile.pop()!
            ajouter(pile.pop()!, x)
            break
          }
          case OP.INSERER: {
            const x = pile.pop()!
            const i = pile.pop()!
            inserer(pile.pop()!, i, x)
            break
          }
          case OP.SUPPRIMER: {
            const i = pile.pop()!
            supprimer(pile.pop()!, i)
            break
          }
          case OP.APPEL: {
            if (this.cadres.length >= PROFONDEUR_MAXIMALE) throw erreurExecution('recursion-trop-profonde')
            const sp = programme.sousProgrammes[a]
            const nombre = code[pc - 1]
            const nouvelles: (Valeur | undefined)[] = new Array(sp.nombreCases)
            for (let k = nombre - 1; k >= 0; k--) nouvelles[k] = pile.pop()
            cadre.pc = pc
            cadre = { sousProgramme: sp, pc: 0, cases: nouvelles, ligne: cadre.ligne }
            this.cadres.push(cadre)
            code = sp.code
            cases = nouvelles
            pc = 0
            break
          }
          case OP.RETOUR:
          case OP.RETOUR_RIEN: {
            this.cadres.pop()
            cadre = this.cadres.at(-1)!
            code = cadre.sousProgramme.code
            cases = cadre.cases
            pc = cadre.pc
            break
          }
          case OP.FIN:
            cadre.pc = pc - 3
            this.instructions += n
            this.etat = { genre: 'termine' }
            return this.etat
          case OP.FIN_SANS_RETOUR:
            throw erreurExecution('fonction-sans-retour', cadre.sousProgramme.nom)
          case OP.AFFICHER: {
            const valeurs = a === 0 ? [] : pile.splice(pile.length - a, a)
            this.sortie.push(valeurs.map(texteAffiche).join(' ') + (code[pc - 1] === 1 ? '\n' : ''))
            break
          }
          case OP.LIRE: {
            const saisie = programme.saisies[a]
            this.sortie.push(saisie.invite)
            cadre.pc = pc
            this.instructions += n + 1
            this.etat = { genre: 'saisie', saisie }
            return this.etat
          }
          case OP.PAUSE:
            cadre.pc = pc
            this.instructions += n + 1
            return { genre: 'arret', raison: 'pause', ligne: cadre.ligne }
          case OP.LIGNE: {
            cadre.ligne = a
            const raison = this.raisonArret(a)
            if (raison) {
              cadre.pc = pc
              this.instructions += n + 1
              this.mode = undefined
              this.arretDemande = false
              return { genre: 'arret', raison, ligne: a }
            }
            break
          }
          case OP.POUR_PAS:
            if (cases[a + 2] === 0n) throw erreurExecution('pas-nul')
            break
          case OP.POUR_TEST: {
            const courant = cases[a]
            const fin = cases[a + 1]
            const p = cases[a + 2]
            if (typeof courant !== 'bigint' || typeof fin !== 'bigint' || typeof p !== 'bigint') {
              throw erreurExecution('operation-invalide', 'Pour', 'des bornes qui ne sont pas des entiers')
            }
            if (p > 0n ? courant > fin : courant < fin) pc = code[pc - 1]
            break
          }
          case OP.POUR_INC:
            cases[a] = (cases[a] as bigint) + (cases[a + 2] as bigint)
            break
          case OP.PARCOURS_INIT: {
            const collection = pile.pop()!
            if (typeof collection === 'string') cases[a] = caracteres(collection)
            else if (Array.isArray(collection)) cases[a] = collection
            else throw erreurExecution('operation-invalide', 'Pour chaque', typeValeur(collection))
            cases[a + 1] = 0n
            break
          }
          case OP.PARCOURS_SUIVANT: {
            // Parcours de la liste vivante, par indice, comme l'itérateur de liste de Python.
            const elements = cases[a] as Valeur[]
            const position = Number(cases[a + 1] as bigint)
            if (position >= elements.length) {
              pc = code[pc - 1]
            } else {
              pile.push(elements[position])
              cases[a + 1] = BigInt(position + 1)
            }
            break
          }
          default:
            throw new Error(`Instruction inconnue : ${op}`)
        }
      }
      cadre.pc = pc
      this.instructions += n
      return { genre: 'interrompu' }
    } catch (e) {
      if (!(e instanceof ErreurExecution)) throw e
      e.ligne = cadre.ligne
      this.instructions += n
      this.etat = { genre: 'erreur', erreur: e }
      return this.etat
    }
  }

  private raisonArret(ligne: number): 'pas' | 'point-arret' | 'demande' | undefined {
    if (this.arretDemande) return 'demande'
    // Un pas qui arrive sur un point d'arrêt est signalé comme point d'arrêt (l'animation s'y interrompt).
    if (this.pointsArret.has(ligne)) return 'point-arret'
    if (this.mode === 'entrer') return 'pas'
    if (this.mode === 'passer' && this.cadres.length <= this.profondeurReference) return 'pas'
    if (this.mode === 'sortir' && this.cadres.length < this.profondeurReference) return 'pas'
    return undefined
  }

  private nomCase(cadre: Cadre, k: number): string {
    return cadre.sousProgramme.variables.find((v) => v.case === k)?.nom ?? '?'
  }

  /** Pile des appels, de l'algorithme principal au sous-programme en cours, pour le débogueur. */
  pileAppels(): CadreAffiche[] {
    return this.cadres.map((c) => ({
      nom: c.sousProgramme.nom,
      ligne: c.ligne,
      variables: c.sousProgramme.variables.map((v) => {
        const valeur = c.cases[v.case]
        const affichee: VariableAffichee = { nom: v.nom, type: texteType(v.type) }
        if (valeur !== undefined) {
          affichee.valeur = repr(valeur)
          if (Array.isArray(valeur)) affichee.elements = valeur.slice(0, 1000).map((x) => repr(x))
        }
        return affichee
      }),
    }))
  }
}

/** Valeur telle que l'affiche `Afficher`. */
function texteAffiche(v: Valeur): string {
  return typeof v === 'string' ? v : repr(v)
}

function condition(v: Valeur): boolean {
  if (typeof v !== 'boolean') throw erreurExecution('operation-invalide', 'Si', `${typeValeur(v)} utilisé comme condition`)
  return v
}

/** Range une valeur dans une variable de type `type`, en convertissant un entier en réel si besoin. */
export function adapter(v: Valeur, type: Type, cible: string): Valeur {
  switch (type.genre) {
    case 'reel':
      if (typeof v === 'number') return v
      if (typeof v === 'bigint') return versReel(v)
      break
    case 'entier':
      if (typeof v === 'bigint') return v
      break
    case 'chaine':
      if (typeof v === 'string') return v
      break
    case 'booleen':
      if (typeof v === 'boolean') return v
      break
    case 'liste':
      if (Array.isArray(v)) return v
      break
    default:
      return v
  }
  throw erreurExecution('type-incompatible', cible, avecArticle(type), repr(v))
}
