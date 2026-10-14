import { Annotation, EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { useEtat } from '../etat.ts'
import { editeurActif } from './actif.ts'
import { debogage, effetPointsArret, surlignerLignes } from './debogage.ts'
import { extensions } from './extensions.ts'

/** Marque les modifications qui viennent de l'application et non de l'utilisateur. */
const externe = Annotation.define<boolean>()

function creerEtat(texte: string): EditorState {
  const etat = useEtat.getState
  return EditorState.create({
    doc: texte,
    extensions: [
      // En premier : la marge des points d'arrêt est la plus à gauche.
      debogage((lignes) => etat().definirPointsArret(lignes)),
      extensions({
        notation: () => etat().preferences.notation,
        diagnostics: (d) => etat().definirDiagnostics(d),
        executer: () => etat().executer(),
      }),
      EditorView.updateListener.of((maj) => {
        if (maj.docChanged && !maj.transactions.some((t) => t.annotation(externe))) {
          etat().modifierTexte(maj.state.doc.toString())
        }
      }),
    ],
  })
}

export function Editeur() {
  const conteneur = useRef<HTMLDivElement>(null)
  const vue = useRef<EditorView | null>(null)
  const courantId = useEtat((e) => e.courantId)
  const versionTexte = useEtat((e) => e.versionTexte)
  const aller = useEtat((e) => e.aller)
  const notation = useEtat((e) => e.preferences.notation)

  // Création de la vue.
  useEffect(() => {
    const v = new EditorView({ state: creerEtat(useEtat.getState().texte), parent: conteneur.current! })
    vue.current = v
    editeurActif.vue = v
    return () => {
      v.destroy()
      vue.current = null
      editeurActif.vue = null
    }
  }, [])

  // Nouvel algorithme ouvert : nouvel état, sans l'historique d'annulation du précédent.
  useEffect(() => {
    const v = vue.current
    if (!v) return
    const etat = useEtat.getState()
    v.setState(creerEtat(etat.texte))
    if (courantId) v.dispatch({ effects: effetPointsArret(etat.pointsArret[courantId] ?? []) })
  }, [courantId, notation])

  // Ligne en cours d'exécution pendant une pause, et ligne d'appel du cadre choisi dans la pile.
  const pause = useEtat((e) => e.pause)
  const cadreChoisi = useEtat((e) => e.cadreChoisi)
  useEffect(() => {
    const v = vue.current
    if (!v) return
    const appel = pause && cadreChoisi < pause.pile.length - 1 ? pause.pile[cadreChoisi].ligne : null
    surlignerLignes(v, { courante: pause?.ligne ?? null, appel })
  }, [pause, cadreChoisi])

  // Texte remplacé par l'application (renommage) : modification annulable.
  useEffect(() => {
    const v = vue.current
    if (!v) return
    const texte = useEtat.getState().texte
    if (texte === v.state.doc.toString()) return
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: texte }, annotations: externe.of(true) })
  }, [versionTexte])

  // Aller à une ligne (diagnostic, erreur d'exécution).
  useEffect(() => {
    const v = vue.current
    if (!v || !aller) return
    const doc = v.state.doc
    const ligne = doc.line(Math.min(Math.max(aller.ligne, 1), doc.lines))
    const position = Math.min(ligne.from + aller.colonne - 1, ligne.to)
    v.dispatch({ selection: EditorSelection.cursor(position), effects: EditorView.scrollIntoView(position, { y: 'center' }) })
    v.focus()
  }, [aller])

  return <div ref={conteneur} className="editeur" />
}
