import { describe, expect, it } from 'vitest'
import { Session, type MessageDuMoteur, type MessageVersMoteur } from './session.ts'

/** Session dont les tâches planifiées s'exécutent à la demande, avec une horloge simulée. */
function session() {
  const recus: MessageDuMoteur[] = []
  const taches: (() => void)[] = []
  let temps = 0
  const s = new Session(
    (m) => recus.push(m),
    (f) => taches.push(f),
    () => temps,
  )
  return {
    recus,
    envoyer: (m: MessageVersMoteur) => s.recevoir(m),
    /** Exécute au plus `maximum` tâches planifiées, en avançant l'horloge de `pas` ms à chacune. */
    derouler: (pas = 1, maximum = 1000) => {
      for (let k = 0; k < maximum && taches.length > 0; k++) {
        temps += pas
        taches.shift()!()
      }
    },
    types: () => recus.map((m) => m.type),
  }
}

const lancer = (source: string, mode: 'continu' | 'pas' = 'continu'): MessageVersMoteur => ({
  type: 'lancer',
  source,
  mode,
  pointsArret: [],
  graine: null,
  notation: 'python',
})

describe('session d’exécution', () => {
  it('signale les erreurs de compilation sans exécuter', () => {
    const s = session()
    s.envoyer(lancer('Début\n  x ← 1\nFin\n'))
    expect(s.types()).toEqual(['diagnostics'])
  })

  it('exécute, demande les saisies, redemande une saisie invalide et termine', () => {
    const s = session()
    s.envoyer(lancer('Variables\n  n : entier\nDébut\n  Lire n\n  Afficher n * 2 ↵\nFin\n'))
    s.derouler()
    expect(s.recus.slice(1)).toEqual([
      { type: 'sortie', texte: 'n = ' },
      { type: 'demandeSaisie', variable: 'n', typeAttendu: 'entier' },
    ])
    s.envoyer({ type: 'saisie', texte: 'x' })
    expect(s.recus.at(-1)?.type).toBe('saisieInvalide')
    s.envoyer({ type: 'saisie', texte: '21' })
    s.derouler()
    expect(s.recus.slice(-2)).toMatchObject([{ type: 'sortie', texte: '42\n' }, { type: 'termine' }])
  })

  it('rend la main entre deux tranches et regroupe les sorties', () => {
    const s = session()
    s.envoyer(lancer('Variables\n  i : entier\nDébut\n  Pour i de 1 à 100000 faire\n    Afficher i ↵\n  FinPour\nFin\n'))
    s.derouler(10)
    const sorties = s.recus.filter((m) => m.type === 'sortie')
    expect(sorties.length).toBeGreaterThan(1)
    expect(sorties.length).toBeLessThan(20)
    expect(sorties.map((m) => (m as { texte: string }).texte).join('').split('\n')).toHaveLength(100001)
  })

  it('s’arrête à la demande pendant une boucle, puis continue', () => {
    const s = session()
    s.envoyer(lancer('Variables\n  i : entier\nDébut\n  i ← 0\n  TantQue vrai faire\n    i ← i + 1\n  FinTantQue\nFin\n'))
    s.derouler(1, 3)
    expect(s.recus.at(-1)?.type).toBe('demarre')
    s.envoyer({ type: 'pause' })
    s.derouler()
    const pause = s.recus.at(-1)
    expect(pause).toMatchObject({ type: 'enPause', raison: 'demande' })
  })

  it('exécute pas à pas et transmet la pile des appels', () => {
    const s = session()
    s.envoyer(lancer('Variables\n  a : entier\nDébut\n  a ← 1\n  Afficher a ↵\nFin\n', 'pas'))
    s.derouler()
    expect(s.recus.at(-1)).toEqual({
      type: 'enPause',
      ligne: 4,
      raison: 'pas',
      pile: [{ nom: '', ligne: 4, variables: [{ nom: 'a', type: 'entier' }] }],
    })
    s.envoyer({ type: 'pas', mode: 'entrer' })
    s.derouler()
    expect(s.recus.at(-1)).toMatchObject({ type: 'enPause', ligne: 5, pile: [{ variables: [{ nom: 'a', valeur: '1' }] }] })
    s.envoyer({ type: 'pointsArret', lignes: [] })
    s.envoyer({ type: 'continuer' })
    s.derouler()
    expect(s.types().slice(-2)).toEqual(['sortie', 'termine'])
  })

  it('transmet les erreurs d’exécution avec la ligne et la suggestion', () => {
    const s = session()
    s.envoyer(lancer('Variables\n  n : entier\nDébut\n  n ← 0\n  Afficher 1 div n ↵\nFin\n'))
    s.derouler()
    expect(s.recus.at(-1)).toMatchObject({ type: 'erreur', ligne: 5, message: 'Division par zéro.', suggestion: expect.any(String) })
  })
})
