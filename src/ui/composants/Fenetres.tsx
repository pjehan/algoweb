import { useState } from 'react'
import { libelleVersion } from '../../version.ts'
import { useEtat } from '../etat.ts'
import { TAILLES_TEXTE } from '../preferences.ts'
import type { Fenetre } from './BarreSuperieure.tsx'
import { Dialogue } from './Dialogue.tsx'

export function Preferences({ ouvert, fermer }: { ouvert: boolean; fermer: () => void }) {
  const p = useEtat((e) => e.preferences)
  const definir = useEtat((e) => e.definirPreferences)
  return (
    <Dialogue ouvert={ouvert} titre="Préférences" fermer={fermer}>
      <fieldset>
        <legend>Thème</legend>
        {(
          [
            ['systeme', 'Réglage du système'],
            ['clair', 'Clair'],
            ['sombre', 'Sombre'],
          ] as const
        ).map(([valeur, libelle]) => (
          <label key={valeur}>
            <input type="radio" name="theme" checked={p.theme === valeur} onChange={() => definir({ theme: valeur })} /> {libelle}
          </label>
        ))}
      </fieldset>
      <label className="champ">
        Taille du texte
        <select value={p.tailleTexte} onChange={(e) => definir({ tailleTexte: Number(e.target.value) })}>
          {TAILLES_TEXTE.map((t) => (
            <option key={t} value={t}>
              {t} pixels
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Noms des fonctions prédéfinies</legend>
        <label>
          <input type="radio" name="notation" checked={p.notation === 'python'} onChange={() => definir({ notation: 'python' })} /> Python : sqrt, len,
          randint…
        </label>
        <label>
          <input type="radio" name="notation" checked={p.notation === 'francais'} onChange={() => definir({ notation: 'francais' })} /> Français : racine,
          longueur, aléaEntier…
        </label>
        <p className="aide">Les deux notations sont toujours acceptées à la saisie. Les fichiers enregistrés utilisent les noms Python.</p>
      </fieldset>
      <fieldset>
        <legend>Mode d’édition</legend>
        <label>
          <input type="radio" name="mode" checked readOnly /> Texte
        </label>
        <label>
          <input type="radio" name="mode" disabled /> Blocs (bientôt disponible)
        </label>
      </fieldset>
    </Dialogue>
  )
}

export function Proprietes({ ouvert, fermer }: { ouvert: boolean; fermer: () => void }) {
  const doc = useEtat((e) => e.document)
  // Le formulaire est recréé à chaque ouverture, avec les valeurs du document.
  return ouvert && doc ? <FormulaireProprietes nomInitial={doc.nom} descriptionInitiale={doc.description} graineInitiale={doc.graine} fermer={fermer} /> : null
}

function FormulaireProprietes({
  nomInitial,
  descriptionInitiale,
  graineInitiale,
  fermer,
}: {
  nomInitial: string
  descriptionInitiale: string
  graineInitiale: string | null
  fermer: () => void
}) {
  const ouvert = true
  const [nom, setNom] = useState(nomInitial)
  const [description, setDescription] = useState(descriptionInitiale)
  const [avecGraine, setAvecGraine] = useState(graineInitiale !== null)
  const [graine, setGraine] = useState(graineInitiale ?? '0')

  const graineValide = /^-?\d{1,30}$/.test(graine.trim())
  return (
    <Dialogue
      ouvert={ouvert}
      titre="Propriétés de l’algorithme"
      fermer={fermer}
      actions={
        <button
          type="button"
          className="principal"
          disabled={nom.trim() === '' || (avecGraine && !graineValide)}
          onClick={() => {
            useEtat.getState().modifierProprietes({ nom, description, graine: avecGraine ? graine.trim() : null })
            fermer()
          }}
        >
          Enregistrer
        </button>
      }
    >
      <label className="champ">
        Nom
        <input value={nom} onChange={(e) => setNom(e.target.value)} />
      </label>
      <label className="champ">
        Description
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <fieldset>
        <legend>Tirages aléatoires</legend>
        <label>
          <input type="checkbox" checked={avecGraine} onChange={(e) => setAvecGraine(e.target.checked)} /> Utiliser une graine : les tirages sont
          identiques à chaque exécution, et dans le programme Python exporté.
        </label>
        {avecGraine && (
          <label className="champ">
            Graine (nombre entier)
            <input inputMode="numeric" value={graine} aria-invalid={!graineValide} onChange={(e) => setGraine(e.target.value)} />
          </label>
        )}
      </fieldset>
    </Dialogue>
  )
}

export function APropos({ ouvert, fermer }: { ouvert: boolean; fermer: () => void }) {
  return (
    <Dialogue ouvert={ouvert} titre="À propos d’AlgoWeb" fermer={fermer}>
      <p>
        <strong>{libelleVersion()}</strong> : apprentissage de l’algorithmique en pseudo-code français, pour les étudiants de BTS SIO.
      </p>
      <p>
        Logiciel libre distribué sous licence GPL-3.0.{' '}
        <a href="https://github.com/pjehan/algoweb" target="_blank" rel="noreferrer">
          Code source sur GitHub
        </a>
        .
      </p>
      <p>AlgoWeb s’inspire d’AlgoBox, de Pascal Brachet, sans en reprendre le code. Éditeur : CodeMirror.</p>
      <p>Vos algorithmes restent dans votre navigateur : aucune donnée n’est envoyée à un serveur.</p>
    </Dialogue>
  )
}

export function Fenetres({ fenetre, fermer }: { fenetre: Fenetre; fermer: () => void }) {
  return (
    <>
      <Preferences ouvert={fenetre === 'preferences'} fermer={fermer} />
      <Proprietes ouvert={fenetre === 'proprietes'} fermer={fermer} />
      <APropos ouvert={fenetre === 'apropos'} fermer={fermer} />
    </>
  )
}
