import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MoteurExecution } from '../execution/client.ts'
import type { MessageDuMoteur } from '../execution/session.ts'

/**
 * Démonstration provisoire de l'exécution dans un Web Worker, en attendant
 * l'interface complète (phase 4).
 */
export function Demonstration({ source }: { source: string }) {
  const [console_, setConsole] = useState('')
  const [saisie, setSaisie] = useState<{ variable: string; typeAttendu: string } | null>(null)
  const [message, setMessage] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [texte, setTexte] = useState('')
  const moteur = useRef<MoteurExecution | null>(null)
  const champ = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const m = new MoteurExecution((msg: MessageDuMoteur) => {
      switch (msg.type) {
        case 'sortie':
          setSaisie(null)
          setConsole((c) => c + msg.texte)
          break
        case 'demandeSaisie':
          setSaisie({ variable: msg.variable, typeAttendu: msg.typeAttendu })
          setMessage('')
          break
        case 'saisieInvalide':
          setMessage(msg.message)
          break
        case 'erreur':
          setSaisie(null)
          setConsole((c) => `${c}\nErreur ligne ${msg.ligne} : ${msg.message}\n`)
          setEnCours(false)
          break
        case 'termine':
          setSaisie(null)
          setMessage(`Exécution terminée (${msg.instructions} instructions).`)
          setEnCours(false)
          break
        case 'diagnostics':
          setConsole(msg.diagnostics.map((d) => `Ligne ${d.etendue.ligne} : ${d.message}`).join('\n'))
          break
      }
    })
    moteur.current = m
    return () => m.detruire()
  }, [])

  useEffect(() => {
    if (saisie) champ.current?.focus()
  }, [saisie])

  const executer = () => {
    setConsole('')
    setMessage('')
    setSaisie(null)
    setEnCours(true)
    moteur.current?.lancer({ source, mode: 'continu', pointsArret: [], graine: null, notation: 'python' })
  }

  const valider = (e: FormEvent) => {
    e.preventDefault()
    setConsole((c) => `${c}${texte}\n`)
    moteur.current?.saisir(texte)
    setTexte('')
  }

  return (
    <section aria-labelledby="titre-demo" className="demonstration">
      <h2 id="titre-demo">Essayer</h2>
      <button type="button" onClick={executer} disabled={enCours}>
        Exécuter l’exemple
      </button>
      <pre role="log" aria-live="polite" aria-label="Console">{console_}</pre>
      {saisie && (
        <form onSubmit={valider}>
          <label>
            {saisie.variable} ({saisie.typeAttendu}) :{' '}
            <input ref={champ} value={texte} onChange={(e) => setTexte(e.target.value)} />
          </label>
          <button type="submit">Valider</button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
