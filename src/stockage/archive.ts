import { strToU8, unzipSync, zipSync } from 'fflate'
import { exporterTexteEnPython } from '../export/index.ts'
import { ErreurAlg, importerAlg, type RapportImport } from '../import-algobox/index.ts'
import { ecrireDocument, lireDocument, nomDeFichier, nomUnique, nouveauDocument, type DocumentAlgo } from './document.ts'

/**
 * Téléchargements groupés et imports (PLAN.md, section 7.3).
 */

/** Archive `.zip` contenant un `.json` par algorithme, et en option le `.py` de ceux qui sont corrects. */
export function creerArchive(documents: DocumentAlgo[], avecPython = false): Uint8Array {
  const fichiers: Record<string, Uint8Array> = {}
  const pris = new Set<string>()
  for (const doc of documents) {
    const json = nomUnique(nomDeFichier(doc.nom, 'json'), pris)
    pris.add(json.toLowerCase())
    fichiers[json] = strToU8(ecrireDocument(doc))
    if (avecPython) {
      const python = exporterTexteEnPython(doc.code, { nom: doc.nom, description: doc.description, graine: doc.graine === null ? null : BigInt(doc.graine) })
      if ('python' in python) fichiers[json.replace(/\.json$/, '.py')] = strToU8(python.python)
    }
  }
  return zipSync(fichiers, { level: 6, mtime: new Date() })
}

/** Nom de l'archive complète : `algoweb-AAAA-MM-JJ.zip`. */
export function nomArchive(date = new Date()): string {
  const deux = (n: number) => String(n).padStart(2, '0')
  return `algoweb-${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}.zip`
}

export interface FichierLu {
  nom: string
  /** Document lu (avec le rapport d'import pour un fichier AlgoBox), ou message d'erreur. */
  resultat: { document: DocumentAlgo; rapport?: RapportImport } | { erreur: string }
}

/** Décode un fichier texte en UTF-8 ; renvoie undefined s'il n'est pas valide. */
function decoderUtf8(octets: Uint8Array): string | undefined {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(octets).replace(/^﻿/, '')
  } catch {
    return undefined
  }
}

function lireJson(nom: string, octets: Uint8Array): FichierLu {
  const texte = decoderUtf8(octets)
  if (texte === undefined) return { nom, resultat: { erreur: 'Le fichier n’est pas encodé en UTF-8.' } }
  try {
    return { nom, resultat: { document: lireDocument(texte) } }
  } catch (e) {
    return { nom, resultat: { erreur: (e as Error).message } }
  }
}

/** Décode un fichier `.alg` : UTF-8, ou Windows-1252 s'il est mal encodé (PLAN.md, section 7.3). */
export function decoderAlg(octets: Uint8Array): string {
  return decoderUtf8(octets) ?? new TextDecoder('windows-1252').decode(octets)
}

function lireAlg(nom: string, octets: Uint8Array): FichierLu {
  try {
    const importe = importerAlg(decoderAlg(octets), nom)
    const document = { ...nouveauDocument(importe.nom), description: importe.description, code: importe.code }
    return { nom, resultat: { document, rapport: importe.rapport } }
  } catch (e) {
    if (e instanceof ErreurAlg) return { nom, resultat: { erreur: e.message } }
    throw e
  }
}

/**
 * Lit un fichier importé : `.json` (un algorithme), `.zip` (archive AlgoWeb)
 * ou `.alg` (algorithme AlgoBox, converti).
 */
export function lireFichier(nom: string, octets: Uint8Array): FichierLu[] {
  const extension = nom.toLowerCase().split('.').pop()
  if (extension === 'json') return [lireJson(nom, octets)]
  if (extension === 'zip') {
    let contenu: Record<string, Uint8Array>
    try {
      contenu = unzipSync(octets)
    } catch {
      return [{ nom, resultat: { erreur: 'L’archive est illisible ou endommagée.' } }]
    }
    const lus = Object.entries(contenu)
      .filter(([chemin]) => chemin.toLowerCase().endsWith('.json') && !chemin.split('/').pop()!.startsWith('.'))
      .map(([chemin, donnees]) => lireJson(`${nom} › ${chemin}`, donnees))
    return lus.length > 0 ? lus : [{ nom, resultat: { erreur: 'L’archive ne contient aucun algorithme AlgoWeb.' } }]
  }
  if (extension === 'alg') return [lireAlg(nom, octets)]
  return [{ nom, resultat: { erreur: 'Type de fichier non reconnu : AlgoWeb importe les fichiers .json, .zip et .alg.' } }]
}
