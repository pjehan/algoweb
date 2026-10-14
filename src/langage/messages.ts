import type { Etendue } from './ast.ts'

/**
 * Catalogue des messages destinés à l'étudiant. Chaque entrée produit le
 * message et, si possible, une piste de correction. Chaque code est couvert
 * par un test (`messages.test.ts`).
 */

export type Gravite = 'erreur' | 'avertissement'

export interface Diagnostic {
  code: CodeDiagnostic
  gravite: Gravite
  message: string
  suggestion?: string
  etendue: Etendue
}

interface Texte {
  message: string
  suggestion?: string
}

const q = (texte: string) => `« ${texte} »`

export const MESSAGES = {
  // ------------------------------------------------------------ Lexique
  'chaine-non-fermee': () => ({
    message: 'La chaîne de caractères n’est pas fermée.',
    suggestion: 'Ajoutez le guillemet de fin sur la même ligne.',
  }),
  'echappement-inconnu': (sequence: string) => ({
    message: `Séquence d’échappement inconnue : ${sequence}.`,
    suggestion: 'Séquences possibles : \\" \\\' \\\\ \\n \\t. Pour écrire une barre oblique inverse, doublez-la : \\\\.',
  }),
  'caractere-inconnu': (caractere: string) => ({
    message: `Caractère inattendu : ${q(caractere)}.`,
  }),
  'exposant-unicode': (caractere: string, exemple: string) => ({
    message: `Le symbole ${q(caractere)} n’est pas reconnu.`,
    suggestion: `Utilisez l’opérateur ^ : ${exemple}.`,
  }),
  'symbole-etranger': (symbole: string, remplacement: string) => ({
    message: `Le symbole ${q(symbole)} n’existe pas en AlgoWeb.`,
    suggestion: `Utilisez ${remplacement}.`,
  }),
  'point-virgule': () => ({
    message: 'Le point-virgule n’est pas utilisé en AlgoWeb.',
    suggestion: 'Écrivez une seule instruction par ligne.',
  }),
  'nombre-colle': (nombre: string, nom: string) => ({
    message: `Il manque un opérateur entre ${nombre} et ${nom}.`,
    suggestion: `Pour une multiplication, écrivez ${nombre} * ${nom}.`,
  }),
  'notation-pointee': () => ({
    message: 'AlgoWeb n’utilise pas la notation pointée (comme L.append(x)).',
    suggestion: 'Utilisez les fonctions et procédures : ajouter(L, x), len(L)…',
  }),
  'retour-mal-place': () => ({
    message: 'Le retour à la ligne ↵ (ou \\n) n’est permis qu’à la fin d’une instruction Afficher.',
  }),

  // ------------------------------------------------------------ Syntaxe des expressions
  'expression-attendue': (trouve?: string) => ({
    message: trouve ? `Une valeur ou un calcul est attendu au lieu de ${q(trouve)}.` : 'Une valeur ou un calcul est attendu.',
  }),
  'mot-cle-dans-expression': (mot: string) => ({
    message: `${q(mot)} est un mot-clé et ne peut pas servir de valeur.`,
  }),
  'parenthese-non-fermee': () => ({
    message: 'Parenthèse ouverte mais jamais fermée.',
    suggestion: 'Ajoutez « ) ».',
  }),
  'crochet-non-ferme': () => ({
    message: 'Crochet ouvert mais jamais fermé.',
    suggestion: 'Ajoutez « ] ».',
  }),
  'appel-invalide': () => ({
    message: 'Seul un nom de fonction peut être suivi de parenthèses.',
  }),
  'virgule-decimale': (correct: string) => ({
    message: 'Le séparateur décimal est le point, pas la virgule.',
    suggestion: `Écrivez ${correct}.`,
  }),
  'texte-en-trop': (texte: string) => ({
    message: `Texte inattendu : ${q(texte)}.`,
  }),

  // ------------------------------------------------------------ Syntaxe des instructions
  'affectation-egal': (cible: string) => ({
    message: 'Le signe = compare deux valeurs ; il n’affecte pas de valeur.',
    suggestion: `Pour affecter une valeur, utilisez ← (ou <-) : ${cible} ← …`,
  }),
  'instruction-inconnue': (proche?: string) => ({
    message: 'Instruction incomprise.',
    suggestion: proche
      ? `Vouliez-vous dire ${proche} ?`
      : 'Une instruction commence par un mot-clé (Lire, Afficher, Si, Pour…), ou c’est une affectation (x ← 3) ou un appel de procédure.',
  }),
  'expression-sans-effet': () => ({
    message: 'Ce calcul n’est ni affecté, ni affiché.',
    suggestion: 'Écrivez par exemple x ← … ou Afficher … ↵',
  }),
  'cible-invalide': () => ({
    message: 'On ne peut affecter une valeur qu’à une variable ou à un élément de liste.',
  }),
  'lire-cible': () => ({
    message: 'Lire range la valeur saisie dans une variable ou un élément de liste.',
    suggestion: 'Exemple : Lire x',
  }),
  'afficher-vide': () => ({
    message: 'Afficher attend au moins une valeur.',
    suggestion: 'Pour passer simplement à la ligne, écrivez Afficher ↵',
  }),
  'si-sans-alors': () => ({
    message: 'Il manque « alors » à la fin de la ligne.',
    suggestion: 'Exemple : Si n > 0 alors',
  }),
  'faire-manquant': (structure: string) => ({
    message: `Il manque « faire » à la fin de la ligne ${structure}.`,
  }),
  'pour-mal-forme': () => ({
    message: 'Boucle Pour mal écrite.',
    suggestion: 'Exemples : Pour i de 1 à n faire, Pour i de 10 à 0 pas de -2 faire, Pour chaque x dans L faire',
  }),
  'bloc-non-ferme': (structure: string, ligne: number, fermeture: string) => ({
    message: `Le bloc ${structure} de la ligne ${ligne} n’est pas fermé.`,
    suggestion: `Ajoutez ${fermeture} à la fin du bloc.`,
  }),
  'fermeture-inattendue': (mot: string, ouverture: string) => ({
    message: `${mot} ne correspond à aucun ${ouverture} ouvert.`,
  }),
  'sinon-apres-sinon': (mot: string) => ({
    message: `${mot} ne peut pas suivre un Sinon.`,
    suggestion: 'Le Sinon doit être la dernière branche du Si.',
  }),
  'debut-manquant': () => ({
    message: 'L’algorithme principal doit contenir un bloc Début … Fin.',
  }),
  'texte-apres-fin': () => ({
    message: 'Rien ne doit suivre la ligne Fin de l’algorithme principal.',
    suggestion: 'Déplacez les fonctions et procédures avant l’algorithme principal.',
  }),
  'entete-mal-place': () => ({
    message: 'La ligne Algorithme doit être la première de l’algorithme.',
  }),
  'entete-sans-nom': () => ({
    message: 'Donnez un nom à l’algorithme.',
    suggestion: 'Exemple : Algorithme Somme des pairs',
  }),
  'variables-mal-placee': () => ({
    message: 'La section Variables doit se trouver avant Début.',
  }),
  'declaration-hors-variables': () => ({
    message: 'Les déclarations de variables se placent dans la section Variables, avant Début.',
  }),
  'declaration-mal-formee': () => ({
    message: 'Déclaration mal écrite.',
    suggestion: 'Exemple : n, i : entier',
  }),
  'instruction-dans-variables': () => ({
    message: 'La section Variables ne contient que des déclarations.',
    suggestion: 'Ajoutez la ligne Début avant les instructions.',
  }),
  'type-inconnu': (mot: string, proche?: string) => ({
    message: `Type inconnu : ${q(mot)}.`,
    suggestion: proche
      ? `Vouliez-vous dire ${proche} ?`
      : 'Types possibles : entier, réel, chaîne, booléen, liste, liste de réels…',
  }),
  'entete-sous-programme': (genre: string) => ({
    message: `En-tête de ${genre} mal écrit.`,
    suggestion:
      genre === 'fonction'
        ? 'Exemple : Fonction aire(longueur : réel, largeur : réel) : réel'
        : 'Exemple : Procédure afficherLigne(n : entier)',
  }),
  'type-retour-manquant': (nom: string) => ({
    message: `La fonction ${nom} doit indiquer le type de la valeur qu’elle renvoie.`,
    suggestion: `Exemple : Fonction ${nom}(…) : réel. Si elle ne renvoie rien, déclarez une Procédure.`,
  }),
  'type-retour-procedure': (nom: string) => ({
    message: `La procédure ${nom} ne renvoie pas de valeur et n’a donc pas de type de retour.`,
    suggestion: 'Retirez le type, ou déclarez une Fonction.',
  }),
  'fin-sous-programme': (attendu: string) => ({
    message: `Ce bloc se termine par ${attendu}.`,
  }),

  // ------------------------------------------------------------ Noms
  'nom-non-declare': (nom: string, proche?: string) => ({
    message: `La variable ${nom} n’est pas déclarée.`,
    suggestion: proche ? `Vouliez-vous dire ${proche} ?` : `Déclarez-la dans la section Variables, par exemple : ${nom} : entier`,
  }),
  'fonction-inconnue': (nom: string, proche?: string) => ({
    message: `La fonction ${nom} n’existe pas.`,
    suggestion: proche ? `Vouliez-vous dire ${proche} ?` : undefined,
  }),
  'variable-hors-portee': (nom: string, sousProgramme: string) => ({
    message: `La variable ${nom} de l’algorithme principal n’est pas accessible dans ${sousProgramme}.`,
    suggestion: 'Passez-la en paramètre, ou déclarez une variable locale.',
  }),
  'declaration-double': (nom: string, ligne: number) => ({
    message: `${nom} est déjà déclaré à la ligne ${ligne}.`,
  }),
  'nom-reserve': (nom: string, raison: 'mot-cle' | 'python' | 'predefini') => ({
    message:
      raison === 'mot-cle'
        ? `${q(nom)} est un mot-clé d’AlgoWeb et ne peut pas servir de nom.`
        : raison === 'python'
          ? `${q(nom)} est un nom réservé de Python et ne peut pas servir de nom.`
          : `${q(nom)} est le nom d’une fonction prédéfinie et ne peut pas servir de nom.`,
    suggestion: 'Choisissez un autre nom.',
  }),
  'fonction-sans-parentheses': (nom: string) => ({
    message: `${nom} est une fonction : il faut des parenthèses pour l’appeler.`,
    suggestion: `Exemple : ${nom}(x)`,
  }),
  'constante-appelee': (nom: string) => ({
    message: `${nom} est une constante, pas une fonction.`,
    suggestion: `Écrivez ${nom} sans parenthèses.`,
  }),
  'variable-appelee': (nom: string) => ({
    message: `${nom} est une variable, pas une fonction.`,
  }),

  // ------------------------------------------------------------ Types
  'type-affectation': (cible: string, typeCible: string, typeValeur: string, conseil?: string) => ({
    message: `${cible} est ${typeCible} : on ne peut pas y ranger ${typeValeur}.`,
    suggestion: conseil,
  }),
  'condition-non-booleenne': (typeValeur: string) => ({
    message: `Une condition doit être vraie ou fausse (un booléen) ; ici, c’est ${typeValeur}.`,
    suggestion: 'Exemple : Si n ≠ 0 alors',
  }),
  'operande-invalide': (operateur: string, description: string, conseil?: string) => ({
    message: `L’opérateur ${operateur} ne s’applique pas à ${description}.`,
    suggestion: conseil,
  }),
  'comparaison-invalide': (typeA: string, typeB: string, operateur: string) => ({
    message: `On ne peut pas comparer ${typeA} et ${typeB} avec ${operateur}.`,
  }),
  'indice-non-entier': (typeValeur: string) => ({
    message: `Un indice doit être un entier ; ici, c’est ${typeValeur}.`,
  }),
  'indexation-invalide': (texte: string, typeValeur: string) => ({
    message: `${texte} est ${typeValeur} : on ne peut pas en prendre un élément.`,
    suggestion: 'Seules les chaînes et les listes ont des indices.',
  }),
  'pour-non-entier': (partie: string, typeValeur: string) => ({
    message: `${partie} d’une boucle Pour doit être un entier ; ici, c’est ${typeValeur}.`,
    suggestion: 'Pour parcourir des réels, utilisez une boucle TantQue.',
  }),
  'pas-nul': () => ({
    message: 'Le pas d’une boucle Pour ne peut pas être nul.',
  }),
  'compteur-modifie': (nom: string) => ({
    message: `Le compteur ${nom} ne doit pas être modifié à l’intérieur de sa boucle.`,
    suggestion: 'Utilisez une autre variable, ou une boucle TantQue.',
  }),
  'collection-invalide': (typeValeur: string) => ({
    message: `Pour chaque parcourt une liste ou une chaîne ; ici, c’est ${typeValeur}.`,
  }),
  'arguments-nombre': (nom: string, attendu: string, recu: number) => ({
    message: `${nom} attend ${attendu}, mais en reçoit ${recu}.`,
  }),
  'argument-type': (nom: string, rang: number, attendu: string, recu: string, conseil?: string) => ({
    message: `Le paramètre ${rang} de ${nom} doit être ${attendu} ; ici, c’est ${recu}.`,
    suggestion: conseil,
  }),
  'liste-attendue': (nom: string, typeValeur: string) => ({
    message: `Le premier paramètre de ${nom} doit être une liste ; ici, c’est ${typeValeur}.`,
  }),
  'chaine-immuable': (nom: string) => ({
    message: `On ne peut pas modifier un caractère de la chaîne ${nom} : une chaîne ne se modifie pas.`,
    suggestion: `Construisez une nouvelle chaîne, par exemple : ${nom} ← ${nom}[:i] + "x" + ${nom}[i + 1:]`,
  }),
  'lire-liste': (nom: string) => ({
    message: `Lire ne peut pas remplir la liste ${nom} d’un coup.`,
    suggestion: `Lisez une valeur puis ajoutez-la : Lire x, puis ajouter(${nom}, x).`,
  }),
  'lire-liste-non-typee': (nom: string) => ({
    message: `Pour lire un élément de ${nom}, le type de ses éléments doit être connu.`,
    suggestion: `Déclarez par exemple ${nom} : liste de réels`,
  }),

  // ------------------------------------------------------------ Fonctions et procédures
  'retour-hors-fonction': () => ({
    message: 'Retourner ne s’utilise que dans une fonction ou une procédure.',
  }),
  'retour-sans-valeur': (nom: string) => ({
    message: `La fonction ${nom} doit renvoyer une valeur.`,
    suggestion: 'Exemple : Retourner resultat',
  }),
  'retour-dans-procedure': (nom: string) => ({
    message: `La procédure ${nom} ne peut pas renvoyer de valeur.`,
    suggestion: 'Écrivez Retourner seul pour en sortir, ou déclarez une Fonction.',
  }),
  'retour-type': (nom: string, attendu: string, recu: string, conseil?: string) => ({
    message: `La fonction ${nom} doit renvoyer ${attendu} ; ici, c’est ${recu}.`,
    suggestion: conseil,
  }),
  'retour-manquant': (nom: string) => ({
    message: `La fonction ${nom} peut se terminer sans exécuter Retourner.`,
    suggestion: 'Vérifiez que chaque cas (chaque branche d’un Si) se termine par Retourner.',
  }),
  'procedure-dans-expression': (nom: string) => ({
    message: `${nom} est une procédure : elle ne renvoie pas de valeur et ne peut pas servir dans un calcul.`,
  }),

  // ------------------------------------------------------------ Avertissements
  'variable-inutilisee': (nom: string) => ({
    message: `La variable ${nom} n’est jamais utilisée.`,
  }),
  'variable-sans-valeur': (nom: string) => ({
    message: `La variable ${nom} n’a peut-être pas encore de valeur ici.`,
    suggestion: `Affectez-lui une valeur avant de l’utiliser (${nom} ← …).`,
  }),
  'code-inaccessible': () => ({
    message: 'Ces instructions ne seront jamais exécutées : elles suivent un Retourner.',
  }),
  'resultat-ignore': (nom: string) => ({
    message: `Le résultat de la fonction ${nom} est ignoré.`,
    suggestion: `Rangez-le dans une variable (x ← ${nom}(…)) ou affichez-le.`,
  }),
} satisfies Record<string, (...args: never[]) => Texte>

export type CodeDiagnostic = keyof typeof MESSAGES

const AVERTISSEMENTS: ReadonlySet<CodeDiagnostic> = new Set<CodeDiagnostic>([
  'variable-inutilisee',
  'variable-sans-valeur',
  'code-inaccessible',
  'resultat-ignore',
])

export function gravite(code: CodeDiagnostic): Gravite {
  return AVERTISSEMENTS.has(code) ? 'avertissement' : 'erreur'
}

/** Construit un diagnostic à partir du catalogue. */
export function diagnostic<C extends CodeDiagnostic>(
  code: C,
  etendue: Etendue,
  ...args: Parameters<(typeof MESSAGES)[C]>
): Diagnostic {
  const fabrique = MESSAGES[code] as (...a: Parameters<(typeof MESSAGES)[C]>) => Texte
  const { message, suggestion } = fabrique(...args)
  return suggestion === undefined
    ? { code, gravite: gravite(code), message, etendue }
    : { code, gravite: gravite(code), message, suggestion, etendue }
}
