import { useEffect, useRef, useState } from 'react'
import { DELAI_ALERTE_EXECUTION, useEtat } from '../etat.ts'

/**
 * Console : sorties du programme, saisie directement dans la console avec le
 * type attendu, historique des saisies, copie et effacement (PLAN.md, section 8).
 */
export function Console() {
  const blocs = useEtat((e) => e.console)
  const saisie = useEtat((e) => e.saisie)
  const execution = useEtat((e) => e.execution)
  const debut = useEtat((e) => e.debutExecution)
  const etat = useEtat.getState
  const [valeur, setValeur] = useState('')
  const [historique, setHistorique] = useState<string[]>([])
  const [position, setPosition] = useState(-1)
  /** Début de l'exécution pour laquelle l'alerte des 10 secondes s'est déclenchée. */
  const [alerte, setAlerte] = useState(0)
  const zone = useRef<HTMLDivElement>(null)
  const champ = useRef<HTMLInputElement>(null)

  // Défilement vers la dernière ligne.
  useEffect(() => {
    const z = zone.current
    if (z) z.scrollTop = z.scrollHeight
  }, [blocs, saisie])

  useEffect(() => {
    if (saisie) champ.current?.focus()
  }, [saisie])

  // Alerte non bloquante après 10 secondes d'exécution.
  useEffect(() => {
    if (execution !== 'en-cours') return
    const reste = Math.max(0, debut + DELAI_ALERTE_EXECUTION - Date.now())
    const minuterie = setTimeout(() => setAlerte(debut), reste)
    return () => clearTimeout(minuterie)
  }, [execution, debut])
  const longue = alerte === debut

  const valider = () => {
    etat().saisir(valeur)
    if (valeur !== '' && historique.at(-1) !== valeur) setHistorique([...historique, valeur])
    setValeur('')
    setPosition(-1)
  }

  const naviguer = (sens: -1 | 1) => {
    if (historique.length === 0) return
    const p = position === -1 ? (sens === -1 ? historique.length - 1 : -1) : position + sens
    if (p < 0 || p >= historique.length) {
      setPosition(-1)
      setValeur('')
    } else {
      setPosition(p)
      setValeur(historique[p])
    }
  }

  const texte = blocs.map((b) => b.texte + ('suggestion' in b && b.suggestion ? `\n${b.suggestion}\n` : b.genre === 'erreur' || b.genre === 'info' ? '\n' : '')).join('')

  return (
    <section className="console" aria-labelledby="titre-console">
      <div className="entete-panneau">
        <h2 id="titre-console">Console</h2>
        <div className="outils">
          <button type="button" onClick={() => void navigator.clipboard?.writeText(texte)} disabled={blocs.length === 0}>
            Copier
          </button>
          <button type="button" onClick={() => etat().effacerConsole()} disabled={blocs.length === 0}>
            Effacer
          </button>
        </div>
      </div>
      <div ref={zone} className="zone-console" role="log" aria-live="polite" aria-label="Sorties du programme" tabIndex={0}>
        {blocs.length === 0 && !saisie && <p className="vide">Les sorties du programme s’afficheront ici. Exécutez avec Ctrl+Entrée.</p>}
        <pre>
          {blocs.map((b, k) => {
            if (b.genre === 'erreur') {
              return (
                <span key={k} className="bloc-erreur" role="alert">
                  {b.texte}
                  {b.suggestion && <span className="suggestion">{`\n${b.suggestion}`}</span>}
                  {b.ligne !== undefined && (
                    <>
                      {' '}
                      <button type="button" className="lien" onClick={() => etat().allerA(b.ligne!)}>
                        Aller à la ligne {b.ligne}
                      </button>
                    </>
                  )}
                  {'\n'}
                </span>
              )
            }
            return (
              <span key={k} className={`bloc-${b.genre}`}>
                {b.texte}
                {b.genre === 'info' ? '\n' : ''}
              </span>
            )
          })}
          {saisie && (
            <form
              className="saisie"
              onSubmit={(e) => {
                e.preventDefault()
                valider()
              }}
            >
              <label>
                <span className="visuellement-cache">
                  Valeur de {saisie.variable} ({saisie.typeAttendu}) :
                </span>
                <input
                  ref={champ}
                  value={valeur}
                  placeholder={saisie.typeAttendu}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={saisie.message ? true : undefined}
                  aria-describedby={saisie.message ? 'message-saisie' : undefined}
                  onChange={(e) => setValeur(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      naviguer(-1)
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      naviguer(1)
                    }
                  }}
                />
              </label>
            </form>
          )}
        </pre>
        {saisie?.message && (
          <p id="message-saisie" className="message-saisie" role="alert">
            {saisie.message}
          </p>
        )}
      </div>
      {longue && execution === 'en-cours' && (
        <p className="alerte-longue" role="status">
          L’exécution dure depuis plus de 10 secondes.{' '}
          <button type="button" onClick={() => etat().arreter()}>
            Arrêter
          </button>
        </p>
      )}
    </section>
  )
}
