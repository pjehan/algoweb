import { useMemo, useRef, useState, type DragEvent } from 'react'
import { CAPACITE_ESTIMEE, type Metadonnees } from '../../stockage/bibliotheque.ts'
import { ecrireDocument, nomDeFichier, type DocumentAlgo } from '../../stockage/document.ts'
import { fermerMenu, taille, telechargerArchive, toutTelecharger } from '../actions.ts'
import { useEtat } from '../etat.ts'
import { telecharger } from '../telechargement.ts'
import { Dialogue } from './Dialogue.tsx'

function dateCourte(iso: string): string {
  const d = new Date(iso)
  const aujourdhui = new Date()
  if (d.toDateString() === aujourdhui.toDateString()) return `aujourd’hui à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: d.getFullYear() === aujourdhui.getFullYear() ? undefined : 'numeric' })
}

/** Liste des algorithmes enregistrés dans le navigateur (PLAN.md, section 7.2). */
export function Bibliotheque() {
  const index = useEtat((e) => e.index)
  const courantId = useEtat((e) => e.courantId)
  const bibliotheque = useEtat((e) => e.bibliotheque)
  const etat = useEtat.getState
  const [recherche, setRecherche] = useState('')
  const [tri, setTri] = useState<'date' | 'nom'>('date')
  const [corbeille, setCorbeille] = useState(false)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [enRenommage, setEnRenommage] = useState<string | null>(null)
  const [aSupprimer, setASupprimer] = useState<Metadonnees | 'tout' | null>(null)
  const [survol, setSurvol] = useState(false)
  const choixFichiers = useRef<HTMLInputElement>(null)

  const actifs = index.filter((m) => !m.supprimeLe)
  const supprimes = index.filter((m) => m.supprimeLe)
  const liste = useMemo(() => {
    const filtre = recherche.trim().toLowerCase()
    return (corbeille ? supprimes : actifs)
      .filter((m) => m.nom.toLowerCase().includes(filtre) || m.description.toLowerCase().includes(filtre))
      .sort((a, b) => (tri === 'nom' ? a.nom.localeCompare(b.nom, 'fr') : b.modifieLe.localeCompare(a.modifieLe)))
  }, [actifs, supprimes, corbeille, recherche, tri])
  const occupation = bibliotheque?.occupation() ?? 0

  const documents = (ids: Iterable<string>) => [...ids].map((id) => bibliotheque?.lire(id)).filter((d): d is DocumentAlgo => d !== undefined)

  const telechargerUn = (m: Metadonnees) => {
    etat().enregistrer()
    const doc = bibliotheque?.lire(m.id)
    if (doc) telecharger(nomDeFichier(doc.nom, 'json'), ecrireDocument(doc), 'application/json')
  }

  const deposer = (e: DragEvent) => {
    e.preventDefault()
    setSurvol(false)
    if (e.dataTransfer.files.length > 0) etat().demanderImport([...e.dataTransfer.files])
  }

  return (
    <section
      className={`bibliotheque${survol ? ' survol' : ''}`}
      aria-labelledby="titre-bibliotheque"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setSurvol(true)
        }
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={deposer}
    >
      <div className="entete-panneau">
        <h2 id="titre-bibliotheque">{corbeille ? 'Corbeille' : 'Mes algorithmes'}</h2>
        {!corbeille && (
          <button type="button" onClick={() => etat().nouveau()}>
            Nouveau
          </button>
        )}
      </div>

      {!corbeille && (
        <div className="outils-bibliotheque">
          <button type="button" onClick={() => choixFichiers.current?.click()}>
            Importer…
          </button>
          <input
            ref={choixFichiers}
            type="file"
            multiple
            accept=".json,.zip,.alg,application/json,application/zip"
            hidden
            onChange={(e) => {
              if (e.target.files) etat().demanderImport([...e.target.files])
              e.target.value = ''
            }}
          />
          <button type="button" onClick={toutTelecharger} disabled={actifs.length === 0}>
            Tout télécharger
          </button>
          {selection.size > 0 && (
            <button type="button" onClick={() => telechargerArchive(documents(selection), false)}>
              Télécharger la sélection ({selection.size})
            </button>
          )}
        </div>
      )}

      <div className="filtres">
        <label>
          <span className="visuellement-cache">Rechercher</span>
          <input type="search" placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>
        <label>
          <span className="visuellement-cache">Trier par</span>
          <select value={tri} onChange={(e) => setTri(e.target.value as 'date' | 'nom')}>
            <option value="date">Plus récents</option>
            <option value="nom">Nom</option>
          </select>
        </label>
      </div>

      <ul className="liste-algos">
        {liste.map((m) => (
          <li key={m.id} className={m.id === courantId ? 'courant' : undefined}>
            {!corbeille && (
              <input
                type="checkbox"
                aria-label={`Sélectionner ${m.nom}`}
                checked={selection.has(m.id)}
                onChange={(e) => {
                  const s = new Set(selection)
                  if (e.target.checked) s.add(m.id)
                  else s.delete(m.id)
                  setSelection(s)
                }}
              />
            )}
            {enRenommage === m.id ? (
              <input
                className="renommage"
                aria-label="Nouveau nom"
                defaultValue={m.nom}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    etat().renommer(m.id, e.currentTarget.value)
                    setEnRenommage(null)
                  } else if (e.key === 'Escape') {
                    setEnRenommage(null)
                  }
                }}
                onBlur={(e) => {
                  etat().renommer(m.id, e.currentTarget.value)
                  setEnRenommage(null)
                }}
              />
            ) : (
              <button
                type="button"
                className="ouvrir"
                aria-current={m.id === courantId ? 'true' : undefined}
                disabled={corbeille}
                onClick={() => etat().ouvrir(m.id)}
              >
                <span className="nom">{m.nom}</span>
                <span className="date">{corbeille ? `supprimé ${dateCourte(m.supprimeLe!)}` : dateCourte(m.modifieLe)}</span>
              </button>
            )}
            <details className="menu-actions">
              <summary aria-label={`Actions pour ${m.nom}`}>⋯</summary>
              <div role="group" aria-label={`Actions pour ${m.nom}`} onClick={fermerMenu}>
                {corbeille ? (
                  <>
                    <button type="button" onClick={() => etat().restaurer(m.id)}>
                      Restaurer
                    </button>
                    <button type="button" onClick={() => setASupprimer(m)}>
                      Supprimer définitivement
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setEnRenommage(m.id)}>
                      Renommer
                    </button>
                    <button type="button" onClick={() => etat().dupliquer(m.id)}>
                      Dupliquer
                    </button>
                    <button type="button" onClick={() => telechargerUn(m)}>
                      Télécharger (.json)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        etat().mettreALaCorbeille(m.id)
                        etat().annoncer(`« ${m.nom} » a été mis à la corbeille.`)
                      }}
                    >
                      Mettre à la corbeille
                    </button>
                  </>
                )}
              </div>
            </details>
          </li>
        ))}
        {liste.length === 0 && <li className="vide">{corbeille ? 'La corbeille est vide.' : recherche ? 'Aucun résultat.' : 'Aucun algorithme.'}</li>}
      </ul>

      <div className="pied-bibliotheque">
        <button type="button" className="lien" onClick={() => setCorbeille(!corbeille)}>
          {corbeille ? '← Retour à mes algorithmes' : `Corbeille (${supprimes.length})`}
        </button>
        {corbeille && supprimes.length > 0 && (
          <button type="button" className="lien" onClick={() => setASupprimer('tout')}>
            Vider la corbeille
          </button>
        )}
        {corbeille && <p className="aide">Les éléments sont supprimés automatiquement après 30 jours.</p>}
        <label className="jauge">
          Espace utilisé : {taille(occupation)} sur environ {taille(CAPACITE_ESTIMEE)}
          <meter min={0} max={CAPACITE_ESTIMEE} high={CAPACITE_ESTIMEE * 0.8} value={occupation} />
        </label>
        <p className="aide">Le stockage du navigateur n’est pas une sauvegarde : téléchargez régulièrement vos algorithmes.</p>
      </div>

      <Dialogue
        ouvert={aSupprimer !== null}
        titre="Supprimer définitivement ?"
        fermer={() => setASupprimer(null)}
        actions={
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (aSupprimer === 'tout') etat().viderCorbeille()
              else if (aSupprimer) etat().supprimer(aSupprimer.id)
              setASupprimer(null)
            }}
          >
            Supprimer
          </button>
        }
      >
        <p>
          {aSupprimer === 'tout'
            ? `Les ${supprimes.length} éléments de la corbeille seront supprimés. Cette action est irréversible.`
            : `« ${(aSupprimer as Metadonnees | null)?.nom ?? ''} » sera supprimé. Cette action est irréversible.`}
        </p>
      </Dialogue>
    </section>
  )
}
