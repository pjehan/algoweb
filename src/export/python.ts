import type {
  Appel,
  Commentaire,
  Corps,
  Expression,
  Instruction,
  LigneDeclarations,
  LigneInvalide,
  LigneVide,
  Programme,
  SousProgramme,
} from '../langage/ast.ts'
import { formaterExpression, texteChaine } from '../langage/formateur.ts'
import { predefiniPython } from '../langage/predefinis.ts'
import { depuisDeclare, T, type Type } from '../langage/types.ts'
import type { ResultatVerification } from '../langage/verification.ts'

/**
 * Export d'un algorithme vérifié en Python 3.10 ou plus récent (PLAN.md,
 * section 6). Les conversions implicites d'entier en réel sont rendues
 * explicites, pour que le programme exporté affiche exactement les mêmes
 * valeurs qu'AlgoWeb.
 */

export interface OptionsExportPython {
  /** Nom de l'algorithme ; à défaut, celui de la ligne `Algorithme`. */
  nom?: string
  description?: string
  /** Date d'export, rappelée dans l'en-tête. */
  date?: Date
  /** Graine de l'aléatoire : produit `seed(n)` si le programme tire des nombres au hasard. */
  graine?: bigint | null
}

const INDENTATION = '    '

export function exporterPython(programme: Programme, verification: ResultatVerification, options: OptionsExportPython = {}): string {
  return new ExporteurPython(programme, verification, options).exporter()
}

// ---------------------------------------------------------------- Priorités (identiques à celles de Python)

const P = { ou: 1, et: 2, non: 3, comparaison: 4, additif: 5, multiplicatif: 6, unaire: 7, puissance: 8, postfixe: 9, atome: 10 } as const

const BINAIRES = {
  ou: ['or', P.ou],
  et: ['and', P.et],
  '+': ['+', P.additif],
  '-': ['-', P.additif],
  '*': ['*', P.multiplicatif],
  '/': ['/', P.multiplicatif],
  div: ['//', P.multiplicatif],
  mod: ['%', P.multiplicatif],
  '^': ['**', P.puissance],
} as const

const COMPARAISONS = { '=': '==', '≠': '!=', '<': '<', '≤': '<=', '>': '>', '≥': '>=', dans: 'in' } as const

function priorite(e: Expression): number {
  switch (e.genre) {
    case 'Binaire':
      return BINAIRES[e.operateur][1]
    case 'Comparaison':
      return P.comparaison
    case 'Unaire':
      return e.operateur === 'non' ? P.non : P.unaire
    case 'Appel':
    case 'Indice':
    case 'Tranche':
      return P.postfixe
    default:
      return P.atome
  }
}

export function annotation(t: Type): string {
  switch (t.genre) {
    case 'entier':
      return 'int'
    case 'reel':
      return 'float'
    case 'chaine':
      return 'str'
    case 'booleen':
      return 'bool'
    case 'liste':
      return t.element.genre === 'quelconque' ? 'list' : `list[${annotation(t.element)}]`
    default:
      return 'object'
  }
}

/** Valeur d'un entier écrit tel quel (`3`, `-2`), sinon `undefined`. */
function entierLitteral(e: Expression): bigint | undefined {
  if (e.parentheses) return undefined
  if (e.genre === 'Entier') return e.valeur
  if (e.genre === 'Unaire' && e.operateur === '-' && !e.operande.parentheses && e.operande.genre === 'Entier') return -e.operande.valeur
  return undefined
}

class ExporteurPython {
  private readonly programme: Programme
  private readonly verification: ResultatVerification
  private readonly options: OptionsExportPython
  private readonly lignes: string[] = []
  private typeRetour: Type = T.rien
  private porteeCourante: Map<string, { type: Type }> | undefined

  constructor(programme: Programme, verification: ResultatVerification, options: OptionsExportPython) {
    this.programme = programme
    this.verification = verification
    this.options = options
  }

  private type(e: Expression): Type {
    return this.verification.types.get(e.id) ?? T.quelconque
  }

  private ligne(niveau: number, texte: string, commentaire?: string): void {
    this.lignes.push(INDENTATION.repeat(niveau) + texte + (commentaire === undefined ? '' : `  ${commentairePython(commentaire)}`))
  }

  exporter(): string {
    const elements = this.programme.elements
    const entete = elements.find((e) => e.genre === 'EnTete')
    const nom = this.options.nom ?? entete?.nom
    this.lignes.push(nom ? `# Algorithme ${nom} (exporté par AlgoWeb)` : '# Algorithme exporté par AlgoWeb')
    for (const l of (this.options.description ?? '').split('\n')) if (l.trim() !== '') this.lignes.push(`# ${l.trim()}`)
    if (this.options.date) this.lignes.push(`# Exporté le ${this.options.date.toLocaleDateString('fr-FR')}`)

    const { math, random } = this.importations()
    if (this.options.graine !== undefined && this.options.graine !== null && random.size > 0) random.add('seed')
    if (math.size > 0 || random.size > 0) this.lignes.push('')
    if (math.size > 0) this.lignes.push(`from math import ${[...math].sort().join(', ')}`)
    if (random.size > 0) this.lignes.push(`from random import ${[...random].sort().join(', ')}`)
    if (random.has('seed')) {
      this.lignes.push('')
      this.lignes.push(`seed(${this.options.graine})`)
    }

    // Les commentaires de premier niveau précèdent l'élément qui les suit ; l'espacement suit PEP 8.
    let commentaires: string[] = []
    for (const e of elements) {
      switch (e.genre) {
        case 'Commentaire':
          commentaires.push(commentairePython(e.texte))
          break
        case 'Fonction':
        case 'Procedure':
          this.lignes.push('', '', ...commentaires)
          commentaires = []
          this.sousProgramme(e)
          break
        case 'Principal':
          this.lignes.push('', '', ...commentaires)
          commentaires = []
          this.typeRetour = T.rien
          this.corps(e.corps, 0, this.verification.portees.get(null))
          break
        default:
          break
      }
    }
    if (commentaires.length > 0) this.lignes.push('', ...commentaires)
    return this.lignes.join('\n').replace(/\n+$/, '') + '\n'
  }

  /** Fonctions des modules math et random utilisées par le programme. */
  private importations(): { math: Set<string>; random: Set<string> } {
    const math = new Set<string>()
    const random = new Set<string>()
    const noter = (nom: string) => {
      const p = predefiniPython(nom)
      if (p?.module === 'math') math.add(p.python)
      if (p?.module === 'random') random.add(p.python)
    }
    const visiter = (valeur: unknown): void => {
      if (Array.isArray(valeur)) {
        for (const v of valeur) visiter(v)
      } else if (valeur && typeof valeur === 'object') {
        const noeud = valeur as { genre?: string; nom?: string }
        if (noeud.genre === 'Appel' || noeud.genre === 'Identifiant') noter(noeud.nom!)
        for (const v of Object.values(valeur)) visiter(v)
      }
    }
    visiter(this.programme.elements)
    return { math, random }
  }

  private sousProgramme(sp: SousProgramme): void {
    const info = this.verification.sousProgrammes.get(sp.nom)!
    this.typeRetour = info.retour
    const parametres = sp.parametres.map((p) => `${p.nom}: ${annotation(depuisDeclare(p.type))}`).join(', ')
    const retour = sp.genre === 'Fonction' ? annotation(info.retour) : 'None'
    for (const l of sp.corps.preambule) if (l.genre === 'Commentaire') this.lignes.push(commentairePython(l.texte))
    this.ligne(0, `def ${sp.nom}(${parametres}) -> ${retour}:`, sp.commentaire)
    this.corps(sp.corps, 1, this.verification.portees.get(sp.nom))
  }

  /** Déclarations (annotations sans valeur) puis instructions. */
  private corps(corps: Corps, niveau: number, portee: Map<string, { type: Type; parametre: boolean }> | undefined): void {
    this.porteeCourante = portee
    const debut = this.lignes.length
    for (const l of corps.variables?.lignes ?? []) this.declaration(l, niveau, portee)
    for (const i of corps.instructions) this.instruction(i, niveau)
    const contenu = this.lignes.slice(debut).some((l) => l.trim() !== '' && !l.trim().startsWith('#'))
    if (!contenu && niveau > 0) this.ligne(niveau, 'pass')
  }

  private declaration(l: LigneDeclarations, niveau: number, portee: Map<string, { type: Type }> | undefined): void {
    if (l.genre !== 'Declaration') {
      this.simple(l, niveau)
      return
    }
    l.noms.forEach(({ nom }, k) => {
      const type = portee?.get(nom)?.type ?? depuisDeclare(l.type)
      this.ligne(niveau, `${nom}: ${annotation(type)}`, k === l.noms.length - 1 ? l.commentaire : undefined)
    })
  }

  private simple(l: Commentaire | LigneVide | LigneInvalide, niveau: number): void {
    if (l.genre === 'LigneVide') this.lignes.push('')
    else if (l.genre === 'Commentaire') this.ligne(niveau, commentairePython(l.texte))
  }

  /** Bloc d'instructions ; `pass` s'il ne contient aucune instruction. */
  private bloc(instructions: Instruction[], niveau: number): void {
    for (const i of instructions) this.instruction(i, niveau)
    const vide = instructions.every((i) => i.genre === 'Commentaire' || i.genre === 'LigneVide' || i.genre === 'LigneInvalide')
    if (vide && niveau > 0) this.ligne(niveau, 'pass')
  }

  // ------------------------------------------------------------ Instructions

  private instruction(i: Instruction, n: number): void {
    switch (i.genre) {
      case 'Commentaire':
      case 'LigneVide':
      case 'LigneInvalide':
        this.simple(i, n)
        return
      case 'Affectation': {
        const cible = i.cible.genre === 'Identifiant' ? this.typeVariable(i.cible.nom) : this.type(i.cible)
        this.ligne(n, `${this.expr(i.cible)} = ${this.convertir(i.valeur, cible)}`, i.commentaire)
        return
      }
      case 'Lire':
        i.cibles.forEach((cible, k) => {
          const type = cible.genre === 'Identifiant' ? this.typeVariable(cible.nom) : this.type(cible)
          const invite = texteChaine(`${formaterExpression(cible, 'python')} = `)
          const lecture =
            type.genre === 'entier'
              ? `int(input(${invite}))`
              : type.genre === 'reel'
                ? `float(input(${invite}))`
                : type.genre === 'booleen'
                  ? `input(${invite}) == "vrai"`
                  : `input(${invite})`
          this.ligne(n, `${this.expr(cible)} = ${lecture}`, k === i.cibles.length - 1 ? i.commentaire : undefined)
        })
        return
      case 'Afficher': {
        const valeurs = i.valeurs.map((v) => this.expr(v))
        if (!i.retourLigne) valeurs.push('end=""')
        this.ligne(n, `print(${valeurs.join(', ')})`, i.commentaire)
        return
      }
      case 'Si':
        i.branches.forEach((b, k) => {
          this.ligne(n, `${k === 0 ? 'if' : 'elif'} ${this.expr(b.condition)}:`, b.commentaire)
          this.bloc(b.corps, n + 1)
        })
        if (i.sinon) {
          this.ligne(n, 'else:', i.sinon.commentaire)
          this.bloc(i.sinon.corps, n + 1)
        }
        this.fermeture(i.fermeture?.commentaire, n)
        return
      case 'Pour':
        this.ligne(n, `for ${i.compteur.nom} in ${this.intervalle(i.debut, i.fin, i.pas)}:`, i.commentaire)
        this.bloc(i.corps, n + 1)
        this.fermeture(i.fermeture?.commentaire, n)
        return
      case 'PourChaque': {
        const collection = this.type(i.collection)
        const element = collection.genre === 'liste' ? collection.element : collection.genre === 'chaine' ? T.chaine : T.quelconque
        const cible = this.typeVariable(i.variable.nom)
        const conversion = cible.genre === 'reel' && element.genre !== 'reel'
        const iterable = conversion ? `map(float, ${this.expr(i.collection)})` : this.expr(i.collection)
        this.ligne(n, `for ${i.variable.nom} in ${iterable}:`, i.commentaire)
        this.bloc(i.corps, n + 1)
        this.fermeture(i.fermeture?.commentaire, n)
        return
      }
      case 'TantQue':
        this.ligne(n, `while ${this.expr(i.condition)}:`, i.commentaire)
        this.bloc(i.corps, n + 1)
        this.fermeture(i.fermeture?.commentaire, n)
        return
      case 'Repeter':
        this.ligne(n, 'while True:', i.commentaire)
        for (const x of i.corps) this.instruction(x, n + 1)
        this.ligne(n + 1, `if ${this.expr(i.condition!)}:`, i.fermeture?.commentaire)
        this.ligne(n + 2, 'break')
        return
      case 'AppelProcedure':
        this.ligne(n, this.appelInstruction(i.appel), i.commentaire)
        return
      case 'Retourner':
        this.ligne(n, i.valeur ? `return ${this.convertir(i.valeur, this.typeRetour)}` : 'return', i.commentaire)
        return
      case 'Pause':
        this.ligne(n, 'input("Pause : appuyez sur Entrée")', i.commentaire)
        return
    }
  }

  /** Commentaire placé sur la ligne fermante d'un bloc (`FinSi // …`). */
  private fermeture(commentaire: string | undefined, niveau: number): void {
    if (commentaire !== undefined) this.ligne(niveau, commentairePython(commentaire))
  }

  /** Type déclaré d'une variable du corps en cours d'export. */
  private typeVariable(nom: string): Type {
    return this.porteeCourante?.get(nom)?.type ?? T.quelconque
  }

  /** `range(…)` équivalent à `Pour … de debut à fin [pas de p]`. */
  private intervalle(debut: Expression, fin: Expression, pas?: Expression): string {
    const d = this.expr(debut)
    const p = pas ? entierLitteral(pas) : 1n
    if (pas && p === undefined) {
      const textePas = this.sous(pas, P.comparaison + 1)
      return `range(${d}, ${this.sous(fin, P.additif)} + (1 if ${textePas} > 0 else -1), ${this.expr(pas)})`
    }
    const decalage = p! > 0n ? 1n : -1n
    const f = this.finDecalee(fin, decalage)
    return pas ? `range(${d}, ${f}, ${this.expr(pas)})` : `range(${d}, ${f})`
  }

  /** `fin + decalage`, simplifié : `10` donne `11`, `n - 1` donne `n`. */
  private finDecalee(fin: Expression, decalage: bigint): string {
    const valeur = entierLitteral(fin)
    if (valeur !== undefined) return String(valeur + decalage)
    if (fin.genre === 'Binaire' && !fin.parentheses && (fin.operateur === '+' || fin.operateur === '-')) {
      const k = entierLitteral(fin.droite)
      if (k !== undefined && k > 0n) {
        const total = (fin.operateur === '+' ? k : -k) + decalage
        const gauche = this.sous(fin.gauche, P.additif)
        if (total === 0n) return gauche
        return `${gauche} ${total > 0n ? '+' : '-'} ${total > 0n ? total : -total}`
      }
    }
    return `${this.sous(fin, P.additif)} ${decalage > 0n ? '+' : '-'} 1`
  }

  private appelInstruction(appel: Appel): string {
    const [liste, ...autres] = appel.arguments
    const element = (): Type => {
      const t = this.type(liste)
      return t.genre === 'liste' ? t.element : T.quelconque
    }
    switch (appel.nom) {
      case 'ajouter':
        return `${this.sous(liste, P.postfixe)}.append(${this.convertir(autres[0], element())})`
      case 'insérer':
        return `${this.sous(liste, P.postfixe)}.insert(${this.expr(autres[0])}, ${this.convertir(autres[1], element())})`
      case 'supprimer':
        return `del ${this.sous(liste, P.postfixe)}[${this.expr(autres[0])}]`
      default:
        return this.expr(appel)
    }
  }

  // ------------------------------------------------------------ Expressions

  /** Texte de `e`, converti en réel si le contexte attend un réel et que `e` n'en est pas un. */
  private convertir(e: Expression, cible: Type): string {
    const source = this.type(e)
    if (cible.genre === 'reel' && source.genre !== 'reel') {
      const n = entierLitteral(e)
      if (n !== undefined) return `${n}.0`
      return `float(${this.expr(e)})`
    }
    return this.expr(e)
  }

  private sous(e: Expression, minimum: number): string {
    const texte = this.expr(e)
    return !e.parentheses && priorite(e) < minimum ? `(${texte})` : texte
  }

  private expr(e: Expression): string {
    const texte = this.exprNue(e)
    return e.parentheses ? `(${texte})` : texte
  }

  private exprNue(e: Expression): string {
    switch (e.genre) {
      case 'Entier':
        return e.valeur.toString()
      case 'Reel':
        return e.texte
      case 'Chaine':
        return texteChaine(e.valeur)
      case 'Booleen':
        return e.valeur ? 'True' : 'False'
      case 'Liste': {
        const t = this.type(e)
        const element = t.genre === 'liste' ? t.element : T.quelconque
        return `[${e.elements.map((x) => this.convertir(x, element)).join(', ')}]`
      }
      case 'Identifiant':
        return e.nom
      case 'Unaire':
        return e.operateur === 'non' ? `not ${this.sous(e.operande, P.non)}` : `-${this.sous(e.operande, P.unaire)}`
      case 'Binaire': {
        const [op, p] = BINAIRES[e.operateur]
        if (e.operateur === '^') return `${this.sous(e.gauche, P.postfixe)} ** ${this.sous(e.droite, P.unaire)}`
        return `${this.sous(e.gauche, p)} ${op} ${this.sous(e.droite, p + 1)}`
      }
      case 'Comparaison':
        return e.operandes.map((o, k) => (k === 0 ? '' : ` ${COMPARAISONS[e.operateurs[k - 1]]} `) + this.sous(o, P.additif)).join('')
      case 'Appel': {
        const sp = this.verification.sousProgrammes.get(e.nom)
        const args = e.arguments.map((x, k) => (sp ? this.convertir(x, sp.parametres[k].type) : this.expr(x)))
        return `${e.nom}(${args.join(', ')})`
      }
      case 'Indice':
        return `${this.sous(e.objet, P.postfixe)}[${this.expr(e.indice)}]`
      case 'Tranche':
        return `${this.sous(e.objet, P.postfixe)}[${e.debut ? this.expr(e.debut) : ''}:${e.fin ? this.expr(e.fin) : ''}]`
      case 'ExpressionInvalide':
        throw new Error('Expression invalide : le programme doit être vérifié avant l’export.')
    }
  }
}

/** `// texte` devient `# texte`. */
function commentairePython(texte: string): string {
  return texte.startsWith(' ') || texte === '' ? `#${texte}` : `# ${texte}`
}
