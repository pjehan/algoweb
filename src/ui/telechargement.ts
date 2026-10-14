/** Propose un fichier au téléchargement. */
export function telecharger(nom: string, contenu: string | Uint8Array, type: string): void {
  const partie = typeof contenu === 'string' ? contenu : new Uint8Array(contenu)
  const url = URL.createObjectURL(new Blob([partie], { type }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  document.body.append(lien)
  lien.click()
  lien.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Lit les octets d'un fichier choisi ou déposé. */
export async function octetsDe(fichier: File): Promise<Uint8Array> {
  return new Uint8Array(await fichier.arrayBuffer())
}
