import { useContext, useId, useRef, useState, type KeyboardEvent } from 'react'
import { normaliser } from '../../langage/normalisation.ts'
import { NomsDisponibles } from './contexte.ts'

const MOT = /[\p{L}_][\p{L}\p{M}\p{Nd}_]*$/u

/**
 * Champ d'un bloc : sa largeur suit son contenu, et il propose de compléter
 * le mot en cours (flèches pour choisir, Entrée ou Tab pour valider, Échap
 * pour fermer la liste).
 */
export function Champ({
  valeur,
  modifier,
  etiquette,
  exemple,
  erreur,
  sansCompletion,
}: {
  valeur: string
  modifier: (v: string) => void
  etiquette: string
  exemple?: string
  erreur?: boolean
  sansCompletion?: boolean
}) {
  const noms = useContext(NomsDisponibles)
  const [propositions, setPropositions] = useState<string[]>([])
  const [choisie, setChoisie] = useState(0)
  const champ = useRef<HTMLInputElement>(null)
  const id = useId()

  const proposer = (texte: string, curseur: number) => {
    if (sansCompletion) return
    const mot = MOT.exec(texte.slice(0, curseur))?.[0]
    if (!mot) {
      setPropositions([])
      return
    }
    const forme = normaliser(mot)
    setPropositions(noms.filter((n) => normaliser(n).startsWith(forme) && n !== mot).slice(0, 8))
    setChoisie(0)
  }

  const completer = (nom: string) => {
    const c = champ.current!
    const curseur = c.selectionStart ?? valeur.length
    const mot = MOT.exec(valeur.slice(0, curseur))?.[0] ?? ''
    const nouveau = valeur.slice(0, curseur - mot.length) + nom + valeur.slice(curseur)
    modifier(nouveau)
    setPropositions([])
    const position = curseur - mot.length + nom.length
    requestAnimationFrame(() => c.setSelectionRange(position, position))
  }

  const touche = (e: KeyboardEvent<HTMLInputElement>) => {
    if (propositions.length === 0) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      setChoisie((choisie + (e.key === 'ArrowDown' ? 1 : -1) + propositions.length) % propositions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      completer(propositions[choisie])
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setPropositions([])
    }
  }

  const ouvert = propositions.length > 0
  return (
    <span className="champ-bloc">
      <input
        ref={champ}
        value={valeur}
        size={Math.max(valeur.length, exemple?.length ?? 0, 2) + 1}
        placeholder={exemple}
        aria-label={etiquette}
        aria-invalid={erreur || undefined}
        spellCheck={false}
        autoComplete="off"
        role={sansCompletion ? undefined : 'combobox'}
        aria-autocomplete={sansCompletion ? undefined : 'list'}
        aria-expanded={sansCompletion ? undefined : ouvert}
        aria-controls={ouvert ? `${id}-liste` : undefined}
        aria-activedescendant={ouvert ? `${id}-${choisie}` : undefined}
        onChange={(e) => {
          modifier(e.target.value)
          proposer(e.target.value, e.target.selectionStart ?? e.target.value.length)
        }}
        onKeyDown={touche}
        onBlur={() => setPropositions([])}
      />
      {ouvert && (
        <ul id={`${id}-liste`} role="listbox" aria-label={`Propositions pour ${etiquette}`} className="propositions">
          {propositions.map((p, k) => (
            <li
              key={p}
              id={`${id}-${k}`}
              role="option"
              aria-selected={k === choisie}
              onMouseDown={(e) => {
                e.preventDefault()
                completer(p)
              }}
            >
              {p}
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}
