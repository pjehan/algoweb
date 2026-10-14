import type { Notation } from '../langage/predefinis.ts'
import { CLES, type Stockage } from '../stockage/bibliotheque.ts'

/** Préférences de l'utilisateur (PLAN.md, section 8). */
export interface Preferences {
  theme: 'systeme' | 'clair' | 'sombre'
  /** Taille du texte, en pixels. */
  tailleTexte: number
  modeEdition: 'texte' | 'blocs'
  notation: Notation
}

export const PREFERENCES_PAR_DEFAUT: Preferences = {
  theme: 'systeme',
  tailleTexte: 16,
  modeEdition: 'texte',
  notation: 'python',
}

export const TAILLES_TEXTE = [14, 16, 18, 20, 24]

export function lirePreferences(stockage: Stockage): Preferences {
  try {
    const lues = JSON.parse(stockage.getItem(CLES.preferences) ?? '{}') as Partial<Preferences>
    const p = { ...PREFERENCES_PAR_DEFAUT }
    if (lues.theme === 'clair' || lues.theme === 'sombre' || lues.theme === 'systeme') p.theme = lues.theme
    if (typeof lues.tailleTexte === 'number' && TAILLES_TEXTE.includes(lues.tailleTexte)) p.tailleTexte = lues.tailleTexte
    if (lues.modeEdition === 'texte' || lues.modeEdition === 'blocs') p.modeEdition = lues.modeEdition
    if (lues.notation === 'python' || lues.notation === 'francais') p.notation = lues.notation
    return p
  } catch {
    return { ...PREFERENCES_PAR_DEFAUT }
  }
}

export function ecrirePreferences(stockage: Stockage, p: Preferences): void {
  try {
    stockage.setItem(CLES.preferences, JSON.stringify(p))
  } catch {
    // Préférences non enregistrées (stockage plein) : elles restent valables pour la session.
  }
}

/** Applique le thème et la taille du texte à la page. */
export function appliquerPreferences(p: Preferences): void {
  const racine = document.documentElement
  if (p.theme === 'systeme') delete racine.dataset.theme
  else racine.dataset.theme = p.theme
  racine.style.setProperty('--taille-texte', `${p.tailleTexte}px`)
}
