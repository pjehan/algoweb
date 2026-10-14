import { exporterTexteEnPython } from '../../export/index.ts'
import { ecrireDocument, nomDeFichier } from '../../stockage/document.ts'
import { fermerMenu } from '../actions.ts'
import { useEtat } from '../etat.ts'
import { telecharger } from '../telechargement.ts'

export type Fenetre = 'preferences' | 'proprietes' | 'apropos' | null

/** « 14 h 32 ». */
function heure(d: Date): string {
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
}

/** Exporte l'algorithme ouvert ; refuse l'export Python d'un algorithme qui contient des erreurs. */
function exporter(format: 'json' | 'py' | 'txt'): void {
  const etat = useEtat.getState()
  etat.enregistrer()
  const doc = useEtat.getState().document
  if (!doc) return
  if (format === 'json') {
    telecharger(nomDeFichier(doc.nom, 'json'), ecrireDocument(doc), 'application/json')
  } else if (format === 'txt') {
    telecharger(nomDeFichier(doc.nom, 'txt'), etat.texte, 'text/plain;charset=utf-8')
  } else {
    const r = exporterTexteEnPython(etat.texte, { nom: doc.nom, description: doc.description, graine: doc.graine === null ? null : BigInt(doc.graine), date: new Date() })
    if ('python' in r) {
      telecharger(nomDeFichier(doc.nom, 'py'), r.python, 'text/x-python;charset=utf-8')
    } else {
      const premiere = r.diagnostics.find((d) => d.gravite === 'erreur')
      etat.annoncer('L’algorithme contient des erreurs : corrigez-les avant de l’exporter en Python.')
      if (premiere) etat.allerA(premiere.etendue.ligne, premiere.etendue.colonne)
    }
  }
}

export function BarreSuperieure({ ouvrir }: { ouvrir: (f: Fenetre) => void }) {
  const doc = useEtat((e) => e.document)
  const courantId = useEtat((e) => e.courantId)
  const sauvegarde = useEtat((e) => e.sauvegarde)
  const execution = useEtat((e) => e.execution)
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
      </div>
    </header>
  )
}
