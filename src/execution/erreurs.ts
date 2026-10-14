/**
 * Erreurs d'exécution (PLAN.md, section 4.10) : elles arrêtent le programme
 * avec un message en français et le numéro de ligne.
 */

interface Texte {
  message: string
  suggestion?: string
}

const q = (texte: string) => `« ${texte} »`

export const MESSAGES_EXECUTION = {
  'division-par-zero': () => ({
    message: 'Division par zéro.',
    suggestion: 'Vérifiez que le diviseur est différent de 0 avant de diviser.',
  }),
  'zero-puissance-negative': () => ({
    message: '0 ne peut pas être élevé à une puissance négative (cela reviendrait à diviser par zéro).',
  }),
  'racine-negative': (nom: string) => ({
    message: `${nom} : racine carrée d’un nombre négatif.`,
  }),
  'logarithme-invalide': (nom: string) => ({
    message: `${nom} : logarithme d’un nombre négatif ou nul.`,
  }),
  'hors-domaine': (nom: string) => ({
    message: `${nom} : la valeur est en dehors du domaine de la fonction.`,
  }),
  'puissance-non-reelle': () => ({
    message: 'Puissance non réelle : un nombre négatif ne peut pas être élevé à une puissance non entière.',
  }),
  'exposant-negatif': () => ({
    message: 'Exposant négatif : le résultat n’est pas un entier.',
    suggestion: 'Pour obtenir un réel, écrivez la base sous forme de réel : 2.0 ^ n.',
  }),
  'resultat-trop-grand': () => ({
    message: 'Résultat trop grand pour être représenté par un réel.',
  }),
  'entier-trop-grand': () => ({
    message: 'Entier trop grand pour être converti en réel.',
  }),
  'memoire-insuffisante': () => ({
    message: 'Résultat trop volumineux : la mémoire est insuffisante.',
  }),
  'indice-hors-limites': (indice: string, longueur: number, chaine: boolean) => ({
    message:
      longueur === 0
        ? `Indice ${indice} hors limites : ${chaine ? 'la chaîne est vide' : 'la liste est vide'}.`
        : `Indice ${indice} hors limites : ${chaine ? `la chaîne contient ${longueur} caractère${longueur > 1 ? 's' : ''}` : `la liste contient ${longueur} élément${longueur > 1 ? 's' : ''}`} (indices de 0 à ${longueur - 1}, ou de -${longueur} à -1).`,
  }),
  'collection-vide': (nom: string) => ({
    message: `${nom} ne s’applique pas à une liste ou une chaîne vide.`,
  }),
  'conversion-impossible': (texte: string, type: string) => ({
    message: `Impossible de convertir ${q(texte)} en ${type}.`,
  }),
  'conversion-infini': (nom: string) => ({
    message: `${nom} : impossible de convertir l’infini ou « nan » en entier.`,
  }),
  'variable-sans-valeur': (nom: string) => ({
    message: `La variable ${nom} n’a pas de valeur.`,
    suggestion: `Affectez-lui une valeur (${nom} ← …) ou lisez-la (Lire ${nom}) avant de l’utiliser.`,
  }),
  'recursion-trop-profonde': () => ({
    message: 'Récursion trop profonde : plus de 1 000 appels imbriqués.',
    suggestion: 'Vérifiez que la fonction atteint toujours un cas où elle ne s’appelle plus elle-même.',
  }),
  'pas-nul': () => ({
    message: 'Le pas de la boucle Pour vaut 0 : la boucle ne se terminerait jamais.',
  }),
  'bornes-alea': (nom: string) => ({
    message: `${nom}(a, b) exige a ≤ b.`,
  }),
  'caractere-attendu': (nom: string, longueur: number) => ({
    message: `${nom} attend un seul caractère, mais la chaîne en contient ${longueur}.`,
  }),
  'code-invalide': (nom: string) => ({
    message: `${nom} attend un code compris entre 0 et 1114111.`,
  }),
  'type-incompatible': (cible: string, type: string, valeur: string) => ({
    message: `${cible} est ${type} : impossible d’y ranger la valeur ${valeur}.`,
    suggestion: 'La valeur provient sans doute d’une liste non typée : déclarez le type de ses éléments.',
  }),
  'operation-invalide': (operateur: string, description: string) => ({
    message: `L’opérateur ${operateur} ne s’applique pas à ${description}.`,
  }),
  'fonction-sans-retour': (nom: string) => ({
    message: `La fonction ${nom} s’est terminée sans exécuter Retourner.`,
  }),
} satisfies Record<string, (...args: never[]) => Texte>

export type CodeExecution = keyof typeof MESSAGES_EXECUTION

export class ErreurExecution extends Error {
  readonly code: CodeExecution
  readonly suggestion?: string
  /** Ligne de l'instruction en cours, renseignée par la machine. */
  ligne?: number

  constructor(code: CodeExecution, texte: Texte) {
    super(texte.message)
    this.name = 'ErreurExecution'
    this.code = code
    if (texte.suggestion !== undefined) this.suggestion = texte.suggestion
  }
}

export function erreurExecution<C extends CodeExecution>(
  code: C,
  ...args: Parameters<(typeof MESSAGES_EXECUTION)[C]>
): ErreurExecution {
  const fabrique = MESSAGES_EXECUTION[code] as (...a: Parameters<(typeof MESSAGES_EXECUTION)[C]>) => Texte
  return new ErreurExecution(code, fabrique(...args))
}
