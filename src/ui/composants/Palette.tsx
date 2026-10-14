import { useMemo } from 'react'
import { blocsActif } from '../blocs/contexte.ts'
import { editeurActif } from '../editeur/actif.ts'
import { insererModele } from '../editeur/extensions.ts'
import { CATEGORIES, modeles, texteSimple } from '../editeur/modeles.ts'
import { useEtat } from '../etat.ts'

/**
 * Palette d'instructions par catégories (PLAN.md, section 8) : un clic insère
 * l'instruction au curseur ; on peut aussi la faire glisser dans l'éditeur.
 */
export function Palette() {
  const notation = useEtat((e) => e.preferences.notation)
  const liste = useMemo(() => modeles(notation), [notation])

  return (
    <section className="palette" aria-labelledby="titre-palette">
      <h2 id="titre-palette">Palette</h2>
      {CATEGORIES.map((categorie) => (
        <details key={categorie}>
          <summary>{categorie}</summary>
          <ul>
            {liste
              .filter((m) => m.categorie === categorie)
              .map((m) => (
                <li key={m.libelle}>
                  <button
                    type="button"
                    draggable
                    title={m.description}
                    aria-description={m.description}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', texteSimple(m.modele) + (m.bloc ? '\n' : ''))}
                    onClick={() => {
                      if (useEtat.getState().modeEdition === 'blocs') blocsActif.inserer?.(m)
                      else if (editeurActif.vue) insererModele(editeurActif.vue, m)
                    }}
                  >
                    {m.libelle}
                  </button>
                </li>
              ))}
          </ul>
        </details>
      ))}
    </section>
  )
}
