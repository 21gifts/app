import { expect, type Page } from '@playwright/test';

/** Open the people and creation disclosure before exercising existing tracker controls. */
export async function openHabitGroups(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Habit-Tracker', exact: true })).toBeVisible();
  const people = page.locator('button[aria-controls^="habit-group-"]');
  await expect(
    people
      .first()
      .or(page.getByText('No habits yet.', { exact: true }))
      .or(page.getByRole('button', { name: 'Try again', exact: true })),
  ).toBeVisible();
  for (const person of await people.all()) {
    if ((await person.getAttribute('aria-expanded')) === 'false') await person.click();
  }
  const create = page.locator('[data-habit-create]');
  if (await create.count()) {
    if ((await create.getAttribute('open')) === null) await create.locator('summary').click();
  }
}
