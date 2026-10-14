import { analyser } from '../../langage/analyse.ts'
import type { Notation } from '../../langage/predefinis.ts'
import { nouvelId, versModele, versTexte, type Bloc, type CorpsBlocs, type LigneVariables, type ModeleBlocs, type SousProgrammeBlocs } from './modele.ts'

/**
 * Opérations de l'éditeur par blocs. Chacune renvoie un nouveau modèle,
 * pour l'historique d'annulation.
 */

/**
 * Une liste de blocs : instructions d'un corps (identifiant du corps), corps
 * d'une boucle (`id:corps`), branche d'un Si (identifiant de la branche) ou
 * Sinon (identifiant du Sinon).
 */
export type CleListe = string

interface Position {
  liste: Bloc[]
  cle: CleListe
  index: number
  bloc: Bloc
  /** Bloc qui contient la liste, s'il y en a un. */
  parent: Bloc | null
}

function cloner(m: ModeleBlocs): ModeleBlocs {
  return structuredClone(m)
}

function corpsDe(m: ModeleBlocs): CorpsBlocs[] {
  const sousProgrammes = [...m.avant, ...m.apres].filter((e): e is SousProgrammeBlocs => e.genre === 'sousProgramme')
  return [...sousProgrammes.map((sp) => sp.corps), m.principal]
}

/** Listes de blocs contenues dans un bloc, avec leur clé. */
export function sousListes(b: Bloc): [CleListe, Bloc[]][] {
  switch (b.genre) {
    case 'si':
      return [...b.branches.map((br): [CleListe, Bloc[]] => [br.id, br.corps]), ...(b.sinon ? [[b.sinon.id, b.sinon.corps] as [CleListe, Bloc[]]] : [])]
    case 'pour':
    case 'pourChaque':
    case 'tantQue':
    case 'repeter':
      return [[`${b.id}:corps`, b.corps]]
    default:
      return []
  }
}

/** Parcourt toutes les listes du modèle. */
function* listes(m: ModeleBlocs): Generator<{ cle: CleListe; liste: Bloc[]; parent: Bloc | null }> {
  function* dans(cle: CleListe, liste: Bloc[], parent: Bloc | null): Generator<{ cle: CleListe; liste: Bloc[]; parent: Bloc | null }> {
    yield { cle, liste, parent }
    for (const b of liste) for (const [c, l] of sousListes(b)) yield* dans(c, l, b)
  }
  for (const c of corpsDe(m)) yield* dans(c.id, c.instructions, null)
}

export function trouverListe(m: ModeleBlocs, cle: CleListe): Bloc[] | undefined {
  for (const l of listes(m)) if (l.cle === cle) return l.liste
  return undefined
}

export function trouver(m: ModeleBlocs, id: string): Position | undefined {
  for (const { cle, liste, parent } of listes(m)) {
    const index = liste.findIndex((b) => b.id === id)
    if (index >= 0) return { liste, cle, index, bloc: liste[index], parent }
  }
  return undefined
}

/** Corps (algorithme principal ou sous-programme) qui contient le bloc ou la ligne `id`. */
export function corpsContenant(m: ModeleBlocs, id: string): CorpsBlocs | undefined {
  for (const c of corpsDe(m)) {
    if (c.id === id || c.variables?.some((l) => l.id === id)) return c
    const contient = (liste: Bloc[]): boolean => liste.some((b) => b.id === id || sousListes(b).some(([cle, l]) => cle === id || contient(l)))
    if (contient(c.instructions)) return c
  }
  return undefined
}

/** Recopie un bloc avec de nouveaux identifiants. */
function renouveler(b: Bloc): Bloc {
  const copie = structuredClone(b)
  const visiter = (x: Bloc) => {
    x.id = nouvelId()
    if (x.genre === 'si') {
      for (const br of x.branches) {
        br.id = nouvelId()
        br.corps.forEach(visiter)
      }
      if (x.sinon) {
        x.sinon.id = nouvelId()
        x.sinon.corps.forEach(visiter)
      }
    } else if ('corps' in x) {
      x.corps.forEach(visiter)
    }
  }
  visiter(copie)
  return copie
}

// ---------------------------------------------------------------- Modifications

/** Change des champs d'un bloc, d'une branche de Si ou d'un Sinon. */
export function modifier(m: ModeleBlocs, id: string, champs: Record<string, string | boolean>): ModeleBlocs {
  const r = cloner(m)
  const pos = trouver(r, id)
  if (pos) {
    Object.assign(pos.bloc, champs)
    return r
  }
  for (const { liste } of listes(r)) {
    for (const b of liste) {
      if (b.genre !== 'si') continue
      const branche = b.branches.find((br) => br.id === id) ?? (b.sinon?.id === id ? b.sinon : undefined)
      if (branche) {
        Object.assign(branche, champs)
        return r
      }
    }
  }
  return m
}

export function inserer(m: ModeleBlocs, cle: CleListe, index: number, blocs: Bloc[]): ModeleBlocs {
  const r = cloner(m)
  const liste = trouverListe(r, cle)
  if (!liste) return m
  liste.splice(Math.max(0, Math.min(index, liste.length)), 0, ...blocs)
  return r
}

export function supprimer(m: ModeleBlocs, id: string): ModeleBlocs {
  const r = cloner(m)
  const pos = trouver(r, id)
  if (!pos) return m
  pos.liste.splice(pos.index, 1)
  return r
}

export function dupliquer(m: ModeleBlocs, id: string): { modele: ModeleBlocs; id?: string } {
  const r = cloner(m)
  const pos = trouver(r, id)
  if (!pos) return { modele: m }
  const copie = renouveler(pos.bloc)
  pos.liste.splice(pos.index + 1, 0, copie)
  return { modele: r, id: copie.id }
}

/** `id` est-il `ancetre`, ou contenu dans `ancetre` ? */
function contenuDans(ancetre: Bloc, cle: CleListe): boolean {
  return sousListes(ancetre).some(([c, l]) => c === cle || l.some((b) => contenuDans(b, cle)))
}

/** Déplace un bloc vers la liste `cle`, à l'indice `index` (indice calculé avant le retrait du bloc). */
export function deplacer(m: ModeleBlocs, id: string, cle: CleListe, index: number): ModeleBlocs {
  const r = cloner(m)
  const pos = trouver(r, id)
  if (!pos || contenuDans(pos.bloc, cle)) return m
  const cible = trouverListe(r, cle)
  if (!cible) return m
  pos.liste.splice(pos.index, 1)
  const ajuste = cible === pos.liste && index > pos.index ? index - 1 : index
  cible.splice(Math.max(0, Math.min(ajuste, cible.length)), 0, pos.bloc)
  return r
}

/**
 * Monte (ou descend) un bloc d'une place. En haut (ou en bas) de sa liste, le
 * bloc sort du bloc qui le contient : c'est l'alternative au glisser-déposer.
 */
export function decaler(m: ModeleBlocs, id: string, sens: -1 | 1): ModeleBlocs {
  const pos = trouver(m, id)
  if (!pos) return m
  const voisin = pos.index + sens
  if (voisin >= 0 && voisin < pos.liste.length) {
    // Le voisin est-il un bloc à corps ? On entre alors dans son corps.
    const v = pos.liste[voisin]
    const interieurs = sousListes(v)
    if (interieurs.length > 0) {
      const [cle, liste] = sens === 1 ? interieurs[0] : interieurs[interieurs.length - 1]
      return deplacer(m, id, cle, sens === 1 ? 0 : liste.length)
    }
    return deplacer(m, id, pos.cle, sens === 1 ? voisin + 1 : voisin)
  }
  if (!pos.parent) return m
  const parent = trouver(m, pos.parent.id)!
  // Plusieurs branches : on passe à la branche voisine du même Si.
  const interieurs = sousListes(pos.parent)
  const k = interieurs.findIndex(([cle]) => cle === pos.cle)
  if (k + sens >= 0 && k + sens < interieurs.length) {
    const [cle, liste] = interieurs[k + sens]
    return deplacer(m, id, cle, sens === 1 ? 0 : liste.length)
  }
  return deplacer(m, id, parent.cle, sens === 1 ? parent.index + 1 : parent.index)
}

/** Remplace un bloc par des commentaires contenant son texte. */
export function commenter(m: ModeleBlocs, id: string): ModeleBlocs {
  const pos = trouver(m, id)
  if (!pos) return m
  const seul: ModeleBlocs = { entete: null, avant: [], principal: { id: 'tmp', variables: null, instructions: [pos.bloc], commentaires: {} }, apres: [] }
  const lignes = versTexte(seul).texte.split('\n').slice(1, -2)
  const commentaires: Bloc[] = lignes.map((l) => ({ genre: 'commentaire', id: nouvelId(), texte: ` ${l.slice(2)}` }))
  const r = cloner(m)
  const p = trouver(r, id)!
  p.liste.splice(p.index, 1, ...commentaires)
  return r
}

export function ajouterSinonSi(m: ModeleBlocs, siId: string): { modele: ModeleBlocs; id?: string } {
  const r = cloner(m)
  const pos = trouver(r, siId)
  if (pos?.bloc.genre !== 'si') return { modele: m }
  const branche = { id: nouvelId(), condition: 'condition', corps: [] }
  pos.bloc.branches.push(branche)
  return { modele: r, id: branche.id }
}

export function ajouterSinon(m: ModeleBlocs, siId: string): { modele: ModeleBlocs; id?: string } {
  const r = cloner(m)
  const pos = trouver(r, siId)
  if (pos?.bloc.genre !== 'si' || pos.bloc.sinon) return { modele: m }
  pos.bloc.sinon = { id: nouvelId(), corps: [] }
  return { modele: r, id: pos.bloc.sinon.id }
}

/** Supprime une branche Sinon si ou le Sinon ; leurs instructions sont perdues. */
export function supprimerBranche(m: ModeleBlocs, brancheId: string): ModeleBlocs {
  const r = cloner(m)
  for (const { liste } of listes(r)) {
    for (const b of liste) {
      if (b.genre !== 'si') continue
      if (b.sinon?.id === brancheId) {
        b.sinon = null
        return r
      }
      const k = b.branches.findIndex((br) => br.id === brancheId)
      if (k > 0) {
        b.branches.splice(k, 1)
        return r
      }
    }
  }
  return m
}

// ---------------------------------------------------------------- Déclarations et sous-programmes

function trouverCorps(m: ModeleBlocs, corpsId: string): CorpsBlocs | undefined {
  return corpsDe(m).find((c) => c.id === corpsId)
}

export function ajouterDeclaration(m: ModeleBlocs, corpsId: string, noms = 'x', type = 'entier'): { modele: ModeleBlocs; id?: string } {
  const r = cloner(m)
  const corps = trouverCorps(r, corpsId)
  if (!corps) return { modele: m }
  const ligne: LigneVariables = { genre: 'declaration', id: nouvelId(), noms, type }
  corps.variables = [...(corps.variables ?? []), ligne]
  return { modele: r, id: ligne.id }
}

export function modifierLigneVariables(m: ModeleBlocs, id: string, champs: Record<string, string>): ModeleBlocs {
  const r = cloner(m)
  for (const c of corpsDe(r)) {
    const l = c.variables?.find((x) => x.id === id)
    if (l) {
      Object.assign(l, champs)
      return r
    }
  }
  return m
}

export function supprimerLigneVariables(m: ModeleBlocs, id: string): ModeleBlocs {
  const r = cloner(m)
  for (const c of corpsDe(r)) {
    const k = c.variables?.findIndex((x) => x.id === id) ?? -1
    if (k >= 0) {
      c.variables!.splice(k, 1)
      return r
    }
  }
  return m
}

export function modifierSousProgramme(m: ModeleBlocs, id: string, champs: Partial<Pick<SousProgrammeBlocs, 'nom' | 'parametres' | 'typeRetour'>>): ModeleBlocs {
  const r = cloner(m)
  const sp = [...r.avant, ...r.apres].find((e) => e.id === id)
  if (sp?.genre !== 'sousProgramme') return m
  Object.assign(sp, champs)
  return r
}

export function supprimerSousProgramme(m: ModeleBlocs, id: string): ModeleBlocs {
  const r = cloner(m)
  r.avant = r.avant.filter((e) => e.id !== id)
  r.apres = r.apres.filter((e) => e.id !== id)
  return r
}

// ---------------------------------------------------------------- Modèles de la palette

/** Retire les lignes vides des modèles de la palette (corps à remplir) : elles n'ont pas lieu d'être en blocs. */
function sansVides(blocs: Bloc[]): Bloc[] {
  return blocs
    .filter((b) => b.genre !== 'vide')
    .map((b) => {
      if (b.genre === 'si') {
        for (const br of b.branches) br.corps = sansVides(br.corps)
        if (b.sinon) b.sinon.corps = sansVides(b.sinon.corps)
      } else if ('corps' in b) {
        b.corps = sansVides(b.corps)
      }
      return b
    })
}

/** Blocs correspondant au texte d'un modèle de la palette (`Si condition alors…`), ou undefined. */
export function blocsDepuisTexte(texte: string, notation: Notation): Bloc[] | undefined {
  const { programme, diagnostics } = analyser(`Début\n${texte}\nFin\n`)
  if (diagnostics.length > 0) return undefined
  return sansVides(versModele(programme, notation).principal.instructions)
}

/** Sous-programme correspondant au texte d'un modèle (`Fonction nom(…)…`), ou undefined. */
export function sousProgrammeDepuisTexte(texte: string, notation: Notation): SousProgrammeBlocs | undefined {
  // Un en-tête seul est complété par un corps vide.
  const complet = /\bFin\s*(Fonction|Proc[ée]dure)\s*$/i.test(texte.trim())
    ? texte
    : `${texte}\nDébut\n${/^\s*fonction/i.test(texte) ? 'FinFonction' : 'FinProcédure'}`
  const { programme, diagnostics } = analyser(`${complet}\nDébut\nFin\n`)
  if (diagnostics.length > 0) return undefined
  const sp = versModele(programme, notation).avant.find((e) => e.genre === 'sousProgramme')
  if (sp?.genre !== 'sousProgramme') return undefined
  sp.corps.instructions = sansVides(sp.corps.instructions)
  return sp
}

/** Ajoute un sous-programme avant l'algorithme principal. */
export function ajouterSousProgramme(m: ModeleBlocs, sp: SousProgrammeBlocs): ModeleBlocs {
  const r = cloner(m)
  const vide = { genre: 'vide' as const, id: nouvelId() }
  r.avant.push(sp, vide)
  return r
}
