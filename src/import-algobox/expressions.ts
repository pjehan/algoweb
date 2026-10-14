/**
 * Analyse des expressions AlgoBox, qui suivent la syntaxe JavaScript avec
 * `ET` et `OU` en plus (PLAN.md, section 5.1). L'arbre produit sert ensuite
 * à la conversion ; une expression illisible est conservée telle quelle.
 */

export type OperateurAB =
  | '||' | '&&' | '|' | '^' | '&'
  | '==' | '!=' | '===' | '!=='
  | '<' | '<=' | '>' | '>='
  | '+' | '-' | '*' | '/' | '%'

export type ExpressionAB =
  | { g: 'nombre'; texte: string; entier: boolean }
  | { g: 'chaine'; valeur: string }
  | { g: 'booleen'; valeur: boolean }
  | { g: 'nom'; nom: string }
  | { g: 'membre'; objet: ExpressionAB; nom: string }
  | { g: 'appel'; fonction: ExpressionAB; arguments: ExpressionAB[] }
  | { g: 'indice'; objet: ExpressionAB; indice: ExpressionAB }
  | { g: 'unaire'; op: '-' | '+' | '!'; operande: ExpressionAB }
  | { g: 'binaire'; op: OperateurAB; gauche: ExpressionAB; droite: ExpressionAB }

type Jeton =
  | { g: 'nombre'; texte: string; entier: boolean }
  | { g: 'chaine'; valeur: string }
  | { g: 'nom'; nom: string }
  | { g: 'symbole'; s: string }

export class ErreurExpression extends Error {}

const SYMBOLES = ['===', '!==', '==', '!=', '<=', '>=', '&&', '||', '<', '>', '+', '-', '*', '/', '%', '^', '&', '|', '!', '(', ')', '[', ']', ',', '.']

function decouper(texte: string): Jeton[] {
  const jetons: Jeton[] = []
  let i = 0
  while (i < texte.length) {
    const c = texte[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    const nombre = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(texte.slice(i))
    if (nombre) {
      jetons.push({ g: 'nombre', texte: nombre[0], entier: /^\d+$/.test(nombre[0]) })
      i += nombre[0].length
      continue
    }
    const nom = /^[\p{L}_$][\p{L}\p{Nd}_$]*/u.exec(texte.slice(i))
    if (nom) {
      jetons.push({ g: 'nom', nom: nom[0] })
      i += nom[0].length
      continue
    }
    if (c === '"' || c === "'") {
      let valeur = ''
      let k = i + 1
      for (;;) {
        if (k >= texte.length) throw new ErreurExpression('chaîne non fermée')
        const d = texte[k]
        if (d === c) break
        if (d === '\\' && k + 1 < texte.length) {
          const e = texte[k + 1]
          valeur += e === 'n' ? '\n' : e === 't' ? '\t' : e
          k += 2
        } else {
          valeur += d
          k++
        }
      }
      jetons.push({ g: 'chaine', valeur })
      i = k + 1
      continue
    }
    const symbole = SYMBOLES.find((s) => texte.startsWith(s, i))
    if (!symbole) throw new ErreurExpression(`caractère inattendu : ${c}`)
    jetons.push({ g: 'symbole', s: symbole })
    i += symbole.length
  }
  return jetons
}

/** Niveaux binaires de JavaScript, du moins au plus prioritaire. */
const NIVEAUX: OperateurAB[][] = [
  ['||'],
  ['&&'],
  ['|'],
  ['^'],
  ['&'],
  ['==', '!=', '===', '!=='],
  ['<', '<=', '>', '>='],
  ['+', '-'],
  ['*', '/', '%'],
]

/** Analyse une expression AlgoBox ; lève ErreurExpression si elle est illisible. */
export function analyserExpressionAB(texte: string): ExpressionAB {
  const jetons = decouper(texte)
  let k = 0

  const symbole = (s: string): boolean => {
    const j = jetons[k]
    return j !== undefined && j.g === 'symbole' && j.s === s
  }
  /** `ET` et `OU` d'AlgoBox, en majuscules, valent `&&` et `||`. */
  const operateur = (): OperateurAB | undefined => {
    const j = jetons[k]
    if (!j) return undefined
    if (j.g === 'nom') return j.nom === 'ET' ? '&&' : j.nom === 'OU' ? '||' : undefined
    return j.g === 'symbole' ? (j.s as OperateurAB) : undefined
  }
  const attendre = (s: string) => {
    if (!symbole(s)) throw new ErreurExpression(`« ${s} » attendu`)
    k++
  }

  const binaire = (niveau: number): ExpressionAB => {
    if (niveau === NIVEAUX.length) return unaire()
    let gauche = binaire(niveau + 1)
    for (;;) {
      const op = operateur()
      if (!op || !NIVEAUX[niveau].includes(op)) return gauche
      k++
      gauche = { g: 'binaire', op, gauche, droite: binaire(niveau + 1) }
    }
  }

  const unaire = (): ExpressionAB => {
    for (const op of ['-', '+', '!'] as const) {
      if (symbole(op)) {
        k++
        return { g: 'unaire', op, operande: unaire() }
      }
    }
    return postfixe()
  }

  const postfixe = (): ExpressionAB => {
    let e = primaire()
    for (;;) {
      if (symbole('(')) {
        k++
        const args: ExpressionAB[] = []
        if (!symbole(')')) {
          args.push(binaire(0))
          while (symbole(',')) {
            k++
            args.push(binaire(0))
          }
        }
        attendre(')')
        e = { g: 'appel', fonction: e, arguments: args }
      } else if (symbole('[')) {
        k++
        const indice = binaire(0)
        attendre(']')
        e = { g: 'indice', objet: e, indice }
      } else if (symbole('.')) {
        k++
        const j = jetons[k]
        if (j?.g !== 'nom') throw new ErreurExpression('nom attendu après « . »')
        k++
        e = { g: 'membre', objet: e, nom: j.nom }
      } else return e
    }
  }

  const primaire = (): ExpressionAB => {
    const j = jetons[k]
    if (!j) throw new ErreurExpression('expression incomplète')
    k++
    switch (j.g) {
      case 'nombre':
        return j
      case 'chaine':
        return j
      case 'nom':
        if (j.nom === 'true' || j.nom === 'false') return { g: 'booleen', valeur: j.nom === 'true' }
        return j
      case 'symbole':
        if (j.s === '(') {
          const e = binaire(0)
          attendre(')')
          return e
        }
        throw new ErreurExpression(`« ${j.s} » inattendu`)
    }
  }

  const e = binaire(0)
  if (k < jetons.length) throw new ErreurExpression('fin d’expression attendue')
  return e
}

/** Découpe `texte` sur `separateur`, hors chaînes, parenthèses et crochets. */
export function decouperHorsGroupes(texte: string, separateur: string): string[] {
  const morceaux: string[] = []
  let profondeur = 0
  let guillemet: string | undefined
  let debut = 0
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]
    if (guillemet) {
      if (c === '\\') i++
      else if (c === guillemet) guillemet = undefined
    } else if (c === '"' || c === "'") guillemet = c
    else if (c === '(' || c === '[') profondeur++
    else if (c === ')' || c === ']') profondeur--
    else if (c === separateur && profondeur === 0) {
      morceaux.push(texte.slice(debut, i))
      debut = i + 1
    }
  }
  morceaux.push(texte.slice(debut))
  return morceaux
}
