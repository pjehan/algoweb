import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { normaliser } from '../../langage/normalisation.ts'
import { MOTS_CLES, trouverPredefini, trouverProcedurePredefinie } from '../../langage/predefinis.ts'

/**
 * Coloration du pseudo-code AlgoWeb pour CodeMirror.
 */

interface EtatLigne {
  /** Premier mot de la ligne, normalisé. */
  premier: string | null
  /** Le reste de la ligne est le nom de l'algorithme. */
  titre: boolean
}

const TYPES = new Set(['entier', 'reel', 'chaine', 'booleen', 'liste', 'entiers', 'reels', 'chaines', 'booleens', 'listes'])
const OPERATEURS_MOTS = new Set(['et', 'ou', 'non', 'mod', 'div', 'dans'])
const CONTEXTUELS: Record<string, Set<string>> = {
  pour: new Set(['de', 'a', 'pas', 'chaque']),
  tant: new Set(['que']),
  fin: new Set(['tant', 'que', 'pour', 'si', 'fonction', 'procedure', 'tantque']),
  liste: new Set(['de', "d'"]),
}

export const algoweb = StreamLanguage.define<EtatLigne>({
  name: 'algoweb',
  startState: () => ({ premier: null, titre: false }),
  token(stream, etat) {
    if (stream.sol()) {
      etat.premier = null
      etat.titre = false
    }
    if (stream.eatSpace()) return null
    if (stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }
    if (etat.titre) {
      if (stream.match(/^.*?(?=\/\/|$)/)) return 'titre'
    }
    if (stream.match('↵') || stream.match('\\n')) return 'retour'
    const c = stream.peek()
    if (c === '"' || c === "'") {
      stream.next()
      let echappe = false
      for (;;) {
        const d = stream.next()
        if (d === undefined) break
        if (echappe) echappe = false
        else if (d === '\\') echappe = true
        else if (d === c) break
      }
      return 'string'
    }
    if (stream.match(/^\d+(\.\d*)?([eE][+-]?\d+)?/)) return 'number'
    const mot = stream.match(/^[\p{L}_][\p{L}\p{M}\p{Nd}_]*(?:['’]\p{L}*)?/u) as RegExpMatchArray | null
    if (mot) {
      const forme = normaliser(mot[0])
      const premier = etat.premier === null
      if (premier) etat.premier = forme
      if (premier && forme === 'algorithme') {
        etat.titre = true
        return 'keyword'
      }
      if (forme === 'vrai' || forme === 'faux') return 'atom'
      const appel = stream.match(/^\s*\(/, false) !== null
      if (TYPES.has(forme) && !appel) return 'typeName'
      if (OPERATEURS_MOTS.has(forme)) return 'operatorKeyword'
      if (MOTS_CLES.has(forme) && !appel) return 'keyword'
      if (etat.premier && CONTEXTUELS[etat.premier]?.has(forme)) return 'keyword'
      if (forme.startsWith("jusqu'") || forme.startsWith('jusqu’')) return 'keyword'
      if (appel && (trouverPredefini(mot[0]) || trouverProcedurePredefinie(mot[0]))) return 'predefini'
      if (appel) return 'fonction'
      if (trouverPredefini(mot[0])?.genre === 'constante') return 'predefini'
      return 'variableName'
    }
    if (stream.match(/^(<-|<=|>=|<>|!=|==|\*\*|[←≠≤≥<>=+\-*/^:])/)) return 'operator'
    stream.next()
    return null
  },
  tokenTable: {
    titre: t.heading,
    retour: t.special(t.string),
    predefini: t.standard(t.function(t.variableName)),
    fonction: t.function(t.variableName),
  },
  languageData: {
    commentTokens: { line: '//' },
    indentOnInput: /^\s*(fin\s*\S*|sinon|jusqu|d[ée]but)$/i,
  },
})

/** Couleurs définies par des variables CSS, pour les thèmes clair et sombre. */
export const coloration = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.keyword, color: 'var(--code-mot-cle)', fontWeight: '600' },
    { tag: t.operatorKeyword, color: 'var(--code-mot-cle)', fontWeight: '600' },
    { tag: t.typeName, color: 'var(--code-type)' },
    { tag: t.atom, color: 'var(--code-constante)' },
    { tag: t.number, color: 'var(--code-nombre)' },
    { tag: t.string, color: 'var(--code-chaine)' },
    { tag: t.special(t.string), color: 'var(--code-constante)', fontWeight: '600' },
    { tag: t.comment, color: 'var(--code-commentaire)', fontStyle: 'italic' },
    { tag: t.heading, color: 'var(--code-titre)', fontWeight: '700' },
    { tag: t.standard(t.function(t.variableName)), color: 'var(--code-predefini)' },
    { tag: t.function(t.variableName), color: 'var(--code-fonction)' },
    { tag: t.operator, color: 'var(--code-operateur)' },
  ]),
)
