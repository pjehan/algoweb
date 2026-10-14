import { openSearchPanel } from '@codemirror/search'
import { useId, useMemo, useState } from 'react'
import { normaliser } from '../../langage/normalisation.ts'
import { exporter, mettreEnForme, toutTelecharger } from '../actions.ts'
import { editeurActif } from '../editeur/actif.ts'
import { useEtat } from '../etat.ts'
import type { Fenetre } from './BarreSuperieure.tsx'
import { Dialogue } from './Dialogue.tsx'

interface Commande {
  libelle: string
  raccourci?: string
  action: () => void
  disponible?: () => boolean
}

function commandes(ouvrir: (f: Fenetre) => void): Commande[] {
  const etat = useEtat.getState
  const enPause = () => etat().execution === 'pause'
  const vue = () => editeurActif.vue
  return [
    { libelle: 'Exécuter', raccourci: 'Ctrl+Entrée', action: () => etat().executer() },
    { libelle: 'Exécuter pas à pas', action: () => etat().executerPasAPas() },
    { libelle: 'Exécution animée', action: () => etat().animer(true) },
    { libelle: 'Arrêter l’exécution', raccourci: 'Échap', action: () => etat().arreter(), disponible: () => etat().execution !== 'arrete' },
    { libelle: 'Continuer', raccourci: 'F9', action: () => etat().continuer(), disponible: enPause },
    { libelle: 'Pas suivant', raccourci: 'F7', action: () => etat().pas('entrer'), disponible: enPause },
    { libelle: 'Pas principal', raccourci: 'F8', action: () => etat().pas('passer'), disponible: enPause },
    { libelle: 'Sortir de la fonction', raccourci: 'Maj+F8', action: () => etat().pas('sortir'), disponible: enPause },
    {
      libelle: 'Placer ou retirer un point d’arrêt sur la ligne du curseur',
      raccourci: 'Ctrl+F8',
      action: () => {
        const v = vue()
        if (v) etat().basculerPointArret(v.state.doc.lineAt(v.state.selection.main.head).number)
      },
    },
    { libelle: 'Retirer tous les points d’arrêt', action: () => etat().definirPointsArret([]) },
    { libelle: 'Mettre le texte en forme', action: () => void mettreEnForme() },
    { libelle: 'Rechercher et remplacer', raccourci: 'Ctrl+F', action: () => vue() && openSearchPanel(vue()!) },
    { libelle: 'Nouvel algorithme', action: () => etat().nouveau() },
    { libelle: 'Dupliquer l’algorithme', action: () => etat().courantId && etat().dupliquer(etat().courantId!) },
    { libelle: 'Mettre l’algorithme à la corbeille', action: () => etat().courantId && etat().mettreALaCorbeille(etat().courantId!) },
    { libelle: 'Renommer l’algorithme', action: () => document.querySelector<HTMLInputElement>('.nom-algo input')?.select() },
    { libelle: 'Propriétés de l’algorithme', action: () => ouvrir('proprietes') },
    { libelle: 'Exporter en JSON', action: () => exporter('json') },
    { libelle: 'Exporter en Python', action: () => exporter('py') },
    { libelle: 'Exporter en texte', action: () => exporter('txt') },
    { libelle: 'Tout télécharger', action: toutTelecharger },
    { libelle: 'Importer des fichiers', action: () => document.querySelector<HTMLInputElement>('.bibliotheque input[type=file]')?.click() },
    { libelle: 'Enregistrer', raccourci: 'Ctrl+S', action: () => etat().enregistrer() },
    { libelle: 'Préférences', action: () => ouvrir('preferences') },
    { libelle: 'Thème clair', action: () => etat().definirPreferences({ theme: 'clair' }) },
    { libelle: 'Thème sombre', action: () => etat().definirPreferences({ theme: 'sombre' }) },
    { libelle: 'Thème du système', action: () => etat().definirPreferences({ theme: 'systeme' }) },
    { libelle: 'Noms des fonctions en Python', action: () => etat().definirPreferences({ notation: 'python' }) },
    { libelle: 'Noms des fonctions en français', action: () => etat().definirPreferences({ notation: 'francais' }) },
    { libelle: 'Effacer la console', action: () => etat().effacerConsole() },
    { libelle: 'À propos d’AlgoWeb', action: () => ouvrir('apropos') },
  ]
}

/** Palette de commandes (Ctrl+K) : toutes les actions, par leur nom. */
export function PaletteCommandes({ ouvert, fermer, ouvrir }: { ouvert: boolean; fermer: () => void; ouvrir: (f: Fenetre) => void }) {
  return ouvert ? <Contenu fermer={fermer} ouvrir={ouvrir} /> : null
}

function Contenu({ fermer, ouvrir }: { fermer: () => void; ouvrir: (f: Fenetre) => void }) {
  const [filtre, setFiltre] = useState('')
  const [actif, setActif] = useState(0)
  const id = useId()
  const liste = useMemo(() => {
    // Chaque mot tapé doit commencer un mot de la commande : « pas a pas » trouve « Exécuter pas à pas ».
    const mots = normaliser(filtre).split(/\s+/).filter(Boolean)
    return commandes(ouvrir).filter((c) => {
      if (!(c.disponible?.() ?? true)) return false
      const motsCommande = normaliser(c.libelle).split(/[\s'’]+/)
      return mots.every((m) => motsCommande.some((x) => x.startsWith(m)))
    })
  }, [filtre, ouvrir])
  const choisi = Math.min(actif, liste.length - 1)

  const lancer = (c: Commande | undefined) => {
    if (!c) return
    fermer()
    // La commande s'exécute une fois la palette fermée (le focus revient à la page).
    setTimeout(c.action, 0)
  }

  return (
    <Dialogue ouvert titre="Commandes" fermer={fermer}>
      <input
        className="filtre-commandes"
        autoFocus
        role="combobox"
        aria-expanded="true"
        aria-controls={`${id}-liste`}
        aria-activedescendant={liste.length > 0 ? `${id}-${choisi}` : undefined}
        aria-label="Rechercher une commande"
        placeholder="Rechercher une commande…"
        value={filtre}
        onChange={(e) => {
          setFiltre(e.target.value)
          setActif(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActif((choisi + 1) % Math.max(liste.length, 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActif((choisi - 1 + liste.length) % Math.max(liste.length, 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            lancer(liste[choisi])
          }
        }}
      />
      <ul id={`${id}-liste`} role="listbox" aria-label="Commandes" className="liste-commandes">
        {liste.map((c, k) => (
          <li
            key={c.libelle}
            id={`${id}-${k}`}
            role="option"
            aria-selected={k === choisi}
            onMouseMove={() => setActif(k)}
            onClick={() => lancer(c)}
          >
            <span>{c.libelle}</span>
            {c.raccourci && <kbd>{c.raccourci}</kbd>}
          </li>
        ))}
        {liste.length === 0 && <li className="vide">Aucune commande.</li>}
      </ul>
    </Dialogue>
  )
}
