import { create } from 'zustand'
import { MoteurExecution } from '../execution/client.ts'
import type { CadreAffiche, ModePas } from '../execution/machine.ts'
import type { MessageDuMoteur } from '../execution/session.ts'
import type { Diagnostic } from '../langage/messages.ts'
import { convertirNotation } from '../langage/notation.ts'
import { Bibliotheque, ErreurQuota, type Metadonnees, type Stockage } from '../stockage/bibliotheque.ts'
import { nomDuCode, nouveauDocument, renommerCode, type DocumentAlgo } from '../stockage/document.ts'
import { appliquerPreferences, ecrirePreferences, lirePreferences, PREFERENCES_PAR_DEFAUT, type Preferences } from './preferences.ts'

/**
 * État de l'application : bibliothèque, algorithme ouvert, exécution et
 * console. Le texte de l'éditeur est dans la notation choisie ; le code
 * enregistré utilise toujours les noms Python.
 */

export type BlocConsole =
  | { genre: 'sortie' | 'saisie' | 'info'; texte: string }
  | { genre: 'erreur'; texte: string; suggestion?: string; ligne?: number }

export type EtatExecution = 'arrete' | 'en-cours' | 'saisie' | 'pause'

export interface Pause {
  ligne: number
  raison: 'pas' | 'point-arret' | 'pause' | 'demande'
  pile: CadreAffiche[]
  /** Variables modifiées depuis la pause précédente : « indice du cadre:nom ». */
  modifiees: string[]
}

/** Délai entre deux pas de l'exécution animée, en millisecondes. */
export const VITESSES = { lente: 1000, normale: 400, rapide: 100 } as const
export type Vitesse = keyof typeof VITESSES

/**
 * Variables dont la valeur a changé depuis la pause précédente. Un cadre est
 * comparé au cadre de même rang s'il s'agit du même sous-programme.
 */
export function variablesModifiees(pile: CadreAffiche[], precedente: CadreAffiche[] | undefined): string[] {
  if (!precedente) return []
  const modifiees: string[] = []
  pile.forEach((cadre, k) => {
    const avant = precedente[k]
    if (!avant || avant.nom !== cadre.nom) return
    for (const v of cadre.variables) {
      const ancienne = avant.variables.find((x) => x.nom === v.nom)
      if (ancienne?.valeur !== v.valeur) modifiees.push(`${k}:${v.nom}`)
    }
  })
  return modifiees
}

export const LIGNES_CONSOLE_MAX = 10_000
const DELAI_SAUVEGARDE = 1000
export const DELAI_ALERTE_EXECUTION = 10_000

interface Etat {
  stockage: Stockage | null
  bibliotheque: Bibliotheque | null
  /** Algorithmes, corbeille comprise. */
  index: Metadonnees[]
  courantId: string | null
  document: DocumentAlgo | null
  /** Texte affiché dans l'éditeur. */
  texte: string
  /** Incrémenté quand le texte est remplacé depuis l'extérieur de l'éditeur. */
  versionTexte: number
  sauvegarde: { etat: 'enregistre' | 'modifie' | 'erreur'; date?: Date; message?: string }
  preferences: Preferences
  diagnostics: Diagnostic[]
  execution: EtatExecution
  debutExecution: number
  console: BlocConsole[]
  saisie: { variable: string; typeAttendu: string; message?: string } | null
  /** Demande de déplacement du curseur dans l'éditeur. */
  aller: { ligne: number; colonne: number; n: number } | null
  /** Message d'état bref (import, téléchargement…), annoncé aux lecteurs d'écran. */
  annonce: string
  /** Fichiers déposés ou choisis, en attente d'import. */
  aImporter: File[]
  /** Points d'arrêt de chaque algorithme (lignes), pour la session. */
  pointsArret: Record<string, number[]>
  pause: Pause | null
  /** Cadre de la pile affiché dans le panneau Variables. */
  cadreChoisi: number
  /** Exécution animée : un pas toutes les `vitesse` millisecondes. */
  animation: boolean
  vitesse: Vitesse

  initialiser: (stockage: Stockage) => void
  recharger: () => void
  ouvrir: (id: string) => void
  nouveau: () => void
  creerDocument: (doc: DocumentAlgo) => Metadonnees | undefined
  remplacerDocument: (id: string, doc: DocumentAlgo) => void
  renommer: (id: string, nom: string) => void
  modifierProprietes: (p: { nom: string; description: string; graine: string | null }) => void
  dupliquer: (id: string) => void
  mettreALaCorbeille: (id: string) => void
  restaurer: (id: string) => void
  supprimer: (id: string) => void
  viderCorbeille: () => void
  modifierTexte: (texte: string) => void
  enregistrer: () => void
  definirPreferences: (p: Partial<Preferences>) => void
  definirDiagnostics: (d: Diagnostic[]) => void
  allerA: (ligne: number, colonne?: number) => void
  annoncer: (texte: string) => void
  demanderImport: (fichiers: File[]) => void
  executer: () => void
  executerPasAPas: () => void
  arreter: () => void
  continuer: () => void
  pas: (mode: ModePas) => void
  suspendre: () => void
  animer: (actif: boolean) => void
  definirVitesse: (v: Vitesse) => void
  definirPointsArret: (lignes: number[]) => void
  basculerPointArret: (ligne: number) => void
  choisirCadre: (k: number) => void
  saisir: (texte: string) => void
  effacerConsole: () => void
}

let minuterieSauvegarde: ReturnType<typeof setTimeout> | undefined
let moteur: MoteurExecution | undefined
let minuterieAnimation: ReturnType<typeof setTimeout> | undefined
/** L'exécution en cours s'est arrêtée au moins une fois : sa durée totale n'a pas de sens. */
let interrompue = false
/** Dernière demande de saisie, rétablie si la valeur envoyée est refusée. */
let saisieEnvoyee: { variable: string; typeAttendu: string } | null = null

/** Ajoute un bloc à la console, en fusionnant les sorties et en gardant les 10 000 dernières lignes. */
export function ajouterConsole(console_: BlocConsole[], bloc: BlocConsole): BlocConsole[] {
  const blocs = [...console_]
  const dernier = blocs.at(-1)
  if (dernier && dernier.genre === bloc.genre && bloc.genre === 'sortie') blocs[blocs.length - 1] = { genre: 'sortie', texte: dernier.texte + bloc.texte }
  else blocs.push(bloc)
  let lignes = blocs.reduce((n, b) => n + b.texte.split('\n').length - 1, 0)
  while (lignes > LIGNES_CONSOLE_MAX && blocs.length > 0) {
    const premier = blocs[0]
    const nombre = premier.texte.split('\n').length - 1
    const enTrop = lignes - LIGNES_CONSOLE_MAX
    if (nombre <= enTrop) {
      blocs.shift()
      lignes -= nombre
    } else {
      const morceaux = premier.texte.split('\n')
      blocs[0] = { ...premier, texte: morceaux.slice(enTrop).join('\n') }
      lignes -= enTrop
    }
  }
  return blocs
}

export const useEtat = create<Etat>()((set, get) => {
  /** Charge un document dans l'éditeur. */
  const charger = (id: string, doc: DocumentAlgo) => {
    const { preferences, versionTexte } = get()
    set({
      courantId: id,
      document: doc,
      texte: convertirNotation(doc.code, preferences.notation),
      versionTexte: versionTexte + 1,
      sauvegarde: { etat: 'enregistre', date: new Date(doc.modifieLe) },
      diagnostics: [],
    })
  }

  const rafraichirIndex = () => {
    const b = get().bibliotheque
    if (b) set({ index: [...b.actifs(), ...b.corbeille()] })
  }

  /** Exécute `action` sur la bibliothèque en signalant un stockage plein. */
  const avecBibliotheque = <T>(action: (b: Bibliotheque) => T): T | undefined => {
    const b = get().bibliotheque
    if (!b) return undefined
    try {
      const r = action(b)
      rafraichirIndex()
      return r
    } catch (e) {
      if (e instanceof ErreurQuota) {
        set({ sauvegarde: { etat: 'erreur', message: e.message } })
        return undefined
      }
      throw e
    }
  }

  const recevoir = (m: MessageDuMoteur) => {
    const ajouter = (bloc: BlocConsole) => set({ console: ajouterConsole(get().console, bloc) })
    switch (m.type) {
      case 'diagnostics':
        set({ execution: 'arrete', diagnostics: m.diagnostics })
        ajouter({ genre: 'erreur', texte: 'Le programme contient des erreurs : corrigez-les avant de l’exécuter.' })
        return
      case 'demarre':
        return
      case 'sortie':
        ajouter({ genre: 'sortie', texte: m.texte })
        return
      case 'demandeSaisie':
        set({ execution: 'saisie', saisie: { variable: m.variable, typeAttendu: m.typeAttendu } })
        return
      case 'saisieInvalide':
        if (saisieEnvoyee) set({ execution: 'saisie', saisie: { ...saisieEnvoyee, message: m.message } })
        return
      case 'enPause': {
        interrompue = true
        const pause: Pause = {
          ligne: m.ligne,
          raison: m.raison,
          pile: m.pile,
          modifiees: variablesModifiees(m.pile, get().pause?.pile),
        }
        set({ execution: 'pause', pause, cadreChoisi: m.pile.length - 1 })
        if (m.raison === 'pause') ajouter({ genre: 'info', texte: `Pause à la ligne ${m.ligne} : choisissez Continuer pour reprendre.` })
        if (get().animation) {
          // Un point d'arrêt ou une instruction Pause interrompt l'animation.
          if (m.raison === 'pas') minuterieAnimation = setTimeout(() => get().animation && get().pas('entrer'), VITESSES[get().vitesse])
          else set({ animation: false })
        }
        return
      }
      case 'erreur':
        set({ execution: 'arrete', saisie: null, pause: null, animation: false })
        ajouter({ genre: 'erreur', texte: `Erreur à la ligne ${m.ligne} : ${m.message}`, suggestion: m.suggestion, ligne: m.ligne })
        return
      case 'termine': {
        set({ execution: 'arrete', saisie: null, pause: null, animation: false })
        const secondes = m.duree / 1000
        const duree = secondes < 1 ? `${Math.round(m.duree)} ms` : `${secondes.toFixed(1).replace('.', ',')} s`
        ajouter({ genre: 'info', texte: interrompue ? 'Exécution terminée.' : `Exécution terminée en ${duree}.` })
        return
      }
    }
  }

  /** Lance l'exécution, en continu ou pas à pas (arrêt sur la première ligne). */
  const lancer = (mode: 'continu' | 'pas') => {
    const { texte, preferences, document: doc, execution, courantId, pointsArret } = get()
    if (execution !== 'arrete') get().arreter()
    clearTimeout(minuterieAnimation)
    interrompue = false
    moteur ??= new MoteurExecution(recevoir)
    set({ console: [], saisie: null, pause: null, execution: 'en-cours', debutExecution: Date.now() })
    moteur.lancer({
      source: texte,
      mode,
      pointsArret: courantId ? (pointsArret[courantId] ?? []) : [],
      graine: doc?.graine ?? null,
      notation: preferences.notation,
    })
  }

  return {
    stockage: null,
    bibliotheque: null,
    index: [],
    courantId: null,
    document: null,
    texte: '',
    versionTexte: 0,
    sauvegarde: { etat: 'enregistre' },
    preferences: PREFERENCES_PAR_DEFAUT,
    diagnostics: [],
    execution: 'arrete',
    debutExecution: 0,
    console: [],
    saisie: null,
    aller: null,
    annonce: '',
    aImporter: [],
    pointsArret: {},
    pause: null,
    cadreChoisi: 0,
    animation: false,
    vitesse: 'normale',

    initialiser: (stockage) => {
      const bibliotheque = new Bibliotheque(stockage)
      const preferences = lirePreferences(stockage)
      appliquerPreferences(preferences)
      set({ stockage, bibliotheque, preferences })
      rafraichirIndex()
      const recent = [...bibliotheque.actifs()].sort((a, b) => b.modifieLe.localeCompare(a.modifieLe))[0]
      if (recent) {
        const doc = bibliotheque.lire(recent.id)
        if (doc) charger(recent.id, doc)
      } else {
        get().nouveau()
      }
    },

    recharger: () => {
      get().bibliotheque?.recharger()
      rafraichirIndex()
    },

    ouvrir: (id) => {
      if (id === get().courantId) return
      get().enregistrer()
      const doc = get().bibliotheque?.lire(id)
      if (doc) charger(id, doc)
    },

    nouveau: () => {
      get().enregistrer()
      const pris = new Set(get().index.filter((m) => !m.supprimeLe).map((m) => m.nom.toLowerCase()))
      let nom = 'Nouvel algorithme'
      for (let k = 2; pris.has(nom.toLowerCase()); k++) nom = `Nouvel algorithme ${k}`
      const doc = nouveauDocument(nom)
      const m = avecBibliotheque((b) => b.creer(doc))
      if (m) charger(m.id, doc)
    },

    creerDocument: (doc) => avecBibliotheque((b) => b.creer(doc)),

    remplacerDocument: (id, doc) => {
      avecBibliotheque((b) => b.enregistrer(id, doc))
      if (id === get().courantId) charger(id, doc)
    },

    renommer: (id, nom) => {
      nom = nom.trim()
      if (nom === '') return
      if (id === get().courantId) {
        const { texte, versionTexte, sauvegarde } = get()
        set({ texte: renommerCode(texte, nom), versionTexte: versionTexte + 1, sauvegarde: { ...sauvegarde, etat: 'modifie' } })
        get().enregistrer()
      } else {
        avecBibliotheque((b) => b.renommer(id, nom))
      }
    },

    modifierProprietes: ({ nom, description, graine }) => {
      const { document: doc, courantId } = get()
      if (!doc || !courantId) return
      set({ document: { ...doc, description, graine }, sauvegarde: { ...get().sauvegarde, etat: 'modifie' } })
      if (nom.trim() !== doc.nom) get().renommer(courantId, nom)
      get().enregistrer()
    },

    dupliquer: (id) => {
      get().enregistrer()
      const m = avecBibliotheque((b) => b.dupliquer(id))
      if (m) get().ouvrir(m.id)
    },

    mettreALaCorbeille: (id) => {
      avecBibliotheque((b) => b.mettreALaCorbeille(id))
      if (id === get().courantId) {
        const suivant = get().index.find((m) => !m.supprimeLe)
        set({ courantId: null })
        if (suivant) get().ouvrir(suivant.id)
        else get().nouveau()
      }
    },

    restaurer: (id) => avecBibliotheque((b) => b.restaurer(id)),
    supprimer: (id) => avecBibliotheque((b) => b.supprimer(id)),
    viderCorbeille: () => avecBibliotheque((b) => b.viderCorbeille()),

    modifierTexte: (texte) => {
      set({ texte, sauvegarde: { ...get().sauvegarde, etat: 'modifie' } })
      clearTimeout(minuterieSauvegarde)
      minuterieSauvegarde = setTimeout(() => get().enregistrer(), DELAI_SAUVEGARDE)
    },

    enregistrer: () => {
      clearTimeout(minuterieSauvegarde)
      const { document: doc, courantId, texte, sauvegarde } = get()
      if (!doc || !courantId || sauvegarde.etat === 'enregistre') return
      const code = convertirNotation(texte, 'python')
      const date = new Date()
      const nouveau: DocumentAlgo = { ...doc, code, nom: nomDuCode(code) ?? doc.nom, modifieLe: date.toISOString() }
      const ok = avecBibliotheque((b) => b.enregistrer(courantId, nouveau))
      if (ok) set({ document: nouveau, sauvegarde: { etat: 'enregistre', date } })
    },

    definirPreferences: (p) => {
      const ancienne = get().preferences
      const preferences = { ...ancienne, ...p }
      appliquerPreferences(preferences)
      const stockage = get().stockage
      if (stockage) ecrirePreferences(stockage, preferences)
      set({ preferences })
      if (preferences.notation !== ancienne.notation) {
        const { texte, versionTexte } = get()
        set({ texte: convertirNotation(texte, preferences.notation), versionTexte: versionTexte + 1 })
      }
    },

    definirDiagnostics: (diagnostics) => set({ diagnostics }),

    allerA: (ligne, colonne = 1) => set({ aller: { ligne, colonne, n: (get().aller?.n ?? 0) + 1 } }),

    annoncer: (annonce) => set({ annonce }),

    demanderImport: (fichiers) => set({ aImporter: fichiers }),

    executer: () => lancer('continu'),

    executerPasAPas: () => lancer('pas'),

    arreter: () => {
      clearTimeout(minuterieAnimation)
      if (get().execution === 'arrete') return
      moteur?.arreter()
      set({ execution: 'arrete', saisie: null, pause: null, animation: false, console: ajouterConsole(get().console, { genre: 'info', texte: 'Exécution arrêtée.' }) })
    },

    continuer: () => {
      if (get().execution !== 'pause') return
      clearTimeout(minuterieAnimation)
      set({ execution: 'en-cours', animation: false })
      moteur?.continuer()
    },

    pas: (mode) => {
      if (get().execution !== 'pause') return
      set({ execution: 'en-cours' })
      moteur?.pas(mode)
    },

    suspendre: () => {
      if (get().execution === 'en-cours') moteur?.pause()
    },

    animer: (actif) => {
      clearTimeout(minuterieAnimation)
      set({ animation: actif })
      if (actif && get().execution === 'pause') get().pas('entrer')
      else if (actif && get().execution === 'arrete') lancer('pas')
    },

    definirVitesse: (vitesse) => set({ vitesse }),

    definirPointsArret: (lignes) => {
      const id = get().courantId
      if (!id) return
      const actuels = get().pointsArret[id] ?? []
      if (actuels.length === lignes.length && actuels.every((l, k) => l === lignes[k])) return
      set({ pointsArret: { ...get().pointsArret, [id]: lignes } })
      if (get().execution !== 'arrete') moteur?.pointsArret(lignes)
    },

    basculerPointArret: (ligne) => {
      const id = get().courantId
      if (!id) return
      const actuels = get().pointsArret[id] ?? []
      get().definirPointsArret(actuels.includes(ligne) ? actuels.filter((l) => l !== ligne) : [...actuels, ligne].sort((a, b) => a - b))
    },

    choisirCadre: (cadreChoisi) => set({ cadreChoisi }),

    saisir: (texte) => {
      const saisie = get().saisie
      if (!saisie) return
      saisieEnvoyee = { variable: saisie.variable, typeAttendu: saisie.typeAttendu }
      set({ console: ajouterConsole(get().console, { genre: 'saisie', texte: texte + '\n' }), saisie: null, execution: 'en-cours' })
      moteur?.saisir(texte)
    },

    effacerConsole: () => set({ console: [] }),
  }
})
