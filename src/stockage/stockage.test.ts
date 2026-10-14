import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { convertirNotation } from '../langage/notation.ts'
import { creerArchive, lireFichier, nomArchive } from './archive.ts'
import { Bibliotheque, CLES, ErreurQuota, StockageMemoire } from './bibliotheque.ts'
import { ecrireDocument, lireDocument, nomDeFichier, nomDuCode, nomUnique, nouveauDocument, renommerCode } from './document.ts'

const JOUR = 24 * 60 * 60 * 1000

function bibliotheque(stockage = new StockageMemoire(), debut = new Date('2026-10-14T10:00:00Z')) {
  let ids = 0
  let temps = debut.getTime()
  const b = new Bibliotheque(stockage, { genererId: () => `id${++ids}`, maintenant: () => new Date(temps) })
  return { b, stockage, avancer: (ms: number) => (temps += ms) }
}

describe('document JSON', () => {
  it('relit ce qu’il écrit, et ignore les champs inconnus', () => {
    const doc = { ...nouveauDocument('Test', new Date('2026-10-13T14:00:00Z')), graine: '42' }
    const texte = ecrireDocument(doc)
    expect(JSON.parse(texte).graine).toBe(42)
    expect(lireDocument(texte)).toEqual(doc)
    expect(lireDocument(JSON.stringify({ ...JSON.parse(texte), inconnu: 1 }))).toEqual(doc)
  })

  it('refuse un fichier qui n’est pas un algorithme', () => {
    expect(() => lireDocument('{')).toThrow('JSON valide')
    expect(() => lireDocument('{"format":"autre"}')).toThrow('AlgoWeb')
    expect(() => lireDocument('{"format":"algoweb","version":2,"code":""}')).toThrow('version plus récente')
  })

  it('synchronise le nom et la ligne Algorithme', () => {
    expect(nomDuCode('// note\n\nalgorithme  Somme des pairs // c\nDébut\nFin')).toBe('Somme des pairs')
    expect(nomDuCode('Début\nFin')).toBeUndefined()
    expect(renommerCode('// note\nAlgorithme A // c\nDébut', 'B')).toBe('// note\nAlgorithme B // c\nDébut')
    expect(renommerCode('Début\nFin', 'B')).toBe('Algorithme B\n\nDébut\nFin')
  })

  it('produit des noms de fichiers sûrs et uniques', () => {
    expect(nomDeFichier('Moyenne des notes', 'json')).toBe('Moyenne des notes.json')
    expect(nomDeFichier('a/b:c*?"<>|', 'py')).toBe('a b c.py')
    expect(nomDeFichier('...', 'json')).toBe('algorithme.json')
    expect(nomUnique('a.json', new Set(['a.json', 'a (2).json']))).toBe('a (3).json')
  })
})

describe('bibliothèque locale', () => {
  it('crée, relit, enregistre et liste les algorithmes', () => {
    const { b, stockage } = bibliotheque()
    const m = b.creer(nouveauDocument('Premier'))
    expect(b.actifs().map((x) => x.nom)).toEqual(['Premier'])
    const doc = b.lire(m.id)!
    b.enregistrer(m.id, { ...doc, code: doc.code + '// fin\n' })
    expect(b.lire(m.id)!.code).toContain('// fin')
    // Un autre onglet relit la même bibliothèque.
    expect(new Bibliotheque(stockage).actifs()).toHaveLength(1)
  })

  it('renomme et duplique en mettant à jour la ligne Algorithme', () => {
    const { b } = bibliotheque()
    const m = b.creer(nouveauDocument('A'))
    expect(b.renommer(m.id, 'B')!.code.startsWith('Algorithme B\n')).toBe(true)
    const copie = b.dupliquer(m.id)!
    expect(copie.nom).toBe('B (copie)')
    expect(b.lire(copie.id)!.code.startsWith('Algorithme B (copie)\n')).toBe(true)
  })

  it('gère la corbeille et la vide après 30 jours', () => {
    const { b, stockage, avancer } = bibliotheque()
    const a = b.creer(nouveauDocument('A'))
    const c = b.creer(nouveauDocument('C'))
    b.mettreALaCorbeille(a.id)
    b.mettreALaCorbeille(c.id)
    b.restaurer(c.id)
    expect(b.corbeille().map((m) => m.nom)).toEqual(['A'])
    avancer(31 * JOUR)
    const relue = new Bibliotheque(stockage, { maintenant: () => new Date(Date.parse('2026-10-14T10:00:00Z') + 31 * JOUR) })
    expect(relue.corbeille()).toEqual([])
    expect(stockage.getItem(CLES.document(a.id))).toBeNull()
  })

  it('signale un stockage plein sans perdre l’index', () => {
    const { b } = bibliotheque(new StockageMemoire(800))
    b.creer(nouveauDocument('A'))
    expect(() => b.creer({ ...nouveauDocument('B'), code: 'x'.repeat(1000) })).toThrow(ErreurQuota)
    expect(b.actifs().map((m) => m.nom)).toEqual(['A'])
  })

  it('reconstruit un index endommagé', () => {
    const { b, stockage } = bibliotheque()
    b.creer(nouveauDocument('A'))
    stockage.setItem(CLES.index, 'pas du JSON')
    expect(new Bibliotheque(stockage).actifs().map((m) => m.nom)).toEqual(['A'])
  })

  it('conseille une sauvegarde après 7 jours sans téléchargement', () => {
    const { b, avancer } = bibliotheque()
    const m = b.creer(nouveauDocument('A'))
    expect(b.sauvegardeConseillee()).toBe(false)
    avancer(8 * JOUR)
    expect(b.sauvegardeConseillee()).toBe(true)
    b.noterExport()
    expect(b.sauvegardeConseillee()).toBe(false)
    avancer(8 * JOUR)
    expect(b.sauvegardeConseillee()).toBe(false)
    b.renommer(m.id, 'B')
    avancer(8 * JOUR)
    expect(b.sauvegardeConseillee()).toBe(true)
  })

  it('mesure la place occupée', () => {
    const { b } = bibliotheque()
    const vide = b.occupation()
    b.creer(nouveauDocument('A'))
    expect(b.occupation()).toBeGreaterThan(vide + 100)
  })
})

describe('archives et imports', () => {
  it('crée une archive avec des noms dédoublonnés et le Python en option', () => {
    const a = nouveauDocument('Test')
    const b = { ...nouveauDocument('test'), code: 'Début\n  Afficher 1 ↵\nFin\n' }
    const fichiers = unzipSync(creerArchive([a, b], true))
    expect(Object.keys(fichiers).sort()).toEqual(['Test.json', 'Test.py', 'test (2).json', 'test (2).py'])
    expect(strFromU8(fichiers['test (2).py'])).toContain('print(1)')
  })

  it('relit une archive et un fichier JSON', () => {
    const doc = nouveauDocument('A')
    const lus = lireFichier('sauvegarde.zip', creerArchive([doc, nouveauDocument('B')]))
    expect(lus.map((f) => 'document' in f.resultat && f.resultat.document.nom)).toEqual(['A', 'B'])
    expect(lireFichier('A.json', new TextEncoder().encode(ecrireDocument(doc)))[0].resultat).toEqual({ document: doc })
  })

  it('importe un fichier AlgoBox, en UTF-8 ou en Windows-1252, avec son rapport', () => {
    const xml = (texte: string) =>
      `<?xml version="1.0"?><Algo><description texte="Écrit en ${texte}" courant=""/>` +
      `<item algoitem="VARIABLES" code="100#x"/><item algoitem="DEBUT_ALGORITHME" code="101#x">` +
      `<item algoitem="" code="4#Été#1"/></item></Algo>`
    const utf8 = lireFichier('Été.alg', new TextEncoder().encode(xml('UTF-8')))[0].resultat
    // Windows-1252 : « É » vaut 0xC9 et « é » 0xE9.
    const octets = Uint8Array.from([...xml('Windows-1252')].map((c) => ({ É: 0xc9, é: 0xe9 })[c] ?? c.charCodeAt(0)))
    const cp1252 = lireFichier('Été.alg', octets)[0].resultat
    for (const [r, encodage] of [[utf8, 'UTF-8'], [cp1252, 'Windows-1252']] as const) {
      if (!('document' in r)) throw new Error('import refusé')
      expect(r.document.nom).toBe('Été')
      expect(r.document.description).toBe(`Écrit en ${encodage}`)
      expect(r.document.code).toBe('Algorithme Été\n\nVariables\nDébut\n  Afficher "Été" ↵\nFin\n')
      expect(r.rapport?.lignes).toBe(1)
    }
  })

  it('explique pourquoi un fichier ne peut pas être importé', () => {
    const erreur = (nom: string, octets: Uint8Array) => {
      const r = lireFichier(nom, octets)[0].resultat
      return 'erreur' in r ? r.erreur : ''
    }
    expect(erreur('a.json', new Uint8Array([0xff, 0xfe]))).toContain('UTF-8')
    expect(erreur('a.zip', new Uint8Array([1, 2, 3]))).toContain('illisible')
    expect(erreur('a.alg', new Uint8Array())).toContain('AlgoBox')
    expect(erreur('a.txt', new Uint8Array())).toContain('non reconnu')
  })

  it('nomme l’archive complète avec la date', () => {
    expect(nomArchive(new Date(2026, 0, 5))).toBe('algoweb-2026-01-05.zip')
  })
})

describe('notation des fonctions', () => {
  it('passe d’une notation à l’autre sans toucher aux variables ni au reste du texte', () => {
    const python = 'somme ← sqrt(len(L)) + log(x) + log(x, 2) // sqrt(\nAfficher "len(", somme ↵'
    const francais = 'somme ← racine(longueur(L)) + ln(x) + log(x, 2) // sqrt(\nAfficher "len(", somme ↵'
    expect(convertirNotation(python, 'francais')).toBe(francais)
    expect(convertirNotation(francais, 'python')).toBe(python)
  })

  it('fonctionne sur un texte incomplet', () => {
    expect(convertirNotation('x ← racine(', 'python')).toBe('x ← sqrt(')
  })
})
