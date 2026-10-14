import type { ModePas } from './machine.ts'
import type { MessageDuMoteur, MessageVersMoteur } from './session.ts'

/**
 * Côté interface : pilote le Web Worker d'exécution. Arrêter termine le
 * Worker, ce qui interrompt à coup sûr même une boucle infinie, puis en crée
 * un nouveau pour l'exécution suivante.
 */
export class MoteurExecution {
  private worker: Worker
  private readonly recevoir: (m: MessageDuMoteur) => void

  constructor(recevoir: (m: MessageDuMoteur) => void) {
    this.recevoir = recevoir
    this.worker = this.creer()
  }

  private creer(): Worker {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'execution' })
    worker.onmessage = (e: MessageEvent<MessageDuMoteur>) => this.recevoir(e.data)
    return worker
  }

  private envoyer(m: MessageVersMoteur): void {
    this.worker.postMessage(m)
  }

  lancer(options: Omit<Extract<MessageVersMoteur, { type: 'lancer' }>, 'type'>): void {
    this.envoyer({ type: 'lancer', ...options })
  }

  saisir(texte: string): void {
    this.envoyer({ type: 'saisie', texte })
  }

  continuer(): void {
    this.envoyer({ type: 'continuer' })
  }

  pas(mode: ModePas): void {
    this.envoyer({ type: 'pas', mode })
  }

  pause(): void {
    this.envoyer({ type: 'pause' })
  }

  pointsArret(lignes: number[]): void {
    this.envoyer({ type: 'pointsArret', lignes })
  }

  /** Arrête l'exécution en cours, quelle qu'elle soit. */
  arreter(): void {
    this.worker.terminate()
    this.worker = this.creer()
  }

  detruire(): void {
    this.worker.terminate()
  }
}
