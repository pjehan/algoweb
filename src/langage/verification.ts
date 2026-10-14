import type {
  Appel,
  Corps,
  Etendue,
  Expression,
  Identifiant,
  Indice,
  Instruction,
  Programme,
  SousProgramme,
} from './ast.ts'
import { formaterExpression } from './formateur.ts'
import { diagnostic, type CodeDiagnostic, type Diagnostic, type MESSAGES } from './messages.ts'
import { plusProche } from './normalisation.ts'
import {
  nomAffiche,
  PREDEFINIS,
  predefiniPython,
  PROCEDURES_PREDEFINIES,
  raisonReservee,
  type Notation,
  type Predefini,
} from './predefinis.ts'
import { affectable, avecArticle, depuisDeclare, egaux, estNumerique, T, unifier, type Type } from './types.ts'

/**
 * Vérification d'un programme syntaxiquement correct : portées, types et
 * règles de la section 4.9 de PLAN.md. Produit les diagnostics et le type de
 * chaque expression.
 */

export interface OptionsVerification {
  /** Notation des fonctions prédéfinies dans les messages. */
  notation: Notation
}

export interface InfoVariable {
  nom: string
  type: Type
  etendue: Etendue
  parametre: boolean
  utilisee: boolean
}

export interface InfoSousProgramme {
  noeud: SousProgramme
  nom: string
  parametres: { nom: string; type: Type }[]
  /** `rien` pour une procédure. */
  retour: Type
}

export interface ResultatVerification {
  diagnostics: Diagnostic[]
  /** Type de chaque expression, par identifiant de nœud. */
  types: Map<number, Type>
  sousProgrammes: Map<string, InfoSousProgramme>
  /** Variables de l'algorithme principal, puis de chaque sous-programme. */
  portees: Map<string | null, Map<string, InfoVariable>>
}

export function verifier(programme: Programme, options: OptionsVerification = { notation: 'python' }): ResultatVerification {
  const v = new Verificateur(options.notation)
  v.programme(programme)
  v.diagnostics.sort((a, b) => a.etendue.de - b.etendue.de)
  return { diagnostics: v.diagnostics, types: v.types, sousProgrammes: v.sousProgrammes, portees: v.portees }
}

// ---------------------------------------------------------------- État du flot

/** Variables ayant certainement une valeur, et fin certaine du bloc (Retourner). */
interface Etat {
  assignees: Set<string>
  termine: boolean
}

interface Contexte {
  portee: Map<string, InfoVariable>
  sousProgramme?: InfoSousProgramme
  /** Compteurs des boucles Pour englobantes. */
  compteurs: Set<string>
  /** Variables déjà signalées comme peut-être sans valeur. */
  signalees: Set<string>
}

// ---------------------------------------------------------------- Vérificateur

class Verificateur {
  readonly diagnostics: Diagnostic[] = []
  readonly types = new Map<number, Type>()
  readonly sousProgrammes = new Map<string, InfoSousProgramme>()
  readonly portees = new Map<string | null, Map<string, InfoVariable>>()
  private readonly notation: Notation
  private principale = new Map<string, InfoVariable>()

  constructor(notation: Notation) {
    this.notation = notation
  }

  private signaler<C extends CodeDiagnostic>(code: C, etendue: Etendue, ...args: Parameters<(typeof MESSAGES)[C]>): void {
    this.diagnostics.push(diagnostic(code, etendue, ...args))
  }

  /** Nom affiché d'une fonction prédéfinie, selon la notation. */
  private nom(python: string, nombreArguments?: number): string {
    return nomAffiche(python, this.notation, nombreArguments)
  }

  private texte(e: Expression): string {
    return formaterExpression(e, this.notation)
  }

  // ------------------------------------------------------------ Programme et déclarations

  programme(programme: Programme): void {
    const lignesDeclaration = new Map<string, number>()
    const declarer = (nom: string, etendue: Etendue): boolean => {
      const raison = raisonReservee(nom, 'sous-programme')
      if (raison) {
        this.signaler('nom-reserve', etendue, nom, raison)
        return false
      }
      const ligne = lignesDeclaration.get(nom)
      if (ligne !== undefined) {
        this.signaler('declaration-double', etendue, nom, ligne)
        return false
      }
      lignesDeclaration.set(nom, etendue.ligne)
      return true
    }

    // Signatures des sous-programmes, pour autoriser les appels dans un ordre quelconque.
    const infos = new Map<SousProgramme, InfoSousProgramme>()
    for (const e of programme.elements) {
      if (e.genre !== 'Fonction' && e.genre !== 'Procedure') continue
      const info: InfoSousProgramme = {
        noeud: e,
        nom: e.nom,
        parametres: e.parametres.map((p) => ({ nom: p.nom, type: depuisDeclare(p.type) })),
        retour: e.genre === 'Fonction' && e.typeRetour ? depuisDeclare(e.typeRetour) : e.genre === 'Fonction' ? T.quelconque : T.rien,
      }
      infos.set(e, info)
      if (declarer(e.nom, e.etendueNom)) this.sousProgrammes.set(e.nom, info)
    }

    // Variables de l'algorithme principal : leurs noms ne doivent pas masquer une fonction.
    const principal = programme.elements.find((e) => e.genre === 'Principal')
    if (principal) {
      this.principale = this.variables(principal.corps, new Map(), new Map(lignesDeclaration))
      this.portees.set(null, this.principale)
    }

    for (const [e, info] of infos) this.sousProgramme(e, info, lignesDeclaration)
    if (principal) {
      const ctx: Contexte = { portee: this.principale, compteurs: new Set(), signalees: new Set() }
      this.bloc(principal.corps.instructions, ctx, { assignees: new Set(), termine: false })
      this.inutilisees(this.principale)
    }
  }

  /** Déclare les variables d'un corps dans `portee`. `connus` donne la ligne des noms déjà pris. */
  private variables(corps: Corps, portee: Map<string, InfoVariable>, connus: Map<string, number>): Map<string, InfoVariable> {
    for (const ligne of corps.variables?.lignes ?? []) {
      if (ligne.genre !== 'Declaration') continue
      const type = depuisDeclare(ligne.type)
      for (const { nom, etendue } of ligne.noms) {
        const raison = raisonReservee(nom)
        if (raison) {
          this.signaler('nom-reserve', etendue, nom, raison)
          continue
        }
        const deja = connus.get(nom)
        if (deja !== undefined) {
          this.signaler('declaration-double', etendue, nom, deja)
          continue
        }
        connus.set(nom, etendue.ligne)
        portee.set(nom, { nom, type, etendue, parametre: false, utilisee: false })
      }
    }
    return portee
  }

  private sousProgramme(sp: SousProgramme, info: InfoSousProgramme, globaux: Map<string, number>): void {
    const connus = new Map(globaux)
    const portee = new Map<string, InfoVariable>()
    for (const p of sp.parametres) {
      const raison = raisonReservee(p.nom)
      if (raison) {
        this.signaler('nom-reserve', p.etendue, p.nom, raison)
        continue
      }
      const deja = connus.get(p.nom)
      if (deja !== undefined) {
        this.signaler('declaration-double', p.etendue, p.nom, deja)
        continue
      }
      connus.set(p.nom, p.etendue.ligne)
      portee.set(p.nom, { nom: p.nom, type: depuisDeclare(p.type), etendue: p.etendue, parametre: true, utilisee: true })
    }
    this.variables(sp.corps, portee, connus)
    if (this.sousProgrammes.get(sp.nom) === info) this.portees.set(sp.nom, portee)

    const ctx: Contexte = { portee, sousProgramme: info, compteurs: new Set(), signalees: new Set() }
    const etat = this.bloc(sp.corps.instructions, ctx, {
      assignees: new Set(sp.parametres.map((p) => p.nom)),
      termine: false,
    })
    if (sp.genre === 'Fonction' && !etat.termine) this.signaler('retour-manquant', sp.etendueNom, sp.nom)
    this.inutilisees(portee)
  }

  private inutilisees(portee: Map<string, InfoVariable>): void {
    for (const v of portee.values()) {
      if (!v.utilisee) this.signaler('variable-inutilisee', v.etendue, v.nom)
    }
  }

  // ------------------------------------------------------------ Instructions

  private bloc(instructions: Instruction[], ctx: Contexte, etat: Etat): Etat {
    let courant: Etat = { assignees: new Set(etat.assignees), termine: etat.termine }
    let inaccessibleSignale = false
    for (const i of instructions) {
      if (i.genre === 'Commentaire' || i.genre === 'LigneVide' || i.genre === 'LigneInvalide') continue
      if (courant.termine && !etat.termine && !inaccessibleSignale) {
        this.signaler('code-inaccessible', i.etendue)
        inaccessibleSignale = true
      }
      courant = this.instruction(i, ctx, courant)
    }
    return courant
  }

  private instruction(i: Instruction, ctx: Contexte, etat: Etat): Etat {
    const a = etat.assignees
    switch (i.genre) {
      case 'Affectation': {
        if (i.cible.genre === 'Identifiant') {
          const v = this.variableModifiee(i.cible, ctx)
          const type = this.typer(i.valeur, ctx, a, v?.type)
          if (v) {
            this.verifierAffectation(type, v.type, i.cible, i.valeur.etendue)
            a.add(v.nom)
          }
        } else {
          const typeElement = this.typer(i.cible, ctx, a)
          const type = this.typer(i.valeur, ctx, a, typeElement)
          if (this.types.get(i.cible.objet.id)?.genre === 'chaine') {
            this.signaler('chaine-immuable', i.cible.etendue, this.texte(i.cible.objet))
          } else {
            this.verifierAffectation(type, typeElement, i.cible, i.valeur.etendue)
          }
        }
        return etat
      }
      case 'Lire':
        for (const cible of i.cibles) {
          if (cible.genre === 'Identifiant') {
            const v = this.variableModifiee(cible, ctx)
            if (v?.type.genre === 'liste') this.signaler('lire-liste', cible.etendue, v.nom)
            if (v) a.add(v.nom)
          } else {
            this.lireElement(cible, ctx, a)
          }
        }
        return etat
      case 'Afficher':
        for (const v of i.valeurs) this.typer(v, ctx, a)
        return etat
      case 'Si': {
        let resultat: Set<string> | undefined
        let tousTerminent = true
        for (const b of i.branches) {
          this.condition(b.condition, ctx, a)
          const fin = this.bloc(b.corps, ctx, { assignees: a, termine: false })
          resultat = intersection(resultat, fin.termine ? undefined : fin.assignees)
          tousTerminent &&= fin.termine
        }
        if (i.sinon) {
          const fin = this.bloc(i.sinon.corps, ctx, { assignees: a, termine: false })
          resultat = intersection(resultat, fin.termine ? undefined : fin.assignees)
          tousTerminent &&= fin.termine
        } else {
          resultat = intersection(resultat, a)
          tousTerminent = false
        }
        return { assignees: resultat ?? new Set(a), termine: tousTerminent }
      }
      case 'Pour': {
        const v = this.variableModifiee(i.compteur, ctx)
        if (v && v.type.genre !== 'entier') this.signaler('pour-non-entier', i.compteur.etendue, 'Le compteur', avecArticle(v.type))
        const bornes: [Expression | undefined, string][] = [
          [i.debut, 'La borne de début'],
          [i.fin, 'La borne de fin'],
          [i.pas, 'Le pas'],
        ]
        for (const [e, partie] of bornes) {
          if (!e) continue
          const t = this.typer(e, ctx, a)
          if (t.genre !== 'entier' && t.genre !== 'quelconque') this.signaler('pour-non-entier', e.etendue, partie, avecArticle(t))
        }
        if (i.pas && valeurEntiere(i.pas) === 0n) this.signaler('pas-nul', i.pas.etendue)
        this.corpsBoucle(i.corps, ctx, a, v?.nom)
        return etat
      }
      case 'PourChaque': {
        const t = this.typer(i.collection, ctx, a)
        let element: Type = T.quelconque
        if (t.genre === 'liste') element = t.element
        else if (t.genre === 'chaine') element = T.chaine
        else if (t.genre !== 'quelconque') this.signaler('collection-invalide', i.collection.etendue, avecArticle(t))
        const v = this.variableModifiee(i.variable, ctx)
        if (v) this.verifierAffectation(element, v.type, i.variable, i.collection.etendue)
        this.corpsBoucle(i.corps, ctx, a, v?.nom)
        return etat
      }
      case 'TantQue': {
        this.condition(i.condition, ctx, a)
        this.bloc(i.corps, ctx, { assignees: a, termine: false })
        return { assignees: a, termine: estLitteral(i.condition, true) }
      }
      case 'Repeter': {
        const fin = this.bloc(i.corps, ctx, { assignees: a, termine: false })
        if (i.condition) this.condition(i.condition, ctx, fin.assignees)
        return {
          assignees: fin.assignees,
          termine: fin.termine || (i.condition !== undefined && estLitteral(i.condition, false)),
        }
      }
      case 'AppelProcedure':
        this.appelInstruction(i.appel, ctx, a)
        return etat
      case 'Retourner': {
        const sp = ctx.sousProgramme
        if (!sp) {
          this.signaler('retour-hors-fonction', i.etendue)
          if (i.valeur) this.typer(i.valeur, ctx, a)
          return { assignees: a, termine: true }
        }
        if (sp.noeud.genre === 'Procedure') {
          if (i.valeur) {
            this.signaler('retour-dans-procedure', i.etendue, sp.nom)
            this.typer(i.valeur, ctx, a)
          }
        } else if (!i.valeur) {
          this.signaler('retour-sans-valeur', i.etendue, sp.nom)
        } else {
          const t = this.typer(i.valeur, ctx, a, sp.retour)
          if (!affectable(t, sp.retour)) {
            this.signaler('retour-type', i.valeur.etendue, sp.nom, avecArticle(sp.retour), avecArticle(t), this.conseil(t, sp.retour))
          }
        }
        return { assignees: a, termine: true }
      }
      default:
        return etat
    }
  }

  private corpsBoucle(corps: Instruction[], ctx: Contexte, assignees: Set<string>, compteur: string | undefined): void {
    const compteurs = new Set(ctx.compteurs)
    const dedans = new Set(assignees)
    if (compteur) {
      compteurs.add(compteur)
      dedans.add(compteur)
    }
    this.bloc(corps, { ...ctx, compteurs }, { assignees: dedans, termine: false })
  }

  private condition(e: Expression, ctx: Contexte, a: Set<string>): void {
    const t = this.typer(e, ctx, a)
    if (t.genre !== 'booleen' && t.genre !== 'quelconque') this.signaler('condition-non-booleenne', e.etendue, avecArticle(t))
  }

  /** Variable affectée par une instruction (affectation, Lire, compteur de boucle). */
  private variableModifiee(cible: Identifiant, ctx: Contexte): InfoVariable | undefined {
    const v = this.resoudre(cible, ctx)
    if (!v) return undefined
    v.utilisee = true
    this.types.set(cible.id, v.type)
    if (ctx.compteurs.has(v.nom)) this.signaler('compteur-modifie', cible.etendue, v.nom)
    return v
  }

  private lireElement(cible: Indice, ctx: Contexte, a: Set<string>): void {
    const t = this.typer(cible, ctx, a)
    const objet = this.types.get(cible.objet.id)
    if (objet?.genre === 'chaine') {
      this.signaler('chaine-immuable', cible.etendue, this.texte(cible.objet))
    } else if (objet?.genre === 'liste' && objet.element.genre === 'quelconque') {
      this.signaler('lire-liste-non-typee', cible.etendue, this.texte(cible.objet))
    } else if (t.genre === 'liste') {
      this.signaler('lire-liste', cible.etendue, this.texte(cible))
    }
  }

  private verifierAffectation(source: Type, cible: Type, noeudCible: Expression, etendue: Etendue): void {
    if (affectable(source, cible)) return
    this.signaler(
      'type-affectation',
      etendue,
      this.texte(noeudCible),
      avecArticle(cible),
      avecArticle(source),
      this.conseil(source, cible),
    )
  }

  /** Conversion à proposer pour passer du type `source` au type `cible`. */
  private conseil(source: Type, cible: Type): string | undefined {
    if (source.genre === 'reel' && cible.genre === 'entier') {
      return `Convertissez avec ${this.nom('int')}(…) ou ${this.nom('round')}(…).`
    }
    if (estNumerique(source) && cible.genre === 'chaine') return `Convertissez avec ${this.nom('str')}(…).`
    if (source.genre === 'chaine' && estNumerique(cible)) {
      return `Convertissez avec ${this.nom(cible.genre === 'entier' ? 'int' : 'float')}(…).`
    }
    return undefined
  }

  // ------------------------------------------------------------ Noms

  /** Variable désignée par `id` ; signale l'erreur si elle n'existe pas. */
  private resoudre(id: Identifiant, ctx: Contexte): InfoVariable | undefined {
    const v = ctx.portee.get(id.nom)
    if (v) return v
    if (this.sousProgrammes.has(id.nom) || (predefiniPython(id.nom)?.genre === 'fonction')) {
      this.signaler('fonction-sans-parentheses', id.etendue, id.nom)
    } else if (ctx.sousProgramme && this.principale.has(id.nom)) {
      this.signaler('variable-hors-portee', id.etendue, id.nom, `${ctx.sousProgramme.noeud.genre === 'Fonction' ? 'la fonction' : 'la procédure'} ${ctx.sousProgramme.nom}`)
    } else {
      const predefini = PREDEFINIS.find((p) => p.genre === 'fonction' && p.francais === id.nom)
      if (predefini) this.signaler('fonction-sans-parentheses', id.etendue, id.nom)
      else this.signaler('nom-non-declare', id.etendue, id.nom, plusProche(id.nom, ctx.portee.keys()))
    }
    return undefined
  }

  // ------------------------------------------------------------ Expressions

  /** Type de `e`, enregistré dans `types`. `attendu` sert à typer les listes écrites directement. */
  private typer(e: Expression, ctx: Contexte, a: Set<string>, attendu?: Type): Type {
    const t = this.typerNu(e, ctx, a, attendu)
    this.types.set(e.id, t)
    return t
  }

  private typerNu(e: Expression, ctx: Contexte, a: Set<string>, attendu?: Type): Type {
    switch (e.genre) {
      case 'Entier':
        return T.entier
      case 'Reel':
        return T.reel
      case 'Chaine':
        return T.chaine
      case 'Booleen':
        return T.booleen
      case 'ExpressionInvalide':
        return T.quelconque
      case 'Liste': {
        const cible = attendu?.genre === 'liste' ? attendu.element : undefined
        const types = e.elements.map((x) => this.typer(x, ctx, a, cible))
        if (cible && types.every((t) => affectable(t, cible))) return T.liste(cible)
        const commun = types.reduce<Type | undefined>((acc, t) => (acc === undefined ? t : unifier(acc, t) ?? T.quelconque), undefined)
        return T.liste(commun ?? T.quelconque)
      }
      case 'Identifiant': {
        const v = ctx.portee.get(e.nom)
        if (v) {
          v.utilisee = true
          if (!a.has(v.nom) && !ctx.signalees.has(v.nom)) {
            ctx.signalees.add(v.nom)
            this.signaler('variable-sans-valeur', e.etendue, v.nom)
          }
          return v.type
        }
        if (predefiniPython(e.nom)?.genre === 'constante') return T.reel
        this.resoudre(e, ctx)
        return T.quelconque
      }
      case 'Unaire': {
        const t = this.typer(e.operande, ctx, a)
        if (t.genre === 'quelconque') return t
        if (e.operateur === 'non') {
          if (t.genre !== 'booleen') this.signaler('operande-invalide', e.etendue, 'non', avecArticle(t))
          return T.booleen
        }
        if (!estNumerique(t)) {
          this.signaler('operande-invalide', e.etendue, '-', avecArticle(t))
          return T.quelconque
        }
        return t
      }
      case 'Binaire':
        return this.binaire(e.operateur, e, ctx, a)
      case 'Comparaison': {
        const types = e.operandes.map((o) => this.typer(o, ctx, a))
        e.operateurs.forEach((op, k) => {
          const g = types[k]
          const d = types[k + 1]
          if (!comparables(op, g, d)) {
            if (op === 'dans') {
              this.signaler('operande-invalide', e.etendue, 'dans', `${avecArticle(g)} et ${avecArticle(d)}`)
            } else {
              this.signaler('comparaison-invalide', e.etendue, avecArticle(g), avecArticle(d), op)
            }
          }
        })
        return T.booleen
      }
      case 'Appel':
        return this.appelExpression(e, ctx, a)
      case 'Indice': {
        const objet = this.typer(e.objet, ctx, a)
        this.indice(e.indice, ctx, a)
        if (objet.genre === 'chaine') return T.chaine
        if (objet.genre === 'liste') return objet.element
        if (objet.genre !== 'quelconque') this.signaler('indexation-invalide', e.objet.etendue, this.texte(e.objet), avecArticle(objet))
        return T.quelconque
      }
      case 'Tranche': {
        const objet = this.typer(e.objet, ctx, a)
        if (e.debut) this.indice(e.debut, ctx, a)
        if (e.fin) this.indice(e.fin, ctx, a)
        if (objet.genre === 'chaine' || objet.genre === 'liste' || objet.genre === 'quelconque') return objet
        this.signaler('indexation-invalide', e.objet.etendue, this.texte(e.objet), avecArticle(objet))
        return T.quelconque
      }
    }
  }

  private indice(e: Expression, ctx: Contexte, a: Set<string>): void {
    const t = this.typer(e, ctx, a)
    if (t.genre !== 'entier' && t.genre !== 'quelconque') this.signaler('indice-non-entier', e.etendue, avecArticle(t))
  }

  private binaire(op: string, e: Expression & { genre: 'Binaire' }, ctx: Contexte, a: Set<string>): Type {
    const g = this.typer(e.gauche, ctx, a)
    const d = this.typer(e.droite, ctx, a)
    if (g.genre === 'quelconque' || d.genre === 'quelconque') {
      return op === 'et' || op === 'ou' ? T.booleen : op === '/' ? T.reel : T.quelconque
    }
    const numeriques = estNumerique(g) && estNumerique(d)
    const lesDeux = `${avecArticle(g)} et ${avecArticle(d)}`
    const refuser = (conseil?: string): Type => {
      this.signaler('operande-invalide', e.etendue, op, lesDeux, conseil)
      return T.quelconque
    }
    switch (op) {
      case 'et':
      case 'ou':
        if (g.genre !== 'booleen' || d.genre !== 'booleen') refuser()
        return T.booleen
      case '+':
        if (numeriques) return g.genre === 'reel' || d.genre === 'reel' ? T.reel : T.entier
        if (g.genre === 'chaine' && d.genre === 'chaine') return T.chaine
        if (g.genre === 'liste' && d.genre === 'liste') return unifier(g, d) ?? T.liste(T.quelconque)
        if ((g.genre === 'chaine' && estNumerique(d)) || (d.genre === 'chaine' && estNumerique(g))) {
          return refuser(`Pour coller un nombre à une chaîne, convertissez-le avec ${this.nom('str')}(…).`)
        }
        return refuser()
      case '*':
        if (numeriques) return g.genre === 'reel' || d.genre === 'reel' ? T.reel : T.entier
        if ((g.genre === 'chaine' || g.genre === 'liste') && d.genre === 'entier') return g
        if ((d.genre === 'chaine' || d.genre === 'liste') && g.genre === 'entier') return d
        return refuser()
      case '-':
        if (numeriques) return g.genre === 'reel' || d.genre === 'reel' ? T.reel : T.entier
        return refuser()
      case '/':
        if (numeriques) return T.reel
        refuser()
        return T.reel
      case 'div':
      case 'mod':
        if (numeriques) return g.genre === 'reel' || d.genre === 'reel' ? T.reel : T.entier
        return refuser()
      case '^': {
        if (!numeriques) return refuser()
        if (g.genre === 'reel' || d.genre === 'reel') return T.reel
        // Un exposant négatif écrit tel quel donne un réel, comme en Python.
        const exposant = valeurEntiere(e.droite)
        return exposant !== undefined && exposant < 0n ? T.reel : T.entier
      }
      default:
        return T.quelconque
    }
  }

  // ------------------------------------------------------------ Appels

  /** Appel utilisé comme instruction. */
  private appelInstruction(appel: Appel, ctx: Contexte, a: Set<string>): void {
    if (appel.nom in PROCEDURES_PREDEFINIES) {
      this.procedurePredefinie(appel, ctx, a)
      return
    }
    const sp = this.sousProgrammes.get(appel.nom)
    const predefini = predefiniPython(appel.nom)
    if ((sp && sp.noeud.genre === 'Fonction') || predefini?.genre === 'fonction') {
      this.signaler('resultat-ignore', appel.etendue, this.nom(appel.nom, appel.arguments.length))
    }
    this.appel(appel, ctx, a)
  }

  /** Appel utilisé dans une expression. */
  private appelExpression(appel: Appel, ctx: Contexte, a: Set<string>): Type {
    const sp = this.sousProgrammes.get(appel.nom)
    if ((sp && sp.noeud.genre === 'Procedure') || appel.nom in PROCEDURES_PREDEFINIES) {
      this.signaler('procedure-dans-expression', appel.etendue, appel.nom)
      for (const x of appel.arguments) this.typer(x, ctx, a)
      return T.quelconque
    }
    return this.appel(appel, ctx, a)
  }

  private appel(appel: Appel, ctx: Contexte, a: Set<string>): Type {
    const sp = this.sousProgrammes.get(appel.nom)
    if (sp) {
      const attendus = sp.parametres
      if (appel.arguments.length !== attendus.length) {
        this.signaler('arguments-nombre', appel.etendue, sp.nom, nombreParametres(attendus.length, attendus.length), appel.arguments.length)
      }
      appel.arguments.forEach((x, k) => {
        const attendu = attendus[k]?.type
        const t = this.typer(x, ctx, a, attendu)
        if (attendu && !affectable(t, attendu)) {
          this.signaler('argument-type', x.etendue, sp.nom, k + 1, avecArticle(attendu), avecArticle(t), this.conseil(t, attendu))
        }
      })
      return sp.retour
    }
    const predefini = predefiniPython(appel.nom)
    const types = appel.arguments.map((x) => this.typer(x, ctx, a))
    if (predefini?.genre === 'fonction') return this.predefini(predefini, appel, types)
    if (predefini?.genre === 'constante') {
      this.signaler('constante-appelee', appel.etendue, appel.nom)
      return T.reel
    }
    if (ctx.portee.has(appel.nom) || this.principale.has(appel.nom)) {
      this.signaler('variable-appelee', appel.etendueNom, appel.nom)
      return T.quelconque
    }
    const candidats = [...this.sousProgrammes.keys(), ...PREDEFINIS.filter((p) => p.genre === 'fonction').map((p) => this.nom(p.python))]
    this.signaler('fonction-inconnue', appel.etendueNom, appel.nom, plusProche(appel.nom, candidats))
    return T.quelconque
  }

  private procedurePredefinie(appel: Appel, ctx: Contexte, a: Set<string>): void {
    const nom = appel.nom as keyof typeof PROCEDURES_PREDEFINIES
    const { min } = PROCEDURES_PREDEFINIES[nom]
    const [liste, ...autres] = appel.arguments
    if (appel.arguments.length !== min) {
      this.signaler('arguments-nombre', appel.etendue, nom, nombreParametres(min, min), appel.arguments.length)
    }
    if (!liste) return
    const t = this.typer(liste, ctx, a)
    const element = t.genre === 'liste' ? t.element : T.quelconque
    if (t.genre !== 'liste' && t.genre !== 'quelconque') this.signaler('liste-attendue', liste.etendue, nom, avecArticle(t))
    // ajouter(L, x) ; insérer(L, i, x) ; supprimer(L, i)
    const roles: ('indice' | 'valeur')[] = nom === 'ajouter' ? ['valeur'] : nom === 'insérer' ? ['indice', 'valeur'] : ['indice']
    autres.forEach((x, k) => {
      const role = roles[k]
      const attendu = role === 'indice' ? T.entier : element
      const tx = this.typer(x, ctx, a, attendu)
      if (role && !affectable(tx, attendu)) {
        this.signaler('argument-type', x.etendue, nom, k + 2, avecArticle(attendu), avecArticle(tx))
      }
    })
  }

  /** Vérifie un appel de fonction prédéfinie et renvoie le type du résultat. */
  private predefini(p: Predefini, appel: Appel, types: Type[]): Type {
    const nom = this.nom(p.python, types.length)
    if (types.length < p.min || types.length > p.max) {
      this.signaler('arguments-nombre', appel.etendue, nom, nombreParametres(p.min, p.max), types.length)
      return T.quelconque
    }
    let correct = true
    const exiger = (k: number, accepte: (t: Type) => boolean, description: string) => {
      const t = types[k]
      if (t.genre === 'quelconque' || accepte(t)) return
      correct = false
      this.signaler('argument-type', appel.arguments[k].etendue, nom, k + 1, description, avecArticle(t))
    }
    const nombre = (k: number) => exiger(k, estNumerique, 'un nombre')
    const entier = (k: number) => exiger(k, (t) => t.genre === 'entier', 'un entier')
    const [t0] = types
    const reelSi = (t: Type): Type => (t.genre === 'reel' ? T.reel : t.genre === 'entier' ? T.entier : T.quelconque)

    switch (p.python) {
      case 'abs':
        nombre(0)
        return correct ? reelSi(t0) : T.quelconque
      case 'round':
        nombre(0)
        if (types.length === 2) {
          entier(1)
          return correct ? reelSi(t0) : T.quelconque
        }
        return T.entier
      case 'min':
      case 'max': {
        if (types.length === 1) {
          exiger(0, (t) => t.genre === 'liste' || t.genre === 'chaine', 'une liste ou une chaîne')
          if (t0.genre === 'liste') return t0.element
          return t0.genre === 'chaine' ? T.chaine : T.quelconque
        }
        let commun: Type = t0
        for (let k = 1; k < types.length; k++) {
          const u = unifier(commun, types[k])
          if (!u || u.genre === 'booleen' || u.genre === 'liste') {
            this.signaler('argument-type', appel.arguments[k].etendue, nom, k + 1, avecArticle(commun), avecArticle(types[k]))
            return T.quelconque
          }
          commun = u
        }
        return commun
      }
      case 'sum':
        exiger(0, (t) => t.genre === 'liste' && (estNumerique(t.element) || t.element.genre === 'quelconque'), 'une liste de nombres')
        return t0.genre === 'liste' && estNumerique(t0.element) ? t0.element : T.quelconque
      case 'len':
        exiger(0, (t) => t.genre === 'liste' || t.genre === 'chaine', 'une liste ou une chaîne')
        return T.entier
      case 'int':
        exiger(0, (t) => estNumerique(t) || t.genre === 'chaine' || t.genre === 'booleen', 'un nombre ou une chaîne')
        return T.entier
      case 'float':
        exiger(0, (t) => estNumerique(t) || t.genre === 'chaine', 'un nombre ou une chaîne')
        return T.reel
      case 'str':
        return T.chaine
      case 'ord':
        exiger(0, (t) => t.genre === 'chaine', 'une chaîne')
        return T.entier
      case 'chr':
        entier(0)
        return T.chaine
      case 'floor':
      case 'ceil':
        nombre(0)
        return T.entier
      case 'log':
        nombre(0)
        if (types.length === 2) nombre(1)
        return T.reel
      case 'random':
        return T.reel
      case 'randint':
        entier(0)
        entier(1)
        return T.entier
      case 'choice':
        exiger(0, (t) => t.genre === 'liste' || t.genre === 'chaine', 'une liste ou une chaîne')
        return t0.genre === 'liste' ? t0.element : t0.genre === 'chaine' ? T.chaine : T.quelconque
      default:
        // sqrt, exp, log10 et fonctions trigonométriques.
        for (let k = 0; k < types.length; k++) nombre(k)
        return T.reel
    }
  }
}

// ---------------------------------------------------------------- Utilitaires

function intersection(a: Set<string> | undefined, b: Set<string> | undefined): Set<string> | undefined {
  if (a === undefined) return b && new Set(b)
  if (b === undefined) return a
  return new Set([...a].filter((x) => b.has(x)))
}

function nombreParametres(min: number, max: number): string {
  const n = (k: number) => (k === 0 ? 'aucun paramètre' : k === 1 ? '1 paramètre' : `${k} paramètres`)
  if (min === max) return n(min)
  if (max === Infinity) return `au moins ${n(min)}`
  return `${min} ou ${n(max)}`
}

/** Valeur d'un entier écrit tel quel (`3`, `-2`), sinon `undefined`. */
function valeurEntiere(e: Expression): bigint | undefined {
  if (e.genre === 'Entier') return e.valeur
  if (e.genre === 'Unaire' && e.operateur === '-') {
    const v = valeurEntiere(e.operande)
    return v === undefined ? undefined : -v
  }
  return undefined
}

function estLitteral(e: Expression, valeur: boolean): boolean {
  return e.genre === 'Booleen' && e.valeur === valeur
}

function comparables(op: string, g: Type, d: Type): boolean {
  if (g.genre === 'quelconque' || d.genre === 'quelconque') return true
  if (op === 'dans') {
    if (d.genre === 'chaine') return g.genre === 'chaine'
    if (d.genre === 'liste') return comparables('=', g, d.element)
    return false
  }
  if (estNumerique(g) && estNumerique(d)) return true
  if (op === '=' || op === '≠') return egaux(g, d) || (g.genre === 'liste' && d.genre === 'liste')
  if (g.genre === 'chaine' && d.genre === 'chaine') return true
  return g.genre === 'liste' && d.genre === 'liste'
}
