import { ecrireDocument, lireDocument, nomUnique, renommerCode, type DocumentAlgo } from './document.ts'

/**
 * Bibliothèque locale des algorithmes, dans le localStorage du navigateur
 * (PLAN.md, section 7.2). Le stockage est injecté pour les tests.
 */

export interface Metadonnees {
  id: string
  nom: string
  description: string
  creeLe: string
  modifieLe: string
  /** Taille du document, en octets. */
  taille: number
  /** Date de mise à la corbeille. */
  supprimeLe?: string
}

/** Sous-ensemble de l'interface Storage du navigateur. */
export interface Stockage {
  getItem(cle: string): string | null
  setItem(cle: string, valeur: string): void
  removeItem(cle: string): void
  key(indice: number): string | null
  readonly length: number
}

export const PREFIXE = 'algoweb:v1:'
export const CLES = {
  index: `${PREFIXE}index`,
  document: (id: string) => `${PREFIXE}doc:${id}`,
  preferences: `${PREFIXE}preferences`,
  dernierExport: `${PREFIXE}dernier-export`,
}

/** Durée de conservation dans la corbeille. */
export const DUREE_CORBEILLE_JOURS = 30
/** Capacité habituelle du localStorage (environ 5 Mo de caractères UTF-16). */
export const CAPACITE_ESTIMEE = 5 * 1024 * 1024

export class ErreurQuota extends Error {
  constructor() {
    super('L’espace de stockage du navigateur est plein. Téléchargez une sauvegarde, puis videz la corbeille ou supprimez des algorithmes.')
    this.name = 'ErreurQuota'
  }
}

function estErreurQuota(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const { name, code } = e as { name?: string; code?: number }
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014
}

const JOUR = 24 * 60 * 60 * 1000

export class Bibliotheque {
  private readonly stockage: Stockage
  private readonly genererId: () => string
  private readonly maintenant: () => Date
  private index: Metadonnees[]

  constructor(stockage: Stockage, options: { genererId?: () => string; maintenant?: () => Date } = {}) {
    this.stockage = stockage
    this.genererId = options.genererId ?? (() => crypto.randomUUID())
    this.maintenant = options.maintenant ?? (() => new Date())
    this.index = this.lireIndex()
    this.purgerCorbeille()
  }

  /** Relit l'index, après une modification faite dans un autre onglet. */
  recharger(): void {
    this.index = this.lireIndex()
  }

  private lireIndex(): Metadonnees[] {
    const texte = this.stockage.getItem(CLES.index)
    if (texte) {
      try {
        const index = JSON.parse(texte) as Metadonnees[]
        if (Array.isArray(index)) return index.filter((m) => this.stockage.getItem(CLES.document(m.id)) !== null)
      } catch {
        // Index illisible : on le reconstruit à partir des documents.
      }
    }
    return this.reconstruireIndex()
  }

  private reconstruireIndex(): Metadonnees[] {
    const index: Metadonnees[] = []
    const prefixe = CLES.document('')
    for (let k = 0; k < this.stockage.length; k++) {
      const cle = this.stockage.key(k)
      if (!cle?.startsWith(prefixe)) continue
      try {
        const texte = this.stockage.getItem(cle)!
        index.push(metadonnees(cle.slice(prefixe.length), lireDocument(texte), texte.length))
      } catch {
        // Document illisible : ignoré.
      }
    }
    return index
  }

  private ecrire(cle: string, valeur: string): void {
    try {
      this.stockage.setItem(cle, valeur)
    } catch (e) {
      if (estErreurQuota(e)) throw new ErreurQuota()
      throw e
    }
  }

  private sauverIndex(): void {
    this.ecrire(CLES.index, JSON.stringify(this.index))
  }

  /** Algorithmes hors corbeille. */
  actifs(): Metadonnees[] {
    return this.index.filter((m) => !m.supprimeLe)
  }

  corbeille(): Metadonnees[] {
    return this.index.filter((m) => m.supprimeLe)
  }

  metadonnees(id: string): Metadonnees | undefined {
    return this.index.find((m) => m.id === id)
  }

  lire(id: string): DocumentAlgo | undefined {
    const texte = this.stockage.getItem(CLES.document(id))
    if (texte === null) return undefined
    try {
      return lireDocument(texte)
    } catch {
      return undefined
    }
  }

  creer(doc: DocumentAlgo): Metadonnees {
    const id = this.genererId()
    const texte = ecrireDocument(doc)
    this.ecrire(CLES.document(id), texte)
    const m = metadonnees(id, doc, texte.length)
    this.index.push(m)
    try {
      this.sauverIndex()
    } catch (e) {
      this.index.pop()
      this.stockage.removeItem(CLES.document(id))
      throw e
    }
    return m
  }

  enregistrer(id: string, doc: DocumentAlgo): Metadonnees {
    const texte = ecrireDocument(doc)
    this.ecrire(CLES.document(id), texte)
    const m = metadonnees(id, doc, texte.length)
    const k = this.index.findIndex((x) => x.id === id)
    if (k >= 0) {
      if (this.index[k].supprimeLe) m.supprimeLe = this.index[k].supprimeLe
      this.index[k] = m
    } else {
      this.index.push(m)
    }
    this.sauverIndex()
    return m
  }

  /** Change le nom d'un algorithme, et la ligne `Algorithme …` de son code. */
  renommer(id: string, nom: string): DocumentAlgo | undefined {
    const doc = this.lire(id)
    if (!doc) return undefined
    const renomme = { ...doc, nom, code: renommerCode(doc.code, nom), modifieLe: this.maintenant().toISOString() }
    this.enregistrer(id, renomme)
    return renomme
  }

  dupliquer(id: string): Metadonnees | undefined {
    const doc = this.lire(id)
    if (!doc) return undefined
    const pris = new Set(this.actifs().map((m) => m.nom.toLowerCase()))
    const nom = nomUnique(`${doc.nom} (copie)`, pris)
    const date = this.maintenant().toISOString()
    return this.creer({ ...doc, nom, code: renommerCode(doc.code, nom), creeLe: date, modifieLe: date })
  }

  mettreALaCorbeille(id: string): void {
    const m = this.metadonnees(id)
    if (!m) return
    m.supprimeLe = this.maintenant().toISOString()
    this.sauverIndex()
  }

  restaurer(id: string): void {
    const m = this.metadonnees(id)
    if (!m) return
    delete m.supprimeLe
    this.sauverIndex()
  }

  /** Suppression définitive. */
  supprimer(id: string): void {
    this.stockage.removeItem(CLES.document(id))
    this.index = this.index.filter((m) => m.id !== id)
    this.sauverIndex()
  }

  viderCorbeille(): void {
    for (const m of this.corbeille()) this.stockage.removeItem(CLES.document(m.id))
    this.index = this.actifs()
    this.sauverIndex()
  }

  /** Supprime les éléments de la corbeille depuis plus de 30 jours. */
  purgerCorbeille(): void {
    const limite = this.maintenant().getTime() - DUREE_CORBEILLE_JOURS * JOUR
    const perimes = this.corbeille().filter((m) => Date.parse(m.supprimeLe!) < limite)
    if (perimes.length === 0) return
    for (const m of perimes) this.stockage.removeItem(CLES.document(m.id))
    this.index = this.index.filter((m) => !perimes.includes(m))
    this.sauverIndex()
  }

  /** Place occupée par AlgoWeb, en octets (deux octets par caractère). */
  occupation(): number {
    let total = 0
    for (let k = 0; k < this.stockage.length; k++) {
      const cle = this.stockage.key(k)
      if (cle?.startsWith(PREFIXE)) total += (cle.length + (this.stockage.getItem(cle)?.length ?? 0)) * 2
    }
    return total
  }

  // ------------------------------------------------------------ Rappel de sauvegarde

  get dernierExport(): Date | undefined {
    const t = this.stockage.getItem(CLES.dernierExport)
    return t ? new Date(t) : undefined
  }

  noterExport(): void {
    this.ecrire(CLES.dernierExport, this.maintenant().toISOString())
  }

  /**
   * Faut-il inviter à télécharger une sauvegarde ? Oui si des algorithmes ont
   * été modifiés depuis le dernier téléchargement complet, et que celui-ci
   * date de plus de 7 jours (ou n'a jamais eu lieu et le premier algorithme a plus de 7 jours).
   */
  sauvegardeConseillee(): boolean {
    const actifs = this.actifs()
    if (actifs.length === 0) return false
    const maintenant = this.maintenant().getTime()
    const dernier = this.dernierExport?.getTime()
    if (dernier === undefined) return actifs.some((m) => maintenant - Date.parse(m.creeLe) > 7 * JOUR)
    return maintenant - dernier > 7 * JOUR && actifs.some((m) => Date.parse(m.modifieLe) > dernier)
  }
}

function metadonnees(id: string, doc: DocumentAlgo, taille: number): Metadonnees {
  return { id, nom: doc.nom, description: doc.description, creeLe: doc.creeLe, modifieLe: doc.modifieLe, taille }
}

/** Stockage en mémoire, pour les tests ou quand le localStorage est indisponible (navigation privée stricte). */
export class StockageMemoire implements Stockage {
  private readonly donnees = new Map<string, string>()
  private readonly limite: number

  constructor(limite = Infinity) {
    this.limite = limite
  }

  get length(): number {
    return this.donnees.size
  }

  key(indice: number): string | null {
    return [...this.donnees.keys()][indice] ?? null
  }

  getItem(cle: string): string | null {
    return this.donnees.get(cle) ?? null
  }

  setItem(cle: string, valeur: string): void {
    let total = valeur.length + cle.length
    for (const [c, v] of this.donnees) if (c !== cle) total += c.length + v.length
    if (total > this.limite) {
      const e = new Error('quota') as Error & { code: number }
      e.name = 'QuotaExceededError'
      throw e
    }
    this.donnees.set(cle, valeur)
  }

  removeItem(cle: string): void {
    this.donnees.delete(cle)
  }
}
