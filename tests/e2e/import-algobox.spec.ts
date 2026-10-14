import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { ouvrir } from './outils.ts'

test('importe un fichier AlgoBox et présente le rapport d’import', async ({ page }) => {
  await ouvrir(page)
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'fonctions.alg', mimeType: 'application/xml', buffer: readFileSync('tests/algobox/fonctions.alg') })

  const rapport = page.getByRole('dialog', { name: 'Rapport d’import : fonctions' })
  await expect(rapport).toBeVisible()
  await expect(rapport).toContainText('38 lignes AlgoBox converties.')
  await expect(rapport.getByRole('row', { name: /^T liste de réels reçoit une liste/ })).toBeVisible()
  await expect(rapport).toContainText('L’extension JavaScript (outils.js) n’est pas reprise.')
  const axe = await new AxeBuilder({ page }).include('.dialogue[open]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations.map((v) => v.id)).toEqual([])

  // Un numéro de ligne ferme le rapport et place le curseur sur la ligne.
  await rapport.getByRole('button', { name: 'Aller à la ligne 56' }).click()
  await expect(rapport).toBeHidden()
  await expect(page.locator('.cm-activeLine')).toHaveText('  Afficher total ↵')
  await expect(page.locator('.diagnostics')).toContainText('La variable total de l’algorithme principal n’est pas accessible')

  // Le rapport reste disponible dans la palette de commandes.
  await page.keyboard.press('ControlOrMeta+k')
  await page.keyboard.type('rapport')
  await page.keyboard.press('Enter')
  await expect(rapport).toBeVisible()
})

test('signale un fichier .alg illisible', async ({ page }) => {
  await ouvrir(page)
  await page.locator('input[type=file]').setInputFiles({ name: 'casse.alg', mimeType: 'application/xml', buffer: Buffer.from('<Algo><item>') })
  const dialogue = page.getByRole('dialog', { name: 'Fichiers non importés' })
  await expect(dialogue).toContainText('casse.alg : Le fichier n’est pas un fichier AlgoBox valide')
})
