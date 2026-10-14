import type {
  Appel,
  BrancheSi,
  Commentaire,
  Corps,
  Declaration,
  ElementProgramme,
  Etendue,
  Expression,
  Identifiant,
  Indice,
  Instruction,
  LigneDeclarations,
  LigneFermante,
  LigneInvalide,
  LigneVide,
  OperateurComparaison,
  Parametre,
  Programme,
  SousProgramme,
  TypeDeclare,
} from './ast.ts'
import { analyserLexique, type Jeton, type LigneLexicale } from './lexique.ts'
import { diagnostic, type CodeDiagnostic, type Diagnostic, type MESSAGES } from './messages.ts'
import { plusProche } from './normalisation.ts'
import { estMotCle, trouverPredefini, trouverProcedurePredefinie } from './predefinis.ts'

/**
 * Analyse syntaxique : descente récursive sur les lignes, précédence
 * d'opérateurs pour les expressions. L'analyse continue après une erreur pour
 * signaler le plus de problèmes possible.
 */

export interface ResultatAnalyse {
  programme: Programme
  diagnostics: Diagnostic[]
}

export function analyser(source: string): ResultatAnalyse {
  const lexique = analyserLexique(source)
  const analyseur = new Analyseur(lexique.lignes)
  const programme = analyseur.programme()
  const diagnostics = [...lexique.diagnostics, ...analyseur.diagnostics]
  diagnostics.sort((a, b) => a.etendue.de - b.etendue.de)
  return { programme, diagnostics }
}

// ---------------------------------------------------------------- Lignes

type GenreLigne =
  | 'vide' | 'commentaire' | 'algorithme' | 'variables' | 'debut' | 'fin'
  | 'si' | 'sinonsi' | 'sinon' | 'finsi' | 'pour' | 'finpour' | 'tantque' | 'fintantque'
  | 'repeter' | 'jusqua' | 'lire' | 'afficher' | 'retourner' | 'pause'
  | 'fonction' | 'procedure' | 'finfonction' | 'finprocedure' | 'instruction'

/** Genre d'une ligne d'après ses premiers mots, et nombre de jetons du mot-clé. */
function classer(ligne: LigneLexicale): [GenreLigne, number] {
  const j = ligne.jetons
  if (j.length === 0) return [ligne.commentaire === undefined ? 'vide' : 'commentaire', 0]
  if (j[0].genre !== 'mot') return ['instruction', 0]
  const mot = (k: number) => (j[k]?.genre === 'mot' ? j[k].valeur : undefined)
  switch (j[0].valeur) {
    case 'algorithme': return ['algorithme', 1]
    case 'variables': return ['variables', 1]
    case 'debut': return ['debut', 1]
    case 'fin':
      switch (mot(1)) {
        case 'si': return ['finsi', 2]
        case 'pour': return ['finpour', 2]
        case 'tantque': return ['fintantque', 2]
        case 'tant': return mot(2) === 'que' ? ['fintantque', 3] : ['fin', 1]
        case 'fonction': return ['finfonction', 2]
        case 'procedure': return ['finprocedure', 2]
        default: return ['fin', 1]
      }
    case 'finsi': return ['finsi', 1]
    case 'finpour': return ['finpour', 1]
    case 'fintantque': return ['fintantque', 1]
    case 'finfonction': return ['finfonction', 1]
    case 'finprocedure': return ['finprocedure', 1]
    case 'si': return ['si', 1]
    case 'sinon': return mot(1) === 'si' ? ['sinonsi', 2] : ['sinon', 1]
    case 'sinonsi': return ['sinonsi', 1]
    case 'pour': return ['pour', 1]
    case 'tantque': return ['tantque', 1]
    case 'tant': return mot(1) === 'que' ? ['tantque', 2] : ['instruction', 0]
    case 'repeter': return ['repeter', 1]
    case "jusqu'a": return ['jusqua', 1]
    case 'lire':
    case 'saisir': return ['lire', 1]
    case 'afficher':
    case 'ecrire': return ['afficher', 1]
    case 'retourner':
    case 'renvoyer': return ['retourner', 1]
    case 'pause': return ['pause', 1]
    case 'fonction': return ['fonction', 1]
    case 'procedure': return ['procedure', 1]
    default: return ['instruction', 0]
  }
}

const MOTS_INSTRUCTIONS = ['Afficher', 'Lire', 'Si', 'Sinon', 'Pour', 'TantQue', 'Répéter', 'Retourner', 'Pause', 'Fonction', 'Procédure']

/** Lignes qui interrompent un bloc d'instructions. */
const TERMINATEURS = new Set<GenreLigne>([
  'fin', 'finsi', 'sinon', 'sinonsi', 'finpour', 'fintantque', 'jusqua',
  'finfonction', 'finprocedure', 'fonction', 'procedure', 'debut', 'algorithme',
])

/** Nom canonique d'une ligne fermante, et structure qu'elle ferme. */
const FERMETURES: Partial<Record<GenreLigne, [string, string]>> = {
  fin: ['Fin', 'Début'],
  finsi: ['FinSi', 'Si'],
  sinon: ['Sinon', 'Si'],
  sinonsi: ['Sinon si', 'Si'],
  finpour: ['FinPour', 'Pour'],
  fintantque: ['FinTantQue', 'TantQue'],
  jusqua: ['Jusqu’à', 'Répéter'],
  finfonction: ['FinFonction', 'Fonction'],
  finprocedure: ['FinProcédure', 'Procédure'],
  debut: ['Début', 'algorithme principal'],
}

// ---------------------------------------------------------------- Erreurs

class ErreurSyntaxe extends Error {
  readonly diagnostic: Diagnostic
  constructor(d: Diagnostic) {
    super(d.message)
    this.diagnostic = d
  }
}

function erreur<C extends CodeDiagnostic>(
  code: C,
  etendue: Etendue,
  ...args: Parameters<(typeof MESSAGES)[C]>
): ErreurSyntaxe {
  return new ErreurSyntaxe(diagnostic(code, etendue, ...args))
}

function couvrir(debut: Etendue, fin: Etendue): Etendue {
  return { de: debut.de, a: fin.a, ligne: debut.ligne, colonne: debut.colonne }
}

// ---------------------------------------------------------------- Curseur dans une ligne

class Curseur {
  i: number
  readonly ligne: LigneLexicale
  constructor(ligne: LigneLexicale, i: number) {
    this.ligne = ligne
    this.i = i
  }
  get courant(): Jeton | undefined {
    return this.ligne.jetons[this.i]
  }
  get precedent(): Jeton | undefined {
    return this.ligne.jetons[this.i - 1]
  }
  fini(): boolean {
    return this.i >= this.ligne.jetons.length
  }
  avancer(): Jeton {
    return this.ligne.jetons[this.i++]
  }
  estSymbole(...symboles: string[]): boolean {
    const j = this.courant
    return j?.genre === 'symbole' && symboles.includes(j.valeur)
  }
  estMot(...mots: string[]): boolean {
    const j = this.courant
    return j?.genre === 'mot' && mots.includes(j.valeur)
  }
  /** Étendue du jeton courant, ou de la fin de la ligne. */
  ici(): Etendue {
    const j = this.courant
    if (j) return j.etendue
    const l = this.ligne
    return { de: l.a, a: l.a, ligne: l.numero, colonne: l.a - l.de + 1 }
  }
  /** Étendue du reste de la ligne. */
  reste(): Etendue {
    const premier = this.courant!.etendue
    return couvrir(premier, this.ligne.jetons.at(-1)!.etendue)
  }
  texteRestant(): string {
    const j = this.ligne.jetons
    return this.ligne.texte.slice(j[this.i].etendue.de - this.ligne.de, j.at(-1)!.etendue.a - this.ligne.de)
  }
}

// ---------------------------------------------------------------- Analyseur

class Analyseur {
  readonly diagnostics: Diagnostic[] = []
  private readonly lignes: LigneLexicale[]
  private pos = 0
  private prochainId = 1
  /** Genres de lignes fermantes attendus par les blocs ouverts. */
  private readonly pile: Set<GenreLigne>[] = []

  constructor(lignes: LigneLexicale[]) {
    // Une dernière ligne vide (texte terminé par un saut de ligne) n'est pas une ligne de l'algorithme.
    if (lignes.length > 1 && lignes.at(-1)!.texte.trim() === '') lignes = lignes.slice(0, -1)
    this.lignes = lignes
  }

  private id(): number {
    return this.prochainId++
  }

  private signaler(d: Diagnostic): void {
    // Une ligne déjà signalée par l'analyse lexicale ne produit pas d'erreur de syntaxe supplémentaire.
    const ligne = this.lignes[d.etendue.ligne - 1]
    if (ligne?.erreur) return
    this.diagnostics.push(d)
  }

  private get ligne(): LigneLexicale | undefined {
    return this.lignes[this.pos]
  }

  private genre(): GenreLigne | undefined {
    const l = this.ligne
    return l && classer(l)[0]
  }

  private etendueLigne(l: LigneLexicale): Etendue {
    const j = l.jetons
    if (j.length === 0) return { de: l.de, a: l.a, ligne: l.numero, colonne: 1 }
    return couvrir(j[0].etendue, j.at(-1)!.etendue)
  }

  // ------------------------------------------------------------ Programme

  programme(): Programme {
    const elements: ElementProgramme[] = []
    let principal = false
    let premiereLigne = true
    this.pile.push(new Set(['fonction', 'procedure', 'variables', 'debut', 'algorithme']))
    while (this.ligne) {
      const l = this.ligne
      const genre = this.genre()!
      if (genre === 'vide' || genre === 'commentaire') {
        elements.push(this.ligneSansInstruction(l))
        this.pos++
        continue
      }
      if (genre === 'algorithme') {
        if (!premiereLigne) this.signaler(diagnostic('entete-mal-place', this.etendueLigne(l)))
        const nom = l.jetons[1]?.valeur ?? ''
        if (nom === '') this.signaler(diagnostic('entete-sans-nom', this.etendueLigne(l)))
        elements.push({ genre: 'EnTete', id: this.id(), etendue: this.etendueLigne(l), nom, commentaire: l.commentaire })
        this.pos++
      } else if (genre === 'fonction' || genre === 'procedure') {
        if (principal) this.signaler(diagnostic('texte-apres-fin', this.etendueLigne(l)))
        elements.push(this.sousProgramme(genre))
      } else if (!principal && (genre === 'variables' || genre === 'debut')) {
        const id = this.id()
        const corps = this.corps('fin', l)
        elements.push({ genre: 'Principal', id, etendue: this.etendueLigne(l), corps })
        principal = true
      } else if (principal) {
        this.signaler(diagnostic('texte-apres-fin', this.etendueLigne(l)))
        elements.push(this.ligneInvalide(l))
        this.pos++
      } else {
        // Instructions sans Début : on les analyse comme le corps de l'algorithme principal.
        this.signaler(diagnostic('debut-manquant', this.etendueLigne(l)))
        const id = this.id()
        const corps = this.corps('fin', l)
        elements.push({ genre: 'Principal', id, etendue: this.etendueLigne(l), corps })
        principal = true
      }
      premiereLigne = false
    }
    this.pile.pop()
    if (!principal) {
      const derniere = this.lignes.at(-1)!
      this.signaler(diagnostic('debut-manquant', { de: derniere.a, a: derniere.a, ligne: derniere.numero, colonne: 1 }))
    }
    return { elements }
  }

  private ligneSansInstruction(l: LigneLexicale): Commentaire | LigneVide {
    const etendue = this.etendueLigne(l)
    return l.commentaire === undefined
      ? { genre: 'LigneVide', id: this.id(), etendue }
      : { genre: 'Commentaire', id: this.id(), etendue, texte: l.commentaire }
  }

  private ligneInvalide(l: LigneLexicale): LigneInvalide {
    return { genre: 'LigneInvalide', id: this.id(), etendue: this.etendueLigne(l), texte: l.texte.trim() }
  }

  // ------------------------------------------------------------ Sous-programmes

  private sousProgramme(genre: 'fonction' | 'procedure'): SousProgramme {
    const l = this.ligne!
    const etendue = this.etendueLigne(l)
    const sp: SousProgramme = {
      genre: genre === 'fonction' ? 'Fonction' : 'Procedure',
      id: this.id(),
      etendue,
      nom: '',
      etendueNom: etendue,
      parametres: [],
      commentaire: l.commentaire,
      corps: { preambule: [], instructions: [] },
    }
    try {
      const c = new Curseur(l, 1)
      const nom = c.courant
      if (nom?.genre !== 'mot') throw erreur('entete-sous-programme', c.ici(), genre)
      c.avancer()
      sp.nom = nom.texte
      sp.etendueNom = nom.etendue
      if (!c.estSymbole('(')) throw erreur('entete-sous-programme', c.ici(), genre)
      c.avancer()
      while (!c.estSymbole(')')) {
        sp.parametres.push(this.parametre(c, genre))
        if (c.estSymbole(',')) c.avancer()
        else if (!c.estSymbole(')')) throw erreur('entete-sous-programme', c.ici(), genre)
      }
      c.avancer()
      if (c.estSymbole(':')) {
        const deuxPoints = c.avancer()
        const type = this.type(c)
        if (genre === 'procedure') {
          this.signaler(diagnostic('type-retour-procedure', couvrir(deuxPoints.etendue, c.precedent!.etendue), sp.nom))
        } else {
          sp.typeRetour = type
        }
      } else if (genre === 'fonction') {
        this.signaler(diagnostic('type-retour-manquant', etendue, sp.nom))
      }
      this.finDeLigne(c)
    } catch (e) {
      this.attraper(e)
    }
    this.pos++
    sp.corps = this.corps(genre === 'fonction' ? 'finfonction' : 'finprocedure', l)
    return sp
  }

  private parametre(c: Curseur, genre: string): Parametre {
    const nom = c.courant
    if (nom?.genre !== 'mot') throw erreur('entete-sous-programme', c.ici(), genre)
    c.avancer()
    if (!c.estSymbole(':')) throw erreur('entete-sous-programme', c.ici(), genre)
    c.avancer()
    return { nom: nom.texte, etendue: nom.etendue, type: this.type(c) }
  }

  // ------------------------------------------------------------ Corps : Variables, Début … Fin

  private corps(fermeture: 'fin' | 'finfonction' | 'finprocedure', ouverture: LigneLexicale): Corps {
    const corps: Corps = { preambule: [], instructions: [] }
    const sousProgramme = fermeture !== 'fin'
    if (sousProgramme) {
      while (this.genre() === 'vide' || this.genre() === 'commentaire') {
        corps.preambule.push(this.ligneSansInstruction(this.ligne!))
        this.pos++
      }
    }
    const fermetures = new Set<GenreLigne>(sousProgramme ? ['finfonction', 'finprocedure', 'fin'] : ['fin'])
    let debutTrouve = false

    if (this.genre() === 'variables') {
      const l = this.ligne!
      this.finDeLigne(new Curseur(l, 1), true)
      corps.variables = { etendue: this.etendueLigne(l), commentaire: l.commentaire, lignes: [] }
      this.pos++
      debutTrouve = this.declarations(corps.variables.lignes)
    }

    if (this.genre() === 'debut') {
      const l = this.ligne!
      this.finDeLigne(new Curseur(l, 1), true)
      corps.debut = { etendue: this.etendueLigne(l), commentaire: l.commentaire }
      this.pos++
      debutTrouve = true
    } else if (!debutTrouve && (sousProgramme || corps.variables)) {
      this.signaler(diagnostic('debut-manquant', this.ligne ? this.etendueLigne(this.ligne) : this.etendueLigne(ouverture)))
    }

    corps.instructions = this.bloc(fermetures)

    const genre = this.genre()
    if (genre !== undefined && fermetures.has(genre)) {
      const l = this.ligne!
      if (genre !== fermeture) {
        this.signaler(diagnostic('fin-sous-programme', this.etendueLigne(l), FERMETURES[fermeture]![0]))
      }
      corps.fin = this.ligneFermante(l, classer(l)[1])
      this.pos++
    } else {
      const structure = fermeture === 'fin' ? 'Début' : FERMETURES[fermeture]![1]
      const ligneOuverture = fermeture === 'fin' && corps.debut ? corps.debut.etendue.ligne : ouverture.numero
      this.signaler(
        diagnostic(
          'bloc-non-ferme',
          this.etendueLigne(this.lignes[ligneOuverture - 1]),
          structure,
          ligneOuverture,
          FERMETURES[fermeture]![0],
        ),
      )
    }
    return corps
  }

  /**
   * Lignes de la section Variables. Renvoie `true` si une instruction y a été
   * trouvée : l'étudiant a oublié `Début`, et la suite est analysée comme le corps.
   */
  private declarations(lignes: LigneDeclarations[]): boolean {
    while (this.ligne) {
      const l = this.ligne
      const genre = this.genre()!
      if (genre === 'vide' || genre === 'commentaire') {
        lignes.push(this.ligneSansInstruction(l))
        this.pos++
        continue
      }
      // Une déclaration se reconnaît à sa forme « nom : » ou « nom, », même si le nom est un mot-clé.
      const [premier, second] = l.jetons
      const estDeclaration = premier.genre === 'mot' && second?.genre === 'symbole' && (second.valeur === ':' || second.valeur === ',')
      if (!estDeclaration) {
        if (genre === 'instruction' || !TERMINATEURS.has(genre)) {
          this.signaler(diagnostic('instruction-dans-variables', this.etendueLigne(l)))
          return true
        }
        return false
      }
      try {
        lignes.push(this.declaration(l))
      } catch (e) {
        this.attraper(e)
        lignes.push(this.ligneInvalide(l))
      }
      this.pos++
    }
    return false
  }

  private declaration(l: LigneLexicale): Declaration {
    const c = new Curseur(l, 0)
    const noms: Declaration['noms'] = []
    for (;;) {
      const j = c.courant
      if (j?.genre !== 'mot') throw erreur('declaration-mal-formee', c.ici())
      c.avancer()
      noms.push({ nom: j.texte, etendue: j.etendue })
      if (c.estSymbole(',')) c.avancer()
      else break
    }
    if (!c.estSymbole(':')) throw erreur('declaration-mal-formee', c.ici())
    c.avancer()
    const type = this.type(c)
    this.finDeLigne(c)
    return { genre: 'Declaration', id: this.id(), etendue: this.etendueLigne(l), noms, type, commentaire: l.commentaire }
  }

  private type(c: Curseur, pluriel = false): TypeDeclare {
    const j = c.courant
    if (j?.genre !== 'mot') throw erreur('declaration-mal-formee', c.ici())
    const mot = pluriel && j.valeur.endsWith('s') ? j.valeur.slice(0, -1) : j.valeur
    c.avancer()
    switch (mot) {
      case 'entier':
      case 'reel':
      case 'chaine':
      case 'booleen':
        return { genre: mot }
      case 'liste':
        if (c.estMot('de', "d'")) {
          c.avancer()
          return { genre: 'liste', element: this.type(c, true) }
        }
        return { genre: 'liste' }
      default: {
        const types = pluriel
          ? ['entiers', 'réels', 'chaînes', 'booléens', 'listes']
          : ['entier', 'réel', 'chaîne', 'booléen', 'liste']
        throw erreur('type-inconnu', j.etendue, j.texte, plusProche(j.texte, types))
      }
    }
  }

  // ------------------------------------------------------------ Blocs d'instructions

  private bloc(fermetures: Set<GenreLigne>): Instruction[] {
    const instructions: Instruction[] = []
    this.pile.push(fermetures)
    while (this.ligne) {
      const l = this.ligne
      const genre = this.genre()!
      if (TERMINATEURS.has(genre)) {
        if (this.pile.some((f) => f.has(genre))) break
        const [mot, ouverture] = FERMETURES[genre] ?? [l.jetons[0].texte, '']
        if (genre === 'fonction' || genre === 'procedure' || genre === 'algorithme') break
        this.signaler(diagnostic('fermeture-inattendue', this.etendueLigne(l), mot, ouverture))
        instructions.push(this.ligneInvalide(l))
        this.pos++
        continue
      }
      if (genre === 'variables') {
        this.signaler(diagnostic('variables-mal-placee', this.etendueLigne(l)))
        instructions.push(this.ligneInvalide(l))
        this.pos++
        continue
      }
      instructions.push(this.instruction(genre))
    }
    this.pile.pop()
    return instructions
  }

  private ligneFermante(l: LigneLexicale, longueur: number): LigneFermante {
    this.finDeLigne(new Curseur(l, longueur), true)
    return { etendue: this.etendueLigne(l), commentaire: l.commentaire }
  }

  private attraper(e: unknown): void {
    if (e instanceof ErreurSyntaxe) this.signaler(e.diagnostic)
    else throw e
  }

  /** Vérifie que la ligne est terminée, sinon signale le texte en trop. */
  private finDeLigne(c: Curseur, signalerSeulement = false): void {
    if (c.fini()) return
    const j = c.courant!
    let d: Diagnostic
    if (j.genre === 'retour') {
      d = diagnostic('retour-mal-place', j.etendue)
    } else if (
      j.genre === 'symbole' && j.valeur === ',' && j.colle &&
      (c.precedent?.genre === 'entier') &&
      (c.ligne.jetons[c.i + 1]?.genre === 'entier' || c.ligne.jetons[c.i + 1]?.genre === 'reel') &&
      c.ligne.jetons[c.i + 1].colle
    ) {
      const suivant = c.ligne.jetons[c.i + 1]
      d = diagnostic('virgule-decimale', couvrir(c.precedent.etendue, suivant.etendue), `${c.precedent.texte}.${suivant.texte}`)
    } else {
      d = diagnostic('texte-en-trop', c.reste(), c.texteRestant())
    }
    if (signalerSeulement) this.signaler(d)
    else throw new ErreurSyntaxe(d)
  }

  private instruction(genre: GenreLigne): Instruction {
    const l = this.ligne!
    const longueur = classer(l)[1]
    const etendue = this.etendueLigne(l)
    const base = { id: this.id(), etendue, commentaire: l.commentaire }
    const c = new Curseur(l, longueur)

    switch (genre) {
      case 'vide':
      case 'commentaire':
        this.pos++
        return this.ligneSansInstruction(l)
      case 'si':
        return this.si(c, base)
      case 'pour':
        return this.pour(c, base)
      case 'tantque': {
        const condition = this.enTeteBloc(c, () => {
          const condition = this.expression(c)
          if (!c.estMot('faire')) throw erreur('faire-manquant', c.ici(), 'TantQue')
          c.avancer()
          return condition
        })
        const corps = this.bloc(new Set(['fintantque']))
        return { genre: 'TantQue', ...base, condition, corps, fermeture: this.fermer('fintantque', 'TantQue', 'FinTantQue', l) }
      }
      case 'repeter': {
        this.finDeLigne(c, true)
        this.pos++
        const corps = this.bloc(new Set(['jusqua']))
        if (this.genre() !== 'jusqua') {
          this.signaler(diagnostic('bloc-non-ferme', etendue, 'Répéter', l.numero, 'Jusqu’à condition'))
          return { genre: 'Repeter', ...base, corps }
        }
        const fin = this.ligne!
        const cf = new Curseur(fin, 1)
        let condition: Expression
        try {
          condition = this.expression(cf)
          this.finDeLigne(cf)
        } catch (e) {
          this.attraper(e)
          condition = this.invalide(cf.ici())
        }
        this.pos++
        return {
          genre: 'Repeter',
          ...base,
          corps,
          condition,
          fermeture: { etendue: this.etendueLigne(fin), commentaire: fin.commentaire },
        }
      }
      default:
        this.pos++
        try {
          const instruction = this.instructionSimple(genre, c, base)
          this.finDeLigne(c)
          return instruction
        } catch (e) {
          this.attraper(e)
          return this.ligneInvalide(l)
        }
    }
  }

  /** Analyse l'en-tête d'un bloc ; en cas d'erreur, le bloc reste ouvert avec une expression invalide. */
  private enTeteBloc<T>(c: Curseur, lire: () => T): T | Expression {
    let resultat: T | Expression
    try {
      resultat = lire()
      this.finDeLigne(c)
    } catch (e) {
      this.attraper(e)
      resultat = this.invalide(c.ici())
    }
    this.pos++
    return resultat
  }

  private fermer(genre: GenreLigne, structure: string, mot: string, ouverture: LigneLexicale): LigneFermante | undefined {
    if (this.genre() === genre) {
      const l = this.ligne!
      const f = this.ligneFermante(l, classer(l)[1])
      this.pos++
      return f
    }
    this.signaler(diagnostic('bloc-non-ferme', this.etendueLigne(ouverture), structure, ouverture.numero, mot))
    return undefined
  }

  private si(c: Curseur, base: { id: number; etendue: Etendue; commentaire?: string }): Instruction {
    const ouverture = this.ligne!
    const condition = (cur: Curseur) =>
      this.enTeteBloc(cur, () => {
        const e = this.expression(cur)
        if (!cur.estMot('alors')) throw erreur('si-sans-alors', cur.ici())
        cur.avancer()
        return e
      })
    const fermetures = new Set<GenreLigne>(['sinonsi', 'sinon', 'finsi'])
    const branches: BrancheSi[] = [{ etendue: base.etendue, condition: condition(c), corps: [], commentaire: base.commentaire }]
    branches[0].corps = this.bloc(fermetures)
    let sinon: { etendue: Etendue; corps: Instruction[]; commentaire?: string } | undefined
    for (;;) {
      const genre = this.genre()
      const l = this.ligne
      if (l && genre === 'sinonsi') {
        if (sinon) this.signaler(diagnostic('sinon-apres-sinon', this.etendueLigne(l), 'Sinon si'))
        const branche: BrancheSi = {
          etendue: this.etendueLigne(l),
          condition: condition(new Curseur(l, classer(l)[1])),
          corps: [],
          commentaire: l.commentaire,
        }
        branche.corps = this.bloc(fermetures)
        branches.push(branche)
      } else if (l && genre === 'sinon') {
        if (sinon) this.signaler(diagnostic('sinon-apres-sinon', this.etendueLigne(l), 'Sinon'))
        this.finDeLigne(new Curseur(l, 1), true)
        this.pos++
        const corps = this.bloc(fermetures)
        if (sinon) sinon.corps.push(...corps)
        else sinon = { etendue: this.etendueLigne(l), corps, commentaire: l.commentaire }
      } else {
        const fermeture = this.fermer('finsi', 'Si', 'FinSi', ouverture)
        const resultat: Instruction = { genre: 'Si', ...base, branches, fermeture }
        if (sinon) resultat.sinon = sinon
        return resultat
      }
    }
  }

  private pour(c: Curseur, base: { id: number; etendue: Etendue; commentaire?: string }): Instruction {
    const ouverture = this.ligne!
    if (c.estMot('chaque')) {
      c.avancer()
      let variable: Identifiant = { genre: 'Identifiant', id: this.id(), etendue: c.ici(), nom: '' }
      const entete = this.enTeteBloc(c, () => {
        variable = this.nomVariable(c)
        if (!c.estMot('dans')) throw erreur('pour-mal-forme', c.ici())
        c.avancer()
        const collection = this.expression(c)
        if (!c.estMot('faire')) throw erreur('faire-manquant', c.ici(), 'Pour')
        c.avancer()
        return { collection }
      })
      const collection = 'genre' in entete ? entete : entete.collection
      const corps = this.bloc(new Set(['finpour']))
      return {
        genre: 'PourChaque',
        ...base,
        variable,
        collection,
        corps,
        fermeture: this.fermer('finpour', 'Pour', 'FinPour', ouverture),
      }
    }
    let compteur: Identifiant = { genre: 'Identifiant', id: this.id(), etendue: c.ici(), nom: '' }
    const entete = this.enTeteBloc(c, () => {
      let pas: Expression | undefined
      compteur = this.nomVariable(c)
      if (!c.estMot('de')) throw erreur('pour-mal-forme', c.ici())
      c.avancer()
      const debut = this.expression(c)
      if (!c.estMot('a')) throw erreur('pour-mal-forme', c.ici())
      c.avancer()
      const fin = this.expression(c)
      if (c.estMot('pas')) {
        c.avancer()
        if (!c.estMot('de')) throw erreur('pour-mal-forme', c.ici())
        c.avancer()
        pas = this.expression(c)
      }
      if (!c.estMot('faire')) throw erreur(c.fini() ? 'faire-manquant' : 'pour-mal-forme', c.ici(), 'Pour')
      c.avancer()
      return { debut, fin, pas }
    })
    const bornes: { debut: Expression; fin: Expression; pas?: Expression } =
      'genre' in entete ? { debut: entete, fin: entete } : entete
    const corps = this.bloc(new Set(['finpour']))
    const resultat: Instruction = {
      genre: 'Pour',
      ...base,
      compteur,
      debut: bornes.debut,
      fin: bornes.fin,
      corps,
      fermeture: this.fermer('finpour', 'Pour', 'FinPour', ouverture),
    }
    if (bornes.pas) resultat.pas = bornes.pas
    return resultat
  }

  private nomVariable(c: Curseur): Identifiant {
    const j = c.courant
    if (j?.genre !== 'mot' || estMotCle(j.texte)) throw erreur('pour-mal-forme', c.ici())
    c.avancer()
    return { genre: 'Identifiant', id: this.id(), etendue: j.etendue, nom: j.texte }
  }

  private instructionSimple(
    genre: GenreLigne,
    c: Curseur,
    base: { id: number; etendue: Etendue; commentaire?: string },
  ): Instruction {
    switch (genre) {
      case 'lire': {
        const cibles: (Identifiant | Indice)[] = []
        do {
          if (cibles.length > 0) c.avancer()
          const debut = c.ici()
          const cible = this.postfixe(c)
          if ((cible.genre !== 'Identifiant' && cible.genre !== 'Indice') || cible.parentheses) {
            throw erreur('lire-cible', couvrir(debut, c.precedent?.etendue ?? debut))
          }
          cibles.push(cible)
        } while (c.estSymbole(','))
        if (!c.fini() && c.courant!.genre !== 'retour') throw erreur('lire-cible', c.reste())
        return { genre: 'Lire', ...base, cibles }
      }
      case 'afficher': {
        const valeurs: Expression[] = []
        if (!c.fini() && c.courant!.genre !== 'retour') {
          valeurs.push(this.expression(c))
          while (c.estSymbole(',')) {
            c.avancer()
            valeurs.push(this.expression(c))
          }
        }
        let retourLigne = false
        if (c.courant?.genre === 'retour') {
          c.avancer()
          retourLigne = true
        }
        if (valeurs.length === 0 && !retourLigne) throw erreur('afficher-vide', base.etendue)
        return { genre: 'Afficher', ...base, valeurs, retourLigne }
      }
      case 'retourner':
        if (c.fini()) return { genre: 'Retourner', ...base }
        return { genre: 'Retourner', ...base, valeur: this.expression(c) }
      case 'pause':
        return { genre: 'Pause', ...base }
      case 'instruction':
        return this.affectationOuAppel(c, base)
      default:
        // Ligne fermante isolée : déjà traitée par `bloc`.
        throw erreur('instruction-inconnue', base.etendue)
    }
  }

  private affectationOuAppel(c: Curseur, base: { id: number; etendue: Etendue; commentaire?: string }): Instruction {
    const jetons = c.ligne.jetons
    const premier = jetons[0]
    // « n : entier » ou « n, i : entier » hors de la section Variables.
    if (premier.genre === 'mot' && jetons.some((j) => j.genre === 'symbole' && j.valeur === ':') &&
      !jetons.some((j) => j.genre === 'symbole' && (j.valeur === '←' || j.valeur === '['))) {
      throw erreur('declaration-hors-variables', base.etendue)
    }
    if (premier.genre !== 'mot' && !(premier.genre === 'symbole' && premier.valeur === '(')) {
      throw erreur('instruction-inconnue', base.etendue)
    }
    const expression = this.expression(c)
    if (c.estSymbole('←')) {
      c.avancer()
      if ((expression.genre !== 'Identifiant' && expression.genre !== 'Indice') || expression.parentheses) {
        throw erreur('cible-invalide', expression.etendue)
      }
      return { genre: 'Affectation', ...base, cible: expression, valeur: this.expression(c) }
    }
    if (
      expression.genre === 'Comparaison' &&
      expression.operateurs.length === 1 &&
      expression.operateurs[0] === '=' &&
      (expression.operandes[0].genre === 'Identifiant' || expression.operandes[0].genre === 'Indice')
    ) {
      const cible = expression.operandes[0]
      const texte = c.ligne.texte.slice(cible.etendue.de - c.ligne.de, cible.etendue.a - c.ligne.de)
      throw erreur('affectation-egal', expression.etendue, texte)
    }
    if (expression.genre === 'Appel' && !expression.parentheses) {
      if (!c.fini()) this.finDeLigne(c)
      return { genre: 'AppelProcedure', ...base, appel: expression }
    }
    if (!c.fini()) {
      // « Affiche x » : mot-clé mal orthographié.
      if (expression.genre === 'Identifiant' && !expression.parentheses) {
        throw erreur('instruction-inconnue', base.etendue, plusProche(expression.nom, MOTS_INSTRUCTIONS))
      }
      this.finDeLigne(c)
    }
    throw erreur('expression-sans-effet', expression.etendue)
  }

  // ------------------------------------------------------------ Expressions

  private invalide(etendue: Etendue): Expression {
    return { genre: 'ExpressionInvalide', id: this.id(), etendue }
  }

  expression(c: Curseur): Expression {
    return this.ou(c)
  }

  private binaireGauche(
    c: Curseur,
    suivant: (c: Curseur) => Expression,
    operateurs: Record<string, 'symbole' | 'mot'>,
  ): Expression {
    let gauche = suivant(c)
    for (;;) {
      const j = c.courant
      if (!j || (j.genre !== 'symbole' && j.genre !== 'mot') || operateurs[j.valeur] !== j.genre) return gauche
      c.avancer()
      const droite = suivant(c)
      gauche = {
        genre: 'Binaire',
        id: this.id(),
        etendue: couvrir(gauche.etendue, droite.etendue),
        operateur: j.valeur as 'et',
        gauche,
        droite,
      }
    }
  }

  private ou(c: Curseur): Expression {
    return this.binaireGauche(c, (c) => this.et(c), { ou: 'mot' })
  }

  private et(c: Curseur): Expression {
    return this.binaireGauche(c, (c) => this.non(c), { et: 'mot' })
  }

  private non(c: Curseur): Expression {
    if (c.estMot('non')) {
      const j = c.avancer()
      const operande = this.non(c)
      return { genre: 'Unaire', id: this.id(), etendue: couvrir(j.etendue, operande.etendue), operateur: 'non', operande }
    }
    return this.comparaison(c)
  }

  private comparaison(c: Curseur): Expression {
    const premier = this.additif(c)
    const operandes = [premier]
    const operateurs: OperateurComparaison[] = []
    while (c.estSymbole('=', '≠', '<', '≤', '>', '≥') || c.estMot('dans')) {
      operateurs.push(c.avancer().valeur as OperateurComparaison)
      operandes.push(this.additif(c))
    }
    if (operateurs.length === 0) return premier
    return {
      genre: 'Comparaison',
      id: this.id(),
      etendue: couvrir(premier.etendue, operandes.at(-1)!.etendue),
      operandes,
      operateurs,
    }
  }

  private additif(c: Curseur): Expression {
    return this.binaireGauche(c, (c) => this.multiplicatif(c), { '+': 'symbole', '-': 'symbole' })
  }

  private multiplicatif(c: Curseur): Expression {
    return this.binaireGauche(c, (c) => this.unaire(c), { '*': 'symbole', '/': 'symbole', div: 'mot', mod: 'mot' })
  }

  private unaire(c: Curseur): Expression {
    if (c.estSymbole('-')) {
      const j = c.avancer()
      const operande = this.unaire(c)
      return { genre: 'Unaire', id: this.id(), etendue: couvrir(j.etendue, operande.etendue), operateur: '-', operande }
    }
    return this.puissance(c)
  }

  private puissance(c: Curseur): Expression {
    const base = this.postfixe(c)
    if (!c.estSymbole('^')) return base
    c.avancer()
    const exposant = this.unaire(c)
    return {
      genre: 'Binaire',
      id: this.id(),
      etendue: couvrir(base.etendue, exposant.etendue),
      operateur: '^',
      gauche: base,
      droite: exposant,
    }
  }

  private postfixe(c: Curseur): Expression {
    let e = this.primaire(c)
    for (;;) {
      if (c.estSymbole('(')) {
        if (e.genre !== 'Identifiant' || e.parentheses) throw erreur('appel-invalide', c.ici())
        const ouvrante = c.avancer()
        const args: Expression[] = []
        if (!c.estSymbole(')')) {
          args.push(this.expression(c))
          while (c.estSymbole(',')) {
            c.avancer()
            args.push(this.expression(c))
          }
        }
        if (!c.estSymbole(')')) throw erreur('parenthese-non-fermee', ouvrante.etendue)
        const fermante = c.avancer()
        const appel: Appel = {
          genre: 'Appel',
          id: e.id,
          etendue: couvrir(e.etendue, fermante.etendue),
          nom: nomAppel(e.nom),
          etendueNom: e.etendue,
          arguments: args,
        }
        e = appel
      } else if (c.estSymbole('[')) {
        const ouvrante = c.avancer()
        let debut: Expression | undefined
        if (!c.estSymbole(':')) debut = this.expression(c)
        if (c.estSymbole(':')) {
          c.avancer()
          const fin = c.estSymbole(']') ? undefined : this.expression(c)
          if (!c.estSymbole(']')) throw erreur('crochet-non-ferme', ouvrante.etendue)
          const fermant = c.avancer()
          e = { genre: 'Tranche', id: this.id(), etendue: couvrir(e.etendue, fermant.etendue), objet: e, debut, fin }
          if (!debut) delete e.debut
          if (!fin) delete e.fin
        } else {
          if (!c.estSymbole(']')) throw erreur('crochet-non-ferme', ouvrante.etendue)
          const fermant = c.avancer()
          e = { genre: 'Indice', id: this.id(), etendue: couvrir(e.etendue, fermant.etendue), objet: e, indice: debut! }
        }
      } else {
        return e
      }
    }
  }

  private primaire(c: Curseur): Expression {
    const j = c.courant
    if (!j) throw erreur('expression-attendue', c.ici())
    switch (j.genre) {
      case 'entier':
        c.avancer()
        return { genre: 'Entier', id: this.id(), etendue: j.etendue, valeur: BigInt(j.texte), texte: j.texte }
      case 'reel':
        c.avancer()
        return { genre: 'Reel', id: this.id(), etendue: j.etendue, valeur: Number(j.texte), texte: j.texte }
      case 'chaine':
        c.avancer()
        return { genre: 'Chaine', id: this.id(), etendue: j.etendue, valeur: j.valeur }
      case 'mot': {
        if (j.valeur === 'vrai' || j.valeur === 'faux') {
          c.avancer()
          return { genre: 'Booleen', id: this.id(), etendue: j.etendue, valeur: j.valeur === 'vrai' }
        }
        const suiviDeParenthese = c.ligne.jetons[c.i + 1]?.genre === 'symbole' && c.ligne.jetons[c.i + 1].valeur === '('
        // entier(x), réel(x), chaîne(x) : conversions en notation française.
        const conversion = (['entier', 'reel', 'chaine'] as const).includes(j.valeur as 'entier') && suiviDeParenthese
        if (estMotCle(j.texte) && !conversion) throw erreur('mot-cle-dans-expression', j.etendue, j.texte)
        c.avancer()
        return { genre: 'Identifiant', id: this.id(), etendue: j.etendue, nom: j.texte }
      }
      case 'symbole':
        if (j.valeur === '(') {
          c.avancer()
          const e = this.expression(c)
          if (!c.estSymbole(')')) throw erreur('parenthese-non-fermee', j.etendue)
          const fermante = c.avancer()
          e.parentheses = true
          e.etendue = couvrir(j.etendue, fermante.etendue)
          return e
        }
        if (j.valeur === '[') {
          c.avancer()
          const elements: Expression[] = []
          if (!c.estSymbole(']')) {
            elements.push(this.expression(c))
            while (c.estSymbole(',')) {
              c.avancer()
              elements.push(this.expression(c))
            }
          }
          if (!c.estSymbole(']')) throw erreur('crochet-non-ferme', j.etendue)
          const fermant = c.avancer()
          return { genre: 'Liste', id: this.id(), etendue: couvrir(j.etendue, fermant.etendue), elements }
        }
        throw erreur('expression-attendue', j.etendue, j.texte)
      default:
        throw erreur('expression-attendue', j.etendue, j.texte)
    }
  }
}

/** Nom enregistré d'un appel : nom Python pour une fonction prédéfinie, forme canonique pour une procédure prédéfinie. */
function nomAppel(nom: string): string {
  return trouverPredefini(nom)?.python ?? trouverProcedurePredefinie(nom) ?? nom
}
