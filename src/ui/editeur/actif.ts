import type { EditorView } from '@codemirror/view'

/** Vue CodeMirror active, pour que la palette y insère ses modèles. */
export const editeurActif: { vue: EditorView | null } = { vue: null }
