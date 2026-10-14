import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ecrire, ouvrir, texteEditeur } from './outils.ts'

const PROGRAMME = ['Variables', 'n : entier', 'Début', 'n ← 1', 'Si n > 0 alors', 'Afficher "positif" ↵', 'FinSi', 'Afficher n ↵', 'Fin']

async function passerEnBlocs(page: Page) {
  await page.getByRole('radio', { name: 'Blocs' }).click()
  await expect(page.getByRole('region', { name: 'Algorithme en blocs' })).toBeVisible()
}

async function texteApres(page: Page): Promise<string> {
  await page.getByRole('radio', { name: 'Texte' }).click()
  await expect(page.locator('.cm-content')).toBeVisible()
  return texteEditeur(page)
}

const champ = (page: Page, nom: string) => page.getByRole('combobox', { name: nom })

test.beforeEach(async ({ page }) => {
  await ouvrir(page)
  await ecrire(page, PROGRAMME)
})

test('passe en blocs, modifie un champ et retrouve le texte modifié', async ({ page }) => {
  await passerEnBlocs(page)
  await expect(champ(page, 'Condition du Si')).toHaveValue('n > 0')
  await champ(page, 'Valeur affectée').fill('5')
  expect(await texteApres(page)).toBe('Variables\n  n : entier\nDébut\n  n ← 5\n  Si n > 0 alors\n    Afficher "positif" ↵\n  FinSi\n  Afficher n ↵\nFin\n')
})

test('refuse le mode blocs tant que le texte contient une erreur de syntaxe', async ({ page }) => {
  await ecrire(page, ['Début', 'x ← (1', 'Fin'])
  await page.getByRole('radio', { name: 'Blocs' }).click()
  await expect(page.getByRole('radio', { name: 'Texte' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('.annonce')).toContainText('sans erreur de syntaxe')
})

test('insère un bloc depuis la palette après le bloc courant', async ({ page }) => {
  await passerEnBlocs(page)
  await champ(page, 'Valeur affectée').click()
  await page.getByText('Boucles', { exact: true }).click()
  await page.getByRole('button', { name: 'TantQue', exact: true }).click()
  // Le texte d'exemple de la condition est sélectionné : la frappe le remplace.
  await page.keyboard.type('n < 10')
  await expect(champ(page, 'Condition du TantQue')).toHaveValue('n < 10')
  expect(await texteApres(page)).toContain('  n ← 1\n  TantQue n < 10 faire\n  FinTantQue\n  Si n > 0 alors')
})

test('insère un bloc avec le bouton « + »', async ({ page }) => {
  await passerEnBlocs(page)
  const points = page.locator('.point-insertion > button')
  await points.first().click({ force: true })
  await page.getByRole('group', { name: 'Instruction à insérer' }).getByRole('button', { name: 'Lire' }).click()
  await page.keyboard.type('n')
  expect(await texteApres(page)).toContain('Début\n  Lire n\n  n ← 1')
})

test('édition au clavier : déplacer, dupliquer, supprimer, annuler', async ({ page }) => {
  await passerEnBlocs(page)
  const derniere = page.locator('[data-bloc]').filter({ has: page.getByRole('combobox', { name: 'Valeurs affichées' }) }).last()
  await derniere.focus()
  await page.keyboard.press('Alt+ArrowUp')
  await page.keyboard.press('ControlOrMeta+d')
  await page.keyboard.press('Delete')
  await page.keyboard.press('ControlOrMeta+z')
  await page.keyboard.press('ControlOrMeta+z')
  const apres = await texteApres(page)
  // Après « monter » : le dernier Afficher entre dans le Si ; les deux annulations défont la suppression et la duplication.
  expect(apres).toBe('Variables\n  n : entier\nDébut\n  n ← 1\n  Si n > 0 alors\n    Afficher "positif" ↵\n    Afficher n ↵\n  FinSi\nFin\n')
})

test('glisser-déposer un bloc avec la souris', async ({ page }) => {
  await passerEnBlocs(page)
  const bloc = page.locator('[data-bloc]').filter({ has: page.getByRole('combobox', { name: 'Valeurs affichées' }) }).last()
  await bloc.hover()
  const poignee = bloc.locator('.poignee').first()
  const cible = page.locator('.point-insertion').first()
  const depart = (await poignee.boundingBox())!
  const arrivee = (await cible.boundingBox())!
  await page.mouse.move(depart.x + 5, depart.y + 5)
  await page.mouse.down()
  await page.mouse.move(depart.x + 5, depart.y - 20, { steps: 5 })
  await page.mouse.move(arrivee.x + 10, arrivee.y + 2, { steps: 10 })
  await page.mouse.up()
  // dnd-kit ignore les clics pendant 50 ms après un dépôt, pour éviter un clic parasite.
  await page.waitForTimeout(100)
  expect(await texteApres(page)).toContain('Début\n  Afficher n ↵\n  n ← 1')
})

test('rattache les erreurs aux blocs, et un clic sur un diagnostic mène au champ', async ({ page }) => {
  await passerEnBlocs(page)
  await champ(page, 'Valeur affectée').fill('m')
  await expect(page.locator('.erreurs-bloc')).toContainText('La variable m n’est pas déclarée')
  await page.getByRole('button', { name: /ligne 4 : La variable m/ }).click()
  await expect(champ(page, 'Variable affectée')).toBeFocused()
})

test('pas à pas en mode blocs : le bloc courant est surligné', async ({ page }) => {
  await passerEnBlocs(page)
  await page.getByRole('button', { name: 'Pas à pas' }).click()
  await expect(page.locator('.bloc-courant')).toContainText('←')
  await page.keyboard.press('F7')
  await expect(page.locator('.bloc-courant')).toContainText('Si')
})

test('accessibilité du mode blocs : aucune violation détectée par axe', async ({ page }) => {
  await passerEnBlocs(page)
  const resultat = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(resultat.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})
