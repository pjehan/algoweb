import { describe, expect, it } from 'vitest'
import { analyser } from '../../langage/analyse.ts'
import { versModele, versTexte, type ModeleBlocs } from './modele.ts'
import {
  ajouterDeclaration,
  ajouterSinon,
  ajouterSinonSi,
  ajouterSousProgramme,
  blocsDepuisTexte,
  commenter,
  decaler,
  deplacer,
  dupliquer,
  inserer,
  modifier,
  sousProgrammeDepuisTexte,
  supprimer,
  supprimerBranche,
} from './operations.ts'

const SOURCE = [
  'Variables',
  '  n : entier',
  'Début',
  '  n ← 1',
  '  Si n > 0 alors',
  '    Afficher "positif" ↵',
  '  FinSi',
  '  Afficher n ↵',
  'Fin',
  '',
].join('\n')

function modele(source = SOURCE): ModeleBlocs {
  return versModele(analyser(source).programme, 'python')
}

const texte = (m: ModeleBlocs) => versTexte(m).texte
const corps = (m: ModeleBlocs) => texte(m).split('\n').slice(3, -2).join('\n')

describe('opérations sur les blocs', () => {
  it('modifie un champ sans toucher au reste', () => {
    const m = modele()
    const [affectation] = m.principal.instructions
    expect(corps(modifier(m, affectation.id, { valeur: '42' }))).toContain('  n ← 42')
    // Un champ incorrect est conservé tel quel.
    expect(corps(modifier(m, affectation.id, { valeur: '2 +' }))).toContain('  n ← 2 +')
  })

  it('insère, supprime et duplique', () => {
    const m = modele()
    const blocs = blocsDepuisTexte('Lire n', 'python')!
    const avecLire = inserer(m, m.principal.id, 0, blocs)
    expect(corps(avecLire).split('\n')[0]).toBe('  Lire n')
    const si = m.principal.instructions[1]
    expect(corps(supprimer(m, si.id))).toBe('  n ← 1\n  Afficher n ↵')
    const { modele: double } = dupliquer(m, si.id)
    expect(corps(double).match(/Si n > 0/g)).toHaveLength(2)
  })

  it('déplace un bloc dans un autre bloc, mais pas dans lui-même', () => {
    const m = modele()
    const [, si, afficher] = m.principal.instructions
    if (si.genre !== 'si') throw new Error()
    const dedans = deplacer(m, afficher.id, si.branches[0].id, 1)
    expect(corps(dedans)).toBe('  n ← 1\n  Si n > 0 alors\n    Afficher "positif" ↵\n    Afficher n ↵\n  FinSi')
    expect(deplacer(m, si.id, si.branches[0].id, 0)).toBe(m)
  })

  it('monte et descend un bloc, en entrant et en sortant des blocs voisins', () => {
    const m = modele()
    const afficher = m.principal.instructions[2]
    const monte = decaler(m, afficher.id, -1)
    expect(corps(monte)).toBe('  n ← 1\n  Si n > 0 alors\n    Afficher "positif" ↵\n    Afficher n ↵\n  FinSi')
    const remonte = decaler(monte, afficher.id, -1)
    expect(corps(remonte)).toBe('  n ← 1\n  Si n > 0 alors\n    Afficher n ↵\n    Afficher "positif" ↵\n  FinSi')
    const sorti = decaler(decaler(remonte, afficher.id, -1), afficher.id, -1)
    expect(corps(sorti)).toBe('  Afficher n ↵\n  n ← 1\n  Si n > 0 alors\n    Afficher "positif" ↵\n  FinSi')
  })

  it('met un bloc en commentaire', () => {
    const m = modele()
    expect(corps(commenter(m, m.principal.instructions[1].id))).toBe('  n ← 1\n  // Si n > 0 alors\n  //   Afficher "positif" ↵\n  // FinSi\n  Afficher n ↵')
  })

  it('ajoute et retire des branches Sinon si et Sinon', () => {
    const m = modele()
    const si = m.principal.instructions[1]
    const { modele: m1, id: brancheId } = ajouterSinonSi(m, si.id)
    const { modele: m2, id: sinonId } = ajouterSinon(m1, si.id)
    expect(corps(m2)).toContain('  Sinon si condition alors\n  Sinon\n  FinSi')
    expect(corps(supprimerBranche(supprimerBranche(m2, brancheId!), sinonId!))).toBe(corps(m))
  })

  it('ajoute une déclaration, et une section Variables si besoin', () => {
    const m = modele('Début\nFin\n')
    expect(texte(ajouterDeclaration(m, m.principal.id, 'total', 'réel').modele)).toBe('Variables\n  total : réel\nDébut\nFin\n')
  })

  it('ajoute un sous-programme avant l’algorithme principal', () => {
    const m = modele('Début\nFin\n')
    const sp = sousProgrammeDepuisTexte('Fonction carre(x : entier) : entier', 'python')!
    expect(texte(ajouterSousProgramme(m, sp))).toBe('Fonction carre(x : entier) : entier\nDébut\nFinFonction\n\nDébut\nFin\n')
  })
})
