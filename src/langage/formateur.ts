import type {
  Corps,
  ElementProgramme,
  Expression,
  Instruction,
  LigneDeclarations,
  Programme,
  TypeDeclare,
} from './ast.ts'
import { nomAffiche, type Notation } from './predefinis.ts'
import { depuisDeclare, texteType } from './types.ts'

/**
 * Formateur : produit le texte canonique d'un programme. Il est stable :
 * analyser puis formater un texte déjà formaté le laisse inchangé.
 */

export interface OptionsFormatage {
  /** Notation des fonctions prédéfinies. Le texte enregistré utilise toujours `python`. */
  notation: Notation
}

const INDENTATION = '  '

export function formater(programme: Programme, options: OptionsFormatage = { notation: 'python' }): string {
  const f = new Formateur(options)
  for (const element of programme.elements) f.element(element)
  return f.lignes.join('\n') + '\n'
}

export function formaterType(type: TypeDeclare): string {
  return texteType(depuisDeclare(type))
}

/** Échappe une chaîne et l'entoure de guillemets droits. */
export function texteChaine(valeur: string): string {
  const echappee = valeur
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
  return `"${echappee}"`
}

// ---------------------------------------------------------------- Précédences

/** Niveaux de priorité, du moins au plus prioritaire (PLAN.md, section 4.6). */
const P = {
  ou: 1,
  et: 2,
  non: 3,
  comparaison: 4,
  additif: 5,
  multiplicatif: 6,
  unaire: 7,
  puissance: 8,
  postfixe: 9,
  primaire: 10,
} as const

const PRIORITE_BINAIRE = {
  ou: P.ou,
  et: P.et,
  '+': P.additif,
  '-': P.additif,
  '*': P.multiplicatif,
  '/': P.multiplicatif,
  div: P.multiplicatif,
  mod: P.multiplicatif,
  '^': P.puissance,
} as const

function priorite(e: Expression): number {
  switch (e.genre) {
    case 'Binaire':
      return PRIORITE_BINAIRE[e.operateur]
    case 'Comparaison':
      return P.comparaison
    case 'Unaire':
      return e.operateur === 'non' ? P.non : P.unaire
    case 'Appel':
    case 'Indice':
    case 'Tranche':
      return P.postfixe
    default:
      return P.primaire
  }
}

// ---------------------------------------------------------------- Formateur

class Formateur {
  readonly lignes: string[] = []
  private readonly notation: Notation

  constructor(options: OptionsFormatage) {
    this.notation = options.notation
  }

  private ligne(niveau: number, texte: string, commentaire?: string): void {
    const suffixe = commentaire === undefined ? '' : `${texte === '' ? '' : ' '}//${commentaire}`
    this.lignes.push(INDENTATION.repeat(niveau) + texte + suffixe)
  }

  element(e: ElementProgramme): void {
    switch (e.genre) {
      case 'EnTete':
        this.ligne(0, `Algorithme ${e.nom}`, e.commentaire)
        break
      case 'Principal':
        this.corps(e.corps, 'Fin')
        break
      case 'Fonction':
      case 'Procedure': {
        const parametres = e.parametres.map((p) => `${p.nom} : ${formaterType(p.type)}`).join(', ')
        const retour = e.typeRetour ? ` : ${formaterType(e.typeRetour)}` : ''
        const motCle = e.genre === 'Fonction' ? 'Fonction' : 'Procédure'
        this.ligne(0, `${motCle} ${e.nom}(${parametres})${retour}`, e.commentaire)
        this.corps(e.corps, e.genre === 'Fonction' ? 'FinFonction' : 'FinProcédure')
        break
      }
      default:
        this.simple(0, e)
    }
  }

  private corps(corps: Corps, fermeture: string): void {
    for (const l of corps.preambule) this.simple(0, l)
    if (corps.variables) {
      this.ligne(0, 'Variables', corps.variables.commentaire)
      for (const l of corps.variables.lignes) this.declaration(l)
    }
    this.ligne(0, 'Début', corps.debut?.commentaire)
    this.bloc(1, corps.instructions)
    this.ligne(0, fermeture, corps.fin?.commentaire)
  }

  private declaration(l: LigneDeclarations): void {
    if (l.genre === 'Declaration') {
      this.ligne(1, `${l.noms.map((n) => n.nom).join(', ')} : ${formaterType(l.type)}`, l.commentaire)
    } else {
      this.simple(1, l)
    }
  }

  /** Ligne vide, commentaire ou ligne invalide. */
  private simple(niveau: number, l: { genre: 'Commentaire'; texte: string } | { genre: 'LigneVide' } | { genre: 'LigneInvalide'; texte: string }): void {
    if (l.genre === 'LigneVide') this.lignes.push('')
    else if (l.genre === 'Commentaire') this.ligne(niveau, '', l.texte)
    else this.ligne(niveau, l.texte)
  }

  private bloc(niveau: number, instructions: Instruction[]): void {
    for (const i of instructions) this.instruction(niveau, i)
  }

  private instruction(n: number, i: Instruction): void {
    switch (i.genre) {
      case 'Affectation':
        this.ligne(n, `${this.expr(i.cible)} ← ${this.expr(i.valeur)}`, i.commentaire)
        break
      case 'Lire':
        this.ligne(n, `Lire ${i.cibles.map((c) => this.expr(c)).join(', ')}`, i.commentaire)
        break
      case 'Afficher': {
        const valeurs = i.valeurs.map((v) => this.expr(v)).join(', ')
        const texte = ['Afficher', valeurs, i.retourLigne ? '↵' : ''].filter((t) => t !== '').join(' ')
        this.ligne(n, texte, i.commentaire)
        break
      }
      case 'Si':
        i.branches.forEach((b, k) => {
          this.ligne(n, `${k === 0 ? 'Si' : 'Sinon si'} ${this.expr(b.condition)} alors`, b.commentaire)
          this.bloc(n + 1, b.corps)
        })
        if (i.sinon) {
          this.ligne(n, 'Sinon', i.sinon.commentaire)
          this.bloc(n + 1, i.sinon.corps)
        }
        this.ligne(n, 'FinSi', i.fermeture?.commentaire)
        break
      case 'Pour': {
        const pas = i.pas ? ` pas de ${this.expr(i.pas)}` : ''
        this.ligne(n, `Pour ${i.compteur.nom} de ${this.expr(i.debut)} à ${this.expr(i.fin)}${pas} faire`, i.commentaire)
        this.bloc(n + 1, i.corps)
        this.ligne(n, 'FinPour', i.fermeture?.commentaire)
        break
      }
      case 'PourChaque':
        this.ligne(n, `Pour chaque ${i.variable.nom} dans ${this.expr(i.collection)} faire`, i.commentaire)
        this.bloc(n + 1, i.corps)
        this.ligne(n, 'FinPour', i.fermeture?.commentaire)
        break
      case 'TantQue':
        this.ligne(n, `TantQue ${this.expr(i.condition)} faire`, i.commentaire)
        this.bloc(n + 1, i.corps)
        this.ligne(n, 'FinTantQue', i.fermeture?.commentaire)
        break
      case 'Repeter':
        this.ligne(n, 'Répéter', i.commentaire)
        this.bloc(n + 1, i.corps)
        this.ligne(n, `Jusqu'à ${i.condition ? this.expr(i.condition) : ''}`.trimEnd(), i.fermeture?.commentaire)
        break
      case 'AppelProcedure':
        this.ligne(n, this.expr(i.appel), i.commentaire)
        break
      case 'Retourner':
        this.ligne(n, i.valeur ? `Retourner ${this.expr(i.valeur)}` : 'Retourner', i.commentaire)
        break
      case 'Pause':
        this.ligne(n, 'Pause', i.commentaire)
        break
      default:
        this.simple(n, i)
    }
  }

  // ------------------------------------------------------------ Expressions

  /** Formate `e`, entre parenthèses si sa priorité est inférieure à `minimum`. */
  private sous(e: Expression, minimum: number): string {
    const texte = this.expr(e)
    return !e.parentheses && priorite(e) < minimum ? `(${texte})` : texte
  }

  expr(e: Expression): string {
    const texte = this.exprNue(e)
    return e.parentheses ? `(${texte})` : texte
  }

  private exprNue(e: Expression): string {
    switch (e.genre) {
      case 'Entier':
      case 'Reel':
        return e.texte
      case 'Chaine':
        return texteChaine(e.valeur)
      case 'Booleen':
        return e.valeur ? 'vrai' : 'faux'
      case 'Liste':
        return `[${e.elements.map((x) => this.expr(x)).join(', ')}]`
      case 'Identifiant':
        return e.nom
      case 'Unaire':
        return e.operateur === 'non'
          ? `non ${this.sous(e.operande, P.non)}`
          : `-${this.sous(e.operande, P.unaire)}`
      case 'Binaire': {
        if (e.operateur === '^') return `${this.sous(e.gauche, P.postfixe)}^${this.sous(e.droite, P.unaire)}`
        const p = PRIORITE_BINAIRE[e.operateur]
        return `${this.sous(e.gauche, p)} ${e.operateur} ${this.sous(e.droite, p + 1)}`
      }
      case 'Comparaison':
        return e.operandes
          .map((o, k) => (k === 0 ? '' : ` ${e.operateurs[k - 1]} `) + this.sous(o, P.additif))
          .join('')
      case 'Appel':
        return `${nomAffiche(e.nom, this.notation, e.arguments.length)}(${e.arguments.map((a) => this.expr(a)).join(', ')})`
      case 'Indice':
        return `${this.sous(e.objet, P.postfixe)}[${this.expr(e.indice)}]`
      case 'Tranche':
        return `${this.sous(e.objet, P.postfixe)}[${e.debut ? this.expr(e.debut) : ''}:${e.fin ? this.expr(e.fin) : ''}]`
      case 'ExpressionInvalide':
        return '?'
    }
  }
}


/** Texte d'une expression, pour les messages. */
export function formaterExpression(e: Expression, notation: Notation = 'python'): string {
  return new Formateur({ notation }).expr(e)
}
