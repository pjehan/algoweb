import { RangeSet, StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'
import { Decoration, EditorView, gutter, GutterMarker, keymap, type DecorationSet } from '@codemirror/view'

/**
 * Débogueur dans l'éditeur (PLAN.md, section 8) : points d'arrêt dans la
 * marge, qui suivent les modifications du texte, et ligne courante surlignée.
 */

const basculer = StateEffect.define<number>()
const definir = StateEffect.define<number[]>()

class MarquePointArret extends GutterMarker {
  toDOM(): Node {
    const s = document.createElement('span')
    s.className = 'point-arret'
    s.textContent = '●'
    s.title = 'Point d’arrêt (cliquer pour le retirer)'
    return s
  }
}

const marque = new MarquePointArret()

const champPointsArret = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(points, tr) {
    points = points.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(basculer)) {
        let present = false
        points.between(e.value, e.value, () => {
          present = true
        })
        points = present ? points.update({ filter: (de) => de !== e.value }) : points.update({ add: [marque.range(e.value)] })
      } else if (e.is(definir)) {
        const doc = tr.state.doc
        points = RangeSet.of(
          e.value.filter((l) => l >= 1 && l <= doc.lines).map((l) => marque.range(doc.line(l).from)),
          true,
        )
      }
    }
    return points
  },
})

/** Lignes des points d'arrêt, sans doublon (deux points peuvent fusionner quand on supprime des lignes). */
export function lignesPointsArret(etat: EditorState): number[] {
  const lignes = new Set<number>()
  etat.field(champPointsArret).between(0, etat.doc.length, (de) => {
    lignes.add(etat.doc.lineAt(de).number)
  })
  return [...lignes].sort((a, b) => a - b)
}

export function effetPointsArret(lignes: number[]): StateEffect<number[]> {
  return definir.of(lignes)
}

/** Bascule le point d'arrêt de la ligne du curseur. */
function basculerLigneCourante(vue: EditorView): boolean {
  vue.dispatch({ effects: basculer.of(vue.state.doc.lineAt(vue.state.selection.main.head).from) })
  return true
}

// ---------------------------------------------------------------- Ligne courante

export interface LignesSurlignees {
  /** Prochaine ligne à exécuter. */
  courante: number | null
  /** Ligne d'appel du cadre choisi dans la pile, s'il n'est pas le cadre en cours. */
  appel: number | null
}

const definirLignes = StateEffect.define<LignesSurlignees>()
const decorationCourante = Decoration.line({ class: 'cm-ligne-courante', attributes: { 'aria-current': 'step' } })
const decorationAppel = Decoration.line({ class: 'cm-ligne-appel' })

const champLignes = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    decorations = decorations.map(tr.changes)
    for (const e of tr.effects) {
      if (!e.is(definirLignes)) continue
      const doc = tr.state.doc
      const plages = []
      const { courante, appel } = e.value
      if (appel !== null && appel <= doc.lines && appel !== courante) plages.push(decorationAppel.range(doc.line(appel).from))
      if (courante !== null && courante <= doc.lines) plages.push(decorationCourante.range(doc.line(courante).from))
      decorations = Decoration.set(plages, true)
    }
    return decorations
  },
  provide: (f) => EditorView.decorations.from(f),
})

/** Surligne la ligne courante et fait défiler l'éditeur jusqu'à elle. */
export function surlignerLignes(vue: EditorView, lignes: LignesSurlignees): void {
  const effets: StateEffect<unknown>[] = [definirLignes.of(lignes)]
  const cible = lignes.appel ?? lignes.courante
  if (cible !== null && cible <= vue.state.doc.lines) {
    effets.push(EditorView.scrollIntoView(vue.state.doc.line(cible).from, { y: 'nearest', yMargin: 60 }))
  }
  vue.dispatch({ effects: effets })
}

export function debogage(changement: (lignes: number[]) => void): Extension {
  return [
    champPointsArret,
    champLignes,
    gutter({
      class: 'cm-gutter-arret',
      markers: (vue) => vue.state.field(champPointsArret),
      initialSpacer: () => marque,
      // Un élément par ligne : toute la marge est cliquable, et un point estompé apparaît au survol.
      renderEmptyElements: true,
      domEventHandlers: {
        mousedown(vue, ligne) {
          vue.dispatch({ effects: basculer.of(ligne.from) })
          return true
        },
      },
    }),
    EditorView.updateListener.of((maj) => {
      if (maj.startState.field(champPointsArret) !== maj.state.field(champPointsArret)) changement(lignesPointsArret(maj.state))
    }),
    keymap.of([{ key: 'Mod-F8', run: basculerLigneCourante, preventDefault: true }]),
  ]
}
