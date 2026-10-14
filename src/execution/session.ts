import type { Diagnostic, Notation } from '../langage/index.ts'
import { texteType } from '../langage/types.ts'
import { preparer } from './index.ts'
import { Machine, type CadreAffiche, type ModePas } from './machine.ts'

/**
 * Protocole entre l'interface et le moteur d'exécution (PLAN.md, section 9.4).
 * La session tourne dans un Web Worker : l'interface ne se fige jamais, et
 * Arrêter termine le Worker.
 */

export type MessageVersMoteur =
  | {
      type: 'lancer'
      source: string
      /** `pas` : l'exécution s'arrête sur la première ligne. */
      mode: 'continu' | 'pas'
      pointsArret: number[]
      /** Graine de l'aléatoire, en texte (un entier) ; `null` pour des tirages différents à chaque exécution. */
      graine: string | null
      notation: Notation
    }
  | { type: 'saisie'; texte: string }
  | { type: 'continuer' }
  | { type: 'pas'; mode: ModePas }
  | { type: 'pause' }
  | { type: 'pointsArret'; lignes: number[] }

export type MessageDuMoteur =
  | { type: 'diagnostics'; diagnostics: Diagnostic[] }
  | { type: 'demarre'; avertissements: Diagnostic[] }
  | { type: 'sortie'; texte: string }
  | { type: 'demandeSaisie'; variable: string; typeAttendu: string }
  | { type: 'saisieInvalide'; message: string }
  | { type: 'enPause'; ligne: number; raison: 'pas' | 'point-arret' | 'pause' | 'demande'; pile: CadreAffiche[] }
  | { type: 'erreur'; ligne: number; message: string; suggestion?: string; pile: CadreAffiche[] }
  | { type: 'termine'; duree: number; instructions: number }

/** Instructions exécutées entre deux retours à la boucle d'événements. */
const TRANCHE = 100_000
/** Intervalle de regroupement des sorties, en millisecondes. */
const INTERVALLE_SORTIE = 50

export class Session {
  private machine: Machine | undefined
  private enCours = false
  private debut = 0
  private dernierEnvoi = 0
  private readonly envoyer: (m: MessageDuMoteur) => void
  private readonly planifier: (f: () => void) => void
  private readonly horloge: () => number

  constructor(
    envoyer: (m: MessageDuMoteur) => void,
    planifier: (f: () => void) => void,
    horloge: () => number = () => Date.now(),
  ) {
    this.envoyer = envoyer
    this.planifier = planifier
    this.horloge = horloge
  }

  recevoir(m: MessageVersMoteur): void {
    switch (m.type) {
      case 'lancer':
        this.lancer(m)
        return
      case 'saisie': {
        if (!this.machine) return
        const message = this.machine.saisir(m.texte)
        if (message) this.envoyer({ type: 'saisieInvalide', message })
        else this.reprendre()
        return
      }
      case 'continuer':
        this.machine?.continuer()
        this.reprendre()
        return
      case 'pas':
        this.machine?.pas(m.mode)
        this.reprendre()
        return
      case 'pause':
        this.machine?.demanderArret()
        return
      case 'pointsArret':
        if (this.machine) this.machine.pointsArret = new Set(m.lignes)
        return
    }
  }

  private lancer(m: Extract<MessageVersMoteur, { type: 'lancer' }>): void {
    const preparation = preparer(m.source, m.notation)
    if (preparation.genre === 'diagnostics') {
      this.envoyer({ type: 'diagnostics', diagnostics: preparation.diagnostics })
      return
    }
    this.machine = new Machine(preparation.programme, {
      graine: m.graine === null ? undefined : BigInt(m.graine),
      notation: m.notation,
    })
    this.machine.pointsArret = new Set(m.pointsArret)
    if (m.mode === 'pas') this.machine.pas('entrer')
    this.debut = this.horloge()
    this.dernierEnvoi = this.debut
    this.envoyer({ type: 'demarre', avertissements: preparation.avertissements })
    this.reprendre()
  }

  private reprendre(): void {
    if (this.enCours) return
    this.enCours = true
    this.planifier(() => this.tranche())
  }

  private viderSortie(): void {
    const machine = this.machine!
    if (machine.sortie.length > 0) {
      this.envoyer({ type: 'sortie', texte: machine.sortie.join('') })
      machine.sortie = []
    }
    this.dernierEnvoi = this.horloge()
  }

  private tranche(): void {
    const machine = this.machine!
    const etat = machine.executer(TRANCHE)
    if (etat.genre === 'interrompu') {
      if (this.horloge() - this.dernierEnvoi >= INTERVALLE_SORTIE) this.viderSortie()
      this.planifier(() => this.tranche())
      return
    }
    this.enCours = false
    this.viderSortie()
    switch (etat.genre) {
      case 'saisie':
        this.envoyer({ type: 'demandeSaisie', variable: etat.saisie.cible, typeAttendu: texteType(etat.saisie.type) })
        return
      case 'arret':
        this.envoyer({ type: 'enPause', ligne: etat.ligne, raison: etat.raison, pile: machine.pileAppels() })
        return
      case 'erreur': {
        const { erreur } = etat
        const message: MessageDuMoteur = { type: 'erreur', ligne: erreur.ligne ?? 0, message: erreur.message, pile: machine.pileAppels() }
        if (erreur.suggestion) message.suggestion = erreur.suggestion
        this.envoyer(message)
        return
      }
      case 'termine':
        this.envoyer({ type: 'termine', duree: this.horloge() - this.debut, instructions: machine.instructions })
        return
    }
  }
}
