import { expect, test, type Page } from '@playwright/test';

const PUBLIC_HABIT = {
  id: 'h-ada',
  accountId: 'acc-ada',
  ownerName: 'Ada',
  role: 'initiator',
  name: 'Walk',
  description: 'Outside',
  cadence: 'daily',
  timeZone: 'Asia/Manila',
  firstPeriod: '2026-10-01',
  lastPeriod: null,
  periods: [
    {
      period: '2026-10-04',
      name: 'Walk',
      description: 'Outside',
      logged: false,
      status: null,
    },
  ],
  comments: [
    {
      id: 'c-bea',
      habitId: 'h-ada',
      accountId: 'acc-bea',
      name: 'Bea',
      text: 'hello',
      week: '2026-09-28',
      createdAt: 1,
    },
  ],
};

const PUBLIC_LIST = {
  reviewWeek: { start: '2026-09-28' },
  habits: [PUBLIC_HABIT],
};

async function stubHabits(page: Page, body: unknown): Promise<void> {
  await page.route('**/habits', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function seedAda(page: Page, role: 'basis' | 'initiator' = 'basis'): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route('**/fx/spot', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"asOf":null,"source":null,"rates":{}}',
    });
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: `02${'a'.repeat(62)}`,
        role,
        name: 'Ada',
        location: null,
        username: 'alice',
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: true,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
}

test('screen /habit-tracker default', async ({ page }) => {
  await stubHabits(page, PUBLIC_LIST);
  await page.goto('/habit-tracker');
  await expect(page.getByRole('heading', { name: 'Habit-Tracker' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ada' })).toBeVisible();
  await expect(page.getByText('Outside')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to comment' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Achieved' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send Bitcoin' })).toHaveCount(0);
});

test('screen /habit-tracker empty', async ({ page }) => {
  await stubHabits(page, {
    reviewWeek: { start: '2026-09-28' },
    habits: [],
  });
  await page.goto('/habit-tracker');
  await expect(page.getByText('No habits yet.')).toBeVisible();
  await expect(page.getByText(/A week can be rated from Monday 08:00/)).toBeVisible();
  await expect(page.getByText(/Monday at 16:00/)).toHaveCount(0);
});

test('screen /habit-tracker loading', async ({ page }) => {
  await page.route('**/habits', () => new Promise(() => undefined));
  await page.goto('/habit-tracker');
  await expect(page.getByText('Loading…')).toBeVisible();
});

test('screen /habit-tracker error', async ({ page }) => {
  await page.route('**/habits', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/habit-tracker');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(
    page.getByText('Could not load or save the tracker. Please try again.'),
  ).toBeVisible();
});

test('screen /habit-tracker signed-in', async ({ page }) => {
  await seedAda(page);
  await stubHabits(page, {
    reviewWeek: PUBLIC_LIST.reviewWeek,
    habits: [{ ...PUBLIC_HABIT, accountId: 'acc_e2e', notes: 'secret' }],
  });
  await page.goto('/habit-tracker');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.getByText('Internal notes:')).toBeVisible();
  await expect(page.getByText('secret')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Achieved', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add habit' })).toBeVisible();
});

test('screen /habit-tracker donate', async ({ page }) => {
  await seedAda(page);
  await stubHabits(page, PUBLIC_LIST);
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Send Bitcoin' }).click();
  await expect(page.getByLabel('Amount')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
});

async function openHabitPay(
  page: Page,
  post: { status: number; error: string } | null,
): Promise<void> {
  await seedAda(page);
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST' && post !== null) {
      await route.fulfill({
        status: post.status,
        contentType: 'application/json',
        body: JSON.stringify({ error: post.error }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_LIST),
    });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Send Bitcoin' }).click();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
}

test('screen /habit-tracker donate-habit-amount', async ({ page }) => {
  await openHabitPay(page, null);
  await page.getByLabel('Amount').fill('0');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByRole('alert').filter({
      hasText: 'Expected a JSON body with an integer "amountSats"',
    }),
  ).toHaveText('Expected a JSON body with an integer "amountSats"');
});

test('screen /habit-tracker donate-request', async ({ page }) => {
  await openHabitPay(page, { status: 500, error: 'nope' });
  await page.getByLabel('Amount').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not start the Bitcoin payment' }),
  ).toHaveText('Could not start the Bitcoin payment');
});

test('screen /habit-tracker donate-request-pending', async ({ page }) => {
  await seedAda(page);
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise(() => undefined);
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_LIST),
    });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Send Bitcoin' }).click();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await page.getByLabel('Amount').fill('21');
  const cont = page.getByRole('button', { name: 'Continue' });
  await cont.click();
  await expect(cont).toBeDisabled();
  await expect(cont.locator('.animate-spin')).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not start the Bitcoin payment' }),
  ).toHaveCount(0);
});

async function rateOwnHabit(
  page: Page,
  status: 'achieved' | 'partial' | 'missed',
  buttonName: string,
): Promise<void> {
  await seedAda(page);
  let rated = false;
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      rated = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [
          {
            ...PUBLIC_HABIT,
            accountId: 'acc_e2e',
            notes: 'secret',
            periods: [
              {
                period: '2026-10-04',
                name: 'Walk',
                description: 'Outside',
                logged: rated,
                status: rated ? status : null,
              },
            ],
          },
        ],
      }),
    });
  });
  await page.goto('/habit-tracker');
  const pill = page.getByRole('button', { name: buttonName, exact: true });
  await expect(pill).toHaveAttribute('aria-pressed', 'false');
  await pill.click();
  await expect(pill).toHaveAttribute('aria-pressed', 'true');
}

test('screen /habit-tracker rated-achieved', async ({ page }) => {
  await rateOwnHabit(page, 'achieved', 'Achieved');
});

test('screen /habit-tracker rated-partial', async ({ page }) => {
  await rateOwnHabit(page, 'partial', 'Partially achieved');
});

test('screen /habit-tracker rated-missed', async ({ page }) => {
  await rateOwnHabit(page, 'missed', 'Not achieved');
});

test('screen /habit-tracker donate-rate-limit', async ({ page }) => {
  await openHabitPay(page, { status: 429, error: 'Too many payments' });
  await page.getByLabel('Amount').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByRole('alert').filter({
      hasText: 'Too many payments. Please wait a moment and try again.',
    }),
  ).toHaveText('Too many payments. Please wait a moment and try again.');
});

test('screen /habit-tracker donate-author-wallet', async ({ page }) => {
  await openHabitPay(page, {
    status: 409,
    error: "The author's wallet cannot receive this Bitcoin payment",
  });
  await page.getByLabel('Amount').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByRole('alert').filter({
      hasText: "The author's wallet cannot receive this Bitcoin payment",
    }),
  ).toHaveText("The author's wallet cannot receive this Bitcoin payment");
});

test('screen /habit-tracker donate-invoice', async ({ page }) => {
  await seedAda(page);
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pr: 'lnbc1', amountSats: 21 }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_LIST),
    });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Send Bitcoin' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByText('Your 21.gifts wallet is not available here, so this cannot be paid.'),
  ).toBeVisible();
});

test('screen /habit-tracker sunday', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e-now', '2026-09-27T12:00:00.000Z');
  });
  await seedAda(page, 'initiator');
  await stubHabits(page, {
    reviewWeek: PUBLIC_LIST.reviewWeek,
    habits: [{ ...PUBLIC_HABIT, accountId: 'acc_e2e', notes: 'secret' }],
  });
  await page.goto('/habit-tracker');
  await expect(page.getByText('Writing is paused on Sunday.').first()).toBeVisible();
  await expect(page.getByText('Zapping is paused on Sunday.').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add habit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Achieved', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Post' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Write a comment' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete comment' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send Bitcoin' })).toHaveCount(0);
});

test('screen /habit-tracker editing', async ({ page }) => {
  await seedAda(page);
  await stubHabits(page, {
    reviewWeek: PUBLIC_LIST.reviewWeek,
    habits: [{ ...PUBLIC_HABIT, accountId: 'acc_e2e', notes: 'secret' }],
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(page.getByText('Save', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

test('screen /habit-tracker archive-confirm', async ({ page }) => {
  await seedAda(page);
  await stubHabits(page, {
    reviewWeek: PUBLIC_LIST.reviewWeek,
    habits: [{ ...PUBLIC_HABIT, accountId: 'acc_e2e', notes: 'secret' }],
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('Archive this habit? Its history stays visible.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm archive' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel archive' })).toBeVisible();
});

test('screen /habit-tracker donate-rate-pending', async ({ page }) => {
  await seedAda(page);
  await page.unroute('**/fx/spot');
  await page.route('**/fx/spot', () => new Promise(() => undefined));
  await stubHabits(page, PUBLIC_LIST);
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Send Bitcoin' }).click();
  const cont = page.getByRole('button', { name: 'Continue' });
  await expect(cont).toBeDisabled();
  await cont.scrollIntoViewIfNeeded();
  await expect(cont).toBeInViewport();
});

test('Function: InlineConfirm — archive uses the shared bordered group', async ({ page }) => {
  await seedAda(page);
  await stubHabits(page, {
    reviewWeek: PUBLIC_LIST.reviewWeek,
    habits: [{ ...PUBLIC_HABIT, accountId: 'acc_e2e', notes: 'secret' }],
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Archive' }).click();
  const group = page.getByRole('group', {
    name: 'Archive this habit? Its history stays visible.',
  });
  await expect(group).toBeVisible();
  await expect(group.getByRole('button', { name: 'Confirm archive' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'Cancel archive' })).toBeVisible();
  await group.getByRole('button', { name: 'Cancel archive' }).click();
  await expect(group).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible();
});

test('screen /habit-tracker archived', async ({ page }) => {
  await seedAda(page);
  let archived = false;
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      archived = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [
          {
            ...PUBLIC_HABIT,
            accountId: 'acc_e2e',
            notes: 'secret',
            lastPeriod: archived ? '2026-10-04' : null,
          },
        ],
      }),
    });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('button', { name: 'Confirm archive' }).click();
  await expect(page.getByText('Archived', { exact: true })).toBeVisible();
  await expect(page.getByText('2026-10-04')).toBeVisible();
  await expect(page.getByText('hello')).toBeVisible();
  await expect(page.getByText('Not rated yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send Bitcoin' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Archive' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Achieved', exact: true })).toHaveCount(0);
});

test('screen /habit-tracker save-error', async ({ page }) => {
  await seedAda(page);
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid name' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [{ ...PUBLIC_HABIT, accountId: 'acc_e2e', notes: 'secret' }],
      }),
    });
  });
  await page.goto('/habit-tracker');
  await expect(page.getByText('Walk', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Achieved', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({
      hasText: 'Could not load or save the tracker. Please try again.',
    }),
  ).toHaveText('Could not load or save the tracker. Please try again.');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByText('Walk', { exact: true })).toBeVisible();
});

test('screen /habit-tracker edit-save-error', async ({ page }) => {
  await seedAda(page);
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid name' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [{ ...PUBLIC_HABIT, accountId: 'acc_e2e', notes: 'secret' }],
      }),
    });
  });
  await page.goto('/habit-tracker');
  await expect(page.getByText('Walk', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('alert').filter({
      hasText: 'Could not load or save the tracker. Please try again.',
    }),
  ).toHaveText('Could not load or save the tracker. Please try again.');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm archive' })).toHaveCount(0);
});

test('screen /habit-tracker archive-confirm-error', async ({ page }) => {
  await seedAda(page);
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid name' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [{ ...PUBLIC_HABIT, accountId: 'acc_e2e', notes: 'secret' }],
      }),
    });
  });
  await page.goto('/habit-tracker');
  await expect(page.getByText('Walk', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('button', { name: 'Confirm archive' }).click();
  await expect(
    page.getByRole('alert').filter({
      hasText: 'Could not load or save the tracker. Please try again.',
    }),
  ).toHaveText('Could not load or save the tracker. Please try again.');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm archive' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel archive' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
});

test('screen /habit-tracker add-error', async ({ page }) => {
  await seedAda(page);
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid name' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [],
      }),
    });
  });
  await page.goto('/habit-tracker');
  await expect(page.getByText('No habits yet.')).toBeVisible();
  await page.locator('#habit-add-name').fill('Stretch');
  await page.getByRole('button', { name: 'Add habit' }).click();
  await expect(
    page.getByRole('alert').filter({
      hasText: 'Could not load or save the tracker. Please try again.',
    }),
  ).toHaveText('Could not load or save the tracker. Please try again.');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.locator('#habit-add-name')).toHaveValue('Stretch');
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Confirm archive' })).toHaveCount(0);
});

test('screen /habit-tracker comment-error', async ({ page }) => {
  await seedAda(page);
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid name' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [
          {
            ...PUBLIC_HABIT,
            accountId: 'acc_e2e',
            description: '',
            periods: [],
            comments: [],
          },
        ],
      }),
    });
  });
  await page.goto('/habit-tracker');
  await expect(page.getByText('Walk', { exact: true })).toBeVisible();
  const draft = page.getByLabel('Write a comment');
  await draft.fill('still here');
  await page.getByRole('button', { name: 'Post' }).click();
  await expect(
    page.getByRole('alert').filter({
      hasText: 'Could not load or save the tracker. Please try again.',
    }),
  ).toHaveText('Could not load or save the tracker. Please try again.');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(draft).toHaveValue('still here');
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Confirm archive' })).toHaveCount(0);
});

test('screen /habit-tracker add-saved', async ({ page }) => {
  await seedAda(page);
  let added = false;
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      added = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    const owned = { ...PUBLIC_HABIT, accountId: 'acc_e2e', notes: 'secret' };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: added
          ? [
              {
                ...PUBLIC_HABIT,
                id: 'h-new',
                accountId: 'acc_e2e',
                name: 'Stretch',
                description: '',
                comments: [],
              },
              owned,
            ]
          : [owned],
      }),
    });
  });
  await page.goto('/habit-tracker');
  await expect(page.getByText('Walk', { exact: true })).toBeVisible();
  await page.locator('#habit-add-name').fill('Stretch');
  await page.getByRole('button', { name: 'Add habit' }).click();
  await expect(page.getByRole('heading', { name: 'Stretch', exact: true })).toBeVisible();
  await expect(page.locator('#habit-add-name')).toHaveValue('');
});

test('screen /habit-tracker edit-saved', async ({ page }) => {
  await seedAda(page);
  let saved = false;
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      saved = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [
          {
            ...PUBLIC_HABIT,
            accountId: 'acc_e2e',
            notes: 'secret',
            name: saved ? 'Stretch' : 'Walk',
          },
        ],
      }),
    });
  });
  await page.goto('/habit-tracker');
  await expect(page.getByText('Walk', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#habit-h-ada-name').fill('Stretch');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Stretch', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Walk', exact: true })).toHaveCount(0);
});

test('screen /habit-tracker comment-posted', async ({ page }) => {
  await seedAda(page);
  let posted = false;
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      posted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [
          {
            ...PUBLIC_HABIT,
            accountId: 'acc_e2e',
            notes: 'secret',
            comments: posted
              ? [
                  ...PUBLIC_HABIT.comments,
                  {
                    id: 'c-new',
                    habitId: 'h-ada',
                    accountId: 'acc_e2e',
                    name: 'Ada',
                    text: 'kept this',
                    week: '2026-09-28',
                    createdAt: 2,
                  },
                ]
              : PUBLIC_HABIT.comments,
          },
        ],
      }),
    });
  });
  await page.goto('/habit-tracker');
  await expect(page.getByText('hello', { exact: true })).toBeVisible();
  await page.getByLabel('Write a comment').fill('kept this');
  await page.getByRole('button', { name: 'Post' }).click();
  await expect(page.getByText('kept this', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Write a comment')).toHaveValue('');
});

test('screen /habit-tracker comment-deleted', async ({ page }) => {
  await seedAda(page, 'initiator');
  let deleted = false;
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      deleted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [
          {
            ...PUBLIC_HABIT,
            comments: deleted ? [] : PUBLIC_HABIT.comments,
          },
        ],
      }),
    });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Delete comment' }).click();
  await page.getByRole('button', { name: 'Confirm deletion' }).click();
  await expect(page.getByText('No comments yet.')).toBeVisible();
  await expect(page.getByText('hello', { exact: true })).toHaveCount(0);
});

test('screen /habit-tracker delete-comment', async ({ page }) => {
  await seedAda(page, 'initiator');
  await stubHabits(page, PUBLIC_LIST);
  await page.goto('/habit-tracker');
  await expect(page.getByRole('button', { name: 'Delete comment' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm deletion' })).toHaveCount(0);
  await expect(page.getByText('Delete this comment from the Habit-Tracker?')).toHaveCount(0);
});

test('screen /habit-tracker delete-comment-confirm', async ({ page }) => {
  await seedAda(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: `02${'a'.repeat(62)}`,
        role: 'initiator',
        name: 'Ada',
        location: null,
        username: 'alice',
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: true,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await stubHabits(page, PUBLIC_LIST);
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Delete comment' }).click();
  await expect(page.getByText('Delete this comment from the Habit-Tracker?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm deletion' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel deletion' })).toBeVisible();
});

test('screen /habit-tracker delete-comment-error', async ({ page }) => {
  await seedAda(page, 'initiator');
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid name' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_LIST),
    });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Delete comment' }).click();
  await page.getByRole('button', { name: 'Confirm deletion' }).click();
  await expect(
    page.getByRole('alert').filter({
      hasText: 'Could not load or save the tracker. Please try again.',
    }),
  ).toHaveText('Could not load or save the tracker. Please try again.');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete comment' })).toBeVisible();
  await expect(page.getByText('hello', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm deletion' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Confirm archive' })).toHaveCount(0);
});

test('Function: ForumPaySheet — a habit comment uses the forum pay sheet', async ({ page }) => {
  await seedAda(page);
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pr: 'lnbc1', amountSats: 21 }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_LIST),
    });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Send Bitcoin' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Pay ₿21')).toBeVisible();
  await expect(
    page.getByText('Your 21.gifts wallet is not available here, so this cannot be paid.'),
  ).toBeVisible();
});

test('Function: HabitTrackerPage — a signed-out visitor reads the public list', async ({
  page,
}) => {
  await stubHabits(page, PUBLIC_LIST);
  await page.goto('/habit-tracker');
  await expect(page.getByRole('heading', { name: 'Habit-Tracker' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
});

test('Function: MemberHabits — the owner logs the open period', async ({ page }) => {
  await seedAda(page);
  let posted = '';
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      posted = route.request().postData() ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [{ ...PUBLIC_HABIT, accountId: 'acc_e2e', notes: 'secret' }],
      }),
    });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Achieved', exact: true }).click();
  await expect.poll(() => posted).toContain('"status":"achieved"');
});

test('Function: MemberHabits — the owner logs an earlier returned period', async ({ page }) => {
  await seedAda(page);
  let posted = '';
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      posted = route.request().postData() ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [
          {
            ...PUBLIC_HABIT,
            accountId: 'acc_e2e',
            notes: 'secret',
            periods: [
              {
                period: '2026-10-02',
                name: 'Walk',
                description: 'Outside',
                logged: true,
                status: 'achieved',
              },
              {
                period: '2026-10-04',
                name: 'Walk',
                description: 'Outside',
                logged: false,
                status: null,
              },
            ],
          },
        ],
      }),
    });
  });
  await page.goto('/habit-tracker');
  const earlier = page.getByRole('listitem').filter({ hasText: '2026-10-02' });
  await earlier.getByRole('button', { name: 'Not achieved', exact: true }).click();
  await expect.poll(() => posted).toContain('"period":"2026-10-02"');
  await expect.poll(() => posted).toContain('"status":"missed"');
});

test('Function: fetchMemberHabits — the habit tracker page loads the public list', async ({
  page,
}) => {
  await stubHabits(page, PUBLIC_LIST);
  await page.goto('/habit-tracker');
  await expect(page.getByRole('heading', { name: 'Habit-Tracker' })).toBeVisible();
  await expect(page.getByText('Walk', { exact: true })).toBeVisible();
  await expect(page.getByText('Outside')).toBeVisible();
});

test('Function: postMemberHabit — the owner logs the open period through the page', async ({
  page,
}) => {
  await seedAda(page);
  let posted = '';
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      posted = route.request().postData() ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [{ ...PUBLIC_HABIT, accountId: 'acc_e2e', notes: 'secret' }],
      }),
    });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Achieved', exact: true }).click();
  await expect.poll(() => posted).toContain('"action":"log"');
  await expect.poll(() => posted).toContain('"status":"achieved"');
});

test('Function: useSpotRateState — Continue stays disabled until the spot rate read settles', async ({
  page,
}) => {
  await seedAda(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/fx/spot', async (route) => {
    await pending;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"asOf":null,"source":null,"rates":{}}',
    });
  });
  await stubHabits(page, PUBLIC_LIST);
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Send Bitcoin' }).click();
  const cont = page.getByRole('button', { name: 'Continue' });
  await expect(cont).toBeDisabled();
  release();
  await expect(cont).toBeEnabled();
});

test('Function: HabitTrackerTopRight — Log in without a session and the menu with one', async ({
  page,
}) => {
  await stubHabits(page, PUBLIC_LIST);
  await page.goto('/habit-tracker');
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);
  await seedAda(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0);
});

test('Function: HabitComments — a comment and Send Bitcoin stay on an archived habit', async ({
  page,
}) => {
  await seedAda(page);
  await stubHabits(page, {
    reviewWeek: PUBLIC_LIST.reviewWeek,
    habits: [{ ...PUBLIC_HABIT, lastPeriod: '2026-10-04' }],
  });
  await page.goto('/habit-tracker');
  await expect(page.getByText('hello')).toBeVisible();
  await expect(page.getByText('Not rated yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send Bitcoin' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Archive' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Achieved', exact: true })).toHaveCount(0);
});

test('Function: postMemberHabit — Time-Zone is sent only for add, comment, delete, and invoice', async ({
  page,
}) => {
  await seedAda(page, 'initiator');
  const posts: Array<{ body: string; zone: string | null }> = [];
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      const headers = await route.request().allHeaders();
      posts.push({
        body: route.request().postData() ?? '',
        zone: headers['time-zone'] ?? null,
      });
      const body = route.request().postData() ?? '';
      if (body.includes('"action":"invoice"')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ pr: 'lnbc1', amountSats: 21 }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [{ ...PUBLIC_HABIT, accountId: 'acc_e2e', notes: 'secret' }],
      }),
    });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Achieved', exact: true }).click();
  await expect.poll(() => posts.length).toBe(1);

  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => posts.length).toBe(2);
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);

  await page.getByLabel('Write a comment').fill('hello again');
  await page.getByRole('button', { name: 'Post' }).click();
  await expect.poll(() => posts.length).toBe(3);

  await page.getByRole('button', { name: 'Delete comment' }).click();
  await page.getByRole('button', { name: 'Confirm deletion' }).click();
  await expect.poll(() => posts.length).toBe(4);

  await page.getByLabel('Name').fill('Next');
  await page.getByRole('button', { name: 'Add habit' }).click();
  await expect.poll(() => posts.length).toBe(5);

  await page.getByRole('button', { name: 'Send Bitcoin' }).click();
  await page.getByLabel('Amount').fill('21');
  const cont = page.getByRole('button', { name: 'Continue' });
  await expect(cont).toBeEnabled();
  await cont.click();
  await expect.poll(() => posts.length).toBe(6);

  await page.getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('button', { name: 'Confirm archive' }).click();
  await expect.poll(() => posts.length).toBe(7);

  const zoneOf = (action: string): string | null | undefined =>
    posts.find((row) => row.body.includes(`"action":"${action}"`))?.zone;
  expect(zoneOf('log')).toBeNull();
  expect(zoneOf('edit')).toBeNull();
  expect(zoneOf('archive')).toBeNull();
  expect(zoneOf('add')).toBeTruthy();
  expect(zoneOf('comment')).toBeTruthy();
  expect(zoneOf('deleteComment')).toBeTruthy();
  expect(zoneOf('invoice')).toBeTruthy();
});
