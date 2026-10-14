import { texteChaine } from '../langage/formateur.ts'
import { raisonReservee } from '../langage/predefinis.ts'
import { analyserExpressionAB, decouperHorsGroupes, type ExpressionAB } from './expressions.ts'
import type { FichierAlg, LigneAlg } from './lecture.ts'

/**
 * Conversion d'un fichier `.alg` en pseudo-code AlgoWeb (PLAN.md, section 5.2).
 *
 * Le type des variables `NOMBRE` se déduit par point fixe : toutes partent
 * entières et deviennent réelles dès qu'elles reçoivent une valeur réelle.
 * Une variable lue au clavier est réelle, sauf si elle sert de borne de
 * boucle, d'indice ou d'opérande de `mod`. Les paramètres prennent le type des
 * arguments reçus.
 */

// ---------------------------------------------------------------- Rapport

export interface TypeDeduit {
  nom: string
  /** Sous-programme où la variable est déclarée, ou null pour l'algorithme principal. */
  portee: string | null
  type: string
  raison: string
  /** Ligne de la valeur renvoyée par une fonction, et non d'une variable. */
  retour?: boolean
}

export interface PointAVerifier {
  /** Lignes du texte AlgoWeb produit concernées (vide pour un point général). */
  lignes: number[]
  message: string
}

export interface RapportImport {
  /** Nombre de lignes AlgoBox converties. */
  lignes: number
  types: TypeDeduit[]
  points: PointAVerifier[]
  /** Réglages d'AlgoBox qui ne sont pas repris. */
  ignores: string[]
}

export interface ResultatConversion {
  code: string
  rapport: RapportImport
}

// ---------------------------------------------------------------- Variables et types

type Genre = 'nombre' | 'chaine' | 'liste' | 'booleen'
type TypeAB = 'entier' | 'reel' | 'chaine' | 'booleen' | 'liste' | 'inconnu'

interface Variable {
  /** Nom AlgoBox. */
  nom: string
  /** Nom AlgoWeb, différent si le nom AlgoBox est réservé. */
  sortie: string
  genre: Genre
  /** Le genre peut changer : paramètre ou valeur de retour, non déclarés chez AlgoBox. */
  genreLibre: boolean
  /** Reçoit une valeur réelle (pour une liste : ses éléments). */
  reel: boolean
  ligneReel?: number
  lue: boolean
  contexteEntier: boolean
  compteur: boolean
  parametre: boolean
  appelsVus: boolean
}

interface SousProgramme {
  nom: string
  sortie: string
  /** Absent pour F1 et F2. */
  ligne?: LigneAlg
  parametres: Variable[]
  /** Paramètres et variables locales. */
  portee: Map<string, Variable>
  locales: Variable[]
  retour: Variable
  renvoie: boolean
}

function variable(nom: string, genre: Genre, options: Partial<Variable> = {}): Variable {
  return {
    nom,
    sortie: nom,
    genre,
    genreLibre: false,
    reel: false,
    lue: false,
    contexteEntier: false,
    compteur: false,
    parametre: false,
    appelsVus: false,
    ...options,
  }
}

function estReel(v: Variable): boolean {
  return v.reel || ((v.lue || (v.parametre && !v.appelsVus)) && !v.contexteEntier)
}

function typeVariable(v: Variable): TypeAB {
  if (v.genre === 'nombre') return estReel(v) ? 'reel' : 'entier'
  return v.genre
}

function typeDeclare(v: Variable): string {
  switch (v.genre) {
    case 'nombre':
      return estReel(v) ? 'réel' : 'entier'
    case 'chaine':
      return 'chaîne'
    case 'booleen':
      return 'booléen'
    case 'liste':
      return v.reel ? 'liste de réels' : "liste d'entiers"
  }
}

function raisonType(v: Variable): string {
  const ligne = v.ligneReel === undefined ? '' : ` (ligne ${v.ligneReel})`
  switch (v.genre) {
    case 'chaine':
      return v.parametre ? 'reçoit une chaîne' : 'déclarée CHAINE'
    case 'booleen':
      return 'reçoit une condition'
    case 'liste':
      return (v.parametre ? 'reçoit une liste' : 'déclarée LISTE') + (v.reel ? `, éléments réels${ligne}` : ', éléments entiers')
    case 'nombre':
      if (v.reel) return `reçoit une valeur réelle${ligne}`
      if (v.compteur) return 'compteur de boucle'
      if (v.lue) return v.contexteEntier ? 'lue au clavier, sert de borne de boucle, d’indice ou d’opérande de mod' : 'lue au clavier'
      if (v.parametre && !v.appelsVus) return v.contexteEntier ? 'sert de borne de boucle, d’indice ou d’opérande de mod' : 'jamais appelée : réel par défaut'
      return 'ne reçoit que des valeurs entières'
  }
}

// ---------------------------------------------------------------- Expressions traduites

/** Priorités AlgoWeb, comme dans le formateur. */
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

interface Traduit {
  texte: string
  p: number
  type: TypeAB
  /** Variable désignée directement, pour unifier les listes passées en argument. */
  variable?: Variable
  /** Valeur entière connue (littéral). */
  valeur?: bigint
}

function entoure(t: Traduit, minimum: number): string {
  return t.p < minimum ? `(${t.texte})` : t.texte
}

function numerique(t: TypeAB): boolean {
  return t === 'entier' || t === 'reel'
}

/** Type d'une opération arithmétique. */
function joindre(a: TypeAB, b: TypeAB): TypeAB {
  if (a === 'entier' && b === 'entier') return 'entier'
  if (numerique(a) && numerique(b)) return 'reel'
  return 'inconnu'
}

/** Fonctions mathématiques d'AlgoBox, sans préfixe ou après `Math.`, sans distinction de casse. */
const MATHS: Record<string, { nom: string; type: (args: TypeAB[]) => TypeAB }> = {
  sqrt: { nom: 'sqrt', type: () => 'reel' },
  cos: { nom: 'cos', type: () => 'reel' },
  sin: { nom: 'sin', type: () => 'reel' },
  tan: { nom: 'tan', type: () => 'reel' },
  acos: { nom: 'acos', type: () => 'reel' },
  asin: { nom: 'asin', type: () => 'reel' },
  atan: { nom: 'atan', type: () => 'reel' },
  exp: { nom: 'exp', type: () => 'reel' },
  log: { nom: 'log', type: () => 'reel' },
  random: { nom: 'random', type: () => 'reel' },
  floor: { nom: 'floor', type: () => 'entier' },
  ceil: { nom: 'ceil', type: () => 'entier' },
  round: { nom: 'round', type: () => 'entier' },
  trunc: { nom: 'int', type: () => 'entier' },
  abs: { nom: 'abs', type: (a) => (a[0] === 'entier' ? 'entier' : 'reel') },
  max: { nom: 'max', type: (a) => a.reduce(joindre, 'entier') },
  min: { nom: 'min', type: (a) => a.reduce(joindre, 'entier') },
}

const COMPARAISONS: Partial<Record<string, string>> = {
  '==': '=',
  '===': '=',
  '!=': '≠',
  '!==': '≠',
  '<': '<',
  '<=': '≤',
  '>': '>',
  '>=': '≥',
}

/** Champ `rang` d'une ligne : absent pour une variable qui n'est pas une liste. */
function rang(champ: string | undefined): string | undefined {
  const r = champ?.trim()
  return r === undefined || r === '' || r === 'pasliste' ? undefined : r
}

const IDENTIFIANT = /^[\p{L}_][\p{L}\p{M}\p{Nd}_]*$/u

/** Lignes de structure, déjà rendues par le bloc qui les contient. */
const STRUCTURE = new Set([7, 8, 10, 11, 13, 14, 16, 17, 202, 203, 204])

// ---------------------------------------------------------------- Convertisseur

class Convertisseur {
  private readonly globales = new Map<string, Variable>()
  private readonly ordreGlobales: Variable[] = []
  private readonly sousProgrammes = new Map<string, SousProgramme>()
  private readonly renommages: string[] = []

  // État d'une passe.
  private lignes: string[] = []
  /** Points à vérifier, par message, avec leurs lignes. */
  private points = new Map<string, Set<number>>()
  private portee: Map<string, Variable> = this.globales
  private courant: SousProgramme | undefined
  private ligneCourante = 0
  private change = false
  private convertis = 0
  /** La ligne en cours contient une syntaxe JavaScript sans équivalent dans AlgoWeb. */
  private invalide = false

  private readonly fichier: FichierAlg
  private readonly nom: string

  constructor(fichier: FichierAlg, nom: string) {
    this.fichier = fichier
    this.nom = nom
    this.preparer()
  }

  // ------------------------------------------------------------ Noms

  private preparer(): void {
    const f = this.fichier
    const nouveau = (nom: string, parametres: string[], ligne?: LigneAlg): SousProgramme => {
      const params = parametres.map((p) => variable(p, 'nombre', { genreLibre: true, parametre: true }))
      return {
        nom,
        sortie: nom,
        ligne,
        parametres: params,
        portee: new Map(params.map((p) => [p.nom, p])),
        locales: [],
        retour: variable(nom, 'nombre', { genreLibre: true }),
        renvoie: ligne === undefined,
      }
    }
    if (f.f1 !== undefined) this.sousProgrammes.set('F1', nouveau('F1', ['x']))
    if (f.f2) this.sousProgrammes.set('F2', nouveau('F2', f.f2.parametres))
    for (const l of f.fonctions) {
      if (l.code !== 201) continue
      const nom = (l.champs[0] ?? '').trim()
      if (nom === '' || this.sousProgrammes.has(nom)) continue
      const parametres = (l.champs[1] ?? '').split(',').map((p) => p.trim()).filter((p) => p !== '')
      const sp = nouveau(nom, parametres, l)
      for (const d of l.enfants.find((e) => e.code === 202)?.enfants ?? []) {
        const v = this.declaration(d)
        if (v && !sp.portee.has(v.nom)) {
          sp.portee.set(v.nom, v)
          sp.locales.push(v)
        }
      }
      sp.renvoie = contientRenvoyer(l.enfants)
      this.sousProgrammes.set(nom, sp)
    }
    for (const d of f.variables) {
      const v = this.declaration(d)
      if (v && !this.globales.has(v.nom)) {
        this.globales.set(v.nom, v)
        this.ordreGlobales.push(v)
      }
    }

    // Renommage des noms réservés par AlgoWeb ou déjà pris. Les noms gardés
    // sont réservés d'abord, pour qu'un nom renommé ne prenne jamais la place
    // d'un autre déclaré plus loin.
    type Nomme = { nom: string; sortie: string }
    const renommer = (groupe: { v: Nomme; quoi: string }[], genre: (v: Nomme) => 'variable' | 'sous-programme', pris: Set<string>) => {
      const libre = (n: string, v: Nomme) => IDENTIFIANT.test(n) && raisonReservee(n, genre(v)) === undefined && !pris.has(n)
      const aRenommer = groupe.filter(({ v }) => {
        if (!libre(v.nom, v)) return true
        pris.add(v.nom)
        return false
      })
      for (const { v, quoi } of aRenommer) {
        const valide = IDENTIFIANT.test(v.nom)
        let base = v.nom.replace(/[^\p{L}\p{M}\p{Nd}_]/gu, '_')
        if (!/^[\p{L}_]/u.test(base)) base = `_${base}`
        let candidat = valide ? `${base}_` : base
        for (let k = 2; !libre(candidat, v); k++) candidat = `${base}_${k}`
        const raison = !valide
          ? 'ce nom n’est pas un identifiant valide'
          : raisonReservee(v.nom, genre(v)) !== undefined
            ? 'ce nom est réservé dans AlgoWeb'
            : 'ce nom est déjà utilisé'
        v.sortie = candidat
        pris.add(candidat)
        this.renommages.push(`« ${v.nom} » (${quoi}) devient « ${candidat} » : ${raison}.`)
      }
    }
    const sousProgrammes = [...this.sousProgrammes.values()]
    const pris = new Set<string>()
    renommer(
      [...sousProgrammes.map((v) => ({ v, quoi: 'fonction' })), ...this.ordreGlobales.map((v) => ({ v, quoi: 'variable' }))],
      (v) => (this.sousProgrammes.get(v.nom) === v ? 'sous-programme' : 'variable'),
      pris,
    )
    for (const sp of sousProgrammes) {
      const groupe = [...sp.portee.values()].map((v) => ({ v, quoi: `${v.parametre ? 'paramètre' : 'variable locale'} de ${sp.sortie}` }))
      renommer(groupe, () => 'variable', new Set(sousProgrammes.map((s) => s.sortie)))
    }
  }

  private declaration(l: LigneAlg): Variable | undefined {
    if (l.code !== 1) return undefined
    const type = (l.champs[0] ?? '').trim().toUpperCase()
    const nom = (l.champs[1] ?? '').trim()
    if (nom === '') return undefined
    return variable(nom, type === 'CHAINE' ? 'chaine' : type === 'LISTE' ? 'liste' : 'nombre')
  }

  // ------------------------------------------------------------ Passes

  convertir(): ResultatConversion {
    this.passe()
    // Les marques d'usage (lecture, borne, indice) sont complètes après une passe :
    // on repart des types entiers pour ne pas garder un « réel » prématuré.
    for (const v of this.toutesVariables()) {
      v.reel = false
      v.ligneReel = undefined
    }
    for (let n = 0; n < 50; n++) {
      this.change = false
      this.passe()
      if (!this.change) break
    }
    return { code: this.lignes.join('\n') + '\n', rapport: this.rapport() }
  }

  private toutesVariables(): Variable[] {
    return [
      ...this.ordreGlobales,
      ...[...this.sousProgrammes.values()].flatMap((sp) => [...sp.portee.values(), sp.retour]),
    ]
  }

  private rapport(): RapportImport {
    const types: TypeDeduit[] = []
    for (const sp of this.sousProgrammes.values()) {
      const f = sp.ligne ? undefined : `fonction ${sp.nom} d’AlgoBox, toujours réelle`
      for (const v of sp.portee.values()) types.push({ nom: v.sortie, portee: sp.sortie, type: typeDeclare(v), raison: f ?? raisonType(v) })
      if (sp.renvoie) types.push({ nom: 'valeur renvoyée', portee: sp.sortie, type: this.typeRetour(sp), raison: f ?? raisonType(sp.retour), retour: true })
    }
    for (const v of this.ordreGlobales) types.push({ nom: v.sortie, portee: null, type: typeDeclare(v), raison: raisonType(v) })
    const f = this.fichier
    const ignores = [
      f.repereActif && 'Le repère graphique n’est pas repris : AlgoWeb ne trace pas de graphiques.',
      f.extension !== undefined && `L’extension JavaScript (${f.extension}) n’est pas reprise.`,
      f.avecParametres && 'Les réglages d’exécution d’AlgoBox (arrondi automatique, nombre de décimales, limites de boucles et d’affichages) ne sont pas repris.',
      ...f.inconnus.map((t) => `Bloc inconnu ignoré : ${t}.`),
    ].filter((t): t is string => typeof t === 'string')
    const points: PointAVerifier[] = [
      ...this.renommages.map((message) => ({ lignes: [], message })),
      ...[...this.points].map(([message, lignes]) => ({ lignes: [...lignes].sort((a, b) => a - b), message })),
    ].sort((a, b) => (a.lignes[0] ?? 0) - (b.lignes[0] ?? 0))
    return { lignes: this.convertis, types, points, ignores }
  }

  private typeRetour(sp: SousProgramme): string {
    return sp.ligne ? typeDeclare(sp.retour) : 'réel'
  }

  private passe(): void {
    this.lignes = []
    this.points = new Map()
    this.convertis = 0
    this.ajouter(0, `Algorithme ${this.nom}`)
    this.ajouter(0, '')
    const f = this.fichier
    for (const sp of this.sousProgrammes.values()) {
      if (sp.ligne) continue
      this.sousProgrammeF(sp)
      this.ajouter(0, '')
    }
    for (const l of f.fonctions) {
      if (l.code === 201) {
        const sp = this.sousProgrammes.get((l.champs[0] ?? '').trim())
        if (sp?.ligne !== l) continue
        this.sousProgramme(sp)
        this.ajouter(0, '')
      } else if (l.code === 19 || (l.code === 103 && this.lignes.at(-1) !== '')) {
        this.instruction(l, 0)
      }
    }
    this.courant = undefined
    this.portee = this.globales
    this.ajouter(0, 'Variables')
    for (const d of f.variables) {
      if (d.code === 1) {
        const v = this.globales.get((d.champs[1] ?? '').trim())
        if (v) {
          this.ajouter(1, `${v.sortie} : ${typeDeclare(v)}`)
          this.convertis++
        }
      } else if (d.code === 19) this.instruction(d, 1)
    }
    this.ajouter(0, 'Début')
    for (const v of this.ordreGlobales) if (v.genre === 'liste') this.ajouter(1, `${v.sortie} ← []`)
    this.bloc(f.instructions, 1)
    this.ajouter(0, 'Fin')
  }

  // ------------------------------------------------------------ Sorties

  private ajouter(niveau: number, texte: string): void {
    this.lignes.push(texte === '' ? '' : '  '.repeat(niveau) + texte)
    this.ligneCourante = this.lignes.length + 1
  }

  private signaler(message: string, ligne: number = this.ligneCourante): void {
    const lignes = this.points.get(message) ?? new Set()
    lignes.add(ligne)
    this.points.set(message, lignes)
  }

  private monterReel(v: Variable): void {
    if (!v.reel) {
      v.reel = true
      v.ligneReel = this.ligneCourante
      this.change = true
    }
  }

  /** Une valeur de type `t` est rangée dans `v`. */
  private recevoir(v: Variable, t: TypeAB, source?: Variable): void {
    if (v.genreLibre && t !== 'inconnu' && t !== 'entier' && t !== 'reel' && v.genre !== t) {
      if (v.genre === 'nombre' || t === 'chaine') {
        v.genre = t
        this.change = true
      }
    }
    if (v.genre === 'nombre' && (t === 'reel' || t === 'inconnu')) this.monterReel(v)
    if (v.genre === 'liste' && source?.genre === 'liste') {
      // Une liste passée en argument : les deux listes ont le même type d'éléments.
      if (estReel(source) || source.reel) this.monterReel(v)
      if (v.reel && !source.reel) this.monterReel(source)
    }
  }

  private marquerEntier(e: ExpressionAB): void {
    if (e.g === 'nom') {
      const v = this.portee.get(e.nom) ?? this.globales.get(e.nom)
      if (v && v.genre === 'nombre' && !v.contexteEntier) {
        v.contexteEntier = true
        this.change = true
      }
    } else if (e.g === 'unaire' && e.op !== '!') this.marquerEntier(e.operande)
    else if (e.g === 'binaire' && ['+', '-', '*', '%'].includes(e.op)) {
      this.marquerEntier(e.gauche)
      this.marquerEntier(e.droite)
    }
  }

  // ------------------------------------------------------------ Sous-programmes

  private entrer(sp: SousProgramme): void {
    this.courant = sp
    this.portee = sp.portee
  }

  private entete(sp: SousProgramme): void {
    const parametres = sp.parametres.map((p) => `${p.sortie} : ${typeDeclare(p)}`).join(', ')
    this.ajouter(0, sp.renvoie ? `Fonction ${sp.sortie}(${parametres}) : ${this.typeRetour(sp)}` : `Procédure ${sp.sortie}(${parametres})`)
  }

  /** F1 ou F2, définies dans les réglages d'AlgoBox. */
  private sousProgrammeF(sp: SousProgramme): void {
    this.entrer(sp)
    for (const p of sp.parametres) this.monterReel(p)
    this.monterReel(sp.retour)
    this.entete(sp)
    this.ajouter(0, 'Début')
    const f = this.fichier
    if (sp.nom === 'F1') {
      this.ajouter(1, `Retourner ${this.traduire(f.f1 ?? '').texte}`)
    } else if (f.f2) {
      for (const l of f.f2.lignes) {
        this.ajouter(1, `Si ${this.traduire(l.condition).texte} alors`)
        this.ajouter(2, `Retourner ${this.traduire(l.valeur).texte}`)
        this.ajouter(1, 'FinSi')
      }
      if (f.f2.defaut.trim() === '') this.signaler('F2 n’avait pas de valeur par défaut : 0 est renvoyé.', this.ligneCourante)
      this.ajouter(1, `Retourner ${f.f2.defaut.trim() === '' ? '0' : this.traduire(f.f2.defaut).texte}`)
    }
    this.ajouter(0, 'FinFonction')
    this.convertis++
  }

  private sousProgramme(sp: SousProgramme): void {
    const l = sp.ligne!
    this.entrer(sp)
    this.entete(sp)
    this.convertis++
    const declarations = l.enfants.find((e) => e.code === 202)?.enfants ?? []
    if (sp.locales.length > 0 || declarations.some((d) => d.code === 19)) {
      this.ajouter(0, 'Variables')
      for (const d of declarations) {
        if (d.code === 1) {
          const v = sp.portee.get((d.champs[1] ?? '').trim())
          if (v && !v.parametre) {
            this.ajouter(1, `${v.sortie} : ${typeDeclare(v)}`)
            this.convertis++
          }
        } else if (d.code === 19) this.instruction(d, 1)
      }
    }
    this.ajouter(0, 'Début')
    for (const v of sp.locales) if (v.genre === 'liste') this.ajouter(1, `${v.sortie} ← []`)
    this.bloc(l.enfants, 1)
    this.ajouter(0, sp.renvoie ? 'FinFonction' : 'FinProcédure')
    this.courant = undefined
    this.portee = this.globales
  }

  // ------------------------------------------------------------ Instructions

  private bloc(lignes: LigneAlg[], niveau: number): void {
    for (let k = 0; k < lignes.length; k++) {
      const l = lignes[k]
      if (STRUCTURE.has(l.code)) continue
      if (l.code === 6 && lignes[k + 1]?.code === 9 && !l.enfants.some((e) => e.code === 9)) {
        this.si(l, niveau, lignes[k + 1])
        k++
      } else this.instruction(l, niveau)
    }
  }

  /** Instructions simples : gardées en commentaire si elles ne peuvent pas être converties. */
  private static readonly SIMPLES = new Set([2, 3, 5, 20, 205, 206])

  private instruction(l: LigneAlg, n: number): void {
    const avant = this.lignes.length
    this.invalide = false
    this.instructionBrute(l, n)
    if (this.invalide && Convertisseur.SIMPLES.has(l.code)) {
      this.lignes.length = avant
      this.ligneCourante = avant + 1
      this.signaler('Ligne gardée en commentaire, car elle n’a pas pu être convertie : réécrivez-la.')
      this.ajouter(n, `// [AlgoBox, non converti] ${l.texte}`)
    }
  }

  private instructionBrute(l: LigneAlg, n: number): void {
    const c = l.champs
    this.ligneCourante = this.lignes.length + 1
    if (l.code !== 103) this.convertis++
    switch (l.code) {
      case 2: {
        const cible = this.cible(c[0], rang(c[1]), 'lecture')
        if (cible.variable) {
          if (rang(c[1]) === undefined) cible.variable.lue = true
          else if (cible.variable.genre === 'liste') this.monterReel(cible.variable)
        }
        this.ajouter(n, `Lire ${cible.texte}`)
        break
      }
      case 3:
        this.ajouter(n, `Afficher ${this.cible(c[0], rang(c[2])).texte}${c[1]?.trim() === '1' ? ' ↵' : ''}`)
        break
      case 4: {
        const [texte, retour] = texteEtRetour(c)
        this.ajouter(n, texte === '' && retour ? 'Afficher ↵' : `Afficher ${texteChaine(texte)}${retour ? ' ↵' : ''}`)
        break
      }
      case 5:
        this.affectation(c[0], c[1] ?? '', rang(c[2]), n)
        break
      case 6:
        this.si(l, n)
        break
      case 9:
        // SINON isolé, sans SI devant : son contenu est gardé.
        this.signaler('Bloc SINON sans SI : son contenu est conservé tel quel.')
        this.bloc(l.enfants, n)
        break
      case 12:
        this.pour(l, n)
        break
      case 15:
        this.ajouter(n, `TantQue ${this.condition(c[0])} faire`)
        this.bloc(l.enfants, n + 1)
        this.ajouter(n, 'FinTantQue')
        break
      case 18:
        this.ajouter(n, 'Pause')
        break
      case 19:
        this.ajouter(n, `//${c.join('#')}`)
        break
      case 20: {
        const [calcul, retour] = texteEtRetour(c)
        this.ajouter(n, `Afficher ${this.traduire(calcul).texte}${retour ? ' ↵' : ''}`)
        break
      }
      case 103:
        this.ajouter(n, '')
        break
      case 205: {
        const t = this.traduire(c.join('#'))
        if (this.courant) this.recevoir(this.courant.retour, t.type, t.variable)
        else this.signaler('RENVOYER hors d’une fonction.')
        this.ajouter(n, `Retourner ${t.texte}`)
        break
      }
      case 206:
        this.ajouter(n, this.traduire(c.join('#')).texte)
        break
      case 50:
      case 51:
      case 52:
        this.signaler('Instruction graphique non convertie : AlgoWeb ne trace pas de graphiques.')
        this.ajouter(n, `// [AlgoBox, non converti] ${l.texte}`)
        break
      default:
        this.signaler(`Ligne AlgoBox inconnue (code ${l.code < 0 ? '?' : l.code}) : elle est gardée en commentaire.`)
        this.ajouter(n, `// [AlgoBox, non converti] ${l.texte}`)
    }
  }

  /** Cible d'une lecture, d'un affichage ou d'une affectation : `x` ou `L[r]`. */
  private cible(nom: string | undefined, r: string | undefined, usage?: 'lecture' | 'affectation'): Traduit {
    const t = this.traduire((nom ?? '').trim())
    if (r === undefined) return t
    const indice = this.traduire(r, true)
    if (usage) {
      this.signaler(
        usage === 'lecture'
          ? 'Lecture dans une liste : les listes AlgoWeb commencent à l’indice 0 et ne s’agrandissent pas seules.'
          : 'Affectation dans une liste : les listes AlgoWeb commencent à l’indice 0 et ne s’agrandissent pas seules ; pour ajouter un élément, utilisez ajouter(L, x).',
      )
    }
    return { texte: `${entoure(t, P.postfixe)}[${indice.texte}]`, p: P.postfixe, type: 'inconnu', variable: t.variable }
  }

  private affectation(nom: string | undefined, expression: string, r: string | undefined, n: number): void {
    // `L[r] PREND_LA_VALEUR a:b:c` remplit plusieurs cases à partir du rang r.
    const valeurs = r === undefined ? [expression] : decouperHorsGroupes(expression, ':')
    valeurs.forEach((texte, k) => {
      this.ligneCourante = this.lignes.length + 1
      const rangK = r === undefined ? undefined : k === 0 ? r : this.plus(r, k)
      const cible = this.cible(nom, rangK, 'affectation')
      const valeur = this.traduire(texte)
      const v = cible.variable
      if (v) {
        if (r !== undefined && v.genre === 'liste') {
          if (valeur.type !== 'entier') this.monterReel(v)
        } else this.recevoir(v, valeur.type, valeur.variable)
      }
      this.ajouter(n, `${cible.texte} ← ${valeur.texte}`)
    })
  }

  /** Texte de `r + k`. */
  private plus(r: string, k: number): string {
    if (/^\s*\d+\s*$/.test(r)) return String(Number(r) + k)
    return `${entoure(this.traduire(r), P.additif)} + ${k}`
  }

  private condition(texte: string | undefined): string {
    return this.traduire(texte ?? '').texte
  }

  private si(l: LigneAlg, n: number, sinonVoisin?: LigneAlg): void {
    this.ajouter(n, `Si ${this.condition(l.champs[0])} alors`)
    this.bloc(l.enfants.filter((e) => e.code !== 9), n + 1)
    let sinon = l.enfants.find((e) => e.code === 9) ?? sinonVoisin
    while (sinon) {
      this.ligneCourante = this.lignes.length + 1
      const corps = sinon.enfants.filter((e) => !STRUCTURE.has(e.code))
      const imbrique = corps.length === 1 && corps[0].code === 6 ? corps[0] : undefined
      if (imbrique) {
        // SINON contenant un seul SI : `Sinon si`.
        this.convertis++
        this.ajouter(n, `Sinon si ${this.condition(imbrique.champs[0])} alors`)
        this.bloc(imbrique.enfants.filter((e) => e.code !== 9), n + 1)
        sinon = imbrique.enfants.find((e) => e.code === 9)
      } else {
        this.convertis++
        this.ajouter(n, 'Sinon')
        this.bloc(sinon.enfants, n + 1)
        sinon = undefined
      }
    }
    this.ajouter(n, 'FinSi')
  }

  private pour(l: LigneAlg, n: number): void {
    const [nom = '', debut = '', fin = ''] = l.champs.map((c) => c.trim())
    const compteur = this.traduire(nom)
    if (compteur.variable && compteur.variable.genre === 'nombre') compteur.variable.compteur = true
    const de = this.traduire(debut, true)
    let a = this.traduire(fin, true)
    if (a.type === 'reel') {
      a = { texte: `floor(${a.texte})`, p: P.postfixe, type: 'entier' }
      this.signaler('La borne de fin de la boucle est réelle : elle est arrondie à l’entier inférieur (floor), ce qui donne les mêmes tours de boucle.')
    }
    // AlgoBox réévalue la borne de fin à chaque tour ; AlgoWeb l'évalue une seule fois.
    const modifiees = new Set<string>()
    nomsModifies(l.enfants, modifiees)
    const borne = new Set<string>()
    try {
      nomsDe(analyserExpressionAB(fin), borne)
    } catch {
      // Expression illisible, déjà signalée.
    }
    if ([...borne].some((b) => modifiees.has(b))) {
      this.signaler('La borne de fin est modifiée dans la boucle : AlgoBox la recalcule à chaque tour, AlgoWeb une seule fois au début.')
    }
    if (modifiees.has(nom)) {
      this.signaler(`Le compteur ${compteur.texte} est modifié dans la boucle : dans AlgoWeb, il reprend sa valeur suivante à chaque tour.`)
    }
    this.ajouter(n, `Pour ${compteur.texte} de ${de.texte} à ${a.texte} faire`)
    this.bloc(l.enfants, n + 1)
    this.ajouter(n, 'FinPour')
  }

  // ------------------------------------------------------------ Expressions

  /** Traduit une expression AlgoBox ; `entier` : elle doit être entière (borne, indice). */
  private traduire(texte: string, entier = false): Traduit {
    let e: ExpressionAB
    try {
      e = analyserExpressionAB(texte)
    } catch {
      this.signaler(`Expression illisible : « ${texte.trim()} ».`)
      this.invalide = true
      return { texte: texte.trim(), p: P.primaire, type: 'inconnu' }
    }
    if (entier) this.marquerEntier(e)
    return this.expr(e)
  }

  private chercher(nom: string): Variable | undefined {
    const v = this.portee.get(nom)
    if (v || !this.courant) return v
    const globale = this.globales.get(nom)
    if (globale) {
      this.signaler(`La fonction ${this.courant.sortie} utilise la variable ${globale.sortie} de l’algorithme principal : dans AlgoWeb, passez-la en paramètre.`)
    }
    return globale
  }

  private expr(e: ExpressionAB): Traduit {
    switch (e.g) {
      case 'nombre': {
        const texte = e.texte.replace(/^\./, '0.').replace(/\.(?=[eE]|$)/, '.0')
        return { texte, p: P.primaire, type: e.entier ? 'entier' : 'reel', valeur: e.entier ? BigInt(e.texte) : undefined }
      }
      case 'chaine':
        return { texte: texteChaine(e.valeur), p: P.primaire, type: 'chaine' }
      case 'booleen':
        return { texte: e.valeur ? 'vrai' : 'faux', p: P.primaire, type: 'booleen' }
      case 'nom': {
        const v = this.chercher(e.nom)
        if (v) return { texte: v.sortie, p: P.primaire, type: typeVariable(v), variable: v }
        if (e.nom === 'Infinity' || e.nom === 'NaN' || e.nom === 'undefined') {
          this.signaler(`Valeur JavaScript non convertie : ${e.nom}.`)
        }
        return { texte: e.nom, p: P.primaire, type: 'inconnu' }
      }
      case 'membre':
        return this.membre(e.objet, e.nom)
      case 'appel':
        return this.appel(e.fonction, e.arguments)
      case 'indice': {
        const objet = this.expr(e.objet)
        this.marquerEntier(e.indice)
        const indice = this.expr(e.indice)
        const type: TypeAB =
          objet.type === 'chaine' ? 'chaine' : objet.type === 'liste' && objet.variable ? (objet.variable.reel ? 'reel' : 'entier') : 'inconnu'
        return { texte: `${entoure(objet, P.postfixe)}[${indice.texte}]`, p: P.postfixe, type }
      }
      case 'unaire': {
        const o = this.expr(e.operande)
        if (e.op === '+') return o
        if (e.op === '!') return { texte: `non ${entoure(o, P.non)}`, p: P.non, type: 'booleen' }
        return {
          texte: `-${entoure(o, P.unaire)}`,
          p: P.unaire,
          type: numerique(o.type) ? o.type : 'inconnu',
          valeur: o.valeur === undefined ? undefined : -o.valeur,
        }
      }
      case 'binaire':
        return this.binaire(e)
    }
  }

  private binaire(e: Extract<ExpressionAB, { g: 'binaire' }>): Traduit {
    if (e.op === '%') {
      this.marquerEntier(e.gauche)
      this.marquerEntier(e.droite)
    }
    const g = this.expr(e.gauche)
    const d = this.expr(e.droite)
    const comparaison = COMPARAISONS[e.op]
    if (comparaison) {
      return { texte: `${entoure(g, P.additif)} ${comparaison} ${entoure(d, P.additif)}`, p: P.comparaison, type: 'booleen' }
    }
    switch (e.op) {
      case '&&':
        return { texte: `${entoure(g, P.et)} et ${entoure(d, P.et + 1)}`, p: P.et, type: 'booleen' }
      case '||':
        return { texte: `${entoure(g, P.ou)} ou ${entoure(d, P.ou + 1)}`, p: P.ou, type: 'booleen' }
      case '+':
        if (g.type === 'chaine' || d.type === 'chaine') {
          // Chaîne + nombre concatène chez AlgoBox : le nombre est converti par str.
          const texte = (t: Traduit) => (numerique(t.type) ? `str(${t.texte})` : t.texte)
          const gauche = numerique(g.type) ? texte(g) : entoure(g, P.additif)
          const droite = numerique(d.type) ? texte(d) : entoure(d, P.additif + 1)
          return { texte: `${gauche} + ${droite}`, p: P.additif, type: 'chaine' }
        }
        return this.arithmetique(g, '+', d, P.additif, joindre(g.type, d.type))
      case '-':
        return this.arithmetique(g, '-', d, P.additif, joindre(g.type, d.type))
      case '*':
        return this.arithmetique(g, '*', d, P.multiplicatif, joindre(g.type, d.type))
      case '/':
        return this.arithmetique(g, '/', d, P.multiplicatif, numerique(g.type) && numerique(d.type) ? 'reel' : 'inconnu')
      case '%':
        this.signaler('mod : avec un nombre négatif, le résultat diffère d’AlgoBox (-7 mod 2 vaut 1 dans AlgoWeb, -1 dans AlgoBox).')
        return this.arithmetique(g, 'mod', d, P.multiplicatif, joindre(g.type, d.type))
      case '^':
        this.signaler('« ^ » était le « ou exclusif » dans AlgoBox ; dans AlgoWeb, il désigne la puissance. Vérifiez l’intention.')
        return this.puissance(g, d)
      default:
        this.signaler(`Opérateur JavaScript non converti : « ${e.op} ».`)
        this.invalide = true
        return { texte: `${entoure(g, P.ou)} ${e.op} ${entoure(d, P.ou + 1)}`, p: 0, type: 'inconnu' }
    }
  }

  private arithmetique(g: Traduit, op: string, d: Traduit, p: number, type: TypeAB): Traduit {
    return { texte: `${entoure(g, p)} ${op} ${entoure(d, p + 1)}`, p, type }
  }

  private puissance(g: Traduit, d: Traduit): Traduit {
    const type = g.type === 'entier' && d.type === 'entier' && (d.valeur === undefined || d.valeur >= 0n) ? 'entier' : joindre(g.type, d.type) === 'inconnu' ? 'inconnu' : 'reel'
    return { texte: `${entoure(g, P.postfixe)}^${entoure(d, P.unaire)}`, p: P.puissance, type }
  }

  private membre(objet: ExpressionAB, nom: string): Traduit {
    if (objet.g === 'nom' && objet.nom === 'Math' && !this.portee.has('Math')) {
      if (nom === 'PI') return { texte: 'pi', p: P.primaire, type: 'reel' }
      if (nom === 'E') return { texte: 'e', p: P.primaire, type: 'reel' }
    }
    const o = this.expr(objet)
    if (nom === 'length') return { texte: `len(${o.texte})`, p: P.postfixe, type: 'entier' }
    this.signaler(`Expression JavaScript non convertie : « .${nom} ».`)
    this.invalide = true
    return { texte: `${entoure(o, P.postfixe)}.${nom}`, p: P.postfixe, type: 'inconnu' }
  }

  private appelSimple(nom: string, args: Traduit[], type: TypeAB): Traduit {
    return { texte: `${nom}(${args.map((a) => a.texte).join(', ')})`, p: P.postfixe, type }
  }

  private appel(fonction: ExpressionAB, argumentsAB: ExpressionAB[]): Traduit {
    const args = () => argumentsAB.map((a) => this.expr(a))
    if (fonction.g === 'membre') {
      const { objet, nom } = fonction
      if (objet.g === 'nom' && objet.nom === 'Math' && !this.portee.has('Math')) return this.maths(nom.toLowerCase(), argumentsAB)
      if (objet.g === 'nom' && objet.nom === 'String' && nom === 'fromCharCode' && argumentsAB.length === 1) {
        this.marquerEntier(argumentsAB[0])
        return this.appelSimple('chr', args(), 'chaine')
      }
      const o = this.expr(objet)
      const a = args()
      const base = entoure(o, P.postfixe)
      argumentsAB.forEach((x) => this.marquerEntier(x))
      switch (nom) {
        case 'substr':
          if (a.length === 1) return { texte: `${base}[${a[0].texte}:]`, p: P.postfixe, type: 'chaine' }
          if (a.length === 2) {
            const fin =
              a[0].valeur !== undefined && a[1].valeur !== undefined
                ? String(a[0].valeur + a[1].valeur)
                : a[0].valeur === 0n
                  ? a[1].texte
                  : `${entoure(a[0], P.additif)} + ${entoure(a[1], P.additif + 1)}`
            return { texte: `${base}[${a[0].texte}:${fin}]`, p: P.postfixe, type: 'chaine' }
          }
          break
        case 'substring':
          if (a.length === 1) return { texte: `${base}[${a[0].texte}:]`, p: P.postfixe, type: 'chaine' }
          if (a.length === 2) return { texte: `${base}[${a[0].texte}:${a[1].texte}]`, p: P.postfixe, type: 'chaine' }
          break
        case 'charAt':
          if (a.length === 1) return { texte: `${base}[${a[0].texte}]`, p: P.postfixe, type: 'chaine' }
          break
        case 'charCodeAt':
          if (a.length <= 1) return { texte: `ord(${base}[${a[0]?.texte ?? '0'}])`, p: P.postfixe, type: 'entier' }
          break
        case 'toString':
          if (a.length === 0) return { texte: `str(${o.texte})`, p: P.postfixe, type: 'chaine' }
          break
      }
      this.signaler(`Expression JavaScript non convertie : « .${nom}(…) ».`)
      this.invalide = true
      return { texte: `${base}.${nom}(${a.map((x) => x.texte).join(', ')})`, p: P.postfixe, type: 'inconnu' }
    }
    if (fonction.g !== 'nom') {
      this.signaler('Appel non converti.')
      this.invalide = true
      const f = this.expr(fonction)
      return { texte: `${entoure(f, P.postfixe)}(${args().map((x) => x.texte).join(', ')})`, p: P.postfixe, type: 'inconnu' }
    }
    const nom = fonction.nom
    const sp = this.sousProgrammes.get(nom)
    if (sp) return this.appelSousProgramme(sp, argumentsAB)
    if (MATHS[nom.toLowerCase()] || nom.toLowerCase() === 'pow') return this.maths(nom.toLowerCase(), argumentsAB)
    if (/^algobox_/i.test(nom)) return this.algobox(nom.toUpperCase(), argumentsAB)
    if (nom === 'parseInt' && argumentsAB.length >= 1) return this.appelSimple('int', [this.expr(argumentsAB[0])], 'entier')
    if ((nom === 'parseFloat' || nom === 'Number') && argumentsAB.length === 1) return this.appelSimple('float', args(), 'reel')
    if (nom === 'String' && argumentsAB.length === 1) return this.appelSimple('str', args(), 'chaine')
    this.signaler(`Fonction inconnue : ${nom}.`)
    return this.appelSimple(nom, args(), 'inconnu')
  }

  private appelSousProgramme(sp: SousProgramme, argumentsAB: ExpressionAB[]): Traduit {
    const a = argumentsAB.map((x) => this.expr(x))
    sp.parametres.forEach((p, k) => {
      if (!a[k]) return
      if (!p.appelsVus) {
        p.appelsVus = true
        this.change = true
      }
      this.recevoir(p, a[k].type, a[k].variable)
    })
    return this.appelSimple(sp.sortie, a, sp.renvoie ? typeVariable(sp.retour) : 'inconnu')
  }

  private maths(nom: string, argumentsAB: ExpressionAB[]): Traduit {
    const a = argumentsAB.map((x) => this.expr(x))
    if (nom === 'pow' && a.length === 2) return this.puissance(a[0], a[1])
    if (nom === 'round') {
      this.signaler('round arrondit les demis au nombre pair le plus proche (round(2.5) vaut 2), alors qu’AlgoBox arrondit vers le haut.')
    }
    const m = MATHS[nom]
    if (!m) {
      this.signaler(`Fonction Math.${nom} non convertie.`)
      this.invalide = true
      return this.appelSimple(`Math.${nom}`, a, 'inconnu')
    }
    return this.appelSimple(m.nom, a, m.type(a.map((x) => x.type)))
  }

  private algobox(nom: string, argumentsAB: ExpressionAB[]): Traduit {
    const n = argumentsAB.length
    if (nom === 'ALGOBOX_ALEA_ENT' && n === 2) {
      argumentsAB.forEach((x) => this.marquerEntier(x))
      return this.appelSimple('randint', argumentsAB.map((x) => this.expr(x)), 'entier')
    }
    if (nom === 'ALGOBOX_ARRONDIR' && n === 2) {
      this.marquerEntier(argumentsAB[1])
      this.signaler('round arrondit les demis au nombre pair le plus proche (round(2.5) vaut 2), alors qu’AlgoBox arrondit vers le haut.')
      return this.appelSimple('round', argumentsAB.map((x) => this.expr(x)), 'reel')
    }
    const statistiques: Record<string, string> = { ALGOBOX_SOMME: 'sum', ALGOBOX_MAXIMUM: 'max', ALGOBOX_MINIMUM: 'min', ALGOBOX_MOYENNE: 'moyenne' }
    if (statistiques[nom] && n === 3) {
      // Fonctions sur les éléments d'indices début à fin (inclus) d'une liste.
      this.marquerEntier(argumentsAB[1])
      this.marquerEntier(argumentsAB[2])
      const [liste, debut, fin] = argumentsAB.map((x) => this.expr(x))
      const finPlusUn = fin.valeur !== undefined ? String(fin.valeur + 1n) : `${entoure(fin, P.additif)} + 1`
      const tranche = `${entoure(liste, P.postfixe)}[${debut.texte}:${finPlusUn}]`
      const element: TypeAB = liste.variable?.genre === 'liste' ? (liste.variable.reel ? 'reel' : 'entier') : 'inconnu'
      this.signaler(`${nom} est remplacée par une tranche de liste : vérifiez les indices, car les listes AlgoWeb commencent à 0.`)
      if (statistiques[nom] === 'moyenne') {
        return { texte: `sum(${tranche}) / len(${tranche})`, p: P.multiplicatif, type: 'reel' }
      }
      return { texte: `${statistiques[nom]}(${tranche})`, p: P.postfixe, type: element }
    }
    this.signaler(`Fonction AlgoBox non convertie : ${nom}.`)
    return this.appelSimple(nom, argumentsAB.map((x) => this.expr(x)), 'inconnu')
  }
}

// ---------------------------------------------------------------- Parcours

/** Texte d'un affichage et indicateur de retour à la ligne, absent des fichiers anciens. */
function texteEtRetour(champs: string[]): [string, boolean] {
  const dernier = champs.at(-1)?.trim()
  if (champs.length >= 2 && (dernier === '0' || dernier === '1')) return [champs.slice(0, -1).join('#'), dernier === '1']
  return [champs.join('#'), false]
}

function contientRenvoyer(lignes: LigneAlg[]): boolean {
  return lignes.some((l) => l.code === 205 || contientRenvoyer(l.enfants))
}

function nomsDe(e: ExpressionAB, noms: Set<string>): void {
  switch (e.g) {
    case 'nom':
      noms.add(e.nom)
      break
    case 'membre':
      nomsDe(e.objet, noms)
      break
    case 'appel':
      if (e.fonction.g !== 'nom') nomsDe(e.fonction, noms)
      e.arguments.forEach((a) => nomsDe(a, noms))
      break
    case 'indice':
      nomsDe(e.objet, noms)
      nomsDe(e.indice, noms)
      break
    case 'unaire':
      nomsDe(e.operande, noms)
      break
    case 'binaire':
      nomsDe(e.gauche, noms)
      nomsDe(e.droite, noms)
      break
  }
}

/** Noms des variables modifiées par des lignes (lecture, affectation, compteur). */
function nomsModifies(lignes: LigneAlg[], noms: Set<string>): void {
  for (const l of lignes) {
    if (l.code === 2 || l.code === 5 || l.code === 12) noms.add((l.champs[0] ?? '').trim())
    nomsModifies(l.enfants, noms)
  }
}

/** Convertit un fichier `.alg` lu en pseudo-code AlgoWeb, avec son rapport. */
export function convertirAlg(fichier: FichierAlg, nom: string): ResultatConversion {
  return new Convertisseur(fichier, nom).convertir()
}
