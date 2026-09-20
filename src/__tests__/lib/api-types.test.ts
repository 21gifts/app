// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  accountNotificationLevel,
  accountSchema,
  CONTACT_MESSAGE_MAX_LENGTH,
  contactSchema,
  conversationInvoiceSchema,
  conversationListSchema,
  conversationMessageSchema,
  conversationResponseSchema,
  conversationSchema,
  conversationThreadSchema,
  notificationListSchema,
  notificationSchema,
  FORUM_MESSAGE_MAX_LENGTH,
  forumMessageSchema,
  hiddenMessageSchema,
  lnAddressResolvedSchema,
  giftStatsSchema,
  memberProfileSchema,
  moderatorProposalSchema,
  moderatorProposalsResponseSchema,
  ownerFundingSchema,
  fundingApplyResponseSchema,
  fundingApplicationSchema,
  fundingApplicationsResponseSchema,
  fundingApplicationDetailSchema,
  fundingDecisionResultSchema,
  trustActionResultSchema,
  trustChainSchema,
  passkeyBeginSchema,
  passkeySessionSchema,
  pushSubscriptionResponseSchema,
  vapidPublicSchema,
  viewProfileSchema,
} from '@/lib/api-types';

const account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis' as const,
  name: null,
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: 'name' as const,
  missing: ['name', 'lightning-address', 'rules'] as ('name' | 'lightning-address' | 'rules')[],
};

describe('memberProfileSchema', () => {
  it('accepts a member profile with a null note', () => {
    const profile = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Carol',
      location: null,
      role: 'verified' as const,
      lightningAddress: 'carol@walletofsatoshi.com',
      createdAt: '2026-01-15T12:00:00.000Z',
      aboutMe: null,
      aboutMeHasPhoto: false,
      profileMessage: null,
      postCount: 0,
      replyCount: 0,
    };
    expect(memberProfileSchema.parse(profile)).toEqual({
      ...profile,
      trust: { verifiedBy: null, proposedBy: null, confirmedBy: null, appointedBy: null },
    });
  });

  it('requires post and reply counts', () => {
    const profile = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Carol',
      location: null,
      role: 'verified' as const,
      lightningAddress: 'carol@walletofsatoshi.com',
      createdAt: '2026-01-15T12:00:00.000Z',
      profileMessage: null,
    };
    expect(() => memberProfileSchema.parse(profile)).toThrow();
    expect(() => memberProfileSchema.parse({ ...profile, postCount: 0 })).toThrow();
    expect(() => memberProfileSchema.parse({ ...profile, replyCount: 0 })).toThrow();
  });

  it('defaults omitted aboutMeHasPhoto to false', () => {
    const profile = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Carol',
      location: null,
      role: 'verified' as const,
      lightningAddress: 'carol@walletofsatoshi.com',
      createdAt: '2026-01-15T12:00:00.000Z',
      aboutMe: null,
      aboutMeHasPhoto: false,
      profileMessage: null,
      postCount: 0,
      replyCount: 0,
    };
    expect(memberProfileSchema.parse(profile).aboutMeHasPhoto).toBe(false);
  });

  it('accepts aboutMeHasPhoto true', () => {
    const profile = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Carol',
      location: null,
      role: 'verified' as const,
      lightningAddress: 'carol@walletofsatoshi.com',
      createdAt: '2026-01-15T12:00:00.000Z',
      aboutMe: null,
      aboutMeHasPhoto: true,
      profileMessage: null,
      postCount: 0,
      replyCount: 0,
    };
    expect(memberProfileSchema.parse(profile).aboutMeHasPhoto).toBe(true);
  });

  it('rejects a non-boolean aboutMeHasPhoto', () => {
    expect(() =>
      memberProfileSchema.parse({
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Carol',
        location: null,
        role: 'verified',
        lightningAddress: 'carol@walletofsatoshi.com',
        createdAt: '2026-01-15T12:00:00.000Z',
        aboutMe: null,
        aboutMeHasPhoto: 'yes',
        profileMessage: null,
        postCount: 0,
        replyCount: 0,
      }),
    ).toThrow();
  });

  it('rejects an empty name string', () => {
    expect(() =>
      memberProfileSchema.parse({
        id: 'x',
        name: '',
        location: null,
        role: 'basis',
        lightningAddress: null,
        createdAt: '2026-01-15T12:00:00.000Z',
        aboutMe: null,
        aboutMeHasPhoto: false,
        profileMessage: null,
        postCount: 0,
        replyCount: 0,
      }),
    ).toThrow();
  });

  it('accepts omitted fundingReviewedAt', () => {
    const profile = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Carol',
      location: null,
      role: 'verified' as const,
      lightningAddress: 'carol@walletofsatoshi.com',
      createdAt: '2026-01-15T12:00:00.000Z',
      aboutMe: null,
      aboutMeHasPhoto: false,
      profileMessage: null,
      postCount: 0,
      replyCount: 0,
    };
    expect(memberProfileSchema.parse(profile).fundingReviewedAt).toBeUndefined();
  });

  it('accepts fundingReviewedAt null and a number', () => {
    const profile = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Carol',
      location: null,
      role: 'verified' as const,
      lightningAddress: 'carol@walletofsatoshi.com',
      createdAt: '2026-01-15T12:00:00.000Z',
      aboutMe: null,
      aboutMeHasPhoto: false,
      profileMessage: null,
      postCount: 0,
      replyCount: 0,
      fundingReviewedAt: null as number | null,
    };
    expect(memberProfileSchema.parse(profile).fundingReviewedAt).toBeNull();
    expect(
      memberProfileSchema.parse({ ...profile, fundingReviewedAt: 1_700_000_000 }).fundingReviewedAt,
    ).toBe(1_700_000_000);
  });

  it('rejects an empty location', () => {
    expect(() =>
      memberProfileSchema.parse({
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Carol',
        location: '',
        role: 'verified',
        lightningAddress: 'carol@walletofsatoshi.com',
        createdAt: '2026-01-15T12:00:00.000Z',
        profileMessage: null,
        postCount: 0,
        replyCount: 0,
      }),
    ).toThrow();
  });
});

describe('trustChainSchema', () => {
  it('accepts an empty graph', () => {
    expect(trustChainSchema.parse({ nodes: [], edges: [] })).toEqual({ nodes: [], edges: [] });
  });
});

describe('trustActionResultSchema', () => {
  it('accepts a staff action snapshot', () => {
    const body = { id: 'acc_1', name: 'Carol', role: 'verified' as const };
    expect(trustActionResultSchema.parse(body)).toEqual(body);
  });
});

describe('moderatorProposalSchema', () => {
  const proposal = {
    subject: { id: 'acc_rose', name: 'Rose', role: 'verified' as const },
    proposedBy: { id: 'acc_bob', name: 'Bob' },
    createdAt: '2026-08-28T12:00:00.000Z',
  };

  it('accepts an open proposal with display names', () => {
    expect(moderatorProposalSchema.parse(proposal)).toEqual(proposal);
  });

  it('accepts null names', () => {
    const unnamed = {
      subject: { id: 'acc_rose', name: null, role: 'verified' as const },
      proposedBy: { id: 'acc_bob', name: null },
      createdAt: '2026-08-28T12:00:00.000Z',
    };
    expect(moderatorProposalSchema.parse(unnamed)).toEqual(unnamed);
  });

  it('rejects a subject role other than verified', () => {
    expect(() =>
      moderatorProposalSchema.parse({
        ...proposal,
        subject: { ...proposal.subject, role: 'moderator' },
      }),
    ).toThrow();
  });

  it('rejects an empty subject id', () => {
    expect(() =>
      moderatorProposalSchema.parse({
        ...proposal,
        subject: { ...proposal.subject, id: '' },
      }),
    ).toThrow();
  });

  it('rejects a createdAt without an offset', () => {
    expect(() =>
      moderatorProposalSchema.parse({ ...proposal, createdAt: '2026-08-28T12:00:00.000' }),
    ).toThrow();
  });
});

describe('moderatorProposalsResponseSchema', () => {
  const proposal = {
    subject: { id: 'acc_rose', name: 'Rose', role: 'verified' as const },
    proposedBy: { id: 'acc_bob', name: 'Bob' },
    createdAt: '2026-08-28T12:00:00.000Z',
  };

  it('accepts an empty list', () => {
    expect(moderatorProposalsResponseSchema.parse({ proposals: [] })).toEqual({ proposals: [] });
  });

  it('accepts a list of proposals', () => {
    expect(moderatorProposalsResponseSchema.parse({ proposals: [proposal] })).toEqual({
      proposals: [proposal],
    });
  });

  it('rejects a missing proposals key', () => {
    expect(() => moderatorProposalsResponseSchema.parse({})).toThrow();
  });

  it('rejects a non-array proposals value', () => {
    expect(() => moderatorProposalsResponseSchema.parse({ proposals: proposal })).toThrow();
  });
});

describe('ownerFundingSchema', () => {
  const funding = {
    status: 'none' as const,
    trialUtcDate: null,
    admittedAt: null,
    reviewedByName: null,
  };

  it('accepts each status', () => {
    for (const status of ['none', 'pending', 'trial', 'admitted', 'rejected'] as const) {
      expect(ownerFundingSchema.parse({ ...funding, status }).status).toBe(status);
    }
  });

  it('rejects a missing field', () => {
    expect(() => ownerFundingSchema.parse({ status: 'none' })).toThrow();
  });
});

describe('fundingApplyResponseSchema', () => {
  it('unwraps a funding object', () => {
    const funding = {
      status: 'pending' as const,
      trialUtcDate: null,
      admittedAt: null,
      reviewedByName: null,
    };
    expect(fundingApplyResponseSchema.parse({ funding })).toEqual({ funding });
  });
});

describe('fundingApplicationSchema', () => {
  it('accepts a pending application', () => {
    const row = {
      accountId: 'acc_rose',
      name: 'Rose',
      role: 'verified' as const,
      appliedAt: 1,
    };
    expect(fundingApplicationSchema.parse(row)).toEqual(row);
    expect(fundingApplicationSchema.parse({ ...row, name: null }).name).toBeNull();
  });
});

describe('fundingApplicationsResponseSchema', () => {
  it('accepts an empty list', () => {
    expect(fundingApplicationsResponseSchema.parse({ applications: [] })).toEqual({
      applications: [],
    });
  });
});

describe('fundingApplicationDetailSchema', () => {
  it('accepts a detail with no messages', () => {
    const detail = {
      account: {
        id: 'acc_rose',
        name: 'Rose',
        role: 'verified' as const,
        lightningAddress: null,
      },
      grant: {
        status: 'pending' as const,
        appliedAt: 1,
        trialUtcDate: null,
        admittedAt: null,
        decidedAt: null,
      },
      messages: [],
    };
    expect(fundingApplicationDetailSchema.parse(detail)).toEqual(detail);
  });
});

describe('fundingDecisionResultSchema', () => {
  it('accepts a nullable funding object', () => {
    expect(
      fundingDecisionResultSchema.parse({
        id: 'acc_1',
        name: null,
        role: 'verified',
        funding: null,
      }).funding,
    ).toBeNull();
  });
});

describe('FORUM_MESSAGE_MAX_LENGTH', () => {
  it('matches the api POST /messages cap', () => {
    expect(FORUM_MESSAGE_MAX_LENGTH).toBe(500);
  });
});

describe('CONTACT_MESSAGE_MAX_LENGTH', () => {
  it('matches the api POST /contact cap', () => {
    expect(CONTACT_MESSAGE_MAX_LENGTH).toBe(500);
  });
});

describe('contactSchema', () => {
  it('accepts a well-formed contact message', () => {
    const message = {
      id: 'c1',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T12:00:00.000Z',
    };
    expect(contactSchema.parse(message)).toEqual(message);
  });

  it('rejects an empty text', () => {
    expect(() =>
      contactSchema.parse({
        id: 'c1',
        name: 'Ada',
        text: '',
        createdAt: '2026-08-28T12:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('conversationSchema', () => {
  it('accepts an empty lastText', () => {
    const row = {
      id: 'c1',
      kind: 'member_member',
      name: 'Bob',
      lastText: '',
      lastAt: '2026-08-28T12:00:00.000Z',
      lastFromMe: false,
      lastSats: 0,
      unread: false,
      unreadMessageCount: 0,
    };
    expect(conversationSchema.parse(row)).toEqual(row);
    expect(conversationListSchema.parse({ conversations: [row] })).toEqual({
      conversations: [row],
      unreadCount: 0,
    });
  });

  it('defaults missing unread to false and missing unreadCount and unreadMessageCount to 0', () => {
    const row = {
      id: 'c1',
      kind: 'member_member',
      name: 'Bob',
      lastText: 'Hi',
      lastAt: '2026-08-28T12:00:00.000Z',
      lastFromMe: false,
      lastSats: 0,
    };
    expect(conversationSchema.parse(row)).toEqual({
      ...row,
      unread: false,
      unreadMessageCount: 0,
    });
    expect(conversationListSchema.parse({ conversations: [row] })).toEqual({
      conversations: [{ ...row, unread: false, unreadMessageCount: 0 }],
      unreadCount: 0,
    });
  });

  it('accepts unread true and unreadCount', () => {
    const row = {
      id: 'c1',
      kind: 'member_member',
      name: 'Bob',
      lastText: 'Hi',
      lastAt: '2026-08-28T12:00:00.000Z',
      lastFromMe: false,
      lastSats: 0,
      unread: true,
      unreadMessageCount: 2,
    };
    expect(conversationSchema.parse(row)).toEqual(row);
    expect(conversationListSchema.parse({ conversations: [row], unreadCount: 1 })).toEqual({
      conversations: [row],
      unreadCount: 1,
    });
  });

  it('rejects a negative unreadCount', () => {
    expect(() => conversationListSchema.parse({ conversations: [], unreadCount: -1 })).toThrow();
  });

  it('rejects a negative unreadMessageCount', () => {
    expect(() =>
      conversationSchema.parse({
        id: 'c1',
        kind: 'member_member',
        name: 'Bob',
        lastText: 'Hi',
        lastAt: '2026-08-28T12:00:00.000Z',
        lastFromMe: false,
        lastSats: 0,
        unread: true,
        unreadMessageCount: -1,
      }),
    ).toThrow();
  });

  it('accepts lastFromMe true and false', () => {
    const incoming = {
      id: 'c1',
      kind: 'member_member',
      name: 'Bob',
      lastText: 'Hi',
      lastAt: '2026-08-28T12:00:00.000Z',
      lastFromMe: false,
      lastSats: 0,
      unread: false,
      unreadMessageCount: 0,
    };
    const outgoing = { ...incoming, lastFromMe: true };
    expect(conversationSchema.parse(incoming)).toEqual(incoming);
    expect(conversationSchema.parse(outgoing)).toEqual(outgoing);
  });

  it('rejects a missing kind', () => {
    expect(() =>
      conversationSchema.parse({
        id: 'c1',
        name: 'Bob',
        lastText: '',
        lastAt: '2026-08-28T12:00:00.000Z',
        lastFromMe: false,
        lastSats: 0,
      }),
    ).toThrow();
  });

  it('rejects a missing lastFromMe', () => {
    expect(() =>
      conversationSchema.parse({
        id: 'c1',
        kind: 'member_member',
        name: 'Bob',
        lastText: '',
        lastAt: '2026-08-28T12:00:00.000Z',
      }),
    ).toThrow();
  });

  it('rejects an invalid kind', () => {
    expect(() =>
      conversationSchema.parse({
        id: 'c1',
        kind: 'forum',
        name: 'Bob',
        lastText: '',
        lastAt: '2026-08-28T12:00:00.000Z',
        lastFromMe: false,
        lastSats: 0,
      }),
    ).toThrow();
  });

  it('accepts an optional accountId', () => {
    const row = {
      id: 'c1',
      kind: 'member_member' as const,
      name: 'Bob',
      lastText: 'Hi',
      lastAt: '2026-08-28T12:00:00.000Z',
      lastFromMe: false,
      lastSats: 0,
      accountId: 'acc_1',
    };
    expect(conversationSchema.parse(row)).toEqual({ ...row, unread: false, unreadMessageCount: 0 });
  });

  it('rejects an empty accountId', () => {
    expect(() =>
      conversationSchema.parse({
        id: 'c1',
        kind: 'member_member',
        name: 'Bob',
        lastText: 'Hi',
        lastAt: '2026-08-28T12:00:00.000Z',
        lastFromMe: false,
        lastSats: 0,
        accountId: '',
      }),
    ).toThrow();
  });
});

describe('conversationResponseSchema', () => {
  it('accepts a moderator_group conversation wrapper', () => {
    const conversation = {
      id: 'conv-mod',
      kind: 'moderator_group',
      name: 'Moderators',
      lastText: 'Hello mods',
      lastAt: '2026-08-28T15:00:00.000Z',
      lastFromMe: false,
      lastSats: 0,
    };
    expect(conversationResponseSchema.parse({ conversation })).toEqual({
      conversation: { ...conversation, unread: false, unreadMessageCount: 0 },
    });
    expect(
      conversationResponseSchema.parse({ conversation: { ...conversation, unread: true } })
        .conversation.unread,
    ).toBe(true);
  });
});

describe('conversationMessageSchema', () => {
  it('accepts a well-formed message', () => {
    const message = {
      id: 'm1',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T12:00:00.000Z',
      fromMe: false,
      sats: 0,
    };
    expect(conversationMessageSchema.parse(message)).toEqual(message);
    expect(conversationThreadSchema.parse({ messages: [message] }).messages).toHaveLength(1);
  });

  it('accepts fromMe true and false', () => {
    const incoming = {
      id: 'm1',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T12:00:00.000Z',
      fromMe: false,
      sats: 0,
    };
    const outgoing = { ...incoming, fromMe: true };
    expect(conversationMessageSchema.parse(incoming)).toEqual(incoming);
    expect(conversationMessageSchema.parse(outgoing)).toEqual(outgoing);
  });

  it('rejects a missing fromMe', () => {
    expect(() =>
      conversationMessageSchema.parse({
        id: 'm1',
        name: 'Ada',
        text: 'Hello',
        createdAt: '2026-08-28T12:00:00.000Z',
      }),
    ).toThrow();
  });

  it('accepts an optional accountId', () => {
    const message = {
      id: 'm1',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T12:00:00.000Z',
      fromMe: false,
      sats: 0,
      accountId: 'acc_1',
    };
    expect(conversationMessageSchema.parse(message)).toEqual(message);
  });

  it('accepts an optional giftFor', () => {
    const message = {
      id: 'm1',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T12:00:00.000Z',
      fromMe: false,
      sats: 0,
      giftFor: 'm0',
    };
    expect(conversationMessageSchema.parse(message)).toEqual(message);
  });

  it('omits giftFor when absent', () => {
    const message = {
      id: 'm1',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T12:00:00.000Z',
      fromMe: false,
      sats: 0,
    };
    const result = conversationMessageSchema.parse(message);
    expect(result.giftFor).toBeUndefined();
  });

  it('accepts empty text with sats', () => {
    const message = {
      id: 'm1',
      name: 'Ada',
      text: '',
      createdAt: '2026-08-28T12:00:00.000Z',
      fromMe: true,
      sats: 21,
    };
    expect(conversationMessageSchema.parse(message)).toEqual(message);
  });

  it('rejects an empty accountId', () => {
    expect(() =>
      conversationMessageSchema.parse({
        id: 'm1',
        name: 'Ada',
        text: 'Hello',
        createdAt: '2026-08-28T12:00:00.000Z',
        fromMe: false,
        sats: 0,
        accountId: '',
      }),
    ).toThrow();
  });

  it('rejects a missing sats', () => {
    expect(() =>
      conversationMessageSchema.parse({
        id: 'm1',
        name: 'Ada',
        text: 'Hello',
        createdAt: '2026-08-28T12:00:00.000Z',
        fromMe: false,
      }),
    ).toThrow();
  });
});

describe('conversationInvoiceSchema', () => {
  it('accepts pr, amountSats, and messageId', () => {
    const invoice = { pr: 'lnbc21n1test', amountSats: 21, messageId: 'm-gift' };
    expect(conversationInvoiceSchema.parse(invoice)).toEqual(invoice);
  });
});

describe('notificationSchema', () => {
  const base = {
    id: 'n1',
    parentId: 'p1',
    replyId: 'r1',
    name: 'Bob',
    text: '',
    createdAt: '2026-08-28T12:00:00.000Z',
    readAt: null,
  };

  it('accepts a well-formed forum_reply and list, including readAt null and empty text', () => {
    const row = { ...base, type: 'forum_reply' as const };
    expect(notificationSchema.parse(row)).toEqual(row);
    expect(notificationListSchema.parse({ notifications: [row], unreadCount: 1 })).toEqual({
      notifications: [row],
      unreadCount: 1,
    });
  });

  it('accepts forum_post', () => {
    const row = { ...base, type: 'forum_post' as const, text: 'Hello living room' };
    expect(notificationSchema.parse(row)).toEqual(row);
  });

  it('accepts zap', () => {
    const row = { ...base, type: 'zap' as const, text: '21' };
    expect(notificationSchema.parse(row)).toEqual(row);
  });

  it('accepts moderator_appointed', () => {
    const row = {
      ...base,
      type: 'moderator_appointed' as const,
      parentId: 'acc_1',
      replyId: 'acc_1',
    };
    expect(notificationSchema.parse(row)).toEqual(row);
  });

  it('rejects an unknown type', () => {
    expect(() => notificationSchema.parse({ ...base, type: 'other' })).toThrow();
  });
});

describe('vapidPublicSchema', () => {
  it('accepts a non-empty public key', () => {
    expect(vapidPublicSchema.parse({ publicKey: 'BAAAA' })).toEqual({ publicKey: 'BAAAA' });
  });

  it('rejects an empty public key', () => {
    expect(() => vapidPublicSchema.parse({ publicKey: '' })).toThrow();
  });
});

describe('pushSubscriptionResponseSchema', () => {
  it('accepts endpoint plus createdAt', () => {
    const body = { endpoint: 'https://push.example/sub', createdAt: '2026-08-30T00:00:00.000Z' };
    expect(pushSubscriptionResponseSchema.parse(body)).toEqual(body);
  });

  it('rejects a missing endpoint', () => {
    expect(() =>
      pushSubscriptionResponseSchema.parse({ createdAt: '2026-08-30T00:00:00.000Z' }),
    ).toThrow();
  });
});

describe('forumMessageSchema', () => {
  const base = {
    id: 'm1',
    name: 'Ada',
    text: 'Hello',
    createdAt: '2026-08-28T12:00:00.000Z',
    sats: 0,
    payable: false,
    hasPhoto: false,
    role: 'basis' as const,
    replyCount: 0,
  };

  it('accepts text with no photo', () => {
    expect(forumMessageSchema.parse(base)).toEqual({
      ...base,
      hasVideo: false,
      videoContentType: null,
      replyCount: 0,
      photoCount: 0,
    });
  });

  it('accepts an optional parentId on replies', () => {
    expect(forumMessageSchema.parse(base).parentId).toBeUndefined();
    expect(forumMessageSchema.parse({ ...base, parentId: 'parent-1' }).parentId).toBe('parent-1');
  });

  it('accepts optional deletedAt and deletedBy on staff hidden rows', () => {
    const hidden = forumMessageSchema.parse({
      ...base,
      deletedAt: '2026-08-29T15:00:00.000Z',
      deletedBy: { id: 'acc_mod', name: 'Ada', role: 'moderator' },
    });
    expect(hidden.deletedAt).toBe('2026-08-29T15:00:00.000Z');
    expect(hidden.deletedBy).toEqual({ id: 'acc_mod', name: 'Ada', role: 'moderator' });
    expect(forumMessageSchema.parse(base).deletedAt).toBeUndefined();
    expect(forumMessageSchema.parse(base).deletedBy).toBeUndefined();
  });

  it('accepts an empty text when hasPhoto is true', () => {
    const photoOnly = { ...base, text: '', hasPhoto: true };
    expect(forumMessageSchema.parse(photoOnly)).toEqual({
      ...photoOnly,
      hasVideo: false,
      videoContentType: null,
      replyCount: 0,
      photoCount: 1,
    });
  });

  it('keeps an explicit photoCount of 2', () => {
    expect(forumMessageSchema.parse({ ...base, hasPhoto: true, photoCount: 2 }).photoCount).toBe(2);
  });

  it('rejects photoCount 11 and -1', () => {
    expect(() => forumMessageSchema.parse({ ...base, hasPhoto: true, photoCount: 11 })).toThrow();
    expect(() => forumMessageSchema.parse({ ...base, hasPhoto: true, photoCount: -1 })).toThrow();
  });

  it('accepts an empty text when hasVideo is true', () => {
    const videoOnly = { ...base, text: '', hasVideo: true };
    expect(forumMessageSchema.parse(videoOnly)).toEqual({
      ...videoOnly,
      videoContentType: null,
      replyCount: 0,
      photoCount: 0,
    });
  });

  it('rejects an empty text when hasPhoto is false', () => {
    expect(() => forumMessageSchema.parse({ ...base, text: '', hasPhoto: false })).toThrow();
  });

  it('accepts an empty text when sats is positive', () => {
    const giftOnly = { ...base, text: '', sats: 21 };
    expect(forumMessageSchema.parse(giftOnly)).toEqual({
      ...giftOnly,
      hasVideo: false,
      videoContentType: null,
      replyCount: 0,
      photoCount: 0,
    });
  });

  it('rejects a missing hasPhoto flag', () => {
    expect(() =>
      forumMessageSchema.parse({
        id: base.id,
        name: base.name,
        text: base.text,
        createdAt: base.createdAt,
      }),
    ).toThrow();
  });

  it('accepts the three video MIME values and null', () => {
    expect(
      forumMessageSchema.parse({ ...base, hasVideo: true, videoContentType: 'video/mp4' })
        .videoContentType,
    ).toBe('video/mp4');
    expect(
      forumMessageSchema.parse({ ...base, hasVideo: true, videoContentType: 'video/webm' })
        .videoContentType,
    ).toBe('video/webm');
    expect(
      forumMessageSchema.parse({ ...base, hasVideo: true, videoContentType: 'video/quicktime' })
        .videoContentType,
    ).toBe('video/quicktime');
    expect(forumMessageSchema.parse({ ...base, videoContentType: null }).videoContentType).toBe(
      null,
    );
  });

  it('rejects an unknown videoContentType string', () => {
    expect(() =>
      forumMessageSchema.parse({ ...base, hasVideo: true, videoContentType: 'video/ogg' }),
    ).toThrow();
  });
});

describe('accountSchema', () => {
  it('accepts a well-formed account without a linked address', () => {
    expect(accountSchema.parse(account)).toEqual(account);
  });

  it('accepts a linked, verified account', () => {
    const linked = {
      ...account,
      lightningAddress: 'me@walletofsatoshi.com',
      lightningAddressVerified: true,
    };
    expect(accountSchema.parse(linked)).toEqual(linked);
  });

  it('accepts a named account', () => {
    const named = { ...account, name: 'Ada' };
    expect(accountSchema.parse(named)).toEqual(named);
  });

  it('rejects a non-string name', () => {
    expect(() => accountSchema.parse({ ...account, name: 1 })).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => accountSchema.parse({ ...account, name: '' })).toThrow();
  });

  it('accepts founder and verified roles', () => {
    expect(accountSchema.parse({ ...account, role: 'founder' }).role).toBe('founder');
    expect(accountSchema.parse({ ...account, role: 'verified' }).role).toBe('verified');
  });

  it('rejects an unknown role', () => {
    expect(() => accountSchema.parse({ ...account, role: 'admin' })).toThrow();
  });

  it('rejects a non-boolean verification flag', () => {
    expect(() => accountSchema.parse({ ...account, lightningAddressVerified: 'yes' })).toThrow();
  });

  it('accepts forumLawsDismissed true and false', () => {
    expect(accountSchema.parse({ ...account, forumLawsDismissed: false }).forumLawsDismissed).toBe(
      false,
    );
    expect(accountSchema.parse({ ...account, forumLawsDismissed: true }).forumLawsDismissed).toBe(
      true,
    );
  });

  it('rejects a non-boolean forumLawsDismissed flag', () => {
    expect(() => accountSchema.parse({ ...account, forumLawsDismissed: 'yes' })).toThrow();
  });

  it('accepts a null linkingKey for passkey accounts', () => {
    expect(accountSchema.parse({ ...account, linkingKey: null }).linkingKey).toBeNull();
  });

  it('accepts a null rulesAgreedAt', () => {
    expect(accountSchema.parse(account).rulesAgreedAt).toBeNull();
  });

  it('accepts a positive rulesAgreedAt timestamp', () => {
    const agreed = { ...account, rulesAgreedAt: 1_700_000_001 };
    expect(accountSchema.parse(agreed).rulesAgreedAt).toBe(1_700_000_001);
  });

  it('rejects a missing rulesAgreedAt field', () => {
    expect(() =>
      accountSchema.parse(
        Object.fromEntries(Object.entries(account).filter(([key]) => key !== 'rulesAgreedAt')),
      ),
    ).toThrow();
  });

  it('rejects a string rulesAgreedAt timestamp', () => {
    expect(() => accountSchema.parse({ ...account, rulesAgreedAt: '1700000001' })).toThrow();
  });

  it('rejects a missing viewKey', () => {
    const without: Record<string, unknown> = { ...account };
    delete without['viewKey'];
    expect(() => accountSchema.parse(without)).toThrow();
  });

  it('rejects an uppercase viewKey', () => {
    expect(() => accountSchema.parse({ ...account, viewKey: 'A'.repeat(64) })).toThrow();
  });

  it('rejects a viewKey with the wrong length', () => {
    expect(() => accountSchema.parse({ ...account, viewKey: 'a'.repeat(63) })).toThrow();
  });

  it('accepts a location string', () => {
    expect(accountSchema.parse({ ...account, location: 'Zug' }).location).toBe('Zug');
  });

  it('rejects an empty location', () => {
    expect(() => accountSchema.parse({ ...account, location: '' })).toThrow();
  });

  it('defaults omitted aboutMeHasPhoto to false', () => {
    const without: Record<string, unknown> = { ...account };
    delete without['aboutMeHasPhoto'];
    expect(accountSchema.parse(without).aboutMeHasPhoto).toBe(false);
  });

  it('accepts aboutMeHasPhoto true', () => {
    expect(accountSchema.parse({ ...account, aboutMeHasPhoto: true }).aboutMeHasPhoto).toBe(true);
  });

  it('rejects a non-boolean aboutMeHasPhoto', () => {
    expect(() => accountSchema.parse({ ...account, aboutMeHasPhoto: 'yes' })).toThrow();
  });

  it('accepts a missing notificationLevel and defaults the helper to all', () => {
    expect(accountNotificationLevel(accountSchema.parse(account))).toBe('all');
  });

  it('accepts all, active, and mentions notification levels', () => {
    expect(accountSchema.parse({ ...account, notificationLevel: 'all' }).notificationLevel).toBe(
      'all',
    );
    expect(accountSchema.parse({ ...account, notificationLevel: 'active' }).notificationLevel).toBe(
      'active',
    );
    expect(
      accountSchema.parse({ ...account, notificationLevel: 'mentions' }).notificationLevel,
    ).toBe('mentions');
  });

  it('rejects a garbage notificationLevel', () => {
    expect(() => accountSchema.parse({ ...account, notificationLevel: 'nope' })).toThrow();
    expect(() => accountSchema.parse({ ...account, notificationLevel: 1 })).toThrow();
  });

  it('accepts omitted funding', () => {
    expect(accountSchema.parse(account).funding).toBeUndefined();
  });

  it('accepts funding null', () => {
    expect(accountSchema.parse({ ...account, funding: null }).funding).toBeNull();
  });

  it('accepts a funding object', () => {
    const funding = {
      status: 'none' as const,
      trialUtcDate: null,
      admittedAt: null,
      reviewedByName: null,
    };
    expect(accountSchema.parse({ ...account, funding }).funding).toEqual(funding);
  });

  it('rejects a garbage funding status', () => {
    expect(() =>
      accountSchema.parse({
        ...account,
        funding: { status: 'open', trialUtcDate: null, admittedAt: null, reviewedByName: null },
      }),
    ).toThrow();
  });
});

describe('accountNotificationLevel', () => {
  it('returns all when the field is missing or undefined', () => {
    expect(accountNotificationLevel(accountSchema.parse(account))).toBe('all');
    expect(
      accountNotificationLevel({
        ...accountSchema.parse(account),
        notificationLevel: undefined,
      }),
    ).toBe('all');
  });

  it('returns mentions when the account stores that level', () => {
    expect(
      accountNotificationLevel({
        ...accountSchema.parse(account),
        notificationLevel: 'mentions',
      }),
    ).toBe('mentions');
  });
});

describe('viewProfileSchema', () => {
  const profile = {
    name: 'Ada',
    location: null,
    lightningAddress: 'alice@walletofsatoshi.com',
    lightningAddressVerified: false,
    createdAt: 1_700_000_000,
    hasPasskey: false,
    aboutMe: null,
    aboutMeHasPhoto: false,
  };

  it('accepts a well-formed named profile', () => {
    expect(viewProfileSchema.parse(profile)).toEqual(profile);
  });

  it('accepts null name and null lightningAddress', () => {
    const bare = { ...profile, name: null, lightningAddress: null };
    expect(viewProfileSchema.parse(bare)).toEqual(bare);
  });

  it('rejects an empty name', () => {
    expect(() => viewProfileSchema.parse({ ...profile, name: '' })).toThrow();
  });

  it('rejects an empty location', () => {
    expect(() => viewProfileSchema.parse({ ...profile, location: '' })).toThrow();
  });

  it('defaults omitted aboutMeHasPhoto to false', () => {
    const without: Record<string, unknown> = { ...profile };
    delete without['aboutMeHasPhoto'];
    expect(viewProfileSchema.parse(without).aboutMeHasPhoto).toBe(false);
  });

  it('accepts aboutMeHasPhoto true', () => {
    expect(viewProfileSchema.parse({ ...profile, aboutMeHasPhoto: true }).aboutMeHasPhoto).toBe(
      true,
    );
  });

  it('rejects a non-boolean aboutMeHasPhoto', () => {
    expect(() => viewProfileSchema.parse({ ...profile, aboutMeHasPhoto: 'yes' })).toThrow();
  });
});

describe('forumMessageSchema', () => {
  const message = {
    id: 'm1',
    name: 'Ada',
    text: 'Hello from Ada',
    createdAt: '2026-08-28T12:00:00.000Z',
    sats: 0,
    payable: true,
    hasPhoto: false,
  };

  it('defaults a missing role to basis', () => {
    expect(forumMessageSchema.parse(message)).toEqual({
      ...message,
      role: 'basis',
      hasVideo: false,
      videoContentType: null,
      replyCount: 0,
      photoCount: 0,
    });
  });

  it('accepts founder, verified, and moderator roles', () => {
    expect(forumMessageSchema.parse({ ...message, role: 'founder' }).role).toBe('founder');
    expect(forumMessageSchema.parse({ ...message, role: 'verified' }).role).toBe('verified');
    expect(forumMessageSchema.parse({ ...message, role: 'moderator' }).role).toBe('moderator');
  });

  it('rejects an unknown role', () => {
    expect(() => forumMessageSchema.parse({ ...message, role: 'admin' })).toThrow();
  });

  it('parses a reply with via nostr and omits via when absent', () => {
    const reply = {
      ...message,
      parentId: 'parent-1',
      via: 'nostr' as const,
      payable: false,
    };
    expect(forumMessageSchema.parse(reply).via).toBe('nostr');
    const parsed = forumMessageSchema.parse(message);
    expect(parsed.via).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(parsed, 'via')).toBe(false);
  });

  it('rejects an unknown via value', () => {
    expect(() => forumMessageSchema.parse({ ...message, via: 'something-else' })).toThrow();
  });
});

describe('hiddenMessageSchema', () => {
  const hidden = {
    id: 'h1',
    name: 'Bob',
    text: 'Hidden note',
    createdAt: '2026-08-28T12:00:00.000Z',
    sats: 0,
    hasPhoto: false,
    parentId: null,
    deletedAt: '2026-08-29T15:00:00.000Z',
    deletedBy: { id: 'acc_mod', name: 'Ada', role: 'moderator' },
  };

  it('parses a hidden note with via nostr and omits via when absent', () => {
    expect(hiddenMessageSchema.parse({ ...hidden, via: 'nostr' as const }).via).toBe('nostr');
    const parsed = hiddenMessageSchema.parse(hidden);
    expect(parsed.via).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(parsed, 'via')).toBe(false);
  });

  it('accepts another non-empty via value', () => {
    expect(hiddenMessageSchema.parse({ ...hidden, via: 'something-else' }).via).toBe(
      'something-else',
    );
  });

  it('rejects an empty via value', () => {
    expect(() => hiddenMessageSchema.parse({ ...hidden, via: '' })).toThrow();
  });
});

describe('passkeyBeginSchema', () => {
  it('accepts challengeId and a JSON options object', () => {
    expect(passkeyBeginSchema.parse({ challengeId: 'ch', options: { challenge: 'aa' } })).toEqual({
      challengeId: 'ch',
      options: { challenge: 'aa' },
    });
  });
});

describe('passkeySessionSchema', () => {
  it('accepts a token plus account', () => {
    expect(
      passkeySessionSchema.parse({ token: 'tok', account: { ...account, linkingKey: null } }),
    ).toEqual({
      token: 'tok',
      account: { ...account, linkingKey: null },
    });
  });
});

describe('lnAddressResolvedSchema', () => {
  const resolved = {
    address: 'me@walletofsatoshi.com',
    callback: 'https://walletofsatoshi.com/lnurlp/callback',
    minSendable: 1000,
    maxSendable: 100_000_000,
  };

  it('accepts metadata without commentAllowed', () => {
    expect(lnAddressResolvedSchema.parse(resolved)).toEqual(resolved);
  });

  it('accepts metadata with commentAllowed', () => {
    const withComment = { ...resolved, commentAllowed: 255 };
    expect(lnAddressResolvedSchema.parse(withComment)).toEqual(withComment);
  });

  it('rejects a non-url callback', () => {
    expect(() => lnAddressResolvedSchema.parse({ ...resolved, callback: 'not-a-url' })).toThrow();
  });
});

describe('giftStatsSchema', () => {
  const fx = {
    quote: 'BTC-USD' as const,
    dayBasis: 'utc' as const,
    source: 'coinbase-exchange-daily-close' as const,
    quotes: [
      { code: 'USD' as const, pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' },
      { code: 'CHF' as const, pair: 'USD-CHF', source: 'ecb-daily' },
      { code: 'EUR' as const, pair: 'USD-EUR', source: 'ecb-daily' },
      { code: 'PHP' as const, pair: 'USD-PHP', source: 'ecb-daily' },
    ],
  };

  const stats = {
    totalSats: 10,
    totalBtc: '0.00000010',
    totalUsd: '0.01',
    totalChf: '0.01',
    totalEur: '0.01',
    totalPhp: '0.50',
    giftCount: 1,
    recipientCount: 1,
    firstPaidAt: '2026-06-01T00:00:00.000Z',
    lastPaidAt: '2026-06-01T00:00:00.000Z',
    spendOverTime: [
      {
        day: '2026-06-01',
        giftCount: 1,
        sats: 10,
        cumulativeSats: 10,
        btc: '0.00000010',
        cumulativeBtc: '0.00000010',
        usd: '0.01',
        cumulativeUsd: '0.01',
        chf: '0.01',
        eur: '0.01',
        php: '0.50',
        cumulativeChf: '0.01',
        cumulativeEur: '0.01',
        cumulativePhp: '0.50',
      },
    ],
    byRecipient: [
      {
        recipient: 'alice',
        giftCount: 1,
        sats: 10,
        btc: '0.00000010',
        usd: '0.01',
        chf: '0.01',
        eur: '0.01',
        php: '0.50',
      },
    ],
    byMonth: [
      {
        month: '2026-06',
        giftCount: 1,
        sats: 10,
        btc: '0.00000010',
        usd: '0.01',
        chf: '0.01',
        eur: '0.01',
        php: '0.50',
      },
    ],
    fx,
  };

  it('accepts a full stats payload', () => {
    expect(giftStatsSchema.parse(stats)).toEqual(stats);
  });

  it('accepts a spendOverTime day without giftCount', () => {
    const day = stats.spendOverTime[0];
    expect(day).toBeDefined();
    const withoutCount = { ...day };
    delete withoutCount.giftCount;
    const parsed = giftStatsSchema.parse({
      ...stats,
      spendOverTime: [withoutCount],
    });
    expect(parsed.spendOverTime[0]?.giftCount).toBeUndefined();
  });

  it('accepts null date range', () => {
    const empty = {
      ...stats,
      giftCount: 0,
      totalSats: 0,
      totalBtc: '0.00000000',
      totalUsd: '0.00',
      totalChf: '0.00',
      totalEur: '0.00',
      totalPhp: '0.00',
      recipientCount: 0,
      firstPaidAt: null,
      lastPaidAt: null,
      spendOverTime: [],
      byRecipient: [],
      byMonth: [],
    };
    expect(giftStatsSchema.parse(empty)).toEqual(empty);
  });

  it('rejects a negative sat count', () => {
    expect(() => giftStatsSchema.parse({ ...stats, totalSats: -1 })).toThrow();
  });

  it('rejects a payload missing totalBtc', () => {
    expect(() =>
      giftStatsSchema.parse(
        Object.fromEntries(Object.entries(stats).filter(([key]) => key !== 'totalBtc')),
      ),
    ).toThrow();
  });

  it('rejects a payload missing totalUsd', () => {
    expect(() =>
      giftStatsSchema.parse(
        Object.fromEntries(Object.entries(stats).filter(([key]) => key !== 'totalUsd')),
      ),
    ).toThrow();
  });

  it('rejects a payload missing fx', () => {
    expect(() =>
      giftStatsSchema.parse(
        Object.fromEntries(Object.entries(stats).filter(([key]) => key !== 'fx')),
      ),
    ).toThrow();
  });

  it('rejects a bad BTC money string', () => {
    expect(() => giftStatsSchema.parse({ ...stats, totalBtc: '0.015' })).toThrow();
  });

  it('rejects a bad USD money string', () => {
    expect(() => giftStatsSchema.parse({ ...stats, totalUsd: '1425' })).toThrow();
  });
});
