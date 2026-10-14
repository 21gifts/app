import { expect, test, type Page } from '@playwright/test';
import { motionSettled } from './motion';

/** First living-room law, shown in the laws hint above the composer. */
const LAWS_1 = '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.';

/** Signs in Ada (laws hint not dismissed) with an account that can hold the wallet. */
async function signInAda(page: Page, role = 'basis'): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
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
        username: 'ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        hasPosted: true,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
        walletRequired: true,
        walletBackupSeenAt: 1,
        passkeyCredentialId: 'cred-seed',
      }),
    });
  });
}

/** A paid feed with no replies yet; a top-level post comes back as the newest note. */
async function feed(page: Page, length = 3): Promise<void> {
  const messages = Array.from({ length }, (_, index) => ({
    id: `m${index + 1}`,
    name: 'Carol',
    text: `Note number ${index + 1} on the forum home.`,
    createdAt: `2026-08-28T1${index % 10}:00:00.000Z`,
    sats: 21,
    payable: true,
    hasPhoto: false,
    role: 'verified',
    replyCount: 0,
  }));
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    // The inbox page itself (`/messages?c=…`) is a document, not the feed.
    if (route.request().resourceType() === 'document') {
      await route.fallback();
      return;
    }
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { text: string };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'm-new',
          name: 'Ada',
          text: body.text,
          createdAt: '2026-08-28T20:00:00.000Z',
          sats: 0,
          payable: false,
          hasPhoto: false,
          role: 'verified',
          replyCount: 0,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages }),
    });
  });
  await page.route(/\/replies(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
}

/**
 * A visual viewport the test drives: `__vvHeight` stands for the keyboard,
 * `__vvFire(type)` delivers a viewport event as the browser would.
 */
async function drivenViewport(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const listeners: Record<string, Array<() => void>> = { resize: [], scroll: [] };
    const state = window as unknown as {
      __vvHeight?: number;
      __vvFire?: (type: string) => void;
    };
    const viewport = {
      get height(): number {
        return state.__vvHeight ?? window.innerHeight;
      },
      offsetTop: 0,
      scale: 1,
      addEventListener(type: string, listener: () => void): void {
        listeners[type]?.push(listener);
      },
      removeEventListener(type: string, listener: () => void): void {
        listeners[type] = (listeners[type] ?? []).filter((entry) => entry !== listener);
      },
    };
    state.__vvFire = (type: string): void => {
      for (const listener of listeners[type] ?? []) listener();
    };
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      get() {
        return viewport;
      },
    });
  });
}

async function keyboard(page: Page, height: number | null): Promise<void> {
  await page.evaluate((next) => {
    const state = window as unknown as { __vvHeight?: number; __vvFire: (type: string) => void };
    if (next === null) delete state.__vvHeight;
    else state.__vvHeight = next;
    state.__vvFire('resize');
  }, height);
}

async function appHeight(page: Page): Promise<string> {
  return page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--app-height').trim(),
  );
}

/** The page scrollport (not the writer's). */
function pagePort(page: Page) {
  return page.locator('[data-scrollport]:has(> [data-scroll-page])');
}

/** The open writer: the layer over the frame body, holding the composer. */
function writer(page: Page) {
  return page.locator('[data-app-body] [data-scrollport]:has([data-writing-composer])');
}

/** The --footer-collapse progress on the frame body (0 when unset). */
async function collapse(page: Page): Promise<number> {
  return page.evaluate(() => {
    const body = document.querySelector('[data-app-body]') as HTMLElement;
    const value = body.style.getPropertyValue('--footer-collapse');
    return value === '' ? 0 : Number(value);
  });
}

/** Sets the page scroll position and announces it. */
async function scrollPageTo(page: Page, top: number): Promise<void> {
  await pagePort(page).evaluate((node, next) => {
    node.scrollTop = next;
  }, top);
  await expect.poll(async () => pagePort(page).evaluate((node) => node.scrollTop)).toBe(top);
}

async function openHome(page: Page, role = 'basis', length = 3): Promise<void> {
  await signInAda(page, role);
  await feed(page, length);
  await page.goto('/welcome?visual=balance-ready');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByText('Note number 1 on the forum home.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Receive' })).toBeVisible();
}

test.describe('forum home writer on a phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });

  test('Function: AppShellOverlay — the home has a + instead of a composer; the writer opens under the header row with the field focused', async ({
    page,
  }) => {
    await openHome(page);
    // No composer, no Post / Ask pill on the page; the laws hint and the view filter stay.
    await expect(page.getByLabel('Your message')).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Compose' })).toHaveCount(0);
    await expect(page.getByText(LAWS_1)).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Forum view' })).toBeVisible();

    const plus = page.getByRole('button', { name: 'Write a post' });
    const plusBox = (await plus.boundingBox())!;
    const receive = (await page.getByRole('button', { name: 'Receive' }).boundingBox())!;
    expect(plusBox.width).toBe(56);
    expect(plusBox.height).toBe(56);
    expect(375 - (plusBox.x + plusBox.width)).toBeCloseTo(24, 0);
    expect(receive.y - (plusBox.y + plusBox.height)).toBeCloseTo(23, 0);

    await plus.tap();
    const layer = writer(page);
    await expect(layer).toBeVisible();
    await expect(page.getByLabel('Your message')).toBeFocused();
    await expect(layer.getByRole('heading', { name: 'Send a post' })).toBeVisible();
    await expect(layer.getByRole('group', { name: 'Compose' })).toBeVisible();
    await expect(plus).toHaveCount(0);

    // From the header row's bottom edge to the frame's, with the frame background.
    const chrome = (await page.locator('[data-app-chrome]').boundingBox())!;
    const body = (await page.locator('[data-app-body]').boundingBox())!;
    const box = (await layer.boundingBox())!;
    expect(box.y).toBeCloseTo(chrome.y + chrome.height, 0);
    expect(box.y + box.height).toBeCloseTo(body.y + body.height, 0);
    expect(box.width).toBeCloseTo(body.width, 0);
    await expect(layer).toHaveCSS('border-bottom-left-radius', '24px');
    await expect(layer).toHaveCSS('position', 'absolute');

    // It covers the feed and Receive / Send.
    const covered = await page.evaluate(() => {
      const button = [...document.querySelectorAll('footer button')].find(
        (node) => node.textContent === 'Receive',
      )!;
      const rect = button.getBoundingClientRect();
      const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      const layer = document.querySelector('[data-writing-composer]')!.parentElement!;
      return top !== null && layer.contains(top);
    });
    expect(covered).toBe(true);
  });

  test('Function: WelcomeScreen — the top-left arrow closes the writer; the feed comes back where it was and the draft stays', async ({
    page,
  }) => {
    await openHome(page, 'basis', 12);
    await scrollPageTo(page, 300);
    await page.getByRole('button', { name: 'Write a post' }).tap();
    await expect(writer(page)).toBeVisible();
    await page.getByLabel('Your message').fill('A draft for later');
    // One back control: the top-left arrow, no close or cancel button in the writer.
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(1);
    await expect(writer(page).getByRole('button', { name: /Close|Cancel/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Back' }).tap();
    await expect(writer(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Write a post' })).toBeVisible();
    expect(await pagePort(page).evaluate((node) => node.scrollTop)).toBe(300);

    await page.getByRole('button', { name: 'Write a post' }).tap();
    await expect(page.getByLabel('Your message')).toHaveValue('A draft for later');
  });

  test('Function: SignedInChrome — the Menu opened over the writer shows its sheet; the writer comes back when it closes', async ({
    page,
  }) => {
    await openHome(page);
    await page.getByRole('button', { name: 'Write a post' }).tap();
    await page.getByLabel('Your message').fill('Kept while the Menu is open');
    await page.getByRole('button', { name: 'Menu' }).tap();
    await expect(page.getByRole('link', { name: 'Balance', exact: true })).toBeVisible();
    await expect(writer(page)).toBeHidden();
    await page.getByRole('button', { name: 'Menu' }).tap();
    await expect(writer(page)).toBeVisible();
    await expect(page.getByLabel('Your message')).toHaveValue('Kept while the Menu is open');
  });

  test('Function: ForumBoard — the writer on a phone: camera, photo and place in a row on top, the field and send below it', async ({
    page,
  }) => {
    await openHome(page);
    await page.getByRole('button', { name: 'Write a post' }).tap();
    const field = (await page.getByLabel('Your message').boundingBox())!;
    const camera = (await page
      .getByRole('button', { name: 'Take a photo', exact: true })
      .boundingBox())!;
    const photo = (await page.getByRole('button', { name: 'Add a photo or video' }).boundingBox())!;
    const place = (await page.getByRole('button', { name: 'Add a place' }).boundingBox())!;
    const post = (await page.getByRole('button', { name: 'Post', exact: true }).boundingBox())!;
    expect(Math.abs(camera.y - photo.y)).toBeLessThan(1);
    expect(Math.abs(place.y - photo.y)).toBeLessThan(1);
    expect(camera.x).toBeLessThan(photo.x);
    expect(photo.x).toBeLessThan(place.x);
    expect(field.y).toBeGreaterThanOrEqual(photo.y + photo.height);
    expect(post.y).toBeGreaterThanOrEqual(photo.y + photo.height);
    expect(post.x).toBeGreaterThanOrEqual(field.x + field.width);
    expect(post.width).toBeGreaterThanOrEqual(44);
  });

  test('Function: ForumLoader — a post from the writer closes it, and the post appears on the home', async ({
    page,
  }) => {
    await openHome(page, 'verified', 12);
    await scrollPageTo(page, 300);
    await page.getByRole('button', { name: 'Write a post' }).tap();
    await page.getByLabel('Your message').fill('Hello from the writer');
    await page.getByRole('button', { name: 'Post', exact: true }).tap();
    await expect(writer(page)).toHaveCount(0);
    // The feed shows its top, where the new note is.
    await expect.poll(async () => pagePort(page).evaluate((node) => node.scrollTop)).toBe(0);
    await expect(page.getByText('Hello from the writer')).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Write a post' })).toBeVisible();
    // The draft was cleared with the post.
    await page.getByRole('button', { name: 'Write a post' }).tap();
    await expect(page.getByLabel('Your message')).toHaveValue('');
  });

  test('Function: ForumAskWizard — Ask for money in the writer: its own title, and the arrow steps back through the Ask before it closes the writer', async ({
    page,
  }) => {
    await openHome(page);
    await page.getByRole('button', { name: 'Write a post' }).tap();
    await writer(page).getByRole('button', { name: 'Ask for money' }).tap();
    await expect(writer(page).getByRole('heading', { name: 'Ask for money' })).toBeVisible();
    await expect(writer(page).getByText('How much?')).toBeVisible();
    await page.getByLabel('Ask', { exact: true }).fill('5000');
    await page.getByRole('button', { name: 'Continue' }).tap();
    await expect(writer(page).getByText('2 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).tap();
    await expect(writer(page).getByText('1 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).tap();
    await expect(writer(page)).toHaveCount(0);
    // Reopening keeps the Ask and its amount.
    await page.getByRole('button', { name: 'Write a post' }).tap();
    await expect(writer(page).getByRole('heading', { name: 'Ask for money' })).toBeVisible();
    await expect(page.getByLabel('Ask', { exact: true })).toHaveValue('5000');
  });

  test('Function: WalletFooterActions — Receive and Send slim down while scrolling down and grow back while scrolling up; the + follows', async ({
    page,
  }) => {
    await openHome(page, 'basis', 12);
    const receive = page.getByRole('button', { name: 'Receive' });
    const plus = page.getByRole('button', { name: 'Write a post' });
    expect((await receive.boundingBox())!.height).toBe(56);
    await expect(receive).toHaveCSS('font-size', '16px');

    await scrollPageTo(page, 200);
    await expect.poll(() => collapse(page)).toBe(1);
    await expect.poll(async () => (await receive.boundingBox())!.height).toBe(36);
    await expect(receive).toHaveCSS('font-size', '14px');
    await expect(receive.locator('svg')).toHaveCSS('width', '16px');
    await expect(page.locator('footer')).toHaveCSS('padding-bottom', '12px');
    await expect(page.locator('[data-footer-actions]')).toHaveCSS('padding-top', '4px');
    const slimPlus = (await plus.boundingBox())!;
    const slimReceive = (await receive.boundingBox())!;
    expect(slimReceive.y - (slimPlus.y + slimPlus.height)).toBeCloseTo(23, 0);

    // Up by the full range: full again, though the page is not at the top.
    await scrollPageTo(page, 110);
    await expect.poll(() => collapse(page)).toBe(0);
    await expect.poll(async () => (await receive.boundingBox())!.height).toBe(56);

    // Stopping half way glides to the nearer end.
    await scrollPageTo(page, 160);
    await expect.poll(() => collapse(page)).toBe(1);
    await scrollPageTo(page, 120);
    await expect.poll(() => collapse(page)).toBe(1);
    await expect(page.locator('[data-app-body]')).toHaveAttribute('data-footer-snap', '');

    // Near the top it is always full.
    await scrollPageTo(page, 10);
    await expect.poll(() => collapse(page)).toBe(0);
    await expect(page.locator('footer')).toHaveCSS('padding-bottom', '20px');
  });

  test('Function: useAppHeight — closing the writer takes the full height at once; leaving a reply waits for the viewport', async ({
    page,
  }) => {
    await drivenViewport(page);
    await openHome(page);
    expect(await appHeight(page)).toBe('812px');

    await page.getByRole('button', { name: 'Write a post' }).tap();
    await expect(page.getByLabel('Your message')).toBeFocused();
    await keyboard(page, 480);
    expect(await appHeight(page)).toBe('480px');
    // The writer moves with the frame: it still ends at the frame's bottom edge.
    const body = (await page.locator('[data-app-body]').boundingBox())!;
    const box = (await writer(page).boundingBox())!;
    expect(box.y + box.height).toBeCloseTo(body.y + body.height, 0);
    await page.getByRole('button', { name: 'Back' }).tap();
    // The keyboard is still sliding away (the viewport still says 480): the frame is already full.
    expect(await appHeight(page)).toBe('812px');
    await keyboard(page, null);
    expect(await appHeight(page)).toBe('812px');

    // A reply field keeps the plain behaviour: the short viewport stays until it reports more.
    await page.getByRole('button', { name: 'React' }).first().tap();
    const reply = page.getByPlaceholder('Write a reaction');
    await reply.tap();
    await keyboard(page, 480);
    await reply.blur();
    expect(await appHeight(page)).toBe('480px');
    await keyboard(page, null);
    expect(await appHeight(page)).toBe('812px');
  });

  test('Function: WalletFooterActions — with reduced motion the buttons settle at once, without the glide', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHome(page, 'basis', 12);
    await scrollPageTo(page, 60);
    await expect.poll(() => collapse(page)).toBe(1);
    await expect(page.locator('[data-app-body]')).not.toHaveAttribute('data-footer-snap');
  });
});

test.describe('forum home while reacting on a phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });

  /** The shell footer's height, in px. */
  async function footerHeight(page: Page): Promise<number> {
    return (await page.locator('footer').boundingBox())!.height;
  }

  /** The reaction form of the expanded post. */
  function reactionForm(page: Page) {
    return page.getByPlaceholder('Write a reaction').locator('xpath=ancestor::form');
  }

  /** True when no button, link, field or toggle other than the + lies under the + box. */
  async function plusCoversNothing(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const plus = [...document.querySelectorAll('button')].find(
        (node) => node.getAttribute('aria-label') === 'Write a post',
      )!;
      const box = plus.getBoundingClientRect();
      const controls = document.querySelectorAll(
        '[data-scroll-page] :is(button, a, input, textarea, select, [role="button"])',
      );
      return [...controls].every((node) => {
        const rect = node.getBoundingClientRect();
        return (
          rect.width === 0 ||
          rect.right <= box.left ||
          rect.left >= box.right ||
          rect.bottom <= box.top ||
          rect.top >= box.bottom
        );
      });
    });
  }

  test('Function: WelcomeScreen — only a focused field in a reaction form moves the + and Receive / Send aside; they come back once the focus left', async ({
    page,
  }) => {
    await drivenViewport(page);
    await openHome(page, 'basis', 12);
    const plus = page.getByRole('button', { name: 'Write a post' });
    const receive = page.getByRole('button', { name: 'Receive' });
    expect(await footerHeight(page)).toBeGreaterThan(70);

    // An open form whose field does not have the focus leaves both in place.
    await page.getByRole('button', { name: 'React', exact: true }).first().tap();
    const reply = page.getByPlaceholder('Write a reaction');
    await expect(reply).toBeVisible();
    await expect(reply).not.toBeFocused();
    await expect(plus).toBeVisible();
    await expect(receive).toBeVisible();
    await expect(page.locator('[data-app-body]')).not.toHaveAttribute('data-footer-fold');

    // Its field taking the focus moves both aside.
    await reply.tap();
    await expect(plus).toBeHidden();
    await expect(receive).toBeHidden();
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeHidden();
    await expect(page.locator('[data-app-body]')).toHaveAttribute('data-footer-fold', '');
    await expect.poll(() => footerHeight(page)).toBe(0);
    await expect(page.locator('footer')).toHaveCSS('padding-bottom', '0px');
    // The folded buttons stay inside the window.
    const outside = await page.evaluate(
      () =>
        [...document.querySelectorAll('footer *')].filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.bottom > window.innerHeight + 1 || rect.top < -1;
        }).length,
    );
    expect(outside).toBe(0);
    // The page reaches down to the frame's bottom edge.
    const port = (await pagePort(page).boundingBox())!;
    const body = (await page.locator('[data-app-body]').boundingBox())!;
    expect(port.y + port.height).toBeCloseTo(body.y + body.height, 0);

    // Typing with the keyboard up, and from the text to the amount: still aside.
    await keyboard(page, 480);
    await reply.fill('Thank you');
    await page.getByLabel('Amount').tap();
    await expect(plus).toBeHidden();
    await expect(receive).toBeHidden();

    // The focus leaves while the form stays open: both come back, and the buttons follow the scroll again.
    await page.getByLabel('Amount').blur();
    await keyboard(page, null);
    await expect(reply).toBeVisible();
    await expect(plus).toBeVisible();
    await expect(receive).toBeVisible();
    await expect(page.locator('[data-app-body]')).not.toHaveAttribute('data-footer-fold');
    await scrollPageTo(page, 0);
    await expect.poll(async () => (await receive.boundingBox())!.height).toBe(56);
    await expect(page.locator('footer')).toHaveCSS('padding-bottom', '20px');
    await scrollPageTo(page, 200);
    await expect.poll(() => collapse(page)).toBe(1);
    await expect.poll(async () => (await receive.boundingBox())!.height).toBe(36);
    const slimPlus = (await plus.boundingBox())!;
    const slimReceive = (await receive.boundingBox())!;
    expect(slimReceive.y - (slimPlus.y + slimPlus.height)).toBeCloseTo(23, 0);

    // React on the expanded post focuses its field: both move aside in that tap.
    await page.getByRole('button', { name: 'React', exact: true }).first().tap();
    await expect(reply).toBeFocused();
    await expect(plus).toBeHidden();
    await expect(receive).toBeHidden();
    // Closing the post with the field focused counts as leaving it.
    await page.getByRole('button', { name: 'Hide reactions' }).first().tap();
    await expect(reply).toHaveCount(0);
    await expect(plus).toBeVisible();
    await expect(receive).toBeVisible();
  });

  test('Function: ForumBoard — an open reaction form scrolls clear of the +, and it posts', async ({
    page,
  }) => {
    await openHome(page, 'basis', 12);
    /** Scrolls the page port to its end. */
    const toEnd = (): Promise<void> =>
      pagePort(page).evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
    /** Scrolls to the end until the port no longer grows (slim buttons make it taller). */
    const settleAtEnd = async (): Promise<void> => {
      // The reaction form eases open; measure the end of the page once it has.
      await motionSettled(page);
      await toEnd();
      await expect.poll(() => collapse(page)).toBe(1);
      await expect
        .poll(async () => {
          await toEnd();
          return pagePort(page).evaluate(
            (node) => node.scrollHeight - node.clientHeight - node.scrollTop,
          );
        })
        .toBeLessThan(1);
    };
    // At the end of the feed the last note's controls lie clear of the +.
    await settleAtEnd();
    expect(await plusCoversNothing(page)).toBe(true);
    // The last note's reaction form, open with its field not focused: the + stays, and at the
    // end of the feed every control of the form lies clear of it.
    const plus = page.getByRole('button', { name: 'Write a post' });
    await page.getByRole('button', { name: 'React', exact: true }).last().tap();
    await expect(page.getByPlaceholder('Write a reaction')).toBeVisible();
    await expect(page.getByPlaceholder('Write a reaction')).not.toBeFocused();
    await expect(plus).toBeVisible();
    await settleAtEnd();
    expect(await plusCoversNothing(page)).toBe(true);
    const send = reactionForm(page).getByRole('button', { name: 'Post' });
    const onTop = await send.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return top !== null && node.contains(top);
    });
    expect(onTop).toBe(true);
    await page.getByPlaceholder('Write a reaction').fill('A reaction under the thumb');
    const posted = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        /\/messages(?:\?|$)/.test(request.url()) &&
        (request.postData() ?? '').includes('A reaction under the thumb'),
    );
    await send.tap();
    await posted;
    await expect(page.getByPlaceholder('Write a reaction')).toHaveValue('');
  });

  test('Function: WelcomeScreen — a mouse click on Post where the + comes back reaches Post', async ({
    page,
  }) => {
    await openHome(page, 'basis', 12);
    const plus = page.getByRole('button', { name: 'Write a post' });
    await page.getByRole('button', { name: 'React', exact: true }).nth(5).tap();
    const reply = page.getByPlaceholder('Write a reaction');
    await reply.fill('A click where the plus comes back');
    await reply.focus();
    await expect(plus).toBeHidden();
    await expect.poll(() => footerHeight(page)).toBe(0);
    const send = reactionForm(page).getByRole('button', { name: 'Post' });
    // The faded + is out of the accessibility tree; its box is still where it comes back to.
    const place = page.locator('button[aria-label="Write a post"]');
    /** How far Post's centre lies below the centre of the hidden +, in px. */
    const below = async (): Promise<number> => {
      const post = (await send.boundingBox())!;
      const box = (await place.boundingBox())!;
      return post.y + post.height / 2 - (box.y + box.height / 2);
    };
    // Post under the place the + comes back to, with the field still focused.
    await expect
      .poll(async () => {
        const delta = await below();
        await pagePort(page).evaluate((node, by) => {
          node.scrollTop += by;
        }, delta);
        return Math.abs(await below());
      })
      .toBeLessThan(1);
    await expect(reply).toBeFocused();
    const post = (await send.boundingBox())!;
    const box = (await place.boundingBox())!;
    const left = Math.max(post.x, box.x);
    const right = Math.min(post.x + post.width, box.x + box.width);
    expect(right - left).toBeGreaterThan(8);
    const point = { x: (left + right) / 2, y: post.y + post.height / 2 };
    const posted = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        /\/messages(?:\?|$)/.test(request.url()) &&
        (request.postData() ?? '').includes('A click where the plus comes back'),
    );
    // The press takes the focus out of the field; the + stays away until the click has landed.
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await expect(reply).not.toBeFocused();
    await page.waitForTimeout(100);
    const under = await send.evaluate((node, at) => {
      const top = document.elementFromPoint(at.x, at.y);
      return top !== null && node.contains(top);
    }, point);
    expect(under).toBe(true);
    await page.mouse.up();
    await posted;
    await expect(writer(page)).toHaveCount(0);
    await expect(reply).toHaveValue('');
    await expect(plus).toBeVisible();
  });

  test('Function: useLocalSunday — on the local Sunday an expanded post has no form, so the + and Receive / Send stay', async ({
    page,
  }) => {
    await openHome(page);
    await page.evaluate(() => {
      document.documentElement.dataset['localSunday'] = '1';
    });
    await page.getByRole('button', { name: 'Show reactions' }).first().tap();
    await expect(page.getByRole('button', { name: 'Hide reactions' })).toBeVisible();
    await expect(page.getByPlaceholder('Write a reaction')).toBeHidden();
    await expect(page.locator('[data-app-body]')).not.toHaveAttribute('data-footer-fold');
    await expect(page.getByRole('button', { name: 'Write a post' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Receive' })).toBeVisible();
  });

  test('Function: WalletFooterActions — with reduced motion the fold and the + switch at once', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHome(page);
    const plus = page.getByRole('button', { name: 'Write a post' });
    await expect(plus).toHaveCSS('transition-property', 'none');
    await page.getByRole('button', { name: 'React', exact: true }).first().tap();
    await page.getByPlaceholder('Write a reaction').tap();
    await expect(page.locator('[data-app-body]')).toHaveAttribute('data-footer-fold', '');
    await expect(page.locator('[data-app-body]')).not.toHaveAttribute('data-footer-folding');
    await expect(plus).toBeHidden();
    await expect(page.getByRole('button', { name: 'Receive' })).toBeHidden();
    await page.getByRole('button', { name: 'Hide reactions' }).first().tap();
    await expect(page.locator('[data-app-body]')).not.toHaveAttribute('data-footer-folding');
    await expect(plus).toBeVisible();
    await expect(page.getByRole('button', { name: 'Receive' })).toBeVisible();
  });
});

test('Function: WalletFooterActions — /wallet follows the scroll too and has no +; other pages keep their own composers', async ({
  page,
}) => {
  await signInAda(page);
  await feed(page);
  await page.goto('/wallet?visual=history-rows');
  await expect(page.getByRole('button', { name: 'Receive' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Write a post' })).toHaveCount(0);
  // Never folded on /wallet.
  await expect(page.locator('[data-app-body]')).not.toHaveAttribute('data-footer-fold');
  await expect(page.locator('footer')).toHaveCSS('padding-bottom', '20px');
  const port = pagePort(page);
  const room = await port.evaluate((node) => node.scrollHeight - node.clientHeight);
  expect(room).toBeGreaterThan(100);
  await scrollPageTo(page, 100);
  await expect.poll(() => collapse(page)).toBe(1);
  await expect
    .poll(async () => (await page.getByRole('button', { name: 'Receive' }).boundingBox())!.height)
    .toBe(36);

  await page.goto('/shops');
  await expect(page.getByRole('button', { name: 'Add a shop' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Write a post' })).toHaveCount(0);

  await page.goto('/contact');
  await expect(page.getByRole('button', { name: 'Write a post' })).toHaveCount(0);
  await expect(page.locator('form textarea').first()).toBeVisible();
});

test('Function: AppShellOverlay — on a desktop pointer the + opens the same writer', async ({
  page,
}) => {
  await openHome(page);
  await page.getByRole('button', { name: 'Write a post' }).click();
  await expect(writer(page)).toBeVisible();
  await expect(page.getByLabel('Your message')).toBeFocused();
  const field = (await page.getByLabel('Your message').boundingBox())!;
  const post = (await page.getByRole('button', { name: 'Post', exact: true }).boundingBox())!;
  // One row on a fine pointer: photo, place, text field, send.
  expect(Math.abs(field.y + field.height / 2 - (post.y + post.height / 2))).toBeLessThan(2);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(writer(page)).toHaveCount(0);
});
