import type { Etendue } from './ast.ts'
import { diagnostic, type Diagnostic } from './messages.ts'
import { normaliser } from './normalisation.ts'

/**
 * Analyse lexicale, ligne par ligne : chaque ligne du texte contient au plus
 * une instruction.
 */

export type GenreJeton = 'mot' | 'entier' | 'reel' | 'chaine' | 'symbole' | 'retour' | 'texteLibre'

export type Symbole = '←' | '=' | '≠' | '<' | '≤' | '>' | '≥' | '^' | '+' | '-' | '*' | '/' | '(' | ')' | '[' | ']' | ',' | ':'

export interface Jeton {
  genre: GenreJeton
  /** Texte tel qu'il a été saisi. */
  texte: string
  /**
   * Pour un mot : sa forme normalisée (minuscules, sans accents).
   * Pour un symbole : sa forme canonique (`<-` donne `←`).
   * Pour une chaîne : son contenu, échappements traduits.
   */
  valeur: string
  etendue: Etendue
  /** Aucune espace ne sépare ce jeton du précédent. */
  colle: boolean
}

export interface LigneLexicale {
  numero: number
  /** Décalage du début et de la fin de la ligne (sans le saut de ligne). */
  de: number
  a: number
  texte: string
  jetons: Jeton[]
  commentaire?: string
  /** Une erreur lexicale a été signalée sur cette ligne. */
  erreur: boolean
}

export interface ResultatLexical {
  lignes: LigneLexicale[]
  diagnostics: Diagnostic[]
}

const SYMBOLES_DOUBLES: Record<string, Symbole> = {
  '<-': '←',
  '<=': '≤',
  '>=': '≥',
  '<>': '≠',
  '!=': '≠',
  '==': '=',
  '**': '^',
}

const SYMBOLES_SIMPLES = new Set<string>(['←', '=', '≠', '<', '≤', '>', '≥', '^', '+', '-', '*', '/', '(', ')', '[', ']', ',', ':'])

/** Symboles d'autres langages, avec leur équivalent AlgoWeb. */
const SYMBOLES_ETRANGERS: Record<string, string> = {
  ':=': '← (ou <-)',
  '&&': 'et',
  '||': 'ou',
  '!': 'non',
  '&': 'et',
  '|': 'ou',
  '%': 'mod',
  '×': '*',
  '÷': '/',
}

const ECHAPPEMENTS: Record<string, string> = { '"': '"', "'": "'", '\\': '\\', n: '\n', t: '\t' }

const DEBUT_MOT = /[\p{L}_]/u
const SUITE_MOT = /^[\p{L}\p{M}\p{Nd}_]*/u
const NOMBRE = /^\d+(\.\d*)?([eE][+-]?\d+)?/
const ESPACE = /[ \t  ]/

export function analyserLexique(source: string): ResultatLexical {
  const lignes: LigneLexicale[] = []
  const diagnostics: Diagnostic[] = []
  let de = 0
  const textes = source.split('\n')
  textes.forEach((brut, index) => {
    const texte = brut.endsWith('\r') ? brut.slice(0, -1) : brut
    lignes.push(analyserLigne(texte, index + 1, de, diagnostics))
    de += brut.length + 1
  })
  return { lignes, diagnostics }
}

function analyserLigne(texte: string, numero: number, debutLigne: number, diagnostics: Diagnostic[]): LigneLexicale {
  const ligne: LigneLexicale = { numero, de: debutLigne, a: debutLigne + texte.length, texte, jetons: [], erreur: false }
  const etendue = (de: number, a: number): Etendue => ({ de: debutLigne + de, a: debutLigne + a, ligne: numero, colonne: de + 1 })
  const signaler = (d: Diagnostic) => {
    diagnostics.push(d)
    ligne.erreur = true
  }
  const ajouter = (genre: GenreJeton, de: number, a: number, valeur: string, colle: boolean) => {
    ligne.jetons.push({ genre, texte: texte.slice(de, a), valeur, etendue: etendue(de, a), colle })
  }

  let i = 0
  let colle = false
  while (i < texte.length) {
    const c = texte[i]
    if (ESPACE.test(c)) {
      i++
      colle = false
      continue
    }
    const debut = i
    const estColle = colle && ligne.jetons.length > 0
    colle = true

    // Commentaire jusqu'à la fin de la ligne.
    if (texte.startsWith('//', i)) {
      ligne.commentaire = texte.slice(i + 2)
      break
    }

    // Retour à la ligne : ↵ ou \n hors d'une chaîne.
    if (c === '↵' || texte.startsWith('\\n', i)) {
      i += c === '↵' ? 1 : 2
      ajouter('retour', debut, i, '↵', estColle)
      const reste = texte.slice(i)
      const finInstruction = reste.trim() === '' || reste.trimStart().startsWith('//')
      if (!finInstruction) signaler(diagnostic('retour-mal-place', etendue(debut, i)))
      continue
    }

    if (DEBUT_MOT.test(c)) {
      i += 1 + (SUITE_MOT.exec(texte.slice(i + 1))?.[0].length ?? 0)
      // Apostrophe de « Jusqu'à » et de « liste d'entiers ».
      const forme = normaliser(texte.slice(debut, i))
      if ((forme === 'jusqu' || forme === 'd') && /^['’]\p{L}/u.test(texte.slice(i))) {
        i += 1
        if (forme === 'jusqu') i += SUITE_MOT.exec(texte.slice(i))?.[0].length ?? 0
      }
      ajouter('mot', debut, i, normaliser(texte.slice(debut, i)), estColle)
      // Le reste de la ligne « Algorithme … » est le nom, saisi librement.
      if (ligne.jetons.length === 1 && ligne.jetons[0].valeur === 'algorithme') {
        const reste = texte.slice(i)
        const posCommentaire = reste.indexOf('//')
        const nom = posCommentaire >= 0 ? reste.slice(0, posCommentaire) : reste
        const decalage = nom.length - nom.trimStart().length
        if (nom.trim() !== '') {
          const de = i + decalage
          ajouter('texteLibre', de, de + nom.trim().length, nom.trim(), false)
        }
        if (posCommentaire >= 0) ligne.commentaire = reste.slice(posCommentaire + 2)
        break
      }
      continue
    }

    const nombre = NOMBRE.exec(texte.slice(i))
    if (nombre) {
      i += nombre[0].length
      const reel = nombre[1] !== undefined || nombre[2] !== undefined
      ajouter(reel ? 'reel' : 'entier', debut, i, nombre[0], estColle)
      // « 2x » : il manque un opérateur.
      if (i < texte.length && DEBUT_MOT.test(texte[i])) {
        const fin = i + 1 + (SUITE_MOT.exec(texte.slice(i + 1))?.[0].length ?? 0)
        signaler(diagnostic('nombre-colle', etendue(debut, fin), nombre[0], texte.slice(i, fin)))
        i = fin
      }
      continue
    }

    if (c === '"' || c === "'") {
      let valeur = ''
      let j = i + 1
      let ferme = false
      while (j < texte.length) {
        const d = texte[j]
        if (d === c) {
          ferme = true
          j++
          break
        }
        if (d === '\\' && j + 1 < texte.length) {
          const suite = texte[j + 1]
          if (suite in ECHAPPEMENTS) {
            valeur += ECHAPPEMENTS[suite]
          } else {
            signaler(diagnostic('echappement-inconnu', etendue(j, j + 2), '\\' + suite))
            valeur += suite
          }
          j += 2
          continue
        }
        valeur += d
        j++
      }
      if (!ferme) signaler(diagnostic('chaine-non-fermee', etendue(debut, j)))
      i = j
      ajouter('chaine', debut, i, valeur, estColle)
      continue
    }

    const double = texte.slice(i, i + 2)
    if (double in SYMBOLES_DOUBLES) {
      i += 2
      ajouter('symbole', debut, i, SYMBOLES_DOUBLES[double], estColle)
      continue
    }
    if (double in SYMBOLES_ETRANGERS) {
      i += 2
      signaler(diagnostic('symbole-etranger', etendue(debut, i), double, SYMBOLES_ETRANGERS[double]))
      continue
    }
    if (SYMBOLES_SIMPLES.has(c)) {
      i++
      ajouter('symbole', debut, i, c, estColle)
      continue
    }

    i++
    if (c in SYMBOLES_ETRANGERS) {
      signaler(diagnostic('symbole-etranger', etendue(debut, i), c, SYMBOLES_ETRANGERS[c]))
    } else if (c === '²' || c === '³') {
      const precedent = ligne.jetons.at(-1)
      const base = precedent && estColle ? precedent.texte : 'x'
      signaler(diagnostic('exposant-unicode', etendue(debut, i), c, `${base}^${c === '²' ? 2 : 3}`))
    } else if (c === ';') {
      signaler(diagnostic('point-virgule', etendue(debut, i)))
    } else if (c === '.' && estColle && /^\p{L}/u.test(texte.slice(i))) {
      signaler(diagnostic('notation-pointee', etendue(debut, i)))
    } else {
      signaler(diagnostic('caractere-inconnu', etendue(debut, i), c))
    }
  }
  return ligne
}
