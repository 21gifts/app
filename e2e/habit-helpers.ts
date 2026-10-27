import { expect, type Page } from '@playwright/test';

/** Open the people and creation disclosure before exercising existing tracker controls. */
export async function openHabitGroups(page: Page): Promise<void> {
  await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0);
  const people = page.locator('button[aria-controls^="habit-group-"]');
  for (const person of await people.all()) {
    if ((await person.getAttribute('aria-expanded')) === 'false') await person.click();
  }
  const create = page.locator('[data-habit-create]');
  if (await create.count()) {
    if ((await create.getAttribute('open')) === null) await create.locator('summary').click();
  }
}
