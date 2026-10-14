import { useEffect, useState } from 'react'
import type { RapportImport } from '../../import-algobox/index.ts'
import { lireFichier } from '../../stockage/archive.ts'
import { nomUnique, renommerCode, type DocumentAlgo } from '../../stockage/document.ts'
import { useEtat } from '../etat.ts'
import { octetsDe } from '../telechargement.ts'
import { Dialogue } from './Dialogue.tsx'

type Decision = 'renommer' | 'remplacer' | 'ignorer'

interface Conflit {
  document: DocumentAlgo
  existant: string
  rapport?: RapportImport
}

/**
 * Import de fichiers .json, .zip et .alg (PLAN.md, section 7.3). En cas de nom
 * déjà pris, l'étudiant choisit de renommer, remplacer ou ignorer, avec
 * l'option « appliquer à tous ». Le rapport d'import du dernier fichier
 * AlgoBox ouvert s'affiche à la fin.
 */
export function Importation() {
  const aImporter = useEtat((e) => e.aImporter)
  const [conflits, setConflits] = useState<Conflit[]>([])
  const [erreurs, setErreurs] = useState<{ nom: string; message: string }[]>([])
  const [bilan, setBilan] = useState({ importes: 0, remplaces: 0, ignores: 0 })
  const [pourTous, setPourTous] = useState(false)
  /** Algorithme ouvert en dernier, s'il vient d'un fichier AlgoBox. */
  const [dernierAlg, setDernierAlg] = useState<string | null>(null)

  const terminer = (b: typeof bilan, erreursLues: typeof erreurs, rapport: string | null) => {
    if (rapport) useEtat.getState().afficherRapport(rapport)
    const morceaux = [
      b.importes > 0 && `${b.importes} algorithme${b.importes > 1 ? 's' : ''} importé${b.importes > 1 ? 's' : ''}`,
      b.remplaces > 0 && `${b.remplaces} remplacé${b.remplaces > 1 ? 's' : ''}`,
      b.ignores > 0 && `${b.ignores} ignoré${b.ignores > 1 ? 's' : ''}`,
      erreursLues.length > 0 && `${erreursLues.length} fichier${erreursLues.length > 1 ? 's' : ''} illisible${erreursLues.length > 1 ? 's' : ''}`,
    ].filter(Boolean)
    useEtat.getState().annoncer(morceaux.length > 0 ? `Import : ${morceaux.join(', ')}.` : 'Aucun algorithme importé.')
  }

  /** Applique une décision au premier conflit, et éventuellement aux suivants. */
  const decider = (decision: Decision, liste = conflits, b = bilan) => {
    const etat = useEtat.getState()
    const [premier, ...reste] = liste
    if (!premier) return
    const traites = pourTous ? liste : [premier]
    const nouveauBilan = { ...b }
    let dernierId: string | undefined
    let rapport = dernierAlg
    for (const c of traites) {
      if (decision === 'ignorer') {
        nouveauBilan.ignores++
        continue
      } else if (decision === 'remplacer') {
        etat.remplacerDocument(c.existant, c.document)
        nouveauBilan.remplaces++
        dernierId = c.existant
      } else {
        const pris = new Set(useEtat.getState().index.filter((m) => !m.supprimeLe).map((m) => m.nom.toLowerCase()))
        const nom = nomUnique(c.document.nom, pris)
        dernierId = etat.creerDocument({ ...c.document, nom, code: renommerCode(c.document.code, nom) })?.id
        nouveauBilan.importes++
      }
      if (dernierId && c.rapport) etat.ajouterRapport(dernierId, c.rapport)
      rapport = dernierId && c.rapport ? dernierId : null
    }
    const suivants = pourTous ? [] : reste
    setConflits(suivants)
    setBilan(nouveauBilan)
    setDernierAlg(rapport)
    if (dernierId) etat.ouvrir(dernierId)
    if (suivants.length === 0) terminer(nouveauBilan, erreurs, rapport)
  }

  useEffect(() => {
    if (aImporter.length === 0) return
    useEtat.getState().demanderImport([])
    void (async () => {
      const lus = (await Promise.all(aImporter.map(async (f) => lireFichier(f.name, await octetsDe(f))))).flat()
      const etat = useEtat.getState()
      const erreursLues = lus.flatMap((f) => ('erreur' in f.resultat ? [{ nom: f.nom, message: f.resultat.erreur }] : []))
      const nouveaux: Conflit[] = []
      const b = { importes: 0, remplaces: 0, ignores: 0 }
      let dernierId: string | undefined
      let rapport: string | null = null
      for (const f of lus) {
        if (!('document' in f.resultat)) continue
        const { document: doc, rapport: rapportLu } = f.resultat
        const existant = etat.index.find((m) => !m.supprimeLe && m.nom.toLowerCase() === doc.nom.toLowerCase())
        if (existant) {
          nouveaux.push({ document: doc, existant: existant.id, rapport: rapportLu })
        } else {
          const id = etat.creerDocument(doc)?.id
          if (!id) continue
          dernierId = id
          if (rapportLu) etat.ajouterRapport(id, rapportLu)
          rapport = rapportLu ? id : null
          b.importes++
        }
      }
      if (dernierId) etat.ouvrir(dernierId)
      setErreurs(erreursLues)
      setBilan(b)
      setPourTous(false)
      setDernierAlg(rapport)
      setConflits(nouveaux)
      if (nouveaux.length === 0) terminer(b, erreursLues, rapport)
    })()
  }, [aImporter])

  const conflit = conflits[0]
  return (
    <>
      <Dialogue
        ouvert={conflit !== undefined}
        titre="Nom déjà utilisé"
        fermer={() => conflit && decider('ignorer')}
        actions={
          <>
            <button type="button" onClick={() => decider('renommer')}>
              Renommer
            </button>
            <button type="button" onClick={() => decider('remplacer')}>
              Remplacer
            </button>
            <button type="button" onClick={() => decider('ignorer')}>
              Ignorer
            </button>
          </>
        }
      >
        {conflit && (
          <>
            <p>
              Un algorithme nommé « {conflit.document.nom} » existe déjà. Que faire de celui qui est importé ?
            </p>
            <ul>
              <li>Renommer : l’importer sous un nouveau nom ;</li>
              <li>Remplacer : écraser l’algorithme existant ;</li>
              <li>Ignorer : ne pas l’importer.</li>
            </ul>
            {conflits.length > 1 && (
              <label>
                <input type="checkbox" checked={pourTous} onChange={(e) => setPourTous(e.target.checked)} /> Appliquer aux{' '}
                {conflits.length} conflits
              </label>
            )}
          </>
        )}
      </Dialogue>
      <Dialogue ouvert={conflit === undefined && erreurs.length > 0} titre="Fichiers non importés" fermer={() => setErreurs([])}>
        <ul>
          {erreurs.map((e) => (
            <li key={e.nom}>
              <strong>{e.nom}</strong> : {e.message}
            </li>
          ))}
        </ul>
      </Dialogue>
    </>
  )
}
