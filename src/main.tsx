import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StockageMemoire, type Stockage } from './stockage/bibliotheque.ts'
import { App } from './ui/App.tsx'
import { useEtat } from './ui/etat.ts'
import './ui/style.css'

/** localStorage, ou un stockage en mémoire si le navigateur le refuse (navigation privée stricte). */
function ouvrirStockage(): { stockage: Stockage; persistant: boolean } {
  try {
    const cle = 'algoweb:v1:test'
    localStorage.setItem(cle, '1')
    localStorage.removeItem(cle)
    return { stockage: localStorage, persistant: true }
  } catch {
    return { stockage: new StockageMemoire(), persistant: false }
  }
}

const { stockage, persistant } = ouvrirStockage()
useEtat.getState().initialiser(stockage)
// Demande au navigateur de ne pas effacer le stockage en cas de manque de place.
void navigator.storage?.persist?.().catch(() => undefined)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App stockagePersistant={persistant} />
  </StrictMode>,
)
