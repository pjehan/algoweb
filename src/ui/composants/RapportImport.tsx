import { Fragment } from 'react'
import { useEtat } from '../etat.ts'
import { Dialogue } from './Dialogue.tsx'

/**
 * Rapport d'import d'un fichier AlgoBox (PLAN.md, section 5.3) : lignes
 * converties, types déduits et points à vérifier. Un numéro de ligne ferme le
 * rapport et place le curseur sur la ligne.
 */
export function RapportImport() {
  const id = useEtat((e) => e.rapportAffiche)
  const rapport = useEtat((e) => (e.rapportAffiche ? e.rapportsImport[e.rapportAffiche] : undefined))
  const nom = useEtat((e) => e.index.find((m) => m.id === e.rapportAffiche)?.nom)
  const fermer = () => useEtat.getState().afficherRapport(null)

  const aller = (ligne: number) => {
    const etat = useEtat.getState()
    fermer()
    if (id && etat.courantId !== id) etat.ouvrir(id)
    etat.allerA(ligne)
  }

  const portees = rapport ? [...new Set(rapport.types.map((t) => t.portee))] : []
  return (
    <Dialogue ouvert={rapport !== undefined} titre={`Rapport d’import${nom ? ` : ${nom}` : ''}`} fermer={fermer}>
      {rapport && (
        <div className="rapport-import">
          <p>
            {rapport.lignes} ligne{rapport.lignes > 1 ? 's' : ''} AlgoBox converti{rapport.lignes > 1 ? 'es' : 'e'}.{' '}
            {rapport.points.length > 0
              ? 'Relisez les points ci-dessous avant d’exécuter l’algorithme.'
              : 'Aucun point particulier à vérifier.'}
          </p>
          {rapport.points.length > 0 && (
            <>
              <h3>Points à vérifier</h3>
              <ul className="rapport-points">
                {rapport.points.map((p) => (
                  <li key={p.message}>
                    {p.lignes.length > 0 && (
                      <span className="rapport-lignes">
                        {p.lignes.length > 1 ? 'Lignes ' : 'Ligne '}
                        {p.lignes.map((l, k) => (
                          <Fragment key={l}>
                            {k > 0 && ', '}
                            <button type="button" className="lien" onClick={() => aller(l)} aria-label={`Aller à la ligne ${l}`}>
                              {l}
                            </button>
                          </Fragment>
                        ))}
                        {' : '}
                      </span>
                    )}
                    {p.message}
                  </li>
                ))}
              </ul>
            </>
          )}
          {rapport.types.length > 0 && (
            <>
              <h3>Types déduits</h3>
              <table className="rapport-types">
                <thead>
                  <tr>
                    <th scope="col">Variable</th>
                    <th scope="col">Type</th>
                    <th scope="col">Raison</th>
                  </tr>
                </thead>
                {portees.map((portee) => (
                  <tbody key={portee ?? ''}>
                    {portees.length > 1 && (
                      <tr>
                        <th scope="rowgroup" colSpan={3}>
                          {portee === null ? 'Algorithme principal' : portee}
                        </th>
                      </tr>
                    )}
                    {rapport.types
                      .filter((t) => t.portee === portee)
                      .map((t) => (
                        <tr key={t.nom}>
                          <td>{t.retour ? <em>{t.nom}</em> : <code>{t.nom}</code>}</td>
                          <td>{t.type}</td>
                          <td>{t.raison}</td>
                        </tr>
                      ))}
                  </tbody>
                ))}
              </table>
            </>
          )}
          {rapport.ignores.length > 0 && (
            <>
              <h3>Non repris</h3>
              <ul>
                {rapport.ignores.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          )}
          <p className="rapport-note">
            Les numéros de ligne correspondent au texte tel qu’il a été importé. Ce rapport reste disponible pendant la
            session dans la palette de commandes (Ctrl+K).
          </p>
        </div>
      )}
    </Dialogue>
  )
}
