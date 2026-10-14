import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Politique de sécurité du contenu (PLAN.md, section 9.5). Elle n'est ajoutée
// qu'à la construction, car le serveur de développement injecte un script en ligne.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

function politiqueSecurite(): Plugin {
  return {
    name: 'algoweb-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend',
      },
    ],
  }
}

// L'application est servie à https://<compte>.github.io/algoweb/
export default defineConfig({
  base: '/algoweb/',
  plugins: [react(), politiqueSecurite()],
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
