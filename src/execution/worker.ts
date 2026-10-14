/// <reference lib="webworker" />
import { Session, type MessageVersMoteur } from './session.ts'

/**
 * Web Worker d'exécution. La boucle d'événements est rendue entre deux
 * tranches d'instructions par un MessageChannel, plus rapide que setTimeout,
 * pour que les messages de l'interface (pause, saisie) soient traités.
 */

const portee = self as unknown as DedicatedWorkerGlobalScope
const canal = new MessageChannel()
const enAttente: (() => void)[] = []
canal.port1.onmessage = () => enAttente.shift()?.()

const session = new Session(
  (m) => portee.postMessage(m),
  (f) => {
    enAttente.push(f)
    canal.port2.postMessage(null)
  },
)

portee.onmessage = (e: MessageEvent<MessageVersMoteur>) => session.recevoir(e.data)
