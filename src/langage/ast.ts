/**
 * Arbre syntaxique d'un algorithme AlgoWeb.
 *
 * Chaque nœud porte un identifiant (unique dans l'arbre) et l'étendue du texte
 * qui l'a produit. Les commentaires et les lignes vides font partie de l'arbre,
 * pour que le formateur et l'éditeur par blocs les conservent.
 */

/** Position dans le texte : décalages `de` et `a` (exclu), ligne et colonne de début (à partir de 1). */
export interface Etendue {
  de: number
  a: number
  ligne: number
  colonne: number
}

interface Noeud {
  id: number
  etendue: Etendue
}

// ---------------------------------------------------------------- Types

export type NomTypeSimple = 'entier' | 'reel' | 'chaine' | 'booleen'

export type TypeDeclare =
  | { genre: NomTypeSimple }
  | { genre: 'liste'; element?: TypeDeclare }

// ---------------------------------------------------------------- Expressions

export type OperateurBinaire = '+' | '-' | '*' | '/' | 'div' | 'mod' | '^' | 'et' | 'ou'
export type OperateurComparaison = '=' | '≠' | '<' | '≤' | '>' | '≥' | 'dans'

interface NoeudExpression extends Noeud {
  /** L'expression était écrite entre parenthèses. */
  parentheses?: boolean
}

export interface LitteralEntier extends NoeudExpression {
  genre: 'Entier'
  valeur: bigint
  texte: string
}

export interface LitteralReel extends NoeudExpression {
  genre: 'Reel'
  valeur: number
  texte: string
}

export interface LitteralChaine extends NoeudExpression {
  genre: 'Chaine'
  valeur: string
}

export interface LitteralBooleen extends NoeudExpression {
  genre: 'Booleen'
  valeur: boolean
}

export interface ListeLitterale extends NoeudExpression {
  genre: 'Liste'
  elements: Expression[]
}

export interface Identifiant extends NoeudExpression {
  genre: 'Identifiant'
  nom: string
}

export interface Unaire extends NoeudExpression {
  genre: 'Unaire'
  operateur: '-' | 'non'
  operande: Expression
}

export interface Binaire extends NoeudExpression {
  genre: 'Binaire'
  operateur: OperateurBinaire
  gauche: Expression
  droite: Expression
}

/** Comparaisons, éventuellement enchaînées : `0 ≤ x < 10`. */
export interface Comparaison extends NoeudExpression {
  genre: 'Comparaison'
  operandes: Expression[]
  operateurs: OperateurComparaison[]
}

/**
 * Appel de fonction ou de procédure. Pour une fonction prédéfinie, `nom` est
 * toujours le nom Python, quelle que soit la notation saisie.
 */
export interface Appel extends NoeudExpression {
  genre: 'Appel'
  nom: string
  etendueNom: Etendue
  arguments: Expression[]
}

export interface Indice extends NoeudExpression {
  genre: 'Indice'
  objet: Expression
  indice: Expression
}

export interface Tranche extends NoeudExpression {
  genre: 'Tranche'
  objet: Expression
  debut?: Expression
  fin?: Expression
}

/** Expression illisible ; l'erreur de syntaxe a déjà été signalée. */
export interface ExpressionInvalide extends NoeudExpression {
  genre: 'ExpressionInvalide'
}

export type Expression =
  | LitteralEntier
  | LitteralReel
  | LitteralChaine
  | LitteralBooleen
  | ListeLitterale
  | Identifiant
  | Unaire
  | Binaire
  | Comparaison
  | Appel
  | Indice
  | Tranche
  | ExpressionInvalide

// ---------------------------------------------------------------- Instructions

/** Commentaire placé en fin de ligne (texte après `//`, tel quel). */
type CommentaireFin = string | undefined

interface NoeudLigne extends Noeud {
  commentaire?: CommentaireFin
}

export interface Affectation extends NoeudLigne {
  genre: 'Affectation'
  cible: Identifiant | Indice
  valeur: Expression
}

export interface Lire extends NoeudLigne {
  genre: 'Lire'
  cibles: (Identifiant | Indice)[]
}

export interface Afficher extends NoeudLigne {
  genre: 'Afficher'
  valeurs: Expression[]
  retourLigne: boolean
}

export interface BrancheSi {
  /** Étendue de la ligne `Si` ou `Sinon si`. */
  etendue: Etendue
  condition: Expression
  corps: Instruction[]
  commentaire?: CommentaireFin
}

export interface Si extends NoeudLigne {
  genre: 'Si'
  /** La première branche est le `Si`, les suivantes les `Sinon si`. */
  branches: BrancheSi[]
  sinon?: { etendue: Etendue; corps: Instruction[]; commentaire?: CommentaireFin }
  fermeture?: LigneFermante
}

/** Ligne qui ferme un bloc (`FinSi`, `FinPour`…). Absente si le bloc n'est pas fermé. */
export interface LigneFermante {
  etendue: Etendue
  commentaire?: CommentaireFin
}

export interface Pour extends NoeudLigne {
  genre: 'Pour'
  compteur: Identifiant
  debut: Expression
  fin: Expression
  pas?: Expression
  corps: Instruction[]
  fermeture?: LigneFermante
}

export interface PourChaque extends NoeudLigne {
  genre: 'PourChaque'
  variable: Identifiant
  collection: Expression
  corps: Instruction[]
  fermeture?: LigneFermante
}

export interface TantQue extends NoeudLigne {
  genre: 'TantQue'
  condition: Expression
  corps: Instruction[]
  fermeture?: LigneFermante
}

export interface Repeter extends NoeudLigne {
  genre: 'Repeter'
  corps: Instruction[]
  /** Condition du `Jusqu'à` ; absente si le bloc n'est pas fermé. */
  condition?: Expression
  fermeture?: LigneFermante
}

export interface AppelProcedure extends NoeudLigne {
  genre: 'AppelProcedure'
  appel: Appel
}

export interface Retourner extends NoeudLigne {
  genre: 'Retourner'
  valeur?: Expression
}

export interface Pause extends NoeudLigne {
  genre: 'Pause'
}

export interface Commentaire extends Noeud {
  genre: 'Commentaire'
  texte: string
}

export interface LigneVide extends Noeud {
  genre: 'LigneVide'
}

/** Ligne illisible, conservée telle quelle ; l'erreur a déjà été signalée. */
export interface LigneInvalide extends Noeud {
  genre: 'LigneInvalide'
  texte: string
}

export type Instruction =
  | Affectation
  | Lire
  | Afficher
  | Si
  | Pour
  | PourChaque
  | TantQue
  | Repeter
  | AppelProcedure
  | Retourner
  | Pause
  | Commentaire
  | LigneVide
  | LigneInvalide

// ---------------------------------------------------------------- Déclarations

export interface NomDeclare {
  nom: string
  etendue: Etendue
}

export interface Declaration extends NoeudLigne {
  genre: 'Declaration'
  noms: NomDeclare[]
  type: TypeDeclare
}

export type LigneDeclarations = Declaration | Commentaire | LigneVide | LigneInvalide

/** Section `Variables` et bloc `Début` … `Fin` (ou `FinFonction`…). */
export interface Corps {
  /** Lignes vides et commentaires entre l'en-tête d'un sous-programme et `Variables` ou `Début`. */
  preambule: (Commentaire | LigneVide | LigneInvalide)[]
  /** Ligne `Variables`, si elle est présente. */
  variables?: { etendue: Etendue; commentaire?: CommentaireFin; lignes: LigneDeclarations[] }
  debut?: { etendue: Etendue; commentaire?: CommentaireFin }
  instructions: Instruction[]
  fin?: LigneFermante
}

export interface Parametre {
  nom: string
  etendue: Etendue
  type: TypeDeclare
}

export interface SousProgramme extends NoeudLigne {
  genre: 'Fonction' | 'Procedure'
  nom: string
  etendueNom: Etendue
  parametres: Parametre[]
  /** Type renvoyé, pour une fonction. */
  typeRetour?: TypeDeclare
  corps: Corps
}

export interface EnTete extends NoeudLigne {
  genre: 'EnTete'
  nom: string
}

export interface Principal extends Noeud {
  genre: 'Principal'
  corps: Corps
}

export type ElementProgramme = EnTete | SousProgramme | Principal | Commentaire | LigneVide | LigneInvalide

export interface Programme {
  elements: ElementProgramme[]
}
