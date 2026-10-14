import type { Appel, Expression, Instruction, Programme, SousProgramme } from '../langage/ast.ts'
import { formaterExpression } from '../langage/formateur.ts'
import { predefiniPython } from '../langage/predefinis.ts'
import { egaux, T, type Type } from '../langage/types.ts'
import type { ResultatVerification } from '../langage/verification.ts'
import { OP, type ProgrammeCompile, type SousProgrammeCompile, type VariableCompilee } from './code.ts'
import type { Valeur } from './valeurs.ts'

/**
 * Compilation d'un programme vérifié vers le code de la machine d'exécution.
 * Le code est produit uniquement à partir de l'AST : le texte de l'étudiant
 * n'est jamais évalué (PLAN.md, section 9.5).
 */
export function compilerProgramme(programme: Programme, verification: ResultatVerification): ProgrammeCompile {
  return new Compilateur(programme, verification).compiler()
}

const OPERATEURS = {
  '+': OP.ADD,
  '-': OP.SUB,
  '*': OP.MUL,
  '/': OP.DIV,
  div: OP.IDIV,
  mod: OP.MOD,
} as const

const COMPARAISONS = {
  '=': OP.EQ,
  '≠': OP.NE,
  '<': OP.LT,
  '≤': OP.LE,
  '>': OP.GT,
  '≥': OP.GE,
  dans: OP.IN,
} as const

class Compilateur {
  private readonly programme: Programme
  private readonly types: Map<number, Type>
  private readonly verification: ResultatVerification
  private readonly resultat: ProgrammeCompile = {
    sousProgrammes: [],
    constantes: [],
    conversions: [],
    saisies: [],
    predefinis: [],
  }
  private readonly indicesSousProgrammes = new Map<string, number>()
  private readonly constantes = new Map<string, number>()

  // État du sous-programme en cours de compilation.
  private code: number[] = []
  private cases = new Map<string, VariableCompilee>()
  private nombreCases = 0
  private typeRetour: Type = T.rien

  constructor(programme: Programme, verification: ResultatVerification) {
    this.programme = programme
    this.verification = verification
    this.types = verification.types
  }

  compiler(): ProgrammeCompile {
    const sousProgrammes = this.programme.elements.filter(
      (e): e is SousProgramme => e.genre === 'Fonction' || e.genre === 'Procedure',
    )
    sousProgrammes.forEach((sp, k) => this.indicesSousProgrammes.set(sp.nom, k + 1))

    const principal = this.programme.elements.find((e) => e.genre === 'Principal')
    this.resultat.sousProgrammes.push(
      this.sousProgramme('', 'principal', [], this.verification.portees.get(null), principal?.corps.instructions ?? []),
    )
    for (const sp of sousProgrammes) {
      const info = this.verification.sousProgrammes.get(sp.nom)!
      this.typeRetour = info.retour
      this.resultat.sousProgrammes.push(
        this.sousProgramme(
          sp.nom,
          sp.genre === 'Fonction' ? 'fonction' : 'procedure',
          info.parametres,
          this.verification.portees.get(sp.nom),
          sp.corps.instructions,
        ),
      )
    }
    return this.resultat
  }

  private sousProgramme(
    nom: string,
    genre: SousProgrammeCompile['genre'],
    parametres: { nom: string; type: Type }[],
    portee: Map<string, { nom: string; type: Type }> | undefined,
    instructions: Instruction[],
  ): SousProgrammeCompile {
    this.code = []
    this.cases = new Map()
    this.nombreCases = 0
    // Les paramètres occupent les premières cases, dans l'ordre.
    for (const p of parametres) this.cases.set(p.nom, { nom: p.nom, type: p.type, case: this.nombreCases++ })
    for (const v of portee?.values() ?? []) {
      if (!this.cases.has(v.nom)) this.cases.set(v.nom, { nom: v.nom, type: v.type, case: this.nombreCases++ })
    }
    const variables = [...this.cases.values()]
    this.bloc(instructions)
    this.emettre(genre === 'principal' ? OP.FIN : genre === 'fonction' ? OP.FIN_SANS_RETOUR : OP.RETOUR_RIEN)
    return { nom, genre, code: this.code, nombreParametres: parametres.length, nombreCases: this.nombreCases, variables }
  }

  // ------------------------------------------------------------ Émission

  private emettre(op: number, a = 0, b = 0): number {
    this.code.push(op, a, b)
    return this.code.length - 3
  }

  /** Position de la prochaine instruction. */
  private get ici(): number {
    return this.code.length
  }

  /** Fixe la cible du saut émis à la position `saut`. */
  private corriger(saut: number, cible = this.ici): void {
    this.code[saut + 1] = cible
  }

  private caseCachee(nombre: number): number {
    const premiere = this.nombreCases
    this.nombreCases += nombre
    return premiere
  }

  private constante(v: Valeur): number {
    const cle = `${typeof v}:${Object.is(v, -0) ? '-0' : String(v)}`
    let k = this.constantes.get(cle)
    if (k === undefined) {
      k = this.resultat.constantes.push(v) - 1
      this.constantes.set(cle, k)
    }
    return k
  }

  private type(e: Expression): Type {
    return this.types.get(e.id) ?? T.quelconque
  }

  /** Convertit la valeur au sommet de la pile vers `cible`, si son type ne correspond pas déjà. */
  private convertir(source: Type, cible: Type, texteCible: string): void {
    if (cible.genre === 'quelconque' || egaux(source, cible)) return
    const k = this.resultat.conversions.push({ type: cible, cible: texteCible }) - 1
    this.emettre(OP.CONV, k)
  }

  private texte(e: Expression): string {
    return formaterExpression(e, 'python')
  }

  // ------------------------------------------------------------ Instructions

  private bloc(instructions: Instruction[]): void {
    for (const i of instructions) this.instruction(i)
  }

  private instruction(i: Instruction): void {
    if (i.genre === 'Commentaire' || i.genre === 'LigneVide' || i.genre === 'LigneInvalide') return
    this.emettre(OP.LIGNE, i.etendue.ligne)
    switch (i.genre) {
      case 'Affectation':
        if (i.cible.genre === 'Identifiant') {
          const v = this.cases.get(i.cible.nom)!
          this.expression(i.valeur)
          this.convertir(this.type(i.valeur), v.type, v.nom)
          this.emettre(OP.STORE, v.case)
        } else {
          this.expression(i.valeur)
          this.convertir(this.type(i.valeur), this.type(i.cible), this.texte(i.cible))
          this.expression(i.cible.objet)
          this.expression(i.cible.indice)
          this.emettre(OP.STORE_INDEX)
        }
        break
      case 'Lire':
        i.cibles.forEach((cible, k) => {
          if (k > 0) this.emettre(OP.LIGNE, i.etendue.ligne)
          const texte = this.texte(cible)
          const type = cible.genre === 'Identifiant' ? this.cases.get(cible.nom)!.type : this.type(cible)
          const saisie = this.resultat.saisies.push({ invite: `${texte} = `, cible: texte, type }) - 1
          this.emettre(OP.LIRE, saisie)
          if (cible.genre === 'Identifiant') {
            this.emettre(OP.STORE, this.cases.get(cible.nom)!.case)
          } else {
            this.expression(cible.objet)
            this.expression(cible.indice)
            this.emettre(OP.STORE_INDEX)
          }
        })
        break
      case 'Afficher':
        for (const v of i.valeurs) this.expression(v)
        this.emettre(OP.AFFICHER, i.valeurs.length, i.retourLigne ? 1 : 0)
        break
      case 'Si': {
        const finales: number[] = []
        i.branches.forEach((b, k) => {
          if (k > 0) this.emettre(OP.LIGNE, b.etendue.ligne)
          this.expression(b.condition)
          const suivante = this.emettre(OP.JUMP_FAUX)
          this.bloc(b.corps)
          finales.push(this.emettre(OP.JUMP))
          this.corriger(suivante)
        })
        if (i.sinon) this.bloc(i.sinon.corps)
        for (const saut of finales) this.corriger(saut)
        break
      }
      case 'Pour': {
        const compteur = this.cases.get(i.compteur.nom)!
        const c = this.caseCachee(3)
        this.expression(i.debut)
        this.emettre(OP.STORE, c)
        this.expression(i.fin)
        this.emettre(OP.STORE, c + 1)
        if (i.pas) this.expression(i.pas)
        else this.emettre(OP.CONST, this.constante(1n))
        this.emettre(OP.STORE, c + 2)
        this.emettre(OP.POUR_PAS, c)
        const tete = this.ici
        const sortie = this.emettre(OP.POUR_TEST, c)
        this.emettre(OP.LOAD, c)
        this.emettre(OP.STORE, compteur.case)
        this.bloc(i.corps)
        this.emettre(OP.LIGNE, i.etendue.ligne)
        this.emettre(OP.POUR_INC, c)
        this.emettre(OP.JUMP, tete)
        this.code[sortie + 2] = this.ici
        break
      }
      case 'PourChaque': {
        const variable = this.cases.get(i.variable.nom)!
        const c = this.caseCachee(2)
        this.expression(i.collection)
        this.emettre(OP.PARCOURS_INIT, c)
        const tete = this.ici
        const sortie = this.emettre(OP.PARCOURS_SUIVANT, c)
        const collection = this.type(i.collection)
        const element = collection.genre === 'liste' ? collection.element : collection.genre === 'chaine' ? T.chaine : T.quelconque
        this.convertir(element, variable.type, variable.nom)
        this.emettre(OP.STORE, variable.case)
        this.bloc(i.corps)
        this.emettre(OP.LIGNE, i.etendue.ligne)
        this.emettre(OP.JUMP, tete)
        this.code[sortie + 2] = this.ici
        break
      }
      case 'TantQue': {
        // La ligne TantQue est déjà émise : la condition est réévaluée en revenant à `tete`.
        const tete = this.ici - 3
        this.expression(i.condition)
        const sortie = this.emettre(OP.JUMP_FAUX)
        this.bloc(i.corps)
        this.emettre(OP.JUMP, tete)
        this.corriger(sortie)
        break
      }
      case 'Repeter': {
        const debut = this.ici
        this.bloc(i.corps)
        this.emettre(OP.LIGNE, i.fermeture?.etendue.ligne ?? i.etendue.ligne)
        this.expression(i.condition!)
        this.emettre(OP.JUMP_FAUX, debut)
        break
      }
      case 'AppelProcedure':
        this.appelInstruction(i.appel)
        break
      case 'Retourner':
        if (i.valeur) {
          this.expression(i.valeur)
          this.convertir(this.type(i.valeur), this.typeRetour, 'la valeur renvoyée')
          this.emettre(OP.RETOUR)
        } else {
          this.emettre(OP.RETOUR_RIEN)
        }
        break
      case 'Pause':
        this.emettre(OP.PAUSE)
        break
    }
  }

  private appelInstruction(appel: Appel): void {
    const [liste, ...autres] = appel.arguments
    const element = (): Type => {
      const t = this.type(liste)
      return t.genre === 'liste' ? t.element : T.quelconque
    }
    switch (appel.nom) {
      case 'ajouter':
        this.expression(liste)
        this.expression(autres[0])
        this.convertir(this.type(autres[0]), element(), `un élément de ${this.texte(liste)}`)
        this.emettre(OP.AJOUTER)
        return
      case 'insérer':
        this.expression(liste)
        this.expression(autres[0])
        this.expression(autres[1])
        this.convertir(this.type(autres[1]), element(), `un élément de ${this.texte(liste)}`)
        this.emettre(OP.INSERER)
        return
      case 'supprimer':
        this.expression(liste)
        this.expression(autres[0])
        this.emettre(OP.SUPPRIMER)
        return
    }
    this.appel(appel)
    const sp = this.indicesSousProgrammes.get(appel.nom)
    const procedure = sp !== undefined && this.verification.sousProgrammes.get(appel.nom)!.noeud.genre === 'Procedure'
    if (!procedure) this.emettre(OP.POP)
  }

  // ------------------------------------------------------------ Expressions

  private appel(appel: Appel): void {
    const indice = this.indicesSousProgrammes.get(appel.nom)
    if (indice !== undefined) {
      const info = this.verification.sousProgrammes.get(appel.nom)!
      appel.arguments.forEach((x, k) => {
        this.expression(x)
        this.convertir(this.type(x), info.parametres[k].type, `le paramètre ${info.parametres[k].nom} de ${appel.nom}`)
      })
      this.emettre(OP.APPEL, indice, appel.arguments.length)
      return
    }
    for (const x of appel.arguments) this.expression(x)
    let k = this.resultat.predefinis.indexOf(appel.nom)
    if (k < 0) k = this.resultat.predefinis.push(appel.nom) - 1
    this.emettre(OP.PREDEF, k, appel.arguments.length)
  }

  private expression(e: Expression): void {
    switch (e.genre) {
      case 'Entier':
      case 'Reel':
      case 'Chaine':
      case 'Booleen':
        this.emettre(OP.CONST, this.constante(e.valeur))
        return
      case 'Liste': {
        const t = this.type(e)
        const element = t.genre === 'liste' ? t.element : T.quelconque
        for (const x of e.elements) {
          this.expression(x)
          this.convertir(this.type(x), element, 'un élément de la liste')
        }
        this.emettre(OP.LISTE, e.elements.length)
        return
      }
      case 'Identifiant': {
        const v = this.cases.get(e.nom)
        if (v) this.emettre(OP.LOAD, v.case)
        else this.emettre(OP.CONST, this.constante(e.nom === 'pi' ? Math.PI : Math.E))
        return
      }
      case 'Unaire':
        this.expression(e.operande)
        this.emettre(e.operateur === 'non' ? OP.NOT : OP.NEG)
        return
      case 'Binaire':
        if (e.operateur === 'et' || e.operateur === 'ou') {
          this.expression(e.gauche)
          const saut = this.emettre(e.operateur === 'et' ? OP.JUMP_FAUX_GARDE : OP.JUMP_VRAI_GARDE)
          this.expression(e.droite)
          this.corriger(saut)
          return
        }
        this.expression(e.gauche)
        this.expression(e.droite)
        if (e.operateur === '^') this.emettre(OP.POW, this.type(e).genre === 'entier' ? 1 : 0)
        else this.emettre(OPERATEURS[e.operateur])
        return
      case 'Comparaison': {
        // a < b < c : b n'est évalué qu'une fois, et c seulement si a < b.
        this.expression(e.operandes[0])
        const sauts: number[] = []
        const temporaire = e.operateurs.length > 1 ? this.caseCachee(1) : -1
        e.operateurs.forEach((op, k) => {
          if (k > 0) this.emettre(OP.LOAD, temporaire)
          this.expression(e.operandes[k + 1])
          if (k < e.operateurs.length - 1) {
            this.emettre(OP.STORE, temporaire)
            this.emettre(OP.LOAD, temporaire)
          }
          this.emettre(COMPARAISONS[op])
          if (k < e.operateurs.length - 1) sauts.push(this.emettre(OP.JUMP_FAUX_GARDE))
        })
        for (const saut of sauts) this.corriger(saut)
        return
      }
      case 'Appel':
        if (predefiniPython(e.nom)?.genre === 'constante') {
          this.emettre(OP.CONST, this.constante(e.nom === 'pi' ? Math.PI : Math.E))
          return
        }
        this.appel(e)
        return
      case 'Indice':
        this.expression(e.objet)
        this.expression(e.indice)
        this.emettre(OP.INDEX)
        return
      case 'Tranche':
        this.expression(e.objet)
        if (e.debut) this.expression(e.debut)
        if (e.fin) this.expression(e.fin)
        this.emettre(OP.TRANCHE, (e.debut ? 1 : 0) + (e.fin ? 2 : 0))
        return
      case 'ExpressionInvalide':
        throw new Error('Expression invalide : le programme doit être vérifié avant la compilation.')
    }
  }
}
