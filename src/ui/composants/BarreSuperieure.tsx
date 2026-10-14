import { exporter, fermerMenu } from '../actions.ts'
import { useEtat } from '../etat.ts'

export type Fenetre = 'preferences' | 'proprietes' | 'apropos' | 'commandes' | null

/** « 14 h 32 ». */
function heure(d: Date): string {
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
}

export function BarreSuperieure({ ouvrir }: { ouvrir: (f: Fenetre) => void }) {
  const doc = useEtat((e) => e.document)
  const courantId = useEtat((e) => e.courantId)
  const sauvegarde = useEtat((e) => e.sauvegarde)
  const execution = useEtat((e) => e.execution)
  const modeEdition = useEtat((e) => e.modeEdition)
  const etat = useEtat.getState

  const valider = (champ: HTMLInputElement) => {
    const nom = champ.value.trim()
    if (courantId && nom !== '' && nom !== doc?.nom) etat().renommer(courantId, nom)
    else champ.value = doc?.nom ?? ''
  }

  const statut =
    sauvegarde.etat === 'erreur'
      ? 'Échec de l’enregistrement'
      : sauvegarde.etat === 'modifie'
        ? 'Modifications en cours…'
        : sauvegarde.date
          ? `Enregistré à ${heure(sauvegarde.date)}`
          : 'Enregistré'

  return (
    <header className="barre">
      <p className="logo" aria-label="AlgoWeb">
        Algo<span>Web</span>
      </p>
      <label className="nom-algo">
        <span className="visuellement-cache">Nom de l’algorithme</span>
        {/* Champ non contrôlé, recréé quand le nom change ailleurs (bibliothèque, propriétés). */}
        <input
          key={`${courantId}:${doc?.nom}`}
          defaultValue={doc?.nom ?? ''}
          onBlur={(e) => valider(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') e.currentTarget.value = doc?.nom ?? ''
          }}
        />
      </label>
      <p className={`statut-sauvegarde ${sauvegarde.etat}`} role="status">
        {statut}
      </p>
      <div className="choix-mode" role="radiogroup" aria-label="Mode d’édition">
        {(['texte', 'blocs'] as const).map((mode) => (
          <button key={mode} type="button" role="radio" aria-checked={modeEdition === mode} onClick={() => etat().changerMode(mode)}>
            {mode === 'texte' ? 'Texte' : 'Blocs'}
          </button>
        ))}
      </div>
      <div className="actions-execution" role="group" aria-label="Exécution">
        {execution === 'pause' ? (
          <button type="button" className="principal" onClick={() => etat().continuer()}>
            ▶ Continuer
          </button>
        ) : (
          <button type="button" className="principal" onClick={() => etat().executer()} aria-keyshortcuts="Control+Enter" title="Exécuter (Ctrl+Entrée)">
            ▶ Exécuter
          </button>
        )}
        <button type="button" onClick={() => etat().executerPasAPas()} title="Exécuter ligne par ligne, en s’arrêtant sur la première">
          Pas à pas
        </button>
        <button type="button" onClick={() => etat().arreter()} disabled={execution === 'arrete'} aria-keyshortcuts="Escape" title="Arrêter (Échap)">
          ■ Arrêter
        </button>
      </div>
      <div className="actions-fichier">
        <details className="menu">
          <summary>Exporter</summary>
          <div role="group" aria-label="Exporter l’algorithme" onClick={fermerMenu}>
            <button type="button" onClick={() => exporter('json')}>
              Algorithme AlgoWeb (.json)
            </button>
            <button type="button" onClick={() => exporter('py')}>
              Programme Python (.py)
            </button>
            <button type="button" onClick={() => exporter('txt')}>
              Texte (.txt)
            </button>
          </div>
        </details>
        <button type="button" onClick={() => ouvrir('proprietes')}>
          Propriétés
        </button>
        <button type="button" onClick={() => ouvrir('preferences')}>
          Préférences
        </button>
        <button type="button" onClick={() => ouvrir('apropos')}>
          À propos
        </button>
        <button type="button" className="raccourci-commandes" onClick={() => ouvrir('commandes')} title="Toutes les commandes (Ctrl+K)" aria-keyshortcuts="Control+K">
          Commandes
        </button>
      </div>
    </header>
  )
}
