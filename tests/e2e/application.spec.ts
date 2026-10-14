import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'
import { attendreEnregistrement, ecrire, ouvrir, PROGRAMME, texteEditeur } from './outils.ts'

test.beforeEach(async ({ page }) => {
  await ouvrir(page)
})

test('écrire un algorithme, l’exécuter avec une saisie redemandée', async ({ page }) => {
  await ecrire(page, PROGRAMME)
  await page.getByRole('button', { name: /Exécuter/ }).click()
  // Formes canoniques (la dernière ligne aussi, quand l'éditeur perd le focus), indentation automatique et équivalents ASCII.
  await expect.poll(() => texteEditeur(page)).toBe(
    'Algorithme Double\nVariables\n  n : entier\nDébut\n  Lire n\n  Afficher "Double :", n * 2 ↵\nFin',
  )
  await expect(page.getByRole('button', { name: /Aucune erreur/ })).toBeVisible()

  const champ = page.getByLabel('Valeur de n (entier)')
  await champ.fill('douze')
  await champ.press('Enter')
  await expect(page.getByRole('alert').filter({ hasText: 'Un entier est attendu' })).toBeVisible()
  await page.getByLabel('Valeur de n (entier)').fill('21')
  await page.getByLabel('Valeur de n (entier)').press('Enter')
  await expect(page.getByRole('log')).toContainText('Double : 42')
  await expect(page.getByRole('log')).toContainText('Exécution terminée')
})

test('signale les erreurs et mène à la ligne concernée', async ({ page }) => {
  await ecrire(page, ['Début', 'x <- 1', 'Fin'])
  const resume = page.getByRole('button', { name: '1 erreur' })
  await expect(resume).toBeVisible()
  await page.getByRole('button', { name: /ligne 2 : La variable x n’est pas déclarée/ }).click()
  await expect(page.locator('.cm-activeLine')).toHaveText('  x ← 1')
  await page.getByRole('button', { name: /Exécuter/ }).click()
  await expect(page.getByRole('log')).toContainText('corrigez-les avant de l’exécuter')
})

test('arrête une boucle infinie', async ({ page }) => {
  await ecrire(page, ['Variables', 'i : entier', 'Début', 'i ← 0', 'TantQue vrai faire', 'i ← i + 1', 'FinTantQue', 'Fin'])
  await page.getByRole('button', { name: /Exécuter/ }).click()
  await expect(page.getByRole('button', { name: /Arrêter/ })).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('log')).toContainText('Exécution arrêtée')
})

test('enregistre automatiquement et retrouve l’algorithme après rechargement', async ({ page }) => {
  await ecrire(page, PROGRAMME)
  await attendreEnregistrement(page)
  await expect(page.getByRole('button', { name: /^Double/ })).toBeVisible()
  await page.reload()
  await expect.poll(() => texteEditeur(page)).toContain('Afficher "Double :", n * 2 ↵')
  await expect(page.getByLabel('Nom de l’algorithme')).toHaveValue('Double')
})

test('renomme, met à la corbeille et restaure', async ({ page }) => {
  await page.getByLabel('Nom de l’algorithme').fill('Mon algo')
  await page.getByLabel('Nom de l’algorithme').press('Enter')
  await expect.poll(() => texteEditeur(page)).toMatch(/^Algorithme Mon algo/)
  await page.getByRole('button', { name: 'Nouveau' }).click()
  await page.getByLabel('Actions pour Mon algo').first().click()
  await page.getByRole('button', { name: 'Mettre à la corbeille' }).click()
  await page.getByRole('button', { name: 'Corbeille (1)' }).click()
  await page.getByLabel('Actions pour Mon algo').first().click()
  await page.getByRole('button', { name: 'Restaurer' }).click()
  await page.getByRole('button', { name: /Retour à mes algorithmes/ }).click()
  await expect(page.getByRole('button', { name: /^Mon algo/ })).toBeVisible()
})

test('télécharge en JSON, en Python et en ZIP, puis réimporte', async ({ page }) => {
  await ecrire(page, PROGRAMME)
  await attendreEnregistrement(page)

  await page.getByText('Exporter', { exact: true }).click()
  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Algorithme AlgoWeb (.json)' }).click()])
  expect(json.suggestedFilename()).toBe('Double.json')
  const cheminJson = await json.path()
  expect(JSON.parse(readFileSync(cheminJson, 'utf8')).format).toBe('algoweb')

  await page.getByText('Exporter', { exact: true }).click()
  const [python] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Programme Python (.py)' }).click()])
  expect(readFileSync(await python.path(), 'utf8')).toContain('n = int(input("n = "))')

  const [zip] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tout télécharger' }).click()])
  expect(zip.suggestedFilename()).toMatch(/^algoweb-\d{4}-\d{2}-\d{2}\.zip$/)
  const cheminZip = await zip.path()
  expect(Object.keys(unzipSync(readFileSync(cheminZip))).sort()).toEqual(['Double.json', 'Double.py'])

  // Réimport du JSON : le nom est déjà pris, on choisit de renommer.
  // Playwright range les téléchargements sous un nom sans extension : on rétablit le nom proposé.
  await page.locator('input[type=file]').setInputFiles({ name: json.suggestedFilename(), mimeType: 'application/json', buffer: readFileSync(cheminJson) })
  await page.getByRole('button', { name: 'Renommer' }).click()
  await expect(page.getByRole('button', { name: /^Double \(2\)/ })).toBeVisible()

  // Réimport de l'archive : les deux noms sont pris, on ignore pour tous.
  await page.locator('input[type=file]').setInputFiles({ name: 'sauvegarde.zip', mimeType: 'application/zip', buffer: readFileSync(cheminZip) })
  await page.getByRole('button', { name: 'Ignorer' }).click()
  await expect(page.locator('.liste-algos li')).toHaveCount(2)
})

test('explique pourquoi un fichier ne peut pas être importé', async ({ page }) => {
  await page.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('bonjour') })
  await expect(page.getByRole('dialog', { name: 'Fichiers non importés' })).toContainText('Type de fichier non reconnu')
})

test('affiche les fonctions dans la notation choisie, sans changer le fichier', async ({ page }) => {
  await ecrire(page, ['Début', 'Afficher sqrt(4) \\n', 'Fin'])
  await attendreEnregistrement(page)
  await page.getByRole('button', { name: 'Préférences' }).click()
  await page.getByLabel(/Français : racine/).check()
  await page.getByRole('button', { name: 'Fermer' }).click()
  await expect.poll(() => texteEditeur(page)).toContain('Afficher racine(4) ↵')
  const code = await page.evaluate(() => {
    const index = JSON.parse(localStorage.getItem('algoweb:v1:index')!)
    return JSON.parse(localStorage.getItem(`algoweb:v1:doc:${index[0].id}`)!).code as string
  })
  expect(code).toContain('Afficher sqrt(4) ↵')
})

test('accessibilité : aucune violation détectée par axe, en thème clair et sombre', async ({ page }) => {
  await ecrire(page, PROGRAMME)
  for (const theme of ['clair', 'sombre']) {
    await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme)
    const resultat = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(resultat.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), theme).toEqual([])
  }
})

test('sur tablette, les panneaux deviennent des onglets', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 })
  await expect(page.getByRole('tab', { name: 'Éditeur' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Console' })).toBeHidden()
  await page.getByRole('tab', { name: 'Console' }).click()
  await expect(page.getByRole('heading', { name: 'Console' })).toBeVisible()
})

test('la sélection reste visible sur la ligne du curseur', async ({ page }) => {
  // La sélection est dessinée sous le texte : le fond de la ligne active doit la laisser voir.
  await ecrire(page, PROGRAMME)
  await page.keyboard.press('Shift+ArrowUp')
  for (const theme of ['clair', 'sombre']) {
    await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme)
    const fond = await page.locator('.cm-activeLine').evaluate((e) => getComputedStyle(e).backgroundColor)
    const alpha = /rgba?\([^)]*,\s*([\d.]+)\)/.exec(fond)?.[1]
    expect(Number(alpha ?? 1), `${theme} : ${fond}`).toBeLessThan(0.2)
  }
})

test('les menus se referment par un clic en dehors, par Échap, ou en ouvrant un autre menu', async ({ page }) => {
  const actions = page.locator('details.menu-actions').first()
  const exporter = page.locator('details.menu')
  await actions.locator('summary').click()
  await expect(actions).toHaveAttribute('open', '')
  await page.locator('.cm-content').click()
  await expect(actions).not.toHaveAttribute('open')

  await actions.locator('summary').click()
  await exporter.locator('summary').click()
  await expect(actions).not.toHaveAttribute('open')
  await expect(exporter).toHaveAttribute('open', '')

  await page.getByRole('button', { name: 'Programme Python (.py)' }).focus()
  await page.keyboard.press('Escape')
  await expect(exporter).not.toHaveAttribute('open')
  await expect(exporter.locator('summary')).toBeFocused()
})
