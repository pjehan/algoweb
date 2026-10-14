import type { Corps, Instruction, LigneDeclarations, Programme, SousProgramme as SousProgrammeAst } from '../../langage/ast.ts'
import { formaterExpression, formaterType } from '../../langage/formateur.ts'
import type { Notation } from '../../langage/predefinis.ts'

/**
 * Modèle de l'éditeur par blocs (PLAN.md, section 8). Il reprend la structure
 * de l'AST, mais chaque expression y est un texte : un champ en cours de
 * saisie, même incorrect, n'est jamais perdu. Le texte de l'algorithme est
 * produit à partir du modèle à chaque modification.
 */

export type Bloc =
  | { genre: 'affectation'; id: string; cible: string; valeur: string; commentaire?: string }
  | { genre: 'lire'; id: string; cibles: string; commentaire?: string }
  | { genre: 'afficher'; id: string; valeurs: string; retour: boolean; commentaire?: string }
  | { genre: 'si'; id: string; branches: Branche[]; sinon: Sinon | null; commentaire?: string; commentaireFin?: string }
  | { genre: 'pour'; id: string; compteur: string; debut: string; fin: string; pas: string; corps: Bloc[]; commentaire?: string; commentaireFin?: string }
  | { genre: 'pourChaque'; id: string; variable: string; collection: string; corps: Bloc[]; commentaire?: string; commentaireFin?: string }
  | { genre: 'tantQue'; id: string; condition: string; corps: Bloc[]; commentaire?: string; commentaireFin?: string }
  | { genre: 'repeter'; id: string; corps: Bloc[]; condition: string; commentaire?: string; commentaireFin?: string }
  | { genre: 'appel'; id: string; appel: string; commentaire?: string }
  | { genre: 'retourner'; id: string; valeur: string; commentaire?: string }
  | { genre: 'pause'; id: string; commentaire?: string }
  | { genre: 'commentaire'; id: string; texte: string }
  | { genre: 'vide'; id: string }

export interface Branche {
  id: string
  condition: string
  corps: Bloc[]
  commentaire?: string
}

export interface Sinon {
  id: string
  corps: Bloc[]
  commentaire?: string
}

export type LigneVariables =
  | { genre: 'declaration'; id: string; noms: string; type: string; commentaire?: string }
  | { genre: 'commentaire'; id: string; texte: string }
  | { genre: 'vide'; id: string }

export interface CorpsBlocs {
  id: string
  /** Section Variables, absente si l'algorithme n'en a pas. */
  variables: LigneVariables[] | null
  instructions: Bloc[]
  commentaires: { variables?: string; debut?: string; fin?: string }
}

export interface SousProgrammeBlocs {
  genre: 'sousProgramme'
  id: string
  type: 'fonction' | 'procedure'
  nom: string
  /** Paramètres en texte : `a : entier, b : réel`. */
  parametres: string
  typeRetour: string
  commentaire?: string
  preambule: (Extract<LigneVariables, { genre: 'commentaire' | 'vide' }>)[]
  corps: CorpsBlocs
}

export type ElementHaut = SousProgrammeBlocs | { genre: 'commentaire'; id: string; texte: string } | { genre: 'vide'; id: string }

export interface ModeleBlocs {
  entete: { nom: string; commentaire?: string } | null
  /** Lignes vides, commentaires et sous-programmes avant l'algorithme principal. */
  avant: ElementHaut[]
  principal: CorpsBlocs
  /** Lignes vides et commentaires après la ligne Fin. */
  apres: ElementHaut[]
}

let compteur = 0
export function nouvelId(): string {
  return `b${++compteur}`
}

// ---------------------------------------------------------------- AST → modèle

export function versModele(programme: Programme, notation: Notation): ModeleBlocs {
  const e = (x: Parameters<typeof formaterExpression>[0]) => formaterExpression(x, notation)
  const avecCommentaire = <T extends object>(objet: T, commentaire: string | undefined): T =>
    commentaire === undefined ? objet : { ...objet, commentaire }

  const bloc = (i: Instruction): Bloc => {
    const id = nouvelId()
    switch (i.genre) {
      case 'Affectation':
        return avecCommentaire({ genre: 'affectation', id, cible: e(i.cible), valeur: e(i.valeur) }, i.commentaire)
      case 'Lire':
        return avecCommentaire({ genre: 'lire', id, cibles: i.cibles.map(e).join(', ') }, i.commentaire)
      case 'Afficher':
        return avecCommentaire({ genre: 'afficher', id, valeurs: i.valeurs.map(e).join(', '), retour: i.retourLigne }, i.commentaire)
      case 'Si':
        return avecCommentaire(
          {
            genre: 'si',
            id,
            branches: i.branches.map((b) => avecCommentaire({ id: nouvelId(), condition: e(b.condition), corps: b.corps.map(bloc) }, b.commentaire)),
            sinon: i.sinon ? avecCommentaire({ id: nouvelId(), corps: i.sinon.corps.map(bloc) }, i.sinon.commentaire) : null,
            ...(i.fermeture?.commentaire !== undefined ? { commentaireFin: i.fermeture.commentaire } : {}),
          },
          i.commentaire,
        )
      case 'Pour':
        return avecCommentaire(
          {
            genre: 'pour',
            id,
            compteur: i.compteur.nom,
            debut: e(i.debut),
            fin: e(i.fin),
            pas: i.pas ? e(i.pas) : '',
            corps: i.corps.map(bloc),
            ...(i.fermeture?.commentaire !== undefined ? { commentaireFin: i.fermeture.commentaire } : {}),
          },
          i.commentaire,
        )
      case 'PourChaque':
        return avecCommentaire(
          {
            genre: 'pourChaque',
            id,
            variable: i.variable.nom,
            collection: e(i.collection),
            corps: i.corps.map(bloc),
            ...(i.fermeture?.commentaire !== undefined ? { commentaireFin: i.fermeture.commentaire } : {}),
          },
          i.commentaire,
        )
      case 'TantQue':
        return avecCommentaire(
          {
            genre: 'tantQue',
            id,
            condition: e(i.condition),
            corps: i.corps.map(bloc),
            ...(i.fermeture?.commentaire !== undefined ? { commentaireFin: i.fermeture.commentaire } : {}),
          },
          i.commentaire,
        )
      case 'Repeter':
        return avecCommentaire(
          {
            genre: 'repeter',
            id,
            corps: i.corps.map(bloc),
            condition: i.condition ? e(i.condition) : '',
            ...(i.fermeture?.commentaire !== undefined ? { commentaireFin: i.fermeture.commentaire } : {}),
          },
          i.commentaire,
        )
      case 'AppelProcedure':
        return avecCommentaire({ genre: 'appel', id, appel: e(i.appel) }, i.commentaire)
      case 'Retourner':
        return avecCommentaire({ genre: 'retourner', id, valeur: i.valeur ? e(i.valeur) : '' }, i.commentaire)
      case 'Pause':
        return avecCommentaire({ genre: 'pause', id }, i.commentaire)
      case 'Commentaire':
        return { genre: 'commentaire', id, texte: i.texte }
      case 'LigneVide':
        return { genre: 'vide', id }
      case 'LigneInvalide':
        // Le mode blocs n'est accessible qu'à un texte sans erreur de syntaxe.
        return { genre: 'commentaire', id, texte: ` ${i.texte}` }
    }
  }

  const ligneVariables = (l: LigneDeclarations): LigneVariables => {
    const id = nouvelId()
    if (l.genre === 'Declaration') {
      return avecCommentaire({ genre: 'declaration', id, noms: l.noms.map((n) => n.nom).join(', '), type: formaterType(l.type) }, l.commentaire)
    }
    if (l.genre === 'Commentaire') return { genre: 'commentaire', id, texte: l.texte }
    return { genre: 'vide', id }
  }

  const corps = (c: Corps): CorpsBlocs => {
    const commentaires: CorpsBlocs['commentaires'] = {}
    if (c.variables?.commentaire !== undefined) commentaires.variables = c.variables.commentaire
    if (c.debut?.commentaire !== undefined) commentaires.debut = c.debut.commentaire
    if (c.fin?.commentaire !== undefined) commentaires.fin = c.fin.commentaire
    return {
      id: nouvelId(),
      variables: c.variables ? c.variables.lignes.map(ligneVariables) : null,
      instructions: c.instructions.map(bloc),
      commentaires,
    }
  }

  const sousProgramme = (sp: SousProgrammeAst): SousProgrammeBlocs =>
    avecCommentaire(
      {
        genre: 'sousProgramme' as const,
        id: nouvelId(),
        type: sp.genre === 'Fonction' ? ('fonction' as const) : ('procedure' as const),
        nom: sp.nom,
        parametres: sp.parametres.map((p) => `${p.nom} : ${formaterType(p.type)}`).join(', '),
        typeRetour: sp.typeRetour ? formaterType(sp.typeRetour) : '',
        preambule: sp.corps.preambule.map((l) => (l.genre === 'Commentaire' ? { genre: 'commentaire' as const, id: nouvelId(), texte: l.texte } : { genre: 'vide' as const, id: nouvelId() })),
        corps: corps(sp.corps),
      },
      sp.commentaire,
    )

  const modele: ModeleBlocs = {
    entete: null,
    avant: [],
    principal: { id: nouvelId(), variables: null, instructions: [], commentaires: {} },
    apres: [],
  }
  let principalVu = false
  for (const el of programme.elements) {
    const cible = principalVu ? modele.apres : modele.avant
    switch (el.genre) {
      case 'EnTete':
        modele.entete = avecCommentaire({ nom: el.nom }, el.commentaire)
        break
      case 'Principal':
        modele.principal = corps(el.corps)
        principalVu = true
        break
      case 'Fonction':
      case 'Procedure':
        cible.push(sousProgramme(el))
        break
      case 'Commentaire':
        cible.push({ genre: 'commentaire', id: nouvelId(), texte: el.texte })
        break
      default:
        cible.push({ genre: 'vide', id: nouvelId() })
    }
  }
  return modele
}

// ---------------------------------------------------------------- Modèle → texte

export interface TexteProduit {
  texte: string
  /** Ligne (à partir de 1) de chaque bloc, ligne de déclaration ou en-tête de sous-programme. */
  lignes: Map<string, number>
}

export function versTexte(modele: ModeleBlocs): TexteProduit {
  const sortie: string[] = []
  const lignes = new Map<string, number>()
  const ligne = (niveau: number, texte: string, commentaire?: string, id?: string) => {
    if (id) lignes.set(id, sortie.length + 1)
    const suffixe = commentaire === undefined ? '' : `${texte === '' ? '' : ' '}//${commentaire}`
    sortie.push(texte === '' && commentaire === undefined ? '' : '  '.repeat(niveau) + texte + suffixe)
  }

  const bloc = (n: number, b: Bloc) => {
    switch (b.genre) {
      case 'affectation':
        ligne(n, `${b.cible} ← ${b.valeur}`, b.commentaire, b.id)
        return
      case 'lire':
        ligne(n, `Lire ${b.cibles}`, b.commentaire, b.id)
        return
      case 'afficher':
        ligne(n, ['Afficher', b.valeurs.trim(), b.retour ? '↵' : ''].filter((x) => x !== '').join(' '), b.commentaire, b.id)
        return
      case 'si':
        b.branches.forEach((br, k) => {
          ligne(n, `${k === 0 ? 'Si' : 'Sinon si'} ${br.condition} alors`, br.commentaire, k === 0 ? b.id : br.id)
          for (const x of br.corps) bloc(n + 1, x)
        })
        if (b.sinon) {
          ligne(n, 'Sinon', b.sinon.commentaire, b.sinon.id)
          for (const x of b.sinon.corps) bloc(n + 1, x)
        }
        ligne(n, 'FinSi', b.commentaireFin)
        return
      case 'pour':
        ligne(n, `Pour ${b.compteur} de ${b.debut} à ${b.fin}${b.pas.trim() !== '' ? ` pas de ${b.pas}` : ''} faire`, b.commentaire, b.id)
        for (const x of b.corps) bloc(n + 1, x)
        ligne(n, 'FinPour', b.commentaireFin)
        return
      case 'pourChaque':
        ligne(n, `Pour chaque ${b.variable} dans ${b.collection} faire`, b.commentaire, b.id)
        for (const x of b.corps) bloc(n + 1, x)
        ligne(n, 'FinPour', b.commentaireFin)
        return
      case 'tantQue':
        ligne(n, `TantQue ${b.condition} faire`, b.commentaire, b.id)
        for (const x of b.corps) bloc(n + 1, x)
        ligne(n, 'FinTantQue', b.commentaireFin)
        return
      case 'repeter':
        ligne(n, 'Répéter', b.commentaire, b.id)
        for (const x of b.corps) bloc(n + 1, x)
        ligne(n, `Jusqu'à ${b.condition}`.trimEnd(), b.commentaireFin, `${b.id}:fin`)
        return
      case 'appel':
        ligne(n, b.appel, b.commentaire, b.id)
        return
      case 'retourner':
        ligne(n, b.valeur.trim() === '' ? 'Retourner' : `Retourner ${b.valeur}`, b.commentaire, b.id)
        return
      case 'pause':
        ligne(n, 'Pause', b.commentaire, b.id)
        return
      case 'commentaire':
        ligne(n, '', b.texte, b.id)
        return
      case 'vide':
        ligne(n, '', undefined, b.id)
        return
    }
  }

  const variables = (l: LigneVariables) => {
    if (l.genre === 'declaration') ligne(1, `${l.noms} : ${l.type}`, l.commentaire, l.id)
    else if (l.genre === 'commentaire') ligne(1, '', l.texte, l.id)
    else ligne(1, '', undefined, l.id)
  }

  const corps = (c: CorpsBlocs, fermeture: string) => {
    if (c.variables) {
      ligne(0, 'Variables', c.commentaires.variables, `${c.id}:variables`)
      for (const l of c.variables) variables(l)
    }
    ligne(0, 'Début', c.commentaires.debut, `${c.id}:debut`)
    for (const b of c.instructions) bloc(1, b)
    ligne(0, fermeture, c.commentaires.fin, `${c.id}:fin`)
  }

  const haut = (e: ElementHaut) => {
    if (e.genre === 'commentaire') ligne(0, '', e.texte, e.id)
    else if (e.genre === 'vide') ligne(0, '', undefined, e.id)
    else {
      for (const l of e.preambule) ligne(0, '', l.genre === 'commentaire' ? l.texte : undefined, l.id)
      const motCle = e.type === 'fonction' ? 'Fonction' : 'Procédure'
      const retour = e.type === 'fonction' && e.typeRetour.trim() !== '' ? ` : ${e.typeRetour}` : ''
      ligne(0, `${motCle} ${e.nom}(${e.parametres})${retour}`, e.commentaire, e.id)
      corps(e.corps, e.type === 'fonction' ? 'FinFonction' : 'FinProcédure')
    }
  }

  if (modele.entete) ligne(0, `Algorithme ${modele.entete.nom}`, modele.entete.commentaire, 'entete')
  for (const e of modele.avant) haut(e)
  corps(modele.principal, 'Fin')
  for (const e of modele.apres) haut(e)
  return { texte: sortie.join('\n') + '\n', lignes }
}
