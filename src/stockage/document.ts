import { analyserLexique } from '../langage/lexique.ts'
import { normaliser } from '../langage/normalisation.ts'

/**
 * Document AlgoWeb, format natif JSON (PLAN.md, section 7.1).
 */
export interface DocumentAlgo {
  format: 'algoweb'
  version: 1
  nom: string
  description: string
  /** Pseudo-code tel qu'il est saisi, fonctions prédéfinies en noms Python. */
  code: string
  /** Graine de l'aléatoire (entier écrit en texte), ou null. */
  graine: string | null
  creeLe: string
  modifieLe: string
}

export const VERSION_FORMAT = 1

export function nouveauDocument(nom = 'Nouvel algorithme', maintenant = new Date()): DocumentAlgo {
  const date = maintenant.toISOString()
  return {
    format: 'algoweb',
    version: VERSION_FORMAT,
    nom,
    description: '',
    code: `Algorithme ${nom}\n\nVariables\n\nDébut\n\nFin\n`,
    graine: null,
    creeLe: date,
    modifieLe: date,
  }
}

export class ErreurDocument extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurDocument'
  }
}

/** Lit un document JSON ; les champs inconnus sont ignorés. */
export function lireDocument(texte: string): DocumentAlgo {
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    throw new ErreurDocument('Le fichier n’est pas un fichier JSON valide.')
  }
  if (!brut || typeof brut !== 'object') throw new ErreurDocument('Le fichier ne contient pas un algorithme AlgoWeb.')
  const d = brut as Record<string, unknown>
  if (d.format !== 'algoweb') throw new ErreurDocument('Le fichier ne contient pas un algorithme AlgoWeb.')
  if (typeof d.version !== 'number' || d.version > VERSION_FORMAT) {
    throw new ErreurDocument('Ce fichier a été créé par une version plus récente d’AlgoWeb : rechargez la page pour mettre AlgoWeb à jour.')
  }
  if (typeof d.code !== 'string') throw new ErreurDocument('Le fichier ne contient pas de code.')
  const maintenant = new Date().toISOString()
  const date = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : maintenant)
  const graine =
    typeof d.graine === 'number' && Number.isSafeInteger(d.graine)
      ? String(d.graine)
      : typeof d.graine === 'string' && /^-?\d+$/.test(d.graine)
        ? d.graine
        : null
  const code = d.code
  return {
    format: 'algoweb',
    version: VERSION_FORMAT,
    nom: typeof d.nom === 'string' && d.nom.trim() !== '' ? d.nom.trim() : (nomDuCode(code) ?? 'Sans nom'),
    description: typeof d.description === 'string' ? d.description : '',
    code,
    graine,
    creeLe: date(d.creeLe),
    modifieLe: date(d.modifieLe),
  }
}

/** Texte JSON d'un document, lisible et stable. */
export function ecrireDocument(doc: DocumentAlgo): string {
  const graine = doc.graine !== null && Number.isSafeInteger(Number(doc.graine)) ? Number(doc.graine) : doc.graine
  return JSON.stringify({ ...doc, graine }, null, 2) + '\n'
}

// ---------------------------------------------------------------- Nom et ligne « Algorithme »

/** Indice de la ligne `Algorithme …`, si c'est la première ligne non vide hors commentaires. */
function ligneEnTete(lignes: string[]): number {
  for (let k = 0; k < lignes.length; k++) {
    const l = lignes[k].trim()
    if (l === '' || l.startsWith('//')) continue
    const mot = /^\p{L}+/u.exec(l)?.[0]
    return mot !== undefined && normaliser(mot) === 'algorithme' ? k : -1
  }
  return -1
}

/** Nom donné par la ligne `Algorithme …`, s'il y en a une. */
export function nomDuCode(code: string): string | undefined {
  const lignes = code.split('\n')
  const k = ligneEnTete(lignes)
  if (k < 0) return undefined
  const jetons = analyserLexique(lignes[k]).lignes[0].jetons
  const nom = jetons[1]?.genre === 'texteLibre' ? jetons[1].valeur : ''
  return nom === '' ? undefined : nom
}

/** Remplace (ou ajoute) la ligne `Algorithme …` pour qu'elle porte `nom`. */
export function renommerCode(code: string, nom: string): string {
  const lignes = code.split('\n')
  const k = ligneEnTete(lignes)
  if (k >= 0) {
    const commentaire = lignes[k].indexOf('//')
    lignes[k] = `Algorithme ${nom}` + (commentaire >= 0 ? ' ' + lignes[k].slice(commentaire) : '')
    return lignes.join('\n')
  }
  return `Algorithme ${nom}\n\n${code}`
}

// ---------------------------------------------------------------- Noms de fichiers

/** Nom de fichier sûr, sans les caractères interdits par les systèmes de fichiers. */
export function nomDeFichier(nom: string, extension: string): string {
  const propre = nom
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 100)
    .trim()
  return `${propre || 'algorithme'}.${extension}`
}

/** `nom.json`, `nom (2).json`, `nom (3).json`… selon les noms déjà pris. */
export function nomUnique(nom: string, pris: Set<string>, comparer: (a: string) => string = (a) => a.toLowerCase()): string {
  if (!pris.has(comparer(nom))) return nom
  const point = nom.lastIndexOf('.')
  const base = point > 0 ? nom.slice(0, point) : nom
  const extension = point > 0 ? nom.slice(point) : ''
  for (let k = 2; ; k++) {
    const candidat = `${base} (${k})${extension}`
    if (!pris.has(comparer(candidat))) return candidat
  }
}
