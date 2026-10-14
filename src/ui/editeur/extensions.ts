import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  snippet,
  snippetCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, foldGutter, foldKeymap, foldService, getIndentation, indentOnInput, indentService, indentUnit } from '@codemirror/language'
import { lintGutter, linter, type Diagnostic as DiagnosticCM } from '@codemirror/lint'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { EditorState, type Extension } from '@codemirror/state'
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view'
import { analyser } from '../../langage/analyse.ts'
import { canoniserLigne } from '../../langage/canonique.ts'
import { compiler } from '../../langage/index.ts'
import { normaliser } from '../../langage/normalisation.ts'
import { nomAffiche, PREDEFINIS, PROCEDURES_PREDEFINIES, trouverPredefini, type Notation } from '../../langage/predefinis.ts'
import { algoweb, coloration } from './langage.ts'
import { modeles, type Modele } from './modeles.ts'

/**
 * Extensions CodeMirror de l'éditeur de texte (PLAN.md, section 8).
 */

export interface Liens {
  notation: () => Notation
  diagnostics: (d: ReturnType<typeof compiler>['diagnostics']) => void
  executer: () => void
}

// ---------------------------------------------------------------- Contexte de la saisie

/** Le texte `avant` (début de ligne jusqu'au curseur) se termine hors d'une chaîne et d'un commentaire. */
export function horsChaine(avant: string): boolean {
  let guillemet: string | null = null
  for (let i = 0; i < avant.length; i++) {
    const c = avant[i]
    if (guillemet) {
      if (c === '\\') i++
      else if (c === guillemet) guillemet = null
    } else if (c === '"' || c === "'") {
      // L'apostrophe de « Jusqu'à » ou « d'entiers » n'ouvre pas de chaîne.
      if (c === "'" && /\p{L}$/u.test(avant.slice(0, i)) && /^\p{L}/u.test(avant.slice(i + 1) || 'a')) continue
      guillemet = c
    } else if (c === '/' && avant[i + 1] === '/') {
      return false
    }
  }
  return guillemet === null
}

const REMPLACEMENTS: Record<string, Record<string, string>> = {
  '-': { '<': '←' },
  '=': { '<': '≤', '>': '≥', '!': '≠', '=': '=' },
  '>': { '<': '≠' },
  '*': { '*': '^' },
  n: { '\\': '↵' },
}

/** Remplace les équivalents ASCII à la frappe, et réécrit le nom d'une fonction dans la notation choisie. */
function remplacementsALaFrappe(liens: Liens): Extension {
  return EditorView.inputHandler.of((vue, de, a, texte) => {
    if (texte.length !== 1 || de !== a) return false
    const ligne = vue.state.doc.lineAt(de)
    const avant = ligne.text.slice(0, de - ligne.from)
    if (!horsChaine(avant)) return false
    const precedent = avant.at(-1) ?? ''
    const remplacement = REMPLACEMENTS[texte]?.[precedent]
    if (remplacement) {
      vue.dispatch({
        changes: { from: de - 1, to: a, insert: remplacement },
        selection: { anchor: de - 1 + remplacement.length },
        userEvent: 'input.type',
      })
      return true
    }
    if (texte === '(') {
      const mot = /[\p{L}_][\p{L}\p{M}\p{Nd}_]*$/u.exec(avant)?.[0]
      const p = mot ? trouverPredefini(mot) : undefined
      // log reste tel quel : en notation française, log(x, b) est le logarithme en base b.
      if (mot && p?.genre === 'fonction' && normaliser(mot) !== 'log') {
        const nom = nomAffiche(p.python, liens.notation())
        if (nom !== mot) {
          vue.dispatch({
            changes: { from: de - mot.length, to: a, insert: nom + '(' },
            selection: { anchor: de - mot.length + nom.length + 1 },
            userEvent: 'input.type',
          })
          return true
        }
      }
    }
    return false
  })
}

// ---------------------------------------------------------------- Forme canonique

/** Quand le curseur quitte une ligne, ses mots-clés prennent leur forme canonique (`debut` devient `Début`). */
const formeCanonique = EditorView.updateListener.of((maj) => {
  // L'éditeur perd le focus (clic sur Exécuter…) : la ligne en cours prend aussi sa forme canonique.
  if (maj.focusChanged && !maj.view.hasFocus) {
    const ligne = maj.state.doc.lineAt(maj.state.selection.main.head)
    const canonique = canoniserLigne(ligne.text)
    if (canonique !== ligne.text) {
      queueMicrotask(() => {
        const l = maj.view.state.doc.line(ligne.number)
        if (l.text === ligne.text) maj.view.dispatch({ changes: { from: l.from, to: l.to, insert: canonique }, userEvent: 'input.canonique' })
      })
    }
    return
  }
  if (!maj.selectionSet && !maj.docChanged) return
  if (maj.transactions.some((t) => t.isUserEvent('input.paste') || t.isUserEvent('undo') || t.isUserEvent('redo'))) return
  if (!maj.transactions.some((t) => t.isUserEvent('input') || t.isUserEvent('select') || t.isUserEvent('delete'))) return
  const avant = maj.startState.selection.main.head
  const position = maj.changes.mapPos(avant, -1)
  const doc = maj.state.doc
  const quittee = doc.lineAt(position)
  if (quittee.number === doc.lineAt(maj.state.selection.main.head).number) return
  const canonique = canoniserLigne(quittee.text)
  if (canonique === quittee.text) return
  // La vue ne peut pas être modifiée pendant sa mise à jour : la réécriture est différée.
  queueMicrotask(() => {
    const ligne = maj.view.state.doc.line(quittee.number)
    if (ligne.text !== quittee.text) return
    maj.view.dispatch({ changes: { from: ligne.from, to: ligne.to, insert: canonique }, userEvent: 'input.canonique' })
  })
})

// ---------------------------------------------------------------- Indentation et repli

const OUVRANTES = /^(si|sinon|pour|tantque|tant\s+que|repeter|variables|debut)\b/
const FERMANTES = /^(fin|finsi|finpour|fintantque|finfonction|finprocedure|sinon|jusqu|debut)\b/

function premierMot(texte: string): string {
  return normaliser(texte.trim())
}

function indentationDe(texte: string): number {
  return /^ */.exec(texte)![0].length
}

const indentation = indentService.of((contexte, position) => {
  // Le contexte simule le retour à la ligne : ses lignes tiennent compte de la coupure.
  const ligne = contexte.lineAt(position, 1)
  let p = ligne.from - 1
  let precedente: { text: string; from: number } | undefined
  while (p >= 0) {
    const l = contexte.lineAt(p, -1)
    if (l.text.trim() !== '') {
      precedente = l
      break
    }
    p = l.from - 1
  }
  if (!precedente) return 0
  let niveau = indentationDe(precedente.text)
  const motPrecedent = premierMot(precedente.text)
  // « Si … » ouvre un bloc ; « Fin Si » non.
  if (OUVRANTES.test(motPrecedent) && !/^fin/.test(motPrecedent)) niveau += 2
  if (FERMANTES.test(premierMot(contexte.textAfterPos(position, 1)))) niveau -= 2
  return Math.max(0, niveau)
})

const repli = foldService.of((etat, debutLigne) => {
  const ligne = etat.doc.lineAt(debutLigne)
  const mot = premierMot(ligne.text)
  if (!OUVRANTES.test(mot) && !/^(fonction|procedure)\b/.test(mot)) return null
  const niveau = indentationDe(ligne.text)
  const sousProgramme = /^(fonction|procedure)\b/.test(mot)
  let derniere = ligne.number
  for (let k = ligne.number + 1; k <= etat.doc.lines; k++) {
    const texte = etat.doc.line(k).text
    if (texte.trim() === '') continue
    const motK = premierMot(texte)
    if (sousProgramme) {
      if (/^fin\s*(fonction|procedure)/.test(motK)) {
        derniere = k - 1
        break
      }
      continue
    }
    if (indentationDe(texte) <= niveau) {
      derniere = k - 1
      break
    }
    derniere = k
  }
  if (derniere <= ligne.number) return null
  return { from: ligne.to, to: etat.doc.line(derniere).to }
})

// ---------------------------------------------------------------- Diagnostics

function diagnostics(liens: Liens): Extension {
  return linter(
    (vue) => {
      const texte = vue.state.doc.toString()
      const { diagnostics } = compiler(texte, liens.notation())
      liens.diagnostics(diagnostics)
      return diagnostics.map((d): DiagnosticCM => {
        const from = Math.min(d.etendue.de, texte.length)
        return {
          from,
          to: Math.min(Math.max(d.etendue.a, from), texte.length),
          severity: d.gravite === 'erreur' ? 'error' : 'warning',
          message: d.suggestion ? `${d.message}\n${d.suggestion}` : d.message,
        }
      })
    },
    { delay: 300 },
  )
}

// ---------------------------------------------------------------- Autocomplétion

const MOTS = ['alors', 'faire', 'Sinon', 'FinSi', 'FinPour', 'FinTantQue', 'Jusqu\'à', 'Début', 'Fin', 'Variables', 'Algorithme', 'FinFonction', 'FinProcédure', 'Pause', 'et', 'ou', 'non', 'mod', 'div', 'dans', 'vrai', 'faux', 'pas de']
const TYPES = ['entier', 'réel', 'chaîne', 'booléen', 'liste', 'liste d\'entiers', 'liste de réels', 'liste de chaînes', 'liste de booléens']

/** Noms déclarés dans le texte : variables, paramètres, fonctions et procédures. */
function nomsDeclares(texte: string): Completion[] {
  const { programme } = analyser(texte)
  const options = new Map<string, Completion>()
  for (const e of programme.elements) {
    if (e.genre === 'Fonction' || e.genre === 'Procedure') {
      options.set(e.nom, snippetCompletion(`${e.nom}(\${})`, { label: e.nom, type: 'function', detail: e.genre === 'Fonction' ? 'fonction' : 'procédure' }))
      for (const p of e.parametres) options.set(p.nom, { label: p.nom, type: 'variable', detail: 'paramètre' })
    }
    if (e.genre === 'Fonction' || e.genre === 'Procedure' || e.genre === 'Principal') {
      for (const l of e.corps.variables?.lignes ?? []) {
        if (l.genre === 'Declaration') for (const n of l.noms) if (!options.has(n.nom)) options.set(n.nom, { label: n.nom, type: 'variable', detail: 'variable' })
      }
    }
  }
  return [...options.values()]
}

function completer(liens: Liens) {
  return (contexte: CompletionContext): CompletionResult | null => {
    const mot = contexte.matchBefore(/[\p{L}_][\p{L}\p{M}\p{Nd}_]*/u)
    if (!mot && !contexte.explicit) return null
    const de = mot?.from ?? contexte.pos
    const ligne = contexte.state.doc.lineAt(de)
    const avant = ligne.text.slice(0, de - ligne.from)
    if (!horsChaine(avant)) return null
    const notation = liens.notation()
    const debutLigne = avant.trim() === ''
    const options: Completion[] = []
    if (debutLigne) {
      for (const m of modeles(notation).filter((x) => x.bloc)) {
        options.push(snippetCompletion(m.modele, { label: m.libelle, type: 'keyword', detail: 'modèle', info: m.description, boost: 2 }))
      }
    }
    options.push(...MOTS.map((label): Completion => ({ label, type: 'keyword' })))
    options.push(...TYPES.map((label): Completion => ({ label, type: 'type' })))
    for (const p of PREDEFINIS) {
      const label = nomAffiche(p.python, notation)
      const autre = notation === 'python' ? p.francais : p.python
      const info = `${p.role}.${autre !== label ? ` ${notation === 'python' ? 'Nom français' : 'Nom Python'} : ${autre}.` : ''}`
      options.push(p.genre === 'constante' ? { label, type: 'constant', info } : snippetCompletion(`${label}(\${})`, { label, type: 'function', detail: 'prédéfinie', info }))
    }
    for (const [nom, p] of Object.entries(PROCEDURES_PREDEFINIES)) {
      options.push(snippetCompletion(`${nom}(\${})`, { label: nom, type: 'function', detail: 'procédure prédéfinie', info: p.role }))
    }
    options.push(...nomsDeclares(contexte.state.doc.toString()))
    // Filtre sans tenir compte des accents ni de la casse : « debut » propose « Début ».
    const tape = normaliser(mot?.text ?? '')
    // Un mot déjà entièrement tapé ne déclenche pas de proposition : Entrée passe à la ligne.
    const retenues = options.filter((o) => normaliser(o.label).startsWith(tape) && normaliser(o.label) !== tape)
    if (retenues.length === 0) return null
    return { from: de, options: retenues, filter: false }
  }
}

// ---------------------------------------------------------------- Insertion d'un modèle (palette)

/** Insère un modèle au curseur : sur la ligne courante si elle est vide, sinon sur une nouvelle ligne. */
export function insererModele(vue: EditorView, modele: Modele): void {
  const etat = vue.state
  const { from, to } = etat.selection.main
  if (!modele.bloc) {
    snippet(modele.modele)(vue, null, from, to)
    vue.focus()
    return
  }
  const ligne = etat.doc.lineAt(from)
  if (ligne.text.trim() === '') {
    const retrait = ' '.repeat(getIndentation(etat, ligne.from) ?? 0)
    vue.dispatch({ changes: { from: ligne.from, to: ligne.to, insert: retrait } })
    const position = ligne.from + retrait.length
    snippet(modele.modele)(vue, null, position, position)
  } else {
    vue.dispatch({ changes: { from: ligne.to, insert: '\n' }, selection: { anchor: ligne.to + 1 } })
    const retrait = ' '.repeat(getIndentation(vue.state, ligne.to + 1) ?? 0)
    vue.dispatch({ changes: { from: ligne.to + 1, insert: retrait } })
    const position = ligne.to + 1 + retrait.length
    snippet(modele.modele)(vue, null, position, position)
  }
  vue.focus()
}

// ---------------------------------------------------------------- Ensemble des extensions

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: 'var(--taille-texte)', backgroundColor: 'var(--fond-editeur)', color: 'var(--texte)' },
  '.cm-scroller': { fontFamily: 'var(--police-code)', lineHeight: '1.55' },
  '.cm-content': { caretColor: 'var(--texte)' },
  '.cm-gutters': { backgroundColor: 'var(--fond-marge)', color: 'var(--texte-doux)', borderRight: '1px solid var(--bordure)' },
  '.cm-activeLine': { backgroundColor: 'var(--ligne-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--ligne-active)' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--texte)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--selection) !important' },
  '.cm-tooltip': { backgroundColor: 'var(--fond-panneau)', color: 'var(--texte)', border: '1px solid var(--bordure)' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--accent)', color: 'var(--sur-accent)' },
  '.cm-panels': { backgroundColor: 'var(--fond-panneau)', color: 'var(--texte)' },
})

export function extensions(liens: Liens): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    foldGutter({ markerDOM: (ouvert) => marqueRepli(ouvert) }),
    lintGutter(),
    history(),
    drawSelection(),
    EditorState.allowMultipleSelections.of(false),
    indentUnit.of('  '),
    EditorState.tabSize.of(2),
    algoweb,
    coloration,
    indentation,
    indentOnInput(),
    formeCanonique,
    repli,
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    autocompletion({ override: [completer(liens)], icons: false }),
    diagnostics(liens),
    remplacementsALaFrappe(liens),
    EditorView.lineWrapping,
    theme,
    EditorView.contentAttributes.of({ 'aria-label': 'Éditeur du pseudo-code', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
    keymap.of([
      { key: 'Mod-Enter', run: () => (liens.executer(), true), preventDefault: true },
      ...closeBracketsKeymap,
      ...completionKeymap,
      ...searchKeymap,
      ...foldKeymap,
      ...historyKeymap,
      ...defaultKeymap,
      indentWithTab,
    ]),
  ]
}

function marqueRepli(ouvert: boolean): HTMLElement {
  const s = document.createElement('span')
  s.textContent = ouvert ? '▾' : '▸'
  s.title = ouvert ? 'Replier le bloc' : 'Déplier le bloc'
  return s
}
