import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForumQuotedBody } from '@/components/QuotedForumNote';
import type { ForumMessage } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    onClick?: (event: { stopPropagation: () => void }) => void;
    'aria-label'?: string;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: (): { push: () => void } => ({ push: () => undefined }),
}));

vi.mock('@/lib/api', () => ({
  fetchForumMessage: vi.fn(),
  fetchPublicMessage: vi.fn(),
  fetchPublicMessagePhoto: vi.fn(),
  fetchShortLink: vi.fn(),
}));

vi.mock('@/lib/note-translate', () => ({
  fetchTranslateAvailable: vi.fn(),
  translateConversationMessage: vi.fn(),
  translateNote: vi.fn(),
}));

import {
  fetchForumMessage,
  fetchPublicMessage,
  fetchPublicMessagePhoto,
  fetchShortLink,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import {
  fetchTranslateAvailable,
  translateConversationMessage,
  translateNote,
} from '@/lib/note-translate';

const fetchMessage = vi.mocked(fetchPublicMessage);
const fetchForum = vi.mocked(fetchForumMessage);
const fetchPhoto = vi.mocked(fetchPublicMessagePhoto);
const fetchShort = vi.mocked(fetchShortLink);
const fetchAvailable = vi.mocked(fetchTranslateAvailable);
const translateConversation = vi.mocked(translateConversationMessage);
const translate = vi.mocked(translateNote);
const german = 'Kann mir jemand diese Woche ein paar Satoshi leihen?';

const PARENT_ID = '444d655b-73a4-475a-b5fc-f7e36210e82e';
const QUOTED_ID = 'd8cd22dd-d5c4-46a8-82ed-38b4d2f551ec';
const QUOTED_URL = `https://21.gifts/messages/${QUOTED_ID}`;

const quotedNote: ForumMessage = {
  id: QUOTED_ID,
  name: 'Cyrill',
  text: 'A Quick Technical Note\n\nThe system responsible for automatic payouts operates on the UTC 00:00 standard. This means a new day always begins at 00:00 UTC. For our friends in the Philippines, that is 08:00 PST.',
  createdAt: '2026-09-16T09:50:23.750Z',
  sats: 43,
  payable: true,
  hasPhoto: true,
  photoCount: 1,
  hasVideo: false,
  videoContentType: null,
  role: 'founder',
  replyCount: 0,
};

const parentNote: ForumMessage = {
  id: PARENT_ID,
  name: 'Riana Rosello',
  text: 'Good morning everyone especially to our sponsor.',
  createdAt: '2026-09-16T20:12:43.660Z',
  sats: 21,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'verified',
  replyCount: 1,
};

beforeEach(() => {
  fetchMessage.mockReset();
  fetchForum.mockReset();
  fetchPhoto.mockReset();
  fetchShort.mockReset();
  fetchShort.mockResolvedValue(null);
  fetchAvailable.mockReset();
  translateConversation.mockReset();
  translate.mockReset();
  fetchMessage.mockResolvedValue(null);
  fetchPhoto.mockRejectedValue(new Error('no photo'));
  fetchAvailable.mockResolvedValue(false);
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => 'blob:quoted',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:quoted');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
  vi.restoreAllMocks();
});

describe('ForumQuotedBody', () => {
  it('returns nothing for empty gift-only text without quotes', () => {
    const { container } = renderWithLocale(
      <ForumQuotedBody text="" knownNotes={[]} excludeId={PARENT_ID} rateDay={null} fiat="USD" />,
    );
    expect(container.textContent).toBe('');
    expect(fetchMessage).not.toHaveBeenCalled();
  });

  it('renders ordinary text without fetching when there is no quote url', () => {
    renderWithLocale(
      <ForumQuotedBody
        text="just a note"
        knownNotes={[parentNote]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    expect(screen.getByText('just a note')).toBeTruthy();
    expect(fetchMessage).not.toHaveBeenCalled();
    expect(fetchPhoto).not.toHaveBeenCalled();
  });

  it('translates outgoing button-tone text with button foreground classes', async () => {
    fetchAvailable.mockResolvedValue(true);
    translate.mockResolvedValue('Can anyone lend me a few satoshi this week?');
    renderWithLocale(
      <ForumQuotedBody
        text={german}
        knownNotes={[]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        truncate={false}
        className="mt-2 whitespace-pre-wrap text-sm text-app-btn-fg"
      />,
    );
    const translateButton = await screen.findByRole('button', { name: 'Translate' });
    expect(translateButton.className).toContain('text-app-btn-fg');
    fireEvent.click(translateButton);
    const body = await screen.findByText('Can anyone lend me a few satoshi this week?');
    expect(body.closest('p')?.className).toContain('text-app-btn-fg');
    expect(screen.queryByText(german)).toBeNull();
  });

  it('uses the conversation source only for the remainder, not a nested card', async () => {
    fetchAvailable.mockResolvedValue(true);
    translateConversation.mockResolvedValue({
      translatedText: 'Translated conversation body',
      cached: false,
    });
    translate.mockResolvedValue('Translated nested caption');
    const conversationId = 'conv-1';
    renderWithLocale(
      <ForumQuotedBody
        text={`${german} ${QUOTED_URL}`}
        knownNotes={[{ ...quotedNote, text: german, hasPhoto: false, photoCount: 0 }]}
        excludeId={PARENT_ID}
        conversationId={conversationId}
        rateDay={null}
        fiat="USD"
        truncate={false}
      />,
    );
    const buttons = await screen.findAllByRole('button', { name: 'Translate' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]!);
    await waitFor(() => {
      expect(translateConversation).toHaveBeenCalledWith(conversationId, PARENT_ID, 'en', '');
    });
    fireEvent.click(buttons[1]!);
    await waitFor(() => {
      expect(translate).toHaveBeenCalledWith(QUOTED_ID, 'en', null);
    });
    expect(translateConversation).not.toHaveBeenCalledWith(conversationId, QUOTED_ID, 'en', '');
  });

  it.each([undefined, ''])(
    'keeps the forum source for conversationId %j',
    async (conversationId) => {
      fetchAvailable.mockResolvedValue(true);
      translate.mockResolvedValue('Translated remainder');
      renderWithLocale(
        <ForumQuotedBody
          text={german}
          knownNotes={[]}
          excludeId={PARENT_ID}
          rateDay={null}
          fiat="USD"
          {...(conversationId === undefined ? {} : { conversationId })}
        />,
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
      expect(translate).toHaveBeenCalledWith(PARENT_ID, 'en', null);
      expect(translateConversation).not.toHaveBeenCalled();
    },
  );

  it('loads a missing quote with the session and passes marks through', async () => {
    useAuthStore.setState({ session: 'tok', account: null });
    fetchForum.mockResolvedValue({ ...quotedNote, text: 'Nested' });
    renderWithLocale(
      <ForumQuotedBody
        text={`hello @ada ${QUOTED_URL}`}
        knownNotes={[]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        translate={false}
        mentions={[{ username: 'ada', accountId: 'acc-ada' }]}
      />,
    );
    await waitFor(() => {
      expect(fetchForum).toHaveBeenCalledWith('tok', QUOTED_ID);
    });
    expect(screen.getByRole('button', { name: 'View profile' })).toBeTruthy();
    cleanup();
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(
      <ForumQuotedBody
        text="hello @ada"
        knownNotes={[]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        translate={false}
        truncate={false}
        mentions={[{ username: 'ada', accountId: 'acc-ada' }]}
      />,
    );
    expect(screen.getByRole('button', { name: 'View profile' })).toBeTruthy();
  });

  it('passes marks on a nested note in each body', () => {
    useAuthStore.setState({ session: 'tok', account: null });
    const marked = {
      ...quotedNote,
      accountId: 'acc-cyrill',
      text: 'hi @ada',
      hasPhoto: false,
      photoCount: 0,
      mentions: [{ username: 'ada', accountId: 'acc-ada' }],
    };
    const { unmount } = renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[marked]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    expect(screen.getByRole('button', { name: 'View profile' })).toBeTruthy();
    unmount();
    const plain = renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[marked]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        translate={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'View profile' })).toBeTruthy();
    plain.unmount();
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[marked]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        translate={false}
        truncate={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'View profile' })).toBeTruthy();
  });

  it('links a nested 21.gifts author without opening the quote', async () => {
    useAuthStore.setState({ session: 'tok', account: null });
    const onActivate = vi.fn();
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[{ ...quotedNote, accountId: 'acc-cyrill', text: 'Nested' }]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        onActivate={onActivate}
      />,
    );
    const author = await screen.findByRole('link', { name: 'View profile' });
    expect(author.getAttribute('href')).toBe('/members/acc-cyrill');
    fireEvent.click(author);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('translates a non-nostr nested caption using its forum id and keeps links active', async () => {
    fetchAvailable.mockResolvedValue(true);
    translate.mockResolvedValue('Translated nested caption');
    const caption = `${german} https://example.com/hello`;
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[{ ...quotedNote, text: caption, hasPhoto: false, photoCount: 0 }]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    expect(await screen.findByRole('link', { name: 'https://example.com/hello' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(translate).toHaveBeenCalledWith(QUOTED_ID, 'en', null);
  });

  it('translates a nostr nested caption while keeping its body plain', async () => {
    fetchAvailable.mockResolvedValue(true);
    translate.mockResolvedValue('Translated nested caption');
    const caption = `${german} https://example.com/hello`;
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[
          {
            ...quotedNote,
            role: 'basis',
            via: 'nostr',
            text: caption,
            hasPhoto: false,
            photoCount: 0,
          },
        ]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    expect(await screen.findByText(caption)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /example\.com/ })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(translate).toHaveBeenCalledWith(QUOTED_ID, 'en', null);
  });

  it('renders a non-nostr nested note without Translate when translate is false', async () => {
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[{ ...quotedNote, text: 'Plain nested note' }]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        translate={false}
      />,
    );
    expect(await screen.findByText('Plain nested note')).toBeTruthy();
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[{ ...quotedNote, text: 'Plain nested note' }]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        translate={false}
        truncate={false}
      />,
    );
    expect(screen.getAllByText('Plain nested note').length).toBeGreaterThan(0);
  });

  it('does not offer Translate when translate is false', async () => {
    fetchAvailable.mockResolvedValue(true);
    const conversationId = 'conv-msg-1';
    renderWithLocale(
      <ForumQuotedBody
        text={german}
        knownNotes={[]}
        excludeId={conversationId}
        rateDay={null}
        fiat="USD"
        truncate={false}
        translate={false}
      />,
    );
    expect(screen.getByText(german)).toBeTruthy();
    await act(async () => undefined);
    expect(screen.queryByRole('button', { name: 'Translate' })).toBeNull();
    expect(fetchAvailable).not.toHaveBeenCalled();
    expect(translate).not.toHaveBeenCalled();
  });

  it('renders ForumNoteText when translate is false and truncate is default', async () => {
    fetchAvailable.mockResolvedValue(true);
    renderWithLocale(
      <ForumQuotedBody
        text={german}
        knownNotes={[]}
        excludeId="conv-msg-2"
        rateDay={null}
        fiat="USD"
        translate={false}
      />,
    );
    expect(screen.getByText(german)).toBeTruthy();
    await act(async () => undefined);
    expect(screen.queryByRole('button', { name: 'Translate' })).toBeNull();
  });

  it('shows stored fiat on the nested post when the live rate differs', async () => {
    renderWithLocale(
      <ForumQuotedBody
        text={`just for information: ${QUOTED_URL}`}
        knownNotes={[{ ...quotedNote, amountUsd: '5.00' }]}
        excludeId={PARENT_ID}
        rateDay={{
          sats: 100_000_000,
          usd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
        }}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('A Quick Technical Note', { exact: false })).toBeTruthy();
    });
    expect(screen.getByText('₿43')).toBeTruthy();
    expect(screen.getByText('$5.00')).toBeTruthy();
    expect(screen.queryByText('$0.04')).toBeNull();
  });

  it('shows the live viewer fiat on a nested post that stored no fiat', async () => {
    renderWithLocale(
      <ForumQuotedBody
        text={`just for information: ${QUOTED_URL}`}
        knownNotes={[quotedNote]}
        excludeId={PARENT_ID}
        rateDay={{
          sats: 100_000_000,
          usd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
        }}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('A Quick Technical Note', { exact: false })).toBeTruthy();
    });
    expect(screen.getByText('₿43')).toBeTruthy();
    expect(screen.getByText('$0.04')).toBeTruthy();
  });

  it('ignores a quoted-note resolve if the body unmounts during fetch', async () => {
    let resolveMessage: ((note: ForumMessage | null) => void) | undefined;
    fetchMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMessage = resolve;
        }),
    );
    const { unmount } = renderWithLocale(
      <ForumQuotedBody
        text={`just for information: ${QUOTED_URL}`}
        knownNotes={[]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(fetchMessage).toHaveBeenCalledWith(QUOTED_ID);
    });
    unmount();
    resolveMessage?.(quotedNote);
    await Promise.resolve();
    expect(screen.queryByRole('link', { name: 'Open linked note from Cyrill' })).toBeNull();
  });

  it('ignores a photo blob if the nested post unmounts during fetch', async () => {
    let resolvePhoto: ((blob: Blob) => void) | undefined;
    fetchPhoto.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePhoto = resolve;
        }),
    );
    const { unmount } = renderWithLocale(
      <ForumQuotedBody
        text={`just for information: ${QUOTED_URL}`}
        knownNotes={[quotedNote]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(fetchPhoto).toHaveBeenCalledWith(QUOTED_ID);
    });
    unmount();
    resolvePhoto?.(new Blob(['photo'], { type: 'image/jpeg' }));
    await Promise.resolve();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('renders a nested post with no caption when the quoted note has empty text', async () => {
    const giftOnly: ForumMessage = { ...quotedNote, text: '', hasPhoto: false, photoCount: 0 };
    renderWithLocale(
      <ForumQuotedBody
        text={`just for information: ${QUOTED_URL}`}
        knownNotes={[giftOnly]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Open linked note from Cyrill' })).toBeTruthy();
    });
    expect(screen.getByText('₿43')).toBeTruthy();
    expect(screen.queryByText('A Quick Technical Note')).toBeNull();
  });

  it('fills a quoted note from knownNotes without fetching', async () => {
    renderWithLocale(
      <ForumQuotedBody
        text={`just for information: ${QUOTED_URL}`}
        knownNotes={[parentNote, quotedNote]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('A Quick Technical Note', { exact: false })).toBeTruthy();
    });
    expect(screen.getByText('just for information:')).toBeTruthy();
    expect(screen.queryByText(QUOTED_URL)).toBeNull();
    expect(screen.getByText('Cyrill')).toBeTruthy();
    expect(screen.getByText('Founder')).toBeTruthy();
    expect(screen.getByText('₿43')).toBeTruthy();
    expect(fetchMessage).not.toHaveBeenCalled();
    const link = screen.getByRole('link', { name: 'Open linked note from Cyrill' });
    expect(link.getAttribute('href')).toBe(`/messages/${QUOTED_ID}`);
  });

  it('fetches a missing quoted note and strips the url after it resolves', async () => {
    fetchMessage.mockImplementation(async (id: string) => (id === QUOTED_ID ? quotedNote : null));
    fetchPhoto.mockResolvedValue(new Blob(['photo'], { type: 'image/jpeg' }));
    renderWithLocale(
      <ForumQuotedBody
        text={`just for information: ${QUOTED_URL}`}
        knownNotes={[parentNote]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    expect(screen.getByText('just for information:')).toBeTruthy();
    expect(screen.getByRole('link', { name: QUOTED_URL }).getAttribute('href')).toBe(
      `/messages/${QUOTED_ID}`,
    );
    await waitFor(() => {
      expect(screen.getByText('just for information:')).toBeTruthy();
      expect(screen.queryByRole('link', { name: QUOTED_URL })).toBeNull();
    });
    expect(screen.queryByText(QUOTED_URL)).toBeNull();
    expect(fetchMessage).toHaveBeenCalledWith(QUOTED_ID);
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Cyrill')).toBeTruthy();
    });
    expect(screen.getByAltText('Photo from Cyrill').className.split(/\s+/)).toEqual(
      expect.arrayContaining([
        'block',
        'h-auto',
        'max-h-80',
        'w-full',
        'shrink-0',
        'rounded-xl',
        'object-contain',
      ]),
    );
    expect(fetchPhoto).toHaveBeenCalledWith(QUOTED_ID);
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('leaves the url visible when fetchPublicMessage returns null', async () => {
    fetchMessage.mockResolvedValue(null);
    renderWithLocale(
      <ForumQuotedBody
        text={`see ${QUOTED_URL}`}
        knownNotes={[]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(fetchMessage).toHaveBeenCalledWith(QUOTED_ID);
    });
    expect(screen.getByText('see', { exact: false })).toBeTruthy();
    expect(screen.getByRole('link', { name: QUOTED_URL }).getAttribute('href')).toBe(
      `/messages/${QUOTED_ID}`,
    );
    expect(screen.queryByRole('link', { name: 'Open linked note from Cyrill' })).toBeNull();
  });

  it('leaves the url visible when fetchPublicMessage throws', async () => {
    fetchMessage.mockRejectedValue(new Error('offline'));
    renderWithLocale(
      <ForumQuotedBody
        text={`see ${QUOTED_URL}`}
        knownNotes={[]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(fetchMessage).toHaveBeenCalledWith(QUOTED_ID);
    });
    expect(screen.getByRole('link', { name: QUOTED_URL }).getAttribute('href')).toBe(
      `/messages/${QUOTED_ID}`,
    );
  });

  it('does not quote the note that contains the url', async () => {
    const selfNote: ForumMessage = {
      ...quotedNote,
      text: `loop ${QUOTED_URL}`,
    };
    renderWithLocale(
      <ForumQuotedBody
        text={selfNote.text}
        knownNotes={[selfNote]}
        excludeId={QUOTED_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    expect(screen.getByRole('link', { name: QUOTED_URL }).getAttribute('href')).toBe(
      `/messages/${QUOTED_ID}`,
    );
    expect(fetchMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Open linked note from Cyrill' })).toBeNull();
  });

  it('does not unfurl urls inside a nested caption', async () => {
    const nestedCaption: ForumMessage = {
      ...quotedNote,
      text: `caption https://21.gifts/messages/${PARENT_ID}`,
    };
    renderWithLocale(
      <ForumQuotedBody
        text={`just for information: ${QUOTED_URL}`}
        knownNotes={[nestedCaption, parentNote]}
        excludeId="322f9dea-4a76-5168-91b8-430432e5f90b"
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('caption', { exact: false })).toBeTruthy();
    });
    const nestedLink = screen.getByRole('link', {
      name: `https://21.gifts/messages/${PARENT_ID}`,
    });
    expect(nestedLink.getAttribute('href')).toBe(`/messages/${PARENT_ID}`);
    expect(screen.queryByText('Good morning everyone especially to our sponsor.')).toBeNull();
  });

  it('omits the paragraph when stripping leaves no display text', async () => {
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[quotedNote]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('A Quick Technical Note', { exact: false })).toBeTruthy();
    });
    expect(screen.queryByText(QUOTED_URL)).toBeNull();
    expect(screen.getByRole('link', { name: 'Open linked note from Cyrill' })).toBeTruthy();
  });

  it('calls onActivate then lets the nested link navigate', async () => {
    const onActivate = vi.fn();
    renderWithLocale(
      <ForumQuotedBody
        text={`just for information: ${QUOTED_URL}`}
        knownNotes={[quotedNote]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        onActivate={onActivate}
      />,
    );
    const link = screen.getByRole('link', { name: 'Open linked note from Cyrill' });
    fireEvent.click(link);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('does not render a role pill for basis authors', async () => {
    const basisNote: ForumMessage = {
      ...quotedNote,
      name: 'Ada',
      role: 'basis',
      hasPhoto: false,
      photoCount: 0,
      text: 'plain',
    };
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[basisNote]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('plain')).toBeTruthy();
    });
    expect(screen.queryByText('Founder')).toBeNull();
    expect(screen.queryByText('Verified')).toBeNull();
    expect(screen.queryByText('Moderator')).toBeNull();
  });

  it('collapses long remaining text behind Show more on the feed', () => {
    const text = `${'a'.repeat(280)} TAILTOKEN`;
    renderWithLocale(
      <ForumQuotedBody
        text={text}
        knownNotes={[]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();
    expect(screen.queryByText(/TAILTOKEN/)).toBeNull();
  });

  it('keeps the full remaining text when truncate is off', () => {
    const text = `${'a'.repeat(280)} TAILTOKEN`;
    renderWithLocale(
      <ForumQuotedBody
        text={text}
        knownNotes={[]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        truncate={false}
      />,
    );
    expect(screen.getByText(/TAILTOKEN/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('collapses a long nested quoted note behind Show more', async () => {
    const longQuoted: ForumMessage = { ...quotedNote, text: `${'a'.repeat(280)} TAILTOKEN` };
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[longQuoted]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Show more' }).closest('a')).toBeNull();
    expect(screen.queryByText(/TAILTOKEN/)).toBeNull();
  });

  it('does not offer Translate on a nested nostr card when translate is false', async () => {
    fetchAvailable.mockResolvedValue(true);
    const viaQuoted: ForumMessage = {
      ...quotedNote,
      role: 'basis',
      via: 'nostr',
      hasPhoto: false,
      photoCount: 0,
    };
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[viaQuoted]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        translate={false}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('A Quick Technical Note', { exact: false })).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Translate' })).toBeNull();
    expect(fetchAvailable).not.toHaveBeenCalled();
  });

  it('keeps a nested nostr url as plain text when translate is false', async () => {
    fetchAvailable.mockResolvedValue(true);
    const viaQuoted: ForumMessage = {
      ...quotedNote,
      role: 'basis',
      via: 'nostr',
      hasPhoto: false,
      photoCount: 0,
      text: 'Greetings! https://example.com/hello',
    };
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[viaQuoted]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        translate={false}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('External')).toBeTruthy();
    });
    expect(screen.getByText('Greetings! https://example.com/hello')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /example\.com/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Translate' })).toBeNull();
  });

  it('keeps a nested nostr url plain when translate is false and truncate is off', async () => {
    fetchAvailable.mockResolvedValue(true);
    const viaQuoted: ForumMessage = {
      ...quotedNote,
      role: 'basis',
      via: 'nostr',
      hasPhoto: false,
      photoCount: 0,
      text: 'Greetings! https://example.com/hello',
    };
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[viaQuoted]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        translate={false}
        truncate={false}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('External')).toBeTruthy();
    });
    expect(screen.getByText('Greetings! https://example.com/hello')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /example\.com/ })).toBeNull();
  });

  it('strips quote urls from the visible translation and keeps the nested card', async () => {
    fetchAvailable.mockResolvedValue(true);
    translate.mockResolvedValue(`Can anyone lend me a few satoshi this week? ${QUOTED_URL}`);
    renderWithLocale(
      <ForumQuotedBody
        text={`${german} ${QUOTED_URL}`}
        knownNotes={[{ ...quotedNote, hasPhoto: false, photoCount: 0 }]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        truncate={false}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('A Quick Technical Note', { exact: false })).toBeTruthy();
    });
    expect(screen.getByText(german)).toBeTruthy();
    expect(screen.queryByText(QUOTED_URL)).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByText('Can anyone lend me a few satoshi this week?')).toBeTruthy();
    expect(screen.queryByText(QUOTED_URL)).toBeNull();
    expect(screen.queryByText(german)).toBeNull();
    expect(screen.getByText('A Quick Technical Note', { exact: false })).toBeTruthy();
  });

  it('applies formatTranslated to the visible remainder after stripping quote urls', async () => {
    fetchAvailable.mockResolvedValue(true);
    translate.mockResolvedValue(`Can anyone lend me a few satoshi this week? ${QUOTED_URL}`);
    renderWithLocale(
      <ForumQuotedBody
        text={`${german} ${QUOTED_URL}`}
        knownNotes={[{ ...quotedNote, hasPhoto: false, photoCount: 0 }]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        truncate={false}
        formatTranslated={(translated) => translated.replace('satoshi', 'sats')}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByText('Can anyone lend me a few sats this week?')).toBeTruthy();
    expect(screen.queryByText(QUOTED_URL)).toBeNull();
  });

  it('shows an External badge on a nested quoted note and keeps the url as plain text', async () => {
    const viaQuoted: ForumMessage = {
      ...quotedNote,
      role: 'basis',
      via: 'nostr',
      hasPhoto: false,
      photoCount: 0,
      text: 'Greetings! https://example.com/hello',
    };
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[viaQuoted]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('External')).toBeTruthy();
    });
    expect(screen.getByText('Greetings! https://example.com/hello')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /example\.com/ })).toBeNull();
    expect(screen.queryByText('Founder')).toBeNull();
  });

  it('uses the external aria-label for a quoted note with via nostr', async () => {
    const viaQuoted: ForumMessage = {
      ...quotedNote,
      role: 'basis',
      via: 'nostr',
      name: 'Robin',
      hasPhoto: false,
      photoCount: 0,
    };
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[viaQuoted]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: 'Open linked note from Robin (external)' }),
      ).toBeTruthy();
    });
  });

  it('keeps a long nested via note full when truncate is off', async () => {
    const viaQuoted: ForumMessage = {
      ...quotedNote,
      role: 'basis',
      via: 'nostr',
      hasPhoto: false,
      photoCount: 0,
      text: `${'a'.repeat(280)} https://example.com/hello`,
    };
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[viaQuoted]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        truncate={false}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(viaQuoted.text)).toBeTruthy();
    });
    expect(screen.getByText('External')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(screen.queryByRole('link', { name: /example\.com/ })).toBeNull();
  });

  it('keeps a long nested quoted note full when truncate is off', async () => {
    const longQuoted: ForumMessage = { ...quotedNote, text: `${'a'.repeat(280)} TAILTOKEN` };
    renderWithLocale(
      <ForumQuotedBody
        text={QUOTED_URL}
        knownNotes={[longQuoted]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
        truncate={false}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/TAILTOKEN/)).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  const SHORT_URL = 'https://21.gifts/l/d8cd22dd';
  const plainQuoted: ForumMessage = { ...quotedNote, hasPhoto: false, photoCount: 0 };

  it('resolves a short link from known notes and strips it', async () => {
    fetchShort.mockResolvedValue({ kind: 'message', id: QUOTED_ID.toUpperCase() });
    renderWithLocale(
      <ForumQuotedBody
        text={`just for information: ${SHORT_URL}`}
        knownNotes={[plainQuoted]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Open linked note from Cyrill' })).toBeTruthy();
    });
    expect(screen.getByText('just for information:')).toBeTruthy();
    expect(screen.queryByText(SHORT_URL)).toBeNull();
    expect(fetchShort).toHaveBeenCalledWith('d8cd22dd');
    expect(fetchMessage).not.toHaveBeenCalled();
    expect(
      screen.getByRole('link', { name: 'Open linked note from Cyrill' }).getAttribute('href'),
    ).toBe(`/messages/${QUOTED_ID}`);
  });

  it('fetches a short-linked note that is not already known', async () => {
    fetchShort.mockResolvedValue({ kind: 'message', id: QUOTED_ID });
    fetchMessage.mockResolvedValue(plainQuoted);
    renderWithLocale(
      <ForumQuotedBody
        text={`see ${SHORT_URL}`}
        knownNotes={[]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: SHORT_URL })).toBeNull();
    });
    expect(fetchMessage).toHaveBeenCalledWith(QUOTED_ID);
    expect(screen.getByText('A Quick Technical Note', { exact: false })).toBeTruthy();
  });

  it('leaves a member short link in the text', async () => {
    const memberUrl = 'https://21.gifts/l/22222222';
    fetchShort.mockResolvedValue({
      kind: 'member',
      id: '22222222-2222-4222-8222-222222222222',
    });
    renderWithLocale(
      <ForumQuotedBody
        text={`hi ${memberUrl} there`}
        knownNotes={[]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(fetchShort).toHaveBeenCalledWith('22222222');
    });
    expect(screen.getByRole('link', { name: memberUrl })).toBeTruthy();
    expect(fetchMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Open linked note from Cyrill' })).toBeNull();
  });

  it('leaves a short link that does not resolve', async () => {
    fetchShort.mockResolvedValue(null);
    renderWithLocale(
      <ForumQuotedBody
        text={`see ${SHORT_URL}`}
        knownNotes={[]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(fetchShort).toHaveBeenCalledWith('d8cd22dd');
    });
    expect(screen.getByRole('link', { name: SHORT_URL })).toBeTruthy();
    expect(fetchMessage).not.toHaveBeenCalled();
  });

  it('does not quote a short link to the note that contains it', async () => {
    fetchShort.mockResolvedValue({ kind: 'message', id: QUOTED_ID });
    renderWithLocale(
      <ForumQuotedBody
        text={`loop ${SHORT_URL}`}
        knownNotes={[plainQuoted]}
        excludeId={QUOTED_ID.toUpperCase()}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(fetchShort).toHaveBeenCalledWith('d8cd22dd');
    });
    expect(screen.getByRole('link', { name: SHORT_URL })).toBeTruthy();
    expect(fetchMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Open linked note from Cyrill' })).toBeNull();
  });

  it('keeps a short link when the public note fails to load', async () => {
    fetchShort.mockResolvedValue({ kind: 'message', id: QUOTED_ID });
    fetchMessage.mockResolvedValue(null);
    renderWithLocale(
      <ForumQuotedBody
        text={`see ${SHORT_URL}`}
        knownNotes={[]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(fetchMessage).toHaveBeenCalledWith(QUOTED_ID);
    });
    expect(screen.getByRole('link', { name: SHORT_URL })).toBeTruthy();
    cleanup();
    fetchMessage.mockRejectedValueOnce(new Error('offline'));
    renderWithLocale(
      <ForumQuotedBody
        text={`again ${SHORT_URL}`}
        knownNotes={[]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('link', { name: SHORT_URL })).toBeTruthy();
    });
  });

  it('shows one card when a short link and a uuid quote name the same note', async () => {
    fetchShort.mockResolvedValue({ kind: 'message', id: QUOTED_ID });
    renderWithLocale(
      <ForumQuotedBody
        text={`see ${SHORT_URL} and ${QUOTED_URL}`}
        knownNotes={[plainQuoted]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(screen.queryByText(SHORT_URL)).toBeNull();
      expect(screen.queryByText(QUOTED_URL)).toBeNull();
    });
    expect(screen.getAllByRole('link', { name: 'Open linked note from Cyrill' })).toHaveLength(1);
    expect(fetchMessage).not.toHaveBeenCalled();
  });

  it('lowercases an uppercase short code before resolving it', async () => {
    fetchShort.mockResolvedValue({ kind: 'message', id: QUOTED_ID });
    renderWithLocale(
      <ForumQuotedBody
        text="see https://21.gifts/l/D8CD22DD"
        knownNotes={[plainQuoted]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(fetchShort).toHaveBeenCalledWith('d8cd22dd');
    });
    expect(fetchShort).toHaveBeenCalledTimes(1);
  });

  it('does not store a short link resolved after unmount', async () => {
    let resolveLink: (value: { kind: 'message'; id: string } | null) => void = () => undefined;
    fetchShort.mockImplementation(
      () =>
        new Promise<{ kind: 'message'; id: string } | null>((resolve) => {
          resolveLink = resolve;
        }),
    );
    const { unmount } = renderWithLocale(
      <ForumQuotedBody
        text={`see ${SHORT_URL}`}
        knownNotes={[]}
        excludeId={PARENT_ID}
        rateDay={null}
        fiat="USD"
      />,
    );
    await waitFor(() => {
      expect(fetchShort).toHaveBeenCalledWith('d8cd22dd');
    });
    unmount();
    resolveLink({ kind: 'message', id: QUOTED_ID });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMessage).not.toHaveBeenCalled();
  });
});
