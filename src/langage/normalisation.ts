/**
 * Forme de comparaison des mots-clés : minuscules, sans accents, apostrophe droite.
 * `Début`, `debut` et `DÉBUT` donnent tous `debut`.
 */
export function normaliser(mot: string): string {
  return mot
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/’/g, "'")
    .toLowerCase()
}

/** Distance d'édition de Levenshtein. */
export function distance(a: string, b: string): number {
  const precedente = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diagonale = precedente[0]
    precedente[0] = i
    for (let j = 1; j <= b.length; j++) {
      const haut = precedente[j]
      precedente[j] = Math.min(
        precedente[j] + 1,
        precedente[j - 1] + 1,
        diagonale + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      diagonale = haut
    }
  }
  return precedente[b.length]
}

/**
 * Nom le plus proche de `nom` parmi `candidats`, ou `undefined` si aucun n'est
 * assez proche. La comparaison ignore la casse et les accents.
 */
export function plusProche(nom: string, candidats: Iterable<string>): string | undefined {
  const cible = normaliser(nom)
  const seuil = cible.length <= 3 ? 1 : 2
  let meilleur: string | undefined
  let meilleureDistance = Infinity
  for (const candidat of candidats) {
    if (candidat === nom) continue
    const d = distance(cible, normaliser(candidat))
    if (d < meilleureDistance && d <= seuil) {
      meilleur = candidat
      meilleureDistance = d
    }
  }
  return meilleur
}
