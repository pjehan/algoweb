/**
 * Lecteur XML minimal, sans dépendance au navigateur : il suffit pour les
 * fichiers `.alg`, qui n'utilisent que des éléments et des attributs.
 * Les textes, commentaires, instructions de traitement et sections CDATA
 * sont ignorés.
 */

export interface ElementXml {
  nom: string
  attributs: Record<string, string>
  enfants: ElementXml[]
}

export class ErreurXml extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurXml'
  }
}

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** Remplace les entités et références de caractères. */
function decoderEntites(texte: string): string {
  return texte.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (tout, nom: string) => {
    if (nom.startsWith('#x')) return codeVersTexte(parseInt(nom.slice(2), 16), tout)
    if (nom.startsWith('#')) return codeVersTexte(parseInt(nom.slice(1), 10), tout)
    return ENTITES[nom] ?? tout
  })
}

function codeVersTexte(code: number, defaut: string): string {
  return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : defaut
}

const NOM = /^[^\s/>=]+/

/** Analyse un document XML et renvoie son élément racine. */
export function lireXml(texte: string): ElementXml {
  let i = 0
  const pile: ElementXml[] = []
  let racine: ElementXml | undefined

  const ignorerJusqua = (fin: string) => {
    const k = texte.indexOf(fin, i)
    if (k < 0) throw new ErreurXml('Le fichier est incomplet.')
    i = k + fin.length
  }

  while (i < texte.length) {
    const k = texte.indexOf('<', i)
    if (k < 0) break
    i = k
    if (texte.startsWith('<!--', i)) ignorerJusqua('-->')
    else if (texte.startsWith('<![CDATA[', i)) ignorerJusqua(']]>')
    else if (texte.startsWith('<?', i)) ignorerJusqua('?>')
    else if (texte.startsWith('<!', i)) ignorerJusqua('>')
    else if (texte.startsWith('</', i)) {
      const fin = texte.indexOf('>', i)
      if (fin < 0) throw new ErreurXml('Le fichier est incomplet.')
      const nom = texte.slice(i + 2, fin).trim()
      const ouvert = pile.pop()
      if (!ouvert || ouvert.nom !== nom) throw new ErreurXml(`Balise fermante </${nom}> inattendue.`)
      i = fin + 1
    } else {
      i++
      const nom = NOM.exec(texte.slice(i))?.[0]
      if (!nom) throw new ErreurXml('Balise mal formée.')
      i += nom.length
      const element: ElementXml = { nom, attributs: {}, enfants: [] }
      let autoFermant = false
      for (;;) {
        while (/\s/.test(texte[i] ?? '')) i++
        if (i >= texte.length) throw new ErreurXml('Le fichier est incomplet.')
        if (texte.startsWith('/>', i)) {
          autoFermant = true
          i += 2
          break
        }
        if (texte[i] === '>') {
          i++
          break
        }
        const attribut = NOM.exec(texte.slice(i))?.[0]
        if (!attribut) throw new ErreurXml(`Attribut mal formé dans <${nom}>.`)
        i += attribut.length
        while (/\s/.test(texte[i] ?? '')) i++
        if (texte[i] !== '=') throw new ErreurXml(`Attribut ${attribut} sans valeur dans <${nom}>.`)
        i++
        while (/\s/.test(texte[i] ?? '')) i++
        const guillemet = texte[i]
        if (guillemet !== '"' && guillemet !== "'") throw new ErreurXml(`Valeur de l’attribut ${attribut} mal formée.`)
        const fin = texte.indexOf(guillemet, i + 1)
        if (fin < 0) throw new ErreurXml('Le fichier est incomplet.')
        // Normalisation XML des valeurs d'attributs : les blancs littéraux deviennent des espaces.
        element.attributs[attribut] = decoderEntites(texte.slice(i + 1, fin).replace(/[\t\n\r]/g, ' '))
        i = fin + 1
      }
      const parent = pile.at(-1)
      if (parent) parent.enfants.push(element)
      else if (racine) throw new ErreurXml('Le fichier contient plusieurs éléments racines.')
      else racine = element
      if (!autoFermant) pile.push(element)
    }
  }
  if (pile.length > 0) throw new ErreurXml(`Balise <${pile.at(-1)!.nom}> non fermée.`)
  if (!racine) throw new ErreurXml('Le fichier ne contient aucun élément XML.')
  return racine
}
