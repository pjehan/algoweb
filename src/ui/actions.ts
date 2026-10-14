import { exporterTexteEnPython } from '../export/index.ts'
import { analyser } from '../langage/analyse.ts'
import { formater } from '../langage/formateur.ts'
import { creerArchive, nomArchive } from '../stockage/archive.ts'
import { ecrireDocument, nomDeFichier, type DocumentAlgo } from '../stockage/document.ts'
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

/** Exporte l'algorithme ouvert ; refuse l'export Python d'un algorithme qui contient des erreurs. */
export function exporter(format: 'json' | 'py' | 'txt'): void {
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


/**
 * Met le texte en forme (indentation, mots-clés, espaces), s'il ne contient
 * pas d'erreur de syntaxe. Renvoie false sinon.
 */
export function mettreEnForme(): boolean {
  const etat = useEtat.getState()
  const { programme, diagnostics } = analyser(etat.texte)
  if (diagnostics.length > 0) {
    etat.annoncer('Le texte contient des erreurs de syntaxe : corrigez-les avant de le mettre en forme.')
    etat.allerA(diagnostics[0].etendue.ligne, diagnostics[0].etendue.colonne)
    return false
  }
  const texte = formater(programme, { notation: etat.preferences.notation })
  if (texte !== etat.texte) {
    useEtat.setState({ texte, versionTexte: etat.versionTexte + 1 })
    etat.modifierTexte(texte)
  }
  etat.annoncer('Texte mis en forme.')
  return true
}
