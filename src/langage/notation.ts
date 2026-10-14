import { analyserLexique, type Jeton } from './lexique.ts'
import { nomAffiche, trouverPredefini, type Notation } from './predefinis.ts'

/**
 * Change la notation des fonctions prédéfinies dans un texte, sans toucher au
 * reste : `racine(x)` devient `sqrt(x)` et inversement (PLAN.md, section 4.7).
 * Seuls les noms suivis d'une parenthèse sont des appels : une variable
 * `somme` n'est jamais modifiée. Le texte peut contenir des erreurs.
 */
export function convertirNotation(texte: string, notation: Notation): string {
  const { lignes } = analyserLexique(texte)
  const remplacements: { de: number; a: number; nom: string }[] = []
  for (const ligne of lignes) {
    const j = ligne.jetons
    for (let k = 0; k < j.length - 1; k++) {
      if (j[k].genre !== 'mot' || j[k + 1].genre !== 'symbole' || j[k + 1].valeur !== '(') continue
      const p = trouverPredefini(j[k].texte)
      if (!p || p.genre !== 'fonction') continue
      const nom = nomAffiche(p.python, notation, nombreArguments(j, k + 1))
      if (nom !== j[k].texte) remplacements.push({ de: j[k].etendue.de, a: j[k].etendue.a, nom })
    }
  }
  let resultat = texte
  for (const r of remplacements.reverse()) resultat = resultat.slice(0, r.de) + r.nom + resultat.slice(r.a)
  return resultat
}

/** Nombre d'arguments de l'appel dont la parenthèse ouvrante est le jeton `ouvrante`. */
function nombreArguments(jetons: Jeton[], ouvrante: number): number {
  let profondeur = 0
  let virgules = 0
  for (let k = ouvrante; k < jetons.length; k++) {
    const j = jetons[k]
    if (j.genre !== 'symbole') continue
    if (j.valeur === '(' || j.valeur === '[') profondeur++
    else if (j.valeur === ')' || j.valeur === ']') {
      profondeur--
      if (profondeur === 0) return k === ouvrante + 1 ? 0 : virgules + 1
    } else if (j.valeur === ',' && profondeur === 1) virgules++
  }
  return virgules + 1
}
