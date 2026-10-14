import { useEtat, VITESSES, type Vitesse } from '../etat.ts'

const RAISONS = {
  pas: 'pas à pas',
  'point-arret': 'point d’arrêt',
  pause: 'instruction Pause',
  demande: 'suspendue',
} as const

/** Commandes du débogueur, affichées pendant une exécution (PLAN.md, section 8). */
export function BarreDebogage() {
  const execution = useEtat((e) => e.execution)
  const pause = useEtat((e) => e.pause)
  const animation = useEtat((e) => e.animation)
  const vitesse = useEtat((e) => e.vitesse)
  const etat = useEtat.getState
  if (execution === 'arrete') return null
  const enPause = execution === 'pause'

  const statut =
    execution === 'saisie'
      ? 'En attente d’une saisie dans la console.'
      : enPause && pause
        ? `En pause à la ligne ${pause.ligne} (${RAISONS[pause.raison]}).`
        : animation
          ? 'Exécution animée…'
          : 'Exécution en cours…'

  return (
    <div className="barre-debogage" role="toolbar" aria-label="Débogueur">
      <p className="statut-execution" role="status">
        {statut}
      </p>
      <button type="button" disabled={!enPause} onClick={() => etat().continuer()} aria-keyshortcuts="F9" title="Continuer jusqu’au prochain point d’arrêt (F9)">
        Continuer
      </button>
      <button type="button" disabled={!enPause} onClick={() => etat().pas('entrer')} aria-keyshortcuts="F7" title="Exécuter la ligne, en entrant dans les fonctions (F7)">
        Pas suivant
      </button>
      <button type="button" disabled={!enPause} onClick={() => etat().pas('passer')} aria-keyshortcuts="F8" title="Exécuter la ligne, sans entrer dans les fonctions (F8)">
        Pas principal
      </button>
      <button
        type="button"
        disabled={!enPause || (pause?.pile.length ?? 0) < 2}
        onClick={() => etat().pas('sortir')}
        aria-keyshortcuts="Shift+F8"
        title="Terminer la fonction en cours (Maj+F8)"
      >
        Sortir de la fonction
      </button>
      <button type="button" disabled={execution !== 'en-cours' || animation} onClick={() => etat().suspendre()} title="Interrompre l’exécution là où elle se trouve">
        Suspendre
      </button>
      <button type="button" aria-pressed={animation} onClick={() => etat().animer(!animation)} disabled={execution === 'saisie'}>
        {animation ? 'Arrêter l’animation' : 'Animer'}
      </button>
      <label>
        Vitesse{' '}
        <select value={vitesse} onChange={(e) => etat().definirVitesse(e.target.value as Vitesse)}>
          {(Object.keys(VITESSES) as Vitesse[]).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/** Variables et pile des appels pendant une pause (PLAN.md, section 8). */
export function Inspection() {
  const pause = useEtat((e) => e.pause)
  const execution = useEtat((e) => e.execution)
  const cadreChoisi = useEtat((e) => e.cadreChoisi)
  const etat = useEtat.getState

  if (!pause) {
    return (
      <section className="inspection" aria-labelledby="titre-variables">
        <div className="entete-panneau">
          <h2 id="titre-variables">Variables</h2>
        </div>
        <p className="vide">Les variables s’affichent quand l’exécution est en pause : utilisez Pas à pas, ou cliquez dans la marge de l’éditeur pour placer un point d’arrêt.</p>
      </section>
    )
  }

  const cadre = pause.pile[Math.min(cadreChoisi, pause.pile.length - 1)]
  const nomCadre = (nom: string) => (nom === '' ? 'Algorithme principal' : nom)
  const perimee = execution !== 'pause'

  return (
    <section className={`inspection${perimee ? ' perimee' : ''}`} aria-labelledby="titre-variables">
      <div className="entete-panneau">
        <h2 id="titre-variables">Variables {pause.pile.length > 1 && <span className="cadre">: {nomCadre(cadre.nom)}</span>}</h2>
      </div>
      {perimee && <p className="aide">Valeurs à la dernière pause.</p>}
      {cadre.variables.length === 0 ? (
        <p className="vide">Aucune variable.</p>
      ) : (
        <table className="variables">
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">Type</th>
              <th scope="col">Valeur</th>
            </tr>
          </thead>
          <tbody>
            {cadre.variables.map((v) => {
              const modifiee = pause.modifiees.includes(`${cadreChoisi}:${v.nom}`)
              return (
                <tr key={v.nom} className={modifiee ? 'modifiee' : undefined}>
                  <th scope="row">
                    {v.nom}
                    {modifiee && <span className="marque-modifiee"> modifiée</span>}
                  </th>
                  <td>{v.type}</td>
                  <td>
                    {v.valeur === undefined ? (
                      <span className="sans-valeur">sans valeur</span>
                    ) : v.elements ? (
                      <details>
                        <summary>
                          <code>{v.valeur.length > 60 ? `${v.valeur.slice(0, 60)}…` : v.valeur}</code>
                        </summary>
                        <ol start={0}>
                          {v.elements.map((x, k) => (
                            <li key={k}>
                              <span className="indice">[{k}]</span> <code>{x}</code>
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : (
                      <code>{v.valeur}</code>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {pause.pile.length > 1 && (
        <>
          <h2 id="titre-pile" className="sous-titre">
            Pile d’appels
          </h2>
          <ol className="pile" aria-labelledby="titre-pile">
            {[...pause.pile.entries()].reverse().map(([k, c]) => (
              <li key={k}>
                <button type="button" aria-current={k === cadreChoisi ? 'true' : undefined} onClick={() => etat().choisirCadre(k)}>
                  {nomCadre(c.nom)} <span className="ligne">ligne {c.ligne}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
