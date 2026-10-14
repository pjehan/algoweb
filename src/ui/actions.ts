import { creerArchive, nomArchive } from '../stockage/archive.ts'
import type { DocumentAlgo } from '../stockage/document.ts'
import { useEtat } from './etat.ts'
import { telecharger } from './telechargement.ts'

/** Taille lisible : « 12 Ko », « 1,2 Mo ». */
export function taille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
}

/** Télécharge plusieurs algorithmes dans une archive ; `complet` note la date de la sauvegarde complète. */
export function telechargerArchive(documents: DocumentAlgo[], complet: boolean): void {
  const etat = useEtat.getState()
  etat.enregistrer()
  telecharger(nomArchive(), creerArchive(documents, true), 'application/zip')
  if (complet) etat.bibliotheque?.noterExport()
  etat.annoncer(`${documents.length} algorithme${documents.length > 1 ? 's' : ''} téléchargé${documents.length > 1 ? 's' : ''}.`)
}

/** Télécharge tous les algorithmes (hors corbeille). */
export function toutTelecharger(): void {
  const { bibliotheque } = useEtat.getState()
  if (!bibliotheque) return
  useEtat.getState().enregistrer()
  const documents = bibliotheque.actifs().map((m) => bibliotheque.lire(m.id)).filter((d): d is DocumentAlgo => d !== undefined)
  telechargerArchive(documents, true)
}

/** Referme le menu déroulant (<details>) après le choix d'une action. */
export function fermerMenu(e: { currentTarget: Element }): void {
  e.currentTarget.closest('details')?.removeAttribute('open')
}

const MENUS = 'details.menu[open], details.menu-actions[open]'

/**
 * Les menus déroulants (<details>) se referment quand on clique en dehors,
 * quand on en ouvre un autre, ou avec Échap (le focus revient alors au
 * bouton du menu). Renvoie la fonction qui retire ce comportement.
 */
export function installerFermetureMenus(): () => void {
  const fermerSauf = (garde: Element | null) => {
    for (const menu of document.querySelectorAll<HTMLDetailsElement>(MENUS)) {
      if (!garde || !menu.contains(garde)) menu.open = false
    }
  }
  const clic = (e: PointerEvent) => fermerSauf(e.target as Element)
  const touche = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    const menu = (e.target as Element | null)?.closest?.<HTMLDetailsElement>(MENUS)
    if (!menu) return
    // Échap ferme le menu, sans arrêter l'exécution en cours.
    e.stopPropagation()
    menu.open = false
    menu.querySelector('summary')?.focus()
  }
  // Ouvrir un menu referme les autres.
  const bascule = (e: Event) => {
    const menu = e.target as HTMLDetailsElement
    if (menu.open && menu.matches(MENUS)) fermerSauf(menu)
  }
  document.addEventListener('pointerdown', clic)
  document.addEventListener('keydown', touche, true)
  document.addEventListener('toggle', bascule, true)
  return () => {
    document.removeEventListener('pointerdown', clic)
    document.removeEventListener('keydown', touche, true)
    document.removeEventListener('toggle', bascule, true)
  }
}
