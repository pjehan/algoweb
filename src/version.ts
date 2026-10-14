export const VERSION = '0.0.0'

/** Libellé affiché dans « À propos » et sur la page d'accueil. */
export function libelleVersion(version: string = VERSION): string {
  return `AlgoWeb ${version}`
}
