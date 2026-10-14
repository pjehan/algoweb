import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * Boîte de dialogue modale, avec l'élément <dialog> natif : le focus y reste
 * enfermé et Échap la ferme.
 */
export function Dialogue({
  ouvert,
  titre,
  fermer,
  children,
  actions,
}: {
  ouvert: boolean
  titre: string
  fermer: () => void
  children: ReactNode
  actions?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (ouvert && !d.open) d.showModal()
    if (!ouvert && d.open) d.close()
  }, [ouvert])

  return (
    <dialog
      ref={ref}
      className="dialogue"
      aria-labelledby={id}
      onCancel={(e) => {
        // Échap : la fermeture passe par l'état de l'application.
        e.preventDefault()
        fermer()
      }}
    >
      <h2 id={id}>{titre}</h2>
      <div className="dialogue-contenu">{children}</div>
      <div className="dialogue-actions">
        {actions}
        <button type="button" onClick={fermer}>
          Fermer
        </button>
      </div>
    </dialog>
  )
}
