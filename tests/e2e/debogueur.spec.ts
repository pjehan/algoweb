import { expect, test, type Page } from '@playwright/test'
import { ecrire, ouvrir } from './outils.ts'

const PROGRAMME = [
  'Fonction carre(x : entier) : entier', // 1
  'Variables', // 2
  'r : entier', // 3
  'Début', // 4
  'r ← x * x', // 5
  'Retourner r', // 6
  'FinFonction', // 7
  'Variables', // 8
  'a, b : entier', // 9
  'L : liste d’entiers', // 10
  'Début', // 11
  'a ← 3', // 12
  'L ← [1, 2]', // 13
  'b ← carre(a)', // 14
  'ajouter(L, b)', // 15
  'Afficher b, L ↵', // 16
  'Fin', // 17
]

/** Marge des points d'arrêt de la ligne `n` (le premier élément de la marge est un espaceur caché). */
const marge = (page: Page, n: number) => page.locator('.cm-gutter-arret .cm-gutterElement').nth(n)

const statut = (page: Page) => page.getByRole('toolbar', { name: 'Débogueur' }).getByRole('status')
const variable = (page: Page, nom: string) => page.locator('table.variables tbody tr').filter({ has: page.getByRole('rowheader', { name: new RegExp(`^${nom}`) }) })

test.beforeEach(async ({ page }) => {
  await ouvrir(page)
  await ecrire(page, PROGRAMME)
})

test('pas à pas : entrer dans une fonction, voir les variables et la pile, en sortir', async ({ page }) => {
  await page.getByRole('button', { name: 'Pas à pas' }).click()
  await expect(statut(page)).toHaveText('En pause à la ligne 12 (pas à pas).')
  await expect(page.locator('.cm-ligne-courante')).toHaveText('  a ← 3')
  await expect(variable(page, 'a')).toContainText('sans valeur')

  await page.keyboard.press('F7')
  await expect(statut(page)).toContainText('ligne 13')
  await expect(variable(page, 'a')).toContainText('3')
  await expect(variable(page, 'a')).toHaveClass('modifiee')

  await page.keyboard.press('F7')
  await expect(statut(page)).toContainText('ligne 14')
  await page.keyboard.press('F7')
  await expect(statut(page)).toContainText('ligne 5')
  await expect(page.getByRole('heading', { name: /Variables : carre/ })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Pile d’appels' }).getByRole('button')).toHaveText(['carre ligne 5', 'Algorithme principal ligne 14'])

  // Le cadre de l'algorithme principal montre ses propres variables.
  await page.getByRole('button', { name: 'Algorithme principal ligne 14' }).click()
  await expect(variable(page, 'L')).toContainText('[1, 2]')
  await expect(page.locator('.cm-ligne-appel')).toHaveText('  b ← carre(a)')

  await page.keyboard.press('Shift+F8')
  await expect(statut(page)).toContainText('ligne 15')
  await expect(variable(page, 'b')).toContainText('9')

  await page.keyboard.press('F9')
  await expect(page.getByRole('log')).toContainText('9 [1, 2, 9]')
  await expect(page.getByRole('log')).toContainText('Exécution terminée.')
  await expect(page.getByRole('toolbar', { name: 'Débogueur' })).toBeHidden()
})

test('pas principal : passer par-dessus un appel', async ({ page }) => {
  await page.getByRole('button', { name: 'Pas à pas' }).click()
  await expect(statut(page)).toContainText('ligne 12 ')
  for (const ligne of [13, 14, 15]) {
    await page.keyboard.press('F8')
    await expect(statut(page)).toContainText(`ligne ${ligne} `)
  }
})

test('points d’arrêt : un clic dans la marge, arrêt puis reprise', async ({ page }) => {
  // Point d'arrêt sur la ligne 5, à l'intérieur de la fonction.
  await marge(page, 5).click()
  await expect(page.locator('.point-arret:visible')).toHaveCount(1)
  await page.getByRole('button', { name: /Exécuter/ }).click()
  await expect(statut(page)).toHaveText('En pause à la ligne 5 (point d’arrêt).')
  await expect(variable(page, 'x')).toContainText('3')
  await page.getByRole('button', { name: 'Continuer', exact: true }).first().click()
  await expect(page.getByRole('log')).toContainText('9 [1, 2, 9]')
})

test('le point d’arrêt suit la ligne quand on modifie le texte', async ({ page }) => {
  await marge(page, 14).click()
  // Une ligne ajoutée au début décale le point d'arrêt d'une ligne.
  await page.locator('.cm-line').first().click()
  await page.keyboard.press('Home')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: /Exécuter/ }).click()
  await expect(statut(page)).toHaveText('En pause à la ligne 15 (point d’arrêt).')
  await expect(page.locator('.cm-ligne-courante')).toHaveText('  b ← carre(a)')
})

test('exécution animée, interrompue par un point d’arrêt', async ({ page }) => {
  await marge(page, 16).click()
  await page.getByRole('button', { name: 'Pas à pas' }).click()
  await page.getByLabel('Vitesse').selectOption('rapide')
  await page.getByRole('button', { name: 'Animer' }).click()
  await expect(statut(page)).toHaveText('En pause à la ligne 16 (point d’arrêt).', { timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'Animer' })).toHaveAttribute('aria-pressed', 'false')
})

test('suspendre une boucle infinie montre où elle en est', async ({ page }) => {
  await ecrire(page, ['Variables', 'i : entier', 'Début', 'i ← 0', 'TantQue vrai faire', 'i ← i + 1', 'FinTantQue', 'Fin'])
  await page.getByRole('button', { name: /Exécuter/ }).click()
  await page.getByRole('button', { name: 'Suspendre' }).click()
  await expect(statut(page)).toContainText('(suspendue)')
  await expect(variable(page, 'i')).not.toContainText('sans valeur')
})

test('palette de commandes', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+k')
  const filtre = page.getByRole('combobox', { name: 'Rechercher une commande' })
  await filtre.fill('pas a pas')
  await expect(page.getByRole('dialog').getByRole('option')).toHaveText(['Exécuter pas à pas'])
  await filtre.press('Enter')
  await expect(statut(page)).toContainText('ligne 12')
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('combobox', { name: 'Rechercher une commande' }).fill('arret')
  await page.getByRole('dialog').getByRole('option', { name: /Arrêter l’exécution/ }).click()
  await expect(page.getByRole('log')).toContainText('Exécution arrêtée')
})
