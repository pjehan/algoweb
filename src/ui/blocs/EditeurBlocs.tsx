import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { analyser } from '../../langage/analyse.ts'
import { compiler } from '../../langage/index.ts'
import { nomAffiche, PREDEFINIS, PROCEDURES_PREDEFINIES } from '../../langage/predefinis.ts'
import { texteSimple, type Modele } from '../editeur/modeles.ts'
import { useEtat } from '../etat.ts'
import { Blocs, blocsActif, NomsDisponibles, type ContexteBlocs } from './contexte.ts'
import { versModele, versTexte, type CorpsBlocs, type ModeleBlocs } from './modele.ts'
import {
  ajouterDeclaration,
  ajouterSinonSi,
  ajouterSousProgramme,
  blocsDepuisTexte,
  commenter,
  corpsContenant,
  decaler,
  deplacer,
  dupliquer,
  inserer,
  sousProgrammeDepuisTexte,
  supprimer,
  trouver,
} from './operations.ts'
import { MODELES_HORS_INSTRUCTIONS, VueCorps, VueSousProgramme } from './VueBloc.tsx'
import { Champ } from './Champ.tsx'

const HISTORIQUE_MAX = 200
const MOTS_EXPRESSION = ['et', 'ou', 'non', 'mod', 'div', 'dans', 'vrai', 'faux']

/** Modèle des blocs du texte, ou undefined s'il contient des erreurs de syntaxe. */
function construire(texte: string, notation: 'python' | 'francais'): ModeleBlocs | undefined {
  const { programme, diagnostics } = analyser(texte)
  return diagnostics.length > 0 ? undefined : versModele(programme, notation)
}

/** Noms proposés par l'autocomplétion : variables, paramètres, sous-programmes, prédéfinis, mots-clés. */
function nomsDuModele(m: ModeleBlocs, notation: 'python' | 'francais'): string[] {
  const noms = new Set<string>()
  const corps = (c: CorpsBlocs) => {
    for (const l of c.variables ?? []) if (l.genre === 'declaration') for (const n of l.noms.split(',')) if (n.trim()) noms.add(n.trim())
  }
  for (const e of [...m.avant, ...m.apres]) {
    if (e.genre !== 'sousProgramme') continue
    noms.add(e.nom)
    for (const p of e.parametres.split(',')) {
      const nom = p.split(':')[0].trim()
      if (nom) noms.add(nom)
    }
    corps(e.corps)
  }
  corps(m.principal)
  for (const p of PREDEFINIS) noms.add(nomAffiche(p.python, notation))
  for (const p of Object.keys(PROCEDURES_PREDEFINIES)) noms.add(p)
  for (const mot of MOTS_EXPRESSION) noms.add(mot)
  return [...noms].sort((a, b) => a.localeCompare(b, 'fr'))
}

/** Lignes des blocs visibles, dans l'ordre du document. */
function lignesVisibles(racine: HTMLElement): HTMLElement[] {
  return [...racine.querySelectorAll<HTMLElement>('[data-bloc]')]
}

export function EditeurBlocs() {
  const courantId = useEtat((e) => e.courantId)
  const versionTexte = useEtat((e) => e.versionTexte)
  const notation = useEtat((e) => e.preferences.notation)
  const texte = useEtat((e) => e.texte)
  const pause = useEtat((e) => e.pause)
  const aller = useEtat((e) => e.aller)
  const diagnostics = useEtat((e) => e.diagnostics)
  const pointsArret = useEtat((e) => (e.courantId ? e.pointsArret[e.courantId] : undefined))
  const [modele, setModele] = useState<ModeleBlocs | undefined>(() => construire(useEtat.getState().texte, notation))
  // Texte remplacé hors des blocs (ouverture d'un algorithme, renommage, notation) : on reconstruit le modèle.
  const cle = `${courantId}|${versionTexte}|${notation}`
  const [cleModele, setCleModele] = useState(cle)
  if (cle !== cleModele) {
    setCleModele(cle)
    setModele(construire(useEtat.getState().texte, notation))
  }
  const [replies, setReplies] = useState<Set<string>>(new Set())
  const racine = useRef<HTMLDivElement>(null)
  const historique = useRef<{ passe: ModeleBlocs[]; futur: ModeleBlocs[]; dernier?: string; date: number }>({ passe: [], futur: [], date: 0 })
  /** Dernier bloc et dernier champ qui ont eu le focus, pour la palette. */
  const focus = useRef<{ bloc?: string; champ?: HTMLInputElement }>({})

  // Nouveau texte : l'historique d'annulation repart de zéro. Un texte incorrect renvoie au mode texte.
  useEffect(() => {
    historique.current = { passe: [], futur: [], date: 0 }
  }, [cle])
  useEffect(() => {
    if (!modele) useEtat.getState().changerMode('texte')
  }, [modele])

  // Diagnostics : le texte produit par les blocs est vérifié comme en mode texte.
  useEffect(() => {
    const minuterie = setTimeout(() => useEtat.getState().definirDiagnostics(compiler(texte, notation).diagnostics), 300)
    return () => clearTimeout(minuterie)
  }, [texte, notation])

  const appliquer = useCallback((nouveau: ModeleBlocs, regroupement?: string) => {
    setModele((ancien) => {
      if (!ancien || nouveau === ancien) return ancien
      const h = historique.current
      const maintenant = Date.now()
      // Les frappes successives dans un même champ forment une seule étape d'annulation.
      if (!(regroupement && regroupement === h.dernier && maintenant - h.date < 1500)) {
        h.passe.push(ancien)
        if (h.passe.length > HISTORIQUE_MAX) h.passe.shift()
      }
      h.futur = []
      h.dernier = regroupement
      h.date = maintenant
      useEtat.getState().modifierTexte(versTexte(nouveau).texte)
      return nouveau
    })
  }, [])

  const annuler = (sens: 'annuler' | 'retablir') => {
    if (!modele) return
    const h = historique.current
    const source = sens === 'annuler' ? h.passe : h.futur
    const cible = sens === 'annuler' ? h.futur : h.passe
    const precedent = source.pop()
    if (!precedent) return
    cible.push(modele)
    h.dernier = undefined
    setModele(precedent)
    useEtat.getState().modifierTexte(versTexte(precedent).texte)
  }

  /** Focus demandé, donné dès que la page est à jour (voir l'effet ci-dessous). */
  const focusDemande = useRef<{ id: string; champ: boolean } | null>(null)
  const donnerFocus = useCallback(() => {
    const demande = focusDemande.current
    if (!demande) return
    const el = racine.current?.querySelector<HTMLElement>(`[data-bloc="${demande.id}"]`)
    if (!el) return
    focusDemande.current = null
    const champ = demande.champ ? el.querySelector<HTMLInputElement>('input') : null
    const cible = champ ?? el
    cible.focus()
    // Le texte d'exemple d'un nouveau bloc est sélectionné : la frappe le remplace.
    champ?.select()
    cible.scrollIntoView({ block: 'nearest' })
  }, [])
  const focaliser = useCallback(
    (id: string, champ = false) => {
      focusDemande.current = { id, champ }
      // Sans modification du modèle, la ligne existe déjà.
      queueMicrotask(donnerFocus)
    },
    [donnerFocus],
  )
  useEffect(donnerFocus, [modele, donnerFocus])

  const produit = useMemo(() => (modele ? versTexte(modele) : undefined), [modele])
  const lignes = useMemo(() => produit?.lignes ?? new Map<string, number>(), [produit])
  const parLigne = useMemo(() => new Map([...lignes].map(([id, l]) => [l, id])), [lignes])

  const erreurs = useMemo(() => {
    const parBloc = new Map<string, string[]>()
    for (const d of diagnostics) {
      if (d.gravite !== 'erreur') continue
      // Une erreur sur une ligne fermante (FinSi…) est rattachée au bloc précédent.
      let l = d.etendue.ligne
      while (l > 0 && !parLigne.has(l)) l--
      const id = parLigne.get(l)
      if (id) parBloc.set(id, [...(parBloc.get(id) ?? []), d.suggestion ? `${d.message} ${d.suggestion}` : d.message])
    }
    return parBloc
  }, [diagnostics, parLigne])

  // Diagnostic choisi dans la liste : on va au bloc de la ligne.
  useEffect(() => {
    if (!aller) return
    let l = aller.ligne
    while (l > 0 && !parLigne.has(l)) l--
    const id = parLigne.get(l)
    if (id) focaliser(id, true)
  }, [aller, parLigne, focaliser])

  // Débogueur : le bloc en cours d'exécution reste visible.
  useEffect(() => {
    if (!pause) return
    const id = parLigne.get(pause.ligne)
    if (id) racine.current?.querySelector(`[data-bloc="${id}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [pause, parLigne])

  // Palette : insertion après le bloc qui a le focus, ou dans le champ en cours pour une expression.
  useEffect(() => {
    blocsActif.inserer = (m: Modele) => {
      const etat = useEtat.getState()
      if (!modele) return
      const texteModele = texteSimple(m.modele)
      if (!m.bloc) {
        const champ = focus.current.champ
        if (champ && document.body.contains(champ)) {
          const debut = champ.selectionStart ?? champ.value.length
          const fin = champ.selectionEnd ?? debut
          const valeur = champ.value.slice(0, debut) + texteModele + champ.value.slice(fin)
          // Le champ est contrôlé par React : on passe par l'événement de saisie natif.
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, valeur)
          champ.dispatchEvent(new Event('input', { bubbles: true }))
          champ.focus()
        } else {
          etat.annoncer('Placez d’abord le curseur dans un champ de bloc.')
        }
        return
      }
      const idFocus = focus.current.bloc
      const corps = (idFocus && corpsContenant(modele, idFocus)) || modele.principal
      if (m.libelle === 'Déclarer une variable' || m.libelle === 'Section Variables') {
        const r = ajouterDeclaration(modele, corps.id)
        appliquer(r.modele)
        if (r.id) focaliser(r.id, true)
        return
      }
      if (m.libelle === 'Fonction' || m.libelle === 'Procédure') {
        const sp = sousProgrammeDepuisTexte(texteModele, notation)
        if (sp) {
          appliquer(ajouterSousProgramme(modele, sp))
          focaliser(sp.id, true)
        }
        return
      }
      if (m.libelle === 'Sinon si') {
        // Ajoute une branche au Si qui contient le bloc qui a le focus.
        let id = idFocus
        while (id) {
          const pos = trouver(modele, id)
          if (pos?.bloc.genre === 'si') break
          id = pos?.parent?.id
        }
        if (id) {
          const r = ajouterSinonSi(modele, id)
          appliquer(r.modele)
          if (r.id) focaliser(r.id, true)
        } else {
          etat.annoncer('Placez d’abord le curseur dans un bloc Si.')
        }
        return
      }
      if (MODELES_HORS_INSTRUCTIONS.has(m.libelle)) return
      const blocs = blocsDepuisTexte(texteModele, notation)
      if (!blocs) return
      const pos = idFocus ? trouver(modele, idFocus) : undefined
      appliquer(pos ? inserer(modele, pos.cle, pos.index + 1, blocs) : inserer(modele, modele.principal.id, modele.principal.instructions.length, blocs))
      focaliser(blocs[0].id, true)
    }
    return () => {
      blocsActif.inserer = null
    }
  }, [modele, appliquer, focaliser, notation])

  const capteurs = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor))

  if (!modele) return null

  const deposer = (e: DragEndEvent) => {
    if (!e.over) return
    const [cle, index] = String(e.over.id).split('|')
    appliquer(deplacer(modele, String(e.active.id), cle, Number(index)))
    focaliser(String(e.active.id))
  }

  /** Clavier : navigation entre les lignes, raccourcis d'édition, annulation. */
  const clavier = (e: KeyboardEvent<HTMLDivElement>) => {
    const mod = e.ctrlKey || e.metaKey
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      annuler('annuler')
      return
    }
    if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault()
      annuler('retablir')
      return
    }
    const cible = e.target as HTMLElement
    const ligne = cible.closest<HTMLElement>('[data-bloc]')
    if (!ligne) return
    const id = ligne.dataset.bloc!
    const dansChamp = cible.tagName === 'INPUT'
    if (dansChamp) {
      if (e.key === 'Escape' && cible.getAttribute('aria-expanded') !== 'true') ligne.focus()
      return
    }
    const voisines = lignesVisibles(racine.current!)
    const k = voisines.indexOf(ligne)
    const ligneCode = lignes.get(id)
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      appliquer(decaler(modele, id, e.key === 'ArrowUp' ? -1 : 1))
      focaliser(id)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      voisines[k + (e.key === 'ArrowDown' ? 1 : -1)]?.focus()
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      voisines[e.key === 'Home' ? 0 : voisines.length - 1]?.focus()
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault()
      ligne.querySelector<HTMLElement>('input')?.focus()
    } else if (e.key === 'Delete') {
      e.preventDefault()
      if (trouver(modele, id)) {
        appliquer(supprimer(modele, id))
        ;(voisines[k + 1] ?? voisines[k - 1])?.focus()
      }
    } else if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      const r = dupliquer(modele, id)
      appliquer(r.modele)
      if (r.id) focaliser(r.id)
    } else if (mod && e.key === '/') {
      e.preventDefault()
      appliquer(commenter(modele, id))
    } else if (mod && e.key === 'F8' && ligneCode !== undefined) {
      e.preventDefault()
      useEtat.getState().basculerPointArret(ligneCode)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (ligne.dataset.conteneur === undefined) return
      e.preventDefault()
      const replie = replies.has(id)
      if ((e.key === 'ArrowLeft') !== replie) basculerRepli(id)
    }
  }

  const basculerRepli = (id: string) => {
    const r = new Set(replies)
    if (r.has(id)) r.delete(id)
    else r.add(id)
    setReplies(r)
  }

  const contexte: ContexteBlocs = {
    modele,
    appliquer,
    lignes,
    erreurs,
    pointsArret: new Set(pointsArret ?? []),
    ligneCourante: pause?.ligne ?? null,
    replies,
    basculerRepli,
    focaliser,
  }

  return (
    <Blocs.Provider value={contexte}>
      <NomsDisponibles.Provider value={nomsDuModele(modele, notation)}>
        <DndContext
          sensors={capteurs}
          onDragEnd={deposer}
          accessibility={{
            screenReaderInstructions: {
              draggable: 'Pour déplacer ce bloc, appuyez sur Espace, choisissez sa place avec les flèches, puis appuyez de nouveau sur Espace. Échap annule.',
            },
            announcements: {
              onDragStart: () => 'Bloc saisi.',
              onDragOver: ({ over }) => (over ? 'Au-dessus d’un point d’insertion.' : 'Hors des points d’insertion.'),
              onDragEnd: ({ over }) => (over ? 'Bloc déplacé.' : 'Bloc reposé à sa place.'),
              onDragCancel: () => 'Déplacement annulé.',
            },
          }}
        >
          <div
            ref={racine}
            className="editeur-blocs"
            role="region"
            aria-label="Algorithme en blocs"
            onKeyDown={clavier}
            onFocus={(e) => {
              const ligne = (e.target as HTMLElement).closest<HTMLElement>('[data-bloc]')
              if (ligne) {
                focus.current.bloc = ligne.dataset.bloc
                // Navigation par tabulation dans l'arbre : une seule ligne est atteignable par Tab.
                for (const l of lignesVisibles(racine.current!)) l.tabIndex = l === ligne ? 0 : -1
              }
              if ((e.target as HTMLElement).tagName === 'INPUT') focus.current.champ = e.target as HTMLInputElement
            }}
          >
            {modele.entete && (
              <div className="ligne-section entete-algorithme">
                <span className="mot-cle">Algorithme</span>{' '}
                <Champ
                  valeur={modele.entete.nom}
                  modifier={(nom) => appliquer({ ...modele, entete: { ...modele.entete!, nom } }, 'entete')}
                  etiquette="Nom de l’algorithme"
                  sansCompletion
                />
              </div>
            )}
            {modele.avant.map((el) =>
              el.genre === 'sousProgramme' ? <VueSousProgramme key={el.id} sp={el} /> : <LigneHaut key={el.id} texte={el.genre === 'commentaire' ? el.texte : undefined} />,
            )}
            <section className="principal" aria-label="Algorithme principal">
              <VueCorps corps={modele.principal} fermeture="Fin" />
            </section>
            {modele.apres.map((el) => (el.genre === 'sousProgramme' ? <VueSousProgramme key={el.id} sp={el} /> : <LigneHaut key={el.id} texte={el.genre === 'commentaire' ? el.texte : undefined} />))}
          </div>
        </DndContext>
      </NomsDisponibles.Provider>
    </Blocs.Provider>
  )
}

/** Commentaire ou ligne vide de premier niveau (non modifiable en blocs). */
function LigneHaut({ texte }: { texte?: string }) {
  return texte === undefined ? <div className="ligne-haut-vide" /> : <div className="ligne-section commentaire-haut">//{texte}</div>
}
