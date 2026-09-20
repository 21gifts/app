'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  ForumBoard,
  type ForumFormError,
  type ForumPayError,
  type ForumPayInvoice,
  type ForumReplyFormError,
} from '@/components/ForumBoard';
import { RequirementsOverlay } from '@/components/RequirementsOverlay';
import {
  fetchComposeTarget,
  fetchGiftStats,
  fetchMessagePhoto,
  fetchPublicMessage,
  fetchReplies,
  postMessage,
  postMessageInvoice,
} from '@/lib/api';
import { FORUM_MESSAGE_MAX_LENGTH, type ForumMessage } from '@/lib/api-types';
import { MissingRequirementsError, nextPostRequirement } from '@/lib/missing-requirements';
import { isReplyPaymentExempt } from '@/lib/roles';
import { latestRateDay, type FiatRateDay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

/** Delay between pay polls (ms). */
const PAY_POLL_MS = 2000;

/** Default invoice amount when the pay or gift-only reply amount field is empty or whitespace-only. */
const DEFAULT_FORUM_PAY_SATS = 21;

/**
 * Parses the reply-composer sats draft.
 *
 * @param raw - Amount field value.
 * @returns Whole sats (`0` becomes `1`), `'empty'` when blank, or `'invalid'`.
 */
function parseReplySats(raw: string): number | 'empty' | 'invalid' {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return 'empty';
  }
  if (!/^\d+$/.test(trimmed)) {
    return 'invalid';
  }
  const sats = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(sats)) {
    return 'invalid';
  }
  return sats < 1 ? 1 : sats;
}

/**
 * True when the api rejected an unpaid reply.
 *
 * @param err - Caught rejection.
 * @returns Whether the message is the unpaid-reply copy.
 */
function isReplyPaymentError(err: unknown): boolean {
  /* v8 ignore next 3 -- non-Error throw is defensive */
  if (!(err instanceof Error)) {
    return false;
  }
  return /reply needs a bitcoin payment/i.test(err.message);
}

/**
 * True when a thrown value is the api rate-limit copy for posts or payments.
 *
 * @param err - Caught rejection.
 * @returns Whether the message looks like a rate-limit error.
 */
function isRateLimitError(err: unknown): boolean {
  /* v8 ignore next 3 -- non-Error throw is defensive */
  if (!(err instanceof Error)) {
    return false;
  }
  return /too many (messages|payments)/i.test(err.message);
}

/**
 * True when the api rejected a zap because the author's wallet cannot receive.
 *
 * @param err - Caught rejection.
 * @returns Whether the message looks like an author's-wallet error.
 */
function isAuthorWalletError(err: unknown): boolean {
  /* v8 ignore next 3 -- non-Error throw is defensive; pay path always rejects with Error */
  if (!(err instanceof Error)) {
    return false;
  }
  return /author's wallet cannot receive this Bitcoin payment/i.test(err.message);
}

/* v8 ignore start -- ForumBoard defaults for a composerHidden permalink board */
const IDLE_BOARD = {
  error: false,
  loading: false,
  posting: false,
  draft: '',
  onDraftChange: (): void => undefined,
  askDraft: '',
  onAskDraftChange: (): void => undefined,
  onPost: (): void => undefined,
  onRetry: (): void => undefined,
  formError: null as ForumFormError,
  payMessageId: null as string | null,
  payDraft: '',
  payBusy: false,
  payError: null as ForumPayError,
  payInvoice: null as ForumPayInvoice | null,
  payWaiting: false,
  onPayOpen: (): void => undefined,
  onPayDraftChange: (): void => undefined,
  onPaySubmit: (): void => undefined,
  onPayCancel: (): void => undefined,
  mode: 'all' as const,
  onModeChange: (): void => undefined,
  lawsVisible: false,
  onDismissLaws: (): void => undefined,
  photoDrafts: [],
  onPickFiles: (): void => undefined,
  onRemovePhoto: (): void => undefined,
  onClearPhoto: (): void => undefined,
  photoUrls: {},
  expandedId: null as string | null,
  onToggleExpand: (): void => undefined,
  replies: null as ForumMessage[] | null,
  repliesLoading: false,
  repliesError: false,
  onRetryReplies: (): void => undefined,
  replyDraft: '',
  onReplyDraftChange: (): void => undefined,
  onReplyPost: (): void => undefined,
  replyPosting: false,
  replyFormError: null as ForumReplyFormError,
  composerHidden: true,
};
/* v8 ignore stop */

/**
 * Appends the opened hidden permalink reply when Bearer replies omit it.
 *
 * @param list - Replies returned by `fetchReplies`.
 * @param seed - Opened hidden reply, if the route id is that child.
 * @param rootId - Public parent id.
 * @param expandedId - Id passed to that `fetchReplies` call.
 * @returns `list`, or `list` plus `seed` when the guards pass.
 */
function withSeededHiddenReply(
  list: ForumMessage[],
  seed: ForumMessage | undefined,
  rootId: string,
  expandedId: string,
): ForumMessage[] {
  if (
    seed === undefined ||
    expandedId !== rootId ||
    seed.parentId !== rootId ||
    seed.deletedAt === undefined ||
    list.some((row) => row.id === seed.id)
  ) {
    return list;
  }
  return [...list, seed];
}

/**
 * Signed-in permalink thread: one root note on {@link ForumBoard} with the
 * same copy, expand/reply, photo, translate, and staff delete actions as
 * `/welcome`. Gift only on a payable nested reply. Auto-expands the root so
 * the thread and in-card reply composer are available. No top-level composer,
 * feed filters, or envelope.
 *
 * @param props - Public parent note, optional reply highlight id, optional
 *   seedReply (hidden permalink reply kept after Bearer refetch), root-delete hook.
 * @returns The interactive thread board and requirements overlay.
 */
export function PublicMessageThread(props: {
  root: ForumMessage;
  /** Route id when it is a reply UUID; otherwise null. */
  highlightId: string | null;
  /** Hidden permalink reply kept after Bearer refetch. */
  seedReply?: ForumMessage;
  /** After a successful staff delete of the root note. */
  onRootDeleted: () => void;
}): ReactElement {
  const { root, highlightId, seedReply, onRootDeleted } = props;
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [note, setNote] = useState(root);
  const [payMessageId, setPayMessageId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<ForumPayError>(null);
  const [payInvoice, setPayInvoice] = useState<ForumPayInvoice | null>(null);
  const [payWaiting, setPayWaiting] = useState(false);
  const payPollAbortRef = useRef<AbortController | null>(null);
  const payPollGeneration = useRef(0);
  const [expandedId, setExpandedId] = useState<string | null>(root.id);
  const expandedIdRef = useRef(expandedId);
  expandedIdRef.current = expandedId;
  const expandGen = useRef(0);
  const [replies, setReplies] = useState<ForumMessage[] | null>(null);
  const repliesRef = useRef(replies);
  repliesRef.current = replies;
  const [repliesLoading, setRepliesLoading] = useState(true);
  const [repliesError, setRepliesError] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyAmountDraft, setReplyAmountDraft] = useState('');
  const [replyPosting, setReplyPosting] = useState(false);
  const [replyFormError, setReplyFormError] = useState<ForumReplyFormError>(null);
  const [overlayRequirement, setOverlayRequirement] = useState<
    'name' | 'username' | 'rules' | 'lightning-address' | null
  >(null);
  const pendingPostRef = useRef<(() => Promise<void>) | null>(null);
  const [rateDay, setRateDay] = useState<FiatRateDay | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photoUrlsRef = useRef(photoUrls);
  photoUrlsRef.current = photoUrls;

  const photoSource: ForumMessage[] = [note];
  if (replies !== null) {
    photoSource.push(...replies);
  }
  const photoSourceRef = useRef(photoSource);
  photoSourceRef.current = photoSource;
  const photoIdsKey = photoSource
    .map((message) => ({
      id: message.id,
      count: message.photoCount ?? (message.hasPhoto ? 1 : 0),
    }))
    .filter(({ count }) => count > 0)
    .map(({ id, count }) => `${id}:${count}`)
    .sort()
    .join('\0');

  useEffect(() => {
    let cancelled = false;
    void fetchGiftStats()
      .then((stats) => {
        if (!cancelled) {
          setRateDay(latestRateDay(stats.spendOverTime));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRateDay(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (session === null || photoIdsKey === '') {
      return;
    }
    const listed = photoSourceRef.current;
    let cancelled = false;
    const missing = listed.flatMap((message) => {
      const count = message.photoCount ?? (message.hasPhoto ? 1 : 0);
      return Array.from({ length: count }, (_, index) => ({
        id: message.id,
        index,
        key: `${message.id}:${index}`,
      })).filter(({ key }) => photoUrlsRef.current[key] === undefined);
    });
    if (missing.length === 0) {
      return;
    }
    void (async () => {
      for (const photo of missing) {
        /* v8 ignore start -- skip ids filled while earlier fetches in this loop ran */
        if (photoUrlsRef.current[photo.key] !== undefined) {
          continue;
        }
        /* v8 ignore stop */
        let blob: Blob;
        try {
          blob = await fetchMessagePhoto(session, photo.id, photo.index);
        } catch {
          /* v8 ignore next 3 -- unmount during the first photo fetch */
          if (cancelled) {
            return;
          }
          try {
            blob = await fetchMessagePhoto(session, photo.id, photo.index);
          } catch {
            /* v8 ignore next 3 -- unmount during the photo retry */
            if (cancelled) {
              return;
            }
            // Leave the row text-only when the photo cannot load.
            continue;
          }
        }
        /* v8 ignore next 3 -- unmount after the photo blob resolved */
        if (cancelled) {
          return;
        }
        const url = URL.createObjectURL(blob);
        /* v8 ignore next 4 -- unmount after createObjectURL */
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setPhotoUrls((prev) => {
          /* v8 ignore start -- race if the same id was filled while the fetch was in flight */
          if (prev[photo.key] !== undefined) {
            URL.revokeObjectURL(url);
            return prev;
          }
          /* v8 ignore stop */
          return { ...prev, [photo.key]: url };
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photoIdsKey, session]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(photoUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const bumpPayPollGeneration = (): number => {
    payPollAbortRef.current?.abort();
    payPollAbortRef.current = new AbortController();
    payPollGeneration.current += 1;
    return payPollGeneration.current;
  };

  useEffect(() => {
    return () => {
      bumpPayPollGeneration();
    };
  }, []);

  useEffect(() => {
    const gen = ++expandGen.current;
    setExpandedId(root.id);
    setReplies(null);
    setRepliesLoading(true);
    setRepliesError(false);
    setReplyDraft('');
    setReplyAmountDraft('');
    setReplyFormError(null);
    if (session === null) {
      setRepliesLoading(false);
      setRepliesError(true);
      return;
    }
    const token = session;
    const messageId = root.id;
    void (async () => {
      try {
        const next = await fetchReplies(token, messageId);
        if (expandGen.current === gen) {
          setReplies(withSeededHiddenReply(next, seedReply, root.id, messageId));
        }
      } catch {
        if (expandGen.current === gen) {
          setRepliesError(true);
        }
      } finally {
        if (expandGen.current === gen) {
          setRepliesLoading(false);
        }
      }
    })();
  }, [root.id, session]);

  const startPayPoll = (messageId: string, baselineSats: number): void => {
    const generation = bumpPayPollGeneration();
    const controller = payPollAbortRef.current;
    /* v8 ignore next 3 -- bumpPayPollGeneration always assigns a controller */
    if (controller === null) {
      return;
    }
    const signal = controller.signal;
    setPayWaiting(true);
    void (async () => {
      for (;;) {
        try {
          const next = await fetchPublicMessage(messageId, {
            sinceSats: baselineSats,
            signal,
          });
          /* v8 ignore start -- poll aborted or superseded before the body is applied */
          if (generation !== payPollGeneration.current || signal.aborted) {
            return;
          }
          /* v8 ignore stop */
          if (next !== null && next.sats > baselineSats) {
            setNote((prev) => {
              if (prev.id !== next.id) {
                return prev;
              }
              return {
                ...prev,
                ...next,
                replyCount: Math.max(prev.replyCount, next.replyCount),
              };
            });
            setReplies((prev) => {
              /* v8 ignore next 3 -- poll can finish after the thread failed to load replies */
              if (prev === null) {
                return prev;
              }
              return prev.map((row) => {
                if (row.id !== next.id) {
                  return row;
                }
                return { ...row, ...next };
              });
            });
            setPayWaiting(false);
            setPayInvoice(null);
            setPayMessageId(null);
            setPayDraft('');
            setPayError(null);
            const current = useAuthStore.getState();
            /* v8 ignore next 3 -- session cleared while the pay poll was in flight */
            if (current.session !== session) {
              return;
            }
            if (current.account !== null) {
              setAccount({ ...current.account, hasPosted: true });
            }
            const threadId = expandedIdRef.current;
            /* v8 ignore next -- permalink auto-expand has replies loaded before a poll settles */
            const paidNestedReply = (repliesRef.current ?? []).some((row) => row.id === messageId);
            if (threadId !== null && current.session !== null && !paidNestedReply) {
              const gen = ++expandGen.current;
              setRepliesLoading(true);
              setRepliesError(false);
              try {
                const repliesNext = await fetchReplies(current.session, threadId);
                if (expandGen.current === gen) {
                  setReplies(withSeededHiddenReply(repliesNext, seedReply, root.id, threadId));
                }
              } catch {
                if (expandGen.current === gen) {
                  setRepliesError(true);
                }
              } finally {
                if (expandGen.current === gen) {
                  setRepliesLoading(false);
                }
              }
            }
            return;
          }
        } catch {
          // Keep waiting while the sheet is open.
        }
        /* v8 ignore next 3 -- poll aborted or superseded after a wait */
        if (generation !== payPollGeneration.current || signal.aborted) {
          return;
        }
        await new Promise((resolve) => {
          setTimeout(resolve, PAY_POLL_MS);
        });
        /* v8 ignore next 3 -- poll superseded after the delay */
        if (generation !== payPollGeneration.current) {
          return;
        }
      }
    })();
  };

  const openOverlayForMissing = (missing: readonly string[]): boolean => {
    const next = nextPostRequirement(missing);
    if (next === null) {
      return false;
    }
    setOverlayRequirement(next);
    return true;
  };

  const runReplyPost = async (
    token: string,
    trimmed: string,
    parentId: string,
    isRetry: boolean,
  ): Promise<void> => {
    setReplyPosting(true);
    setReplyFormError(null);
    try {
      const created = await postMessage(token, { text: trimmed, inReplyTo: parentId });
      let alreadyListed = false;
      if (expandedIdRef.current === parentId) {
        setReplies((prev) => {
          /* v8 ignore next 3 -- composer only posts after the thread loaded */
          if (prev === null) {
            return [created];
          }
          alreadyListed = prev.some((message) => message.id === created.id);
          /* v8 ignore next 3 -- duplicate id already in the list */
          if (alreadyListed) {
            return prev;
          }
          return [...prev, created];
        });
        setReplyDraft('');
      }
      if (!alreadyListed) {
        setNote((prev) => ({
          ...prev,
          replyCount: Math.max(prev.replyCount, prev.replyCount + 1),
        }));
      }
      setReplyAmountDraft('');
      pendingPostRef.current = null;
      const current = useAuthStore.getState();
      /* v8 ignore next 3 -- session cleared while the unpaid reply POST was in flight */
      if (current.session !== token || current.account === null) {
        return;
      }
      setAccount({ ...current.account, hasPosted: true });
    } catch (err) {
      if (err instanceof MissingRequirementsError) {
        if (!isRetry && openOverlayForMissing(err.missing)) {
          pendingPostRef.current = () => runReplyPost(token, trimmed, parentId, true);
          return;
        }
        if (expandedIdRef.current === parentId) {
          setReplyFormError('request');
        }
        return;
      }
      if (isReplyPaymentError(err)) {
        await runComposePay(token, trimmed, parentId, 1, isRetry);
        return;
      }
      if (expandedIdRef.current === parentId) {
        setReplyFormError(isRateLimitError(err) ? 'rateLimit' : 'request');
      }
    } finally {
      setReplyPosting(false);
    }
  };

  const runComposePay = async (
    token: string,
    trimmed: string,
    parentId: string,
    sats: number,
    isRetry: boolean,
  ): Promise<void> => {
    setReplyPosting(true);
    setReplyFormError(null);
    const generation = payPollGeneration.current;
    try {
      const target = await fetchComposeTarget(token);
      const invoice = await postMessageInvoice(
        token,
        target.messageId,
        sats,
        `inReplyTo:${parentId}\n${trimmed}`,
      );
      /* v8 ignore next 3 -- pay sheet closed while the compose invoice was minting */
      if (generation !== payPollGeneration.current) {
        return;
      }
      setPayMessageId(target.messageId);
      setPayError(null);
      setPayInvoice({
        messageId: target.messageId,
        pr: invoice.pr,
        amountSats: invoice.amountSats,
      });
      setReplyDraft('');
      setReplyAmountDraft('');
      pendingPostRef.current = null;
      setReplyPosting(false);
      startPayPoll(target.messageId, target.sats);
    } catch (err) {
      /* v8 ignore start -- pay sheet closed while the compose invoice failed */
      if (generation !== payPollGeneration.current) {
        return;
      }
      /* v8 ignore stop */
      if (err instanceof MissingRequirementsError) {
        if (!isRetry && openOverlayForMissing(err.missing)) {
          pendingPostRef.current = () => runComposePay(token, trimmed, parentId, sats, true);
          return;
        }
        setReplyFormError('request');
        return;
      }
      if (expandedIdRef.current === parentId) {
        setReplyFormError(
          err instanceof Error && /1[-–]500 characters/i.test(err.message)
            ? 'tooLong'
            : isRateLimitError(err)
              ? 'rateLimit'
              : 'request',
        );
      }
    } finally {
      setReplyPosting(false);
    }
  };

  const runPaidReply = async (
    token: string,
    trimmed: string,
    parentId: string,
    sats: number,
    isRetry: boolean,
    baselineSats: number,
  ): Promise<void> => {
    setReplyPosting(true);
    setReplyFormError(null);
    const generation = payPollGeneration.current;
    try {
      const invoice =
        trimmed === ''
          ? await postMessageInvoice(token, parentId, sats)
          : await postMessageInvoice(token, parentId, sats, trimmed);
      /* v8 ignore next 3 -- pay sheet closed while the reply invoice was minting */
      if (generation !== payPollGeneration.current) {
        return;
      }
      setPayMessageId(parentId);
      setPayError(null);
      setPayInvoice({
        messageId: parentId,
        pr: invoice.pr,
        amountSats: invoice.amountSats,
      });
      setReplyDraft('');
      setReplyAmountDraft('');
      pendingPostRef.current = null;
      setReplyPosting(false);
      startPayPoll(parentId, baselineSats);
    } catch (err) {
      /* v8 ignore start -- pay sheet closed while the reply invoice failed */
      if (generation !== payPollGeneration.current) {
        return;
      }
      /* v8 ignore stop */
      if (err instanceof MissingRequirementsError) {
        if (!isRetry && openOverlayForMissing(err.missing)) {
          pendingPostRef.current = () =>
            runPaidReply(token, trimmed, parentId, sats, true, baselineSats);
          return;
        }
        setReplyFormError('request');
        return;
      }
      setReplyFormError(
        err instanceof Error && /1[-–]500 characters/i.test(err.message)
          ? 'tooLong'
          : isRateLimitError(err)
            ? 'rateLimit'
            : 'request',
      );
    } finally {
      setReplyPosting(false);
    }
  };

  const onOverlaySatisfied = (): void => {
    const current = useAuthStore.getState().account;
    /* v8 ignore next 4 -- overlay onSatisfied is not invoked after the account vanishes */
    if (current === null) {
      setOverlayRequirement(null);
      return;
    }
    const still = nextPostRequirement(current.missing);
    if (still !== null) {
      setOverlayRequirement(still);
      return;
    }
    setOverlayRequirement(null);
    const pending = pendingPostRef.current;
    /* v8 ignore next 3 -- overlay cannot satisfy without a queued reply */
    if (pending === null) {
      return;
    }
    void pending();
  };

  const handlePayOpen = (messageId: string): void => {
    bumpPayPollGeneration();
    setPayMessageId(messageId);
    setPayDraft('');
    setPayError(null);
    setPayInvoice(null);
    setPayWaiting(false);
    setPayBusy(false);
  };

  const handlePaySubmit = (): void | Promise<ForumPayInvoice | null> => {
    /* v8 ignore next 3 -- Continue unmounts without a session; busy clicks are ignored */
    if (session === null || payMessageId === null || payBusy) {
      return;
    }
    const rawAmount = payDraft.trim();
    let sats: number;
    if (rawAmount === '') {
      sats = DEFAULT_FORUM_PAY_SATS;
    } else if (!/^\d+$/.test(rawAmount)) {
      setPayError('amount');
      return;
    } else {
      sats = Number.parseInt(rawAmount, 10);
      if (sats <= 0 || !Number.isSafeInteger(sats)) {
        setPayError('amount');
        return;
      }
    }
    const token = session;
    const messageId = payMessageId;
    /* v8 ignore next 4 -- Gift sheet only opens on a loaded payable nested reply */
    const listed = replies?.find((row) => row.id === messageId);
    if (listed === undefined || listed.payable !== true) {
      return;
    }
    const baselineSats = listed.sats;
    const continuePay = (isRetry: boolean): Promise<ForumPayInvoice | null> => {
      const generation = payPollGeneration.current;
      setPayBusy(true);
      setPayError(null);
      return (async () => {
        let minted: ForumPayInvoice | null = null;
        try {
          const invoice = await postMessageInvoice(token, messageId, sats);
          if (generation !== payPollGeneration.current) {
            return null;
          }
          minted = {
            messageId,
            pr: invoice.pr,
            amountSats: invoice.amountSats,
          };
          setPayInvoice(minted);
          setPayBusy(false);
          startPayPoll(messageId, baselineSats);
        } catch (err) {
          /* v8 ignore next 3 -- pay sheet closed while the invoice request failed */
          if (generation !== payPollGeneration.current) {
            return null;
          }
          if (err instanceof MissingRequirementsError) {
            if (!isRetry && openOverlayForMissing(err.missing)) {
              pendingPostRef.current = async () => {
                await continuePay(true);
              };
              return null;
            }
            setPayError('request');
            return null;
          }
          setPayError(
            isRateLimitError(err)
              ? 'rateLimit'
              : isAuthorWalletError(err)
                ? 'authorWallet'
                : 'request',
          );
        } finally {
          if (generation === payPollGeneration.current) {
            setPayBusy(false);
          }
        }
        return minted;
      })();
    };
    if (account !== null && openOverlayForMissing(account.missing)) {
      pendingPostRef.current = async () => {
        await continuePay(true);
      };
      return;
    }
    return continuePay(false);
  };

  const handlePayCancel = (): void => {
    bumpPayPollGeneration();
    setPayMessageId(null);
    setPayDraft('');
    setPayError(null);
    setPayInvoice(null);
    setPayBusy(false);
    setPayWaiting(false);
    setReplyPosting(false);
  };

  const handleToggleExpand = (messageId: string): void => {
    if (replyPosting) {
      return;
    }
    if (
      payMessageId !== null &&
      replies !== null &&
      replies.some((row) => row.id === payMessageId)
    ) {
      handlePayCancel();
    }
    if (expandedId === messageId) {
      ++expandGen.current;
      setExpandedId(null);
      setReplies(null);
      setRepliesError(false);
      setRepliesLoading(false);
      setReplyDraft('');
      setReplyAmountDraft('');
      setReplyFormError(null);
      return;
    }
    const gen = ++expandGen.current;
    setExpandedId(messageId);
    setReplies(null);
    setRepliesLoading(true);
    setRepliesError(false);
    setReplyDraft('');
    setReplyAmountDraft('');
    setReplyFormError(null);
    /* v8 ignore start -- expand after the session was cleared */
    if (session === null) {
      setRepliesLoading(false);
      setRepliesError(true);
      return;
    }
    /* v8 ignore stop */
    void (async () => {
      try {
        const next = await fetchReplies(session, messageId);
        if (expandGen.current === gen) {
          setReplies(withSeededHiddenReply(next, seedReply, root.id, messageId));
        }
      } catch {
        if (expandGen.current === gen) {
          setRepliesError(true);
        }
      } finally {
        if (expandGen.current === gen) {
          setRepliesLoading(false);
        }
      }
    })();
  };

  const handleReplyPost = (): void => {
    /* v8 ignore next 3 -- Post is disabled without a session or while posting */
    if (session === null || expandedId === null || replyPosting) {
      return;
    }
    const trimmed = replyDraft.trim();
    if (trimmed.length > FORUM_MESSAGE_MAX_LENGTH) {
      setReplyFormError('tooLong');
      return;
    }
    const parsed = parseReplySats(replyAmountDraft);
    const token = session;
    const parentId = expandedId;
    const exempt = isReplyPaymentExempt(account, note.accountId);
    const authorUnknown = note.accountId === undefined;
    const continueReply = (isRetry: boolean): Promise<void> => {
      if (parsed === 'invalid') {
        setReplyFormError('amount');
        return Promise.resolve();
      }
      const baselineSats = note.sats;
      if (trimmed === '' && parsed === 'empty') {
        return runPaidReply(
          token,
          trimmed,
          parentId,
          DEFAULT_FORUM_PAY_SATS,
          isRetry,
          baselineSats,
        );
      }
      if (parsed === 'empty') {
        if (exempt || authorUnknown) {
          return runReplyPost(token, trimmed, parentId, isRetry);
        }
        return runComposePay(token, trimmed, parentId, 1, isRetry);
      }
      return runPaidReply(token, trimmed, parentId, parsed, isRetry, baselineSats);
    };
    const missing = account?.missing ?? [];
    if (openOverlayForMissing(missing)) {
      pendingPostRef.current = () => continueReply(true);
      return;
    }
    void continueReply(false);
  };

  const handleRetryReplies = (): void => {
    /* v8 ignore next 3 -- retry is not mounted without an expanded thread and session */
    if (expandedId === null || session === null) {
      return;
    }
    const gen = ++expandGen.current;
    setRepliesLoading(true);
    setRepliesError(false);
    const messageId = expandedId;
    void (async () => {
      try {
        const next = await fetchReplies(session, messageId);
        if (expandGen.current === gen) {
          setReplies(withSeededHiddenReply(next, seedReply, root.id, messageId));
        }
      } catch {
        if (expandGen.current === gen) {
          setRepliesError(true);
        }
      } finally {
        if (expandGen.current === gen) {
          setRepliesLoading(false);
        }
      }
    })();
  };

  const handleDeleted = (messageId: string): void => {
    if (messageId === note.id) {
      handlePayCancel();
      onRootDeleted();
      return;
    }
    if (payMessageId === messageId) {
      handlePayCancel();
    }
    setReplies((prev) => {
      /* v8 ignore next 3 -- delete control only mounts after replies loaded */
      if (prev === null) {
        return prev;
      }
      return prev.filter((row) => row.id !== messageId);
    });
    setNote((prev) => ({
      ...prev,
      replyCount: Math.max(0, prev.replyCount - 1),
    }));
  };

  return (
    <>
      {overlayRequirement !== null ? (
        <RequirementsOverlay
          requirement={overlayRequirement}
          onDismiss={() => {
            setOverlayRequirement(null);
            pendingPostRef.current = null;
          }}
          onSatisfied={onOverlaySatisfied}
        />
      ) : null}
      <ForumBoard
        {...IDLE_BOARD}
        messages={[note]}
        truncate={false}
        photoUrls={photoUrls}
        rateDay={rateDay}
        payMessageId={payMessageId}
        payDraft={payDraft}
        payBusy={payBusy}
        payError={payError}
        payInvoice={payInvoice}
        payWaiting={payWaiting}
        onPayOpen={handlePayOpen}
        onPayDraftChange={(value: string): void => {
          setPayDraft(value);
          setPayError(null);
        }}
        onPaySubmit={handlePaySubmit}
        onPayCancel={handlePayCancel}
        expandedId={expandedId}
        onToggleExpand={handleToggleExpand}
        replies={expandedId === null ? null : replies}
        repliesLoading={expandedId !== null && repliesLoading}
        repliesError={expandedId !== null && repliesError}
        replyDraft={replyDraft}
        onReplyDraftChange={(value: string): void => {
          setReplyDraft(value);
          setReplyFormError(null);
        }}
        replyAmountDraft={replyAmountDraft}
        onReplyAmountDraftChange={(value: string): void => {
          setReplyAmountDraft(value);
          setReplyFormError(null);
        }}
        replyPosting={replyPosting}
        replyFormError={replyFormError}
        onReplyPost={handleReplyPost}
        onRetryReplies={handleRetryReplies}
        onDeleted={handleDeleted}
        permalinkTargetId={highlightId}
      />
    </>
  );
}
