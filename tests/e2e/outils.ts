import { expect, type Page } from '@playwright/test'

/** Remplace le contenu de l'éditeur en tapant les lignes au clavier (l'indentation est automatique). */
export async function ecrire(page: Page, lignes: string[]): Promise<void> {
  const editeur = page.locator('.cm-content')
  await editeur.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  for (const [k, ligne] of lignes.entries()) {
    await page.keyboard.type(ligne)
    // Ferme une éventuelle liste d'autocomplétion avant de passer à la ligne.
    if (await page.locator('.cm-tooltip-autocomplete').isVisible()) await page.keyboard.press('Escape')
    if (k < lignes.length - 1) await page.keyboard.press('Enter')
  }
}

export function texteEditeur(page: Page): Promise<string> {
  return page.locator('.cm-content').evaluate((e) => [...(e as HTMLElement).querySelectorAll('.cm-line')].map((l) => l.textContent).join('\n'))
}

export async function attendreEnregistrement(page: Page): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: /^Enregistré/ })).toBeVisible({ timeout: 5000 })
}

/** Ouvre l'application sur une bibliothèque vide. */
export async function ouvrir(page: Page): Promise<void> {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('.cm-content')).toBeVisible()
}

export const PROGRAMME = ['Algorithme Double', 'variables', 'n : entier', 'debut', 'Lire n', 'afficher "Double :", n * 2 \\n', 'fin']
