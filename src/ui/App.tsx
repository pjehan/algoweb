import { useEffect, useState } from 'react'
import { BarreSuperieure, type Fenetre } from './composants/BarreSuperieure.tsx'
import { installerFermetureMenus, toutTelecharger } from './actions.ts'
import { Bibliotheque } from './composants/Bibliotheque.tsx'
import { Console } from './composants/Console.tsx'
import { BarreDebogage, Inspection } from './composants/Debogueur.tsx'
import { Diagnostics } from './composants/Diagnostics.tsx'
import { Fenetres } from './composants/Fenetres.tsx'
import { Importation } from './composants/Importation.tsx'
import { RapportImport } from './composants/RapportImport.tsx'
import { Palette } from './composants/Palette.tsx'
import { PaletteCommandes } from './composants/PaletteCommandes.tsx'
import { EditeurBlocs } from './blocs/EditeurBlocs.tsx'
import { Editeur } from './editeur/Editeur.tsx'
import { useEtat } from './etat.ts'

type Onglet = 'algorithmes' | 'editeur' | 'console'

const ONGLETS: [Onglet, string][] = [
  ['algorithmes', 'Algorithmes'],
  ['editeur', 'Éditeur'],
  ['console', 'Console'],
]

/**
 * Signale qu'un même algorithme est ouvert dans deux onglets (PLAN.md,
 * section 7.2). Un seul canal par page ; chaque onglet annonce l'algorithme
 * qu'il ouvre, et celui qui a le même algorithme ouvert répond.
 */
const identifiantOnglet = Math.random().toString(36).slice(2)
type MessageOnglet = { type: 'ouvert' | 'aussi' | 'ferme'; id: string; onglet: string }
const canalOnglets = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('algoweb')

function useOngletsMultiples(): boolean {
  const courantId = useEtat((e) => e.courantId)
  /** Algorithme signalé comme ouvert ailleurs. */
  const [double, setDouble] = useState<string | null>(null)
  useEffect(() => {
    if (!canalOnglets || !courantId) return
    const recevoir = (e: MessageEvent<MessageOnglet>) => {
      const m = e.data
      if (m.onglet === identifiantOnglet || m.id !== courantId) return
      if (m.type === 'ferme') {
        setDouble(null)
        return
      }
      if (m.type === 'ouvert') canalOnglets.postMessage({ type: 'aussi', id: courantId, onglet: identifiantOnglet } satisfies MessageOnglet)
      setDouble(courantId)
    }
    // L'onglet qui se ferme, ou qui ouvre un autre algorithme, le signale aux autres.
    const fermer = () => canalOnglets.postMessage({ type: 'ferme', id: courantId, onglet: identifiantOnglet } satisfies MessageOnglet)
    canalOnglets.addEventListener('message', recevoir)
    window.addEventListener('pagehide', fermer)
    canalOnglets.postMessage({ type: 'ouvert', id: courantId, onglet: identifiantOnglet } satisfies MessageOnglet)
    return () => {
      fermer()
      canalOnglets.removeEventListener('message', recevoir)
      window.removeEventListener('pagehide', fermer)
    }
  }, [courantId])
  return double !== null && double === courantId
}

export function App({ stockagePersistant }: { stockagePersistant: boolean }) {
  const [fenetre, setFenetre] = useState<Fenetre>(null)
  const [onglet, setOnglet] = useState<Onglet>('editeur')
  const [rappelMasque, setRappelMasque] = useState(false)
  const sauvegarde = useEtat((e) => e.sauvegarde)
  const annonce = useEtat((e) => e.annonce)
  const modeEdition = useEtat((e) => e.modeEdition)
  const index = useEtat((e) => e.index)
  const bibliotheque = useEtat((e) => e.bibliotheque)
  const double = useOngletsMultiples()
  const etat = useEtat.getState

  // Raccourcis généraux.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        etat().enregistrer()
        etat().annoncer('Algorithme enregistré.')
      } else if (mod && e.key === 'Enter') {
        e.preventDefault()
        etat().executer()
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setFenetre('commandes')
      } else if (e.key === 'F7' || e.key === 'F8' || e.key === 'F9') {
        // Débogueur : F7 pas suivant, F8 pas principal (Maj+F8 sortir), F9 continuer.
        if (mod || etat().execution !== 'pause') return
        e.preventDefault()
        if (e.key === 'F9') etat().continuer()
        else etat().pas(e.key === 'F7' ? 'entrer' : e.shiftKey ? 'sortir' : 'passer')
      } else if (e.key === 'Escape' && etat().execution !== 'arrete' && !document.querySelector('dialog[open]')) {
        etat().arreter()
      }
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [etat])

  useEffect(() => installerFermetureMenus(), [])

  // Synchronisation entre onglets, et enregistrement avant de quitter la page.
  useEffect(() => {
    const stockage = (e: StorageEvent) => {
      if (e.key?.startsWith('algoweb:')) etat().recharger()
    }
    const quitter = () => etat().enregistrer()
    window.addEventListener('storage', stockage)
    window.addEventListener('pagehide', quitter)
    return () => {
      window.removeEventListener('storage', stockage)
      window.removeEventListener('pagehide', quitter)
    }
  }, [etat])

  // Sur petit écran, la console s'affiche quand une exécution démarre.
  useEffect(
    () =>
      useEtat.subscribe((e, precedent) => {
        if (e.execution !== 'arrete' && precedent.execution === 'arrete') setOnglet('console')
      }),
    [],
  )

  const rappel = !rappelMasque && index.length > 0 && bibliotheque?.sauvegardeConseillee()

  return (
    <div className="application" data-onglet={onglet}>
      <a className="lien-evitement" href="#editeur">
        Aller à l’éditeur
      </a>
      <BarreSuperieure ouvrir={setFenetre} />
      <BarreDebogage />

      <div className="bandeaux">
        {!stockagePersistant && (
          <p className="bandeau alerte" role="alert">
            Le navigateur empêche AlgoWeb d’enregistrer vos algorithmes (navigation privée ?) : ils seront perdus à la fermeture de la page.
            Téléchargez-les avant de partir.
          </p>
        )}
        {sauvegarde.etat === 'erreur' && (
          <p className="bandeau alerte" role="alert">
            {sauvegarde.message ?? 'L’algorithme n’a pas pu être enregistré.'}{' '}
            <button type="button" onClick={toutTelecharger}>
              Tout télécharger
            </button>
          </p>
        )}
        {double && (
          <p className="bandeau attention" role="status">
            Cet algorithme est aussi ouvert dans un autre onglet : les modifications de l’un peuvent écraser celles de l’autre.
          </p>
        )}
        {rappel && (
          <p className="bandeau info" role="status">
            Vous n’avez pas téléchargé de sauvegarde depuis plus de 7 jours. Le stockage du navigateur n’est pas une sauvegarde.{' '}
            <button type="button" onClick={toutTelecharger}>
              Tout télécharger
            </button>{' '}
            <button type="button" className="lien" onClick={() => setRappelMasque(true)}>
              Plus tard
            </button>
          </p>
        )}
      </div>

      <div className="onglets" role="tablist" aria-label="Panneaux">
        {ONGLETS.map(([id, libelle]) => (
          <button key={id} type="button" role="tab" id={`onglet-${id}`} aria-selected={onglet === id} aria-controls={`panneau-${id}`} onClick={() => setOnglet(id)}>
            {libelle}
          </button>
        ))}
      </div>

      <div className="espace">
        <nav id="panneau-algorithmes" className="colonne gauche" aria-label="Algorithmes et palette" data-panneau="algorithmes">
          <Bibliotheque />
          <Palette />
        </nav>
        <main id="panneau-editeur" className="colonne centre" data-panneau="editeur">
          <h1 className="visuellement-cache">Éditeur</h1>
          <div id="editeur" className="zone-editeur">
            {modeEdition === 'blocs' ? <EditeurBlocs /> : <Editeur />}
          </div>
          <Diagnostics />
        </main>
        <aside id="panneau-console" className="colonne droite" aria-label="Console" data-panneau="console">
          <Console />
          <Inspection />
        </aside>
      </div>

      <p className="visuellement-cache" role="status" aria-live="polite">
        {annonce}
      </p>
      {annonce && (
        <p className="annonce" aria-hidden="true">
          {annonce}{' '}
          <button type="button" className="lien" onClick={() => etat().annoncer('')}>
            ×
          </button>
        </p>
      )}
      <Fenetres fenetre={fenetre} fermer={() => setFenetre(null)} />
      <PaletteCommandes ouvert={fenetre === 'commandes'} fermer={() => setFenetre(null)} ouvrir={setFenetre} />
      <Importation />
      <RapportImport />
    </div>
  )
}
