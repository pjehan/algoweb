import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/style.css'
import { Accueil } from './ui/Accueil.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Accueil />
  </StrictMode>,
)
