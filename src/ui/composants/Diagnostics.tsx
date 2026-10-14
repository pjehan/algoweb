import { useState } from 'react'
import { useEtat } from '../etat.ts'

/** Liste des erreurs et avertissements ; un clic mène à la ligne concernée (PLAN.md, section 8). */
export function Diagnostics() {
  const diagnostics = useEtat((e) => e.diagnostics)
  const [ouvert, setOuvert] = useState(true)
  const erreurs = diagnostics.filter((d) => d.gravite === 'erreur').length
  const avertissements = diagnostics.length - erreurs
  const resume =
    diagnostics.length === 0
      ? 'Aucune erreur'
      : [erreurs > 0 && `${erreurs} erreur${erreurs > 1 ? 's' : ''}`, avertissements > 0 && `${avertissements} avertissement${avertissements > 1 ? 's' : ''}`]
          .filter(Boolean)
          .join(', ')

  return (
    <section className={`diagnostics${erreurs > 0 ? ' avec-erreurs' : ''}`} aria-labelledby="titre-diagnostics">
      <h2 id="titre-diagnostics">
        <button type="button" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>
          <span aria-hidden="true">{ouvert ? '▾' : '▸'}</span> {resume}
        </button>
      </h2>
      {ouvert && diagnostics.length > 0 && (
        <ul>
          {diagnostics.map((d, k) => (
            <li key={k} className={d.gravite}>
              <button type="button" onClick={() => useEtat.getState().allerA(d.etendue.ligne, d.etendue.colonne)}>
                <span className="gravite">{d.gravite === 'erreur' ? 'Erreur' : 'Avertissement'}</span>{' '}
                <span className="ligne">ligne {d.etendue.ligne}</span> : {d.message}
                {d.suggestion && <span className="suggestion"> {d.suggestion}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
