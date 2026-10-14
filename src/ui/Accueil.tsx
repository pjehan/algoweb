import { libelleVersion } from '../version.ts'
import { Demonstration } from './Demonstration.tsx'

const exemple = `Algorithme Somme des pairs

Variables
  n, i, s : entier
Début
  Lire n
  s ← 0
  Pour i de 1 à n faire
    Si i mod 2 = 0 alors
      s ← s + i
    FinSi
  FinPour
  Afficher s ↵
Fin`

export function Accueil() {
  return (
    <main className="accueil">
      <h1>AlgoWeb</h1>
      <p className="accroche">
        Écrire des algorithmes en pseudo-code français, les exécuter pas à pas et les
        exporter en Python. Tout se passe dans le navigateur.
      </p>
      <pre aria-label="Exemple d’algorithme">
        <code>{exemple}</code>
      </pre>
      <Demonstration source={exemple} />
      <p>Application en cours de développement.</p>
      <footer>
        {libelleVersion()} · logiciel libre sous licence GPL-3.0
      </footer>
    </main>
  )
}
