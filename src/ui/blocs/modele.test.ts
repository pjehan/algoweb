import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyser } from '../../langage/analyse.ts'
import { formater } from '../../langage/formateur.ts'
import { versModele, versTexte } from './modele.ts'

const DOSSIER = join(import.meta.dirname, '../../../tests/programmes')
const CORPUS = readdirSync(DOSSIER).filter((f) => f.endsWith('.algo'))

describe('modèle des blocs', () => {
  it.each(CORPUS)('le passage texte → blocs → texte est sans perte : %s', (fichier) => {
    const source = readFileSync(join(DOSSIER, fichier), 'utf8')
    expect(versTexte(versModele(analyser(source).programme, 'python')).texte).toBe(source)
    const francais = formater(analyser(source).programme, { notation: 'francais' })
    expect(versTexte(versModele(analyser(francais).programme, 'francais')).texte).toBe(francais)
  })

  it('conserve tous les commentaires et les lignes vides', () => {
    const source = [
      'Algorithme Test // en-tête',
      '',
      '// avant',
      'Procédure p(a : entier) // procédure',
      'Variables // variables',
      '  // locales',
      '  i : entier // compteur',
      'Début // début',
      '  Pour i de 1 à a faire // pour',
      '  FinPour // fin pour',
      'FinProcédure // fin',
      '',
      'Début',
      '  Si vrai alors // si',
      '  Sinon si faux alors // sinon si',
      '  Sinon // sinon',
      '    Répéter // répéter',
      '      Pause // pause',
      "    Jusqu'à vrai // jusqu'à",
      '  FinSi // fin si',
      '',
      '  p(1) // appel',
      'Fin // fin',
      '// après',
      '',
    ].join('\n')
    expect(analyser(source).diagnostics).toEqual([])
    expect(versTexte(versModele(analyser(source).programme, 'python')).texte).toBe(source)
  })

  it('indique la ligne de chaque bloc', () => {
    const source = 'Variables\n  n : entier\nDébut\n  n ← 1\n  Si n = 1 alors\n    Afficher n ↵\n  FinSi\nFin\n'
    const modele = versModele(analyser(source).programme, 'python')
    const { lignes } = versTexte(modele)
    const [affectation, si] = modele.principal.instructions
    expect(lignes.get(modele.principal.variables![0].id)).toBe(2)
    expect(lignes.get(affectation.id)).toBe(4)
    expect(lignes.get(si.id)).toBe(5)
    expect(si.genre === 'si' && lignes.get(si.branches[0].corps[0].id)).toBe(6)
  })
})
