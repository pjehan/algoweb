import { analyserLexique, type Jeton } from './lexique.ts'

/**
 * Réécrit les mots-clés d'une ligne dans leur forme canonique (PLAN.md,
 * section 3, point 10) : `debut` devient `Début`, `fin si` devient `FinSi`,
 * `ecrire` devient `Afficher`. Le reste de la ligne (noms, chaînes,
 * commentaire) est conservé tel quel.
 */

const CANONIQUES: Record<string, string> = {
  algorithme: 'Algorithme',
  variables: 'Variables',
  debut: 'Début',
  fin: 'Fin',
  si: 'Si',
  alors: 'alors',
  sinon: 'Sinon',
  sinonsi: 'Sinon si',
  finsi: 'FinSi',
  pour: 'Pour',
  faire: 'faire',
  finpour: 'FinPour',
  tantque: 'TantQue',
  fintantque: 'FinTantQue',
  repeter: 'Répéter',
  "jusqu'a": "Jusqu'à",
  lire: 'Lire',
  saisir: 'Lire',
  afficher: 'Afficher',
  ecrire: 'Afficher',
  fonction: 'Fonction',
  finfonction: 'FinFonction',
  procedure: 'Procédure',
  finprocedure: 'FinProcédure',
  retourner: 'Retourner',
  renvoyer: 'Retourner',
  pause: 'Pause',
  et: 'et',
  ou: 'ou',
  non: 'non',
  mod: 'mod',
  div: 'div',
  dans: 'dans',
  vrai: 'vrai',
  faux: 'faux',
}

const TYPES: Record<string, string> = {
  entier: 'entier',
  reel: 'réel',
  chaine: 'chaîne',
  booleen: 'booléen',
  liste: 'liste',
  entiers: 'entiers',
  reels: 'réels',
  chaines: 'chaînes',
  booleens: 'booléens',
  listes: 'listes',
}

const FIN_COMPOSEE: Record<string, string> = {
  si: 'FinSi',
  pour: 'FinPour',
  tantque: 'FinTantQue',
  fonction: 'FinFonction',
  procedure: 'FinProcédure',
}

interface Remplacement {
  de: number
  a: number
  texte: string
}

function estMot(j: Jeton | undefined, valeur?: string): boolean {
  return j?.genre === 'mot' && (valeur === undefined || j.valeur === valeur)
}

function suiviDeParenthese(jetons: Jeton[], k: number): boolean {
  const s = jetons[k + 1]
  return s?.genre === 'symbole' && s.valeur === '('
}

export function canoniserLigne(ligne: string): string {
  const lexique = analyserLexique(ligne).lignes[0]
  const j = lexique.jetons
  const r: Remplacement[] = []
  const remplacer = (debut: Jeton, fin: Jeton, texte: string) => r.push({ de: debut.etendue.de, a: fin.etendue.a, texte })

  if (j.length === 0) return ligne
  // Ligne « Algorithme … » : seul le mot-clé change, pas le nom.
  if (j[0].valeur === 'algorithme') {
    if (j[0].texte !== 'Algorithme') remplacer(j[0], j[0], 'Algorithme')
    return appliquer(ligne, r)
  }

  let k = 0
  // Mots-clés composés en début de ligne.
  if (estMot(j[0], 'fin') && estMot(j[1], 'tant') && estMot(j[2], 'que')) {
    remplacer(j[0], j[2], 'FinTantQue')
    k = 3
  } else if (estMot(j[0], 'fin') && estMot(j[1]) && FIN_COMPOSEE[j[1].valeur]) {
    remplacer(j[0], j[1], FIN_COMPOSEE[j[1].valeur])
    k = 2
  } else if (estMot(j[0], 'tant') && estMot(j[1], 'que')) {
    remplacer(j[0], j[1], 'TantQue')
    k = 2
  } else if (estMot(j[0], 'sinon') && estMot(j[1], 'si')) {
    remplacer(j[0], j[1], 'Sinon si')
    k = 2
  }

  // Dans une boucle Pour, le « a » (ou « à ») qui suit l'expression de début devient « à ».
  const pour = estMot(j[0], 'pour') && !estMot(j[1], 'chaque')
  let a = -1
  if (pour) {
    const de = j.findIndex((x, i) => i > 1 && estMot(x, 'de'))
    let profondeur = 0
    for (let i = de + 1; de > 0 && i < j.length; i++) {
      const x = j[i]
      if (x.genre === 'symbole' && (x.valeur === '(' || x.valeur === '[')) profondeur++
      else if (x.genre === 'symbole' && (x.valeur === ')' || x.valeur === ']')) profondeur--
      else if (i > de + 1 && profondeur === 0 && estMot(x, 'a')) {
        a = i
        break
      }
    }
  }

  for (; k < j.length; k++) {
    const x = j[k]
    if (x.genre !== 'mot') continue
    let canonique: string | undefined
    if (k === a) canonique = 'à'
    else if (pour && (x.valeur === 'de' || x.valeur === 'pas')) canonique = x.valeur
    else if (estMot(j[0], 'pour') && k === 1 && x.valeur === 'chaque') canonique = 'chaque'
    else if (TYPES[x.valeur] && !suiviDeParenthese(j, k)) canonique = TYPES[x.valeur]
    else if (CANONIQUES[x.valeur] && !suiviDeParenthese(j, k)) canonique = CANONIQUES[x.valeur]
    if (canonique !== undefined && canonique !== x.texte) remplacer(x, x, canonique)
  }
  return appliquer(ligne, r)
}

function appliquer(ligne: string, remplacements: Remplacement[]): string {
  let resultat = ligne
  for (const r of [...remplacements].sort((x, y) => y.de - x.de)) resultat = resultat.slice(0, r.de) + r.texte + resultat.slice(r.a)
  return resultat
}
