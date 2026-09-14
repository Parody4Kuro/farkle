import type { Page } from '@playwright/test'
export async function equipItem(page: Page, kind: 'die' | 'badge', index: number, id: string) {
  await page.getByRole('button', { name: new RegExp(`^${kind === 'die' ? '骰子' : '徽章'} ${index + 1}：`) }).click()
  await page.locator(`.bag-list button[data-item-kind="${kind}"][data-item-id="${id}"]`).click()
}
