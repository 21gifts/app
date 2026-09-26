import { proxyApiRequest } from '@/lib/api-proxy';

/**
 * Proxies POST /auth/passkey/register/begin to the 21.gifts api.
 *
 * @param request - Incoming App Router request.
 * @returns The upstream response.
 */
export async function proxyAuthPasskeyRegisterBeginPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/passkey/register/begin');
}

/**
 * Proxies POST /auth/passkey/register/finish to the 21.gifts api.
 *
 * @param request - Incoming App Router request (JSON body).
 * @returns The upstream response.
 */
export async function proxyAuthPasskeyRegisterFinishPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/passkey/register/finish');
}

/**
 * Proxies POST /auth/passkey/authenticate/begin to the 21.gifts api.
 *
 * @param request - Incoming App Router request.
 * @returns The upstream response.
 */
export async function proxyAuthPasskeyAuthenticateBeginPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/passkey/authenticate/begin');
}

/**
 * Proxies POST /auth/passkey/authenticate/finish to the 21.gifts api.
 *
 * @param request - Incoming App Router request (JSON body).
 * @returns The upstream response.
 */
export async function proxyAuthPasskeyAuthenticateFinishPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/passkey/authenticate/finish');
}

/**
 * Proxies POST /auth/passkey/replace/begin to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyAuthPasskeyReplaceBeginPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/passkey/replace/begin');
}

/**
 * Proxies POST /auth/passkey/replace/finish to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyAuthPasskeyReplaceFinishPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/passkey/replace/finish');
}

/**
 * Proxies POST /auth/passkey/seed/begin to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyAuthPasskeySeedBeginPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/passkey/seed/begin');
}

/**
 * Proxies POST /auth/passkey/seed/finish to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyAuthPasskeySeedFinishPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/auth/passkey/seed/finish');
}

/**
 * Proxies GET /me to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyMeGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me');
}

/**
 * Proxies GET /pos/charge to api `GET /pos`.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyPosGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/pos');
}

/**
 * Proxies POST /pos/charge to api `POST /pos`.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyPosPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/pos');
}

/**
 * Proxies DELETE /pos/charge to api `DELETE /pos`.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyPosDelete(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/pos');
}

/**
 * Proxies GET /me/activity to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyMeActivityGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/activity');
}

/**
 * Proxies POST /me/name to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyMeNamePost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/name');
}

/**
 * Proxies POST /me/username to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyMeUsernamePost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/username');
}

/**
 * Proxies POST /me/location to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyMeLocationPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/location');
}

/**
 * Proxies PUT /me/about to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON `{ text }`).
 * @returns The upstream response.
 */
export async function proxyMeAboutPut(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/about');
}

/**
 * Proxies GET /me/about/photo to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response (raw image bytes).
 */
export async function proxyMeAboutPhotoGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/about/photo');
}

/**
 * Proxies POST /me/setup/skip to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON `{ step }`).
 * @returns The upstream response.
 */
export async function proxyMeSetupSkipPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/setup/skip');
}

/**
 * Proxies POST /me/wallet-backup-seen to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyMeWalletBackupSeenPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/wallet-backup-seen');
}

/**
 * Proxies GET /members/:accountId to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param accountId - Member account id from the route.
 * @returns The upstream response.
 */
export async function proxyMembersGet(request: Request, accountId: string): Promise<Response> {
  return proxyApiRequest(request, `/members/${encodeURIComponent(accountId)}`);
}

/**
 * Proxies GET /members/:accountId/activity to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param accountId - Member account id from the route.
 * @returns The upstream response.
 */
export async function proxyMembersActivityGet(
  request: Request,
  accountId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/members/${encodeURIComponent(accountId)}/activity`);
}

/**
 * Proxies GET /members/:accountId/posts to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param accountId - Member account id from the route.
 * @returns The upstream response.
 */
export async function proxyMembersPostsGet(request: Request, accountId: string): Promise<Response> {
  return proxyApiRequest(request, `/members/${encodeURIComponent(accountId)}/posts`);
}

/**
 * Proxies GET /members/:accountId/replies to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param accountId - Member account id from the route.
 * @returns The upstream response.
 */
export async function proxyMembersRepliesGet(
  request: Request,
  accountId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/members/${encodeURIComponent(accountId)}/replies`);
}

/**
 * Proxies POST /me/forum-laws-dismissed to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyMeForumLawsDismissedPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/forum-laws-dismissed');
}

/**
 * Proxies POST /me/notification-level to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON `{ level }`).
 * @returns The upstream response.
 */
export function proxyMeNotificationLevelPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/notification-level');
}

/**
 * Proxies POST /me/amount-unit to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON `{ unit }`).
 * @returns The upstream response.
 */
export function proxyMeAmountUnitPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/amount-unit');
}

/**
 * Proxies POST /me/locale to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export function proxyMeLocalePost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/locale');
}

/**
 * Proxies POST /me/fiat to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export function proxyMeFiatPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/fiat');
}

/**
 * Proxies POST /me/lightning-address to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyMeLightningAddressPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/lightning-address');
}

/**
 * Proxies DELETE /me/lightning-address to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyMeLightningAddressDelete(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/lightning-address');
}

/**
 * Proxies POST /me/rules-agreement to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session, no body).
 * @returns The upstream response.
 */
export async function proxyMeRulesAgreementPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/rules-agreement');
}

/**
 * Proxies GET /lightning-address to the 21.gifts api.
 *
 * @param request - Incoming App Router request (`address` query param).
 * @returns The upstream response.
 */
export async function proxyLightningAddressGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/lightning-address');
}

/**
 * Proxies GET /gifts/stats to the 21.gifts api (forwards `recipient` query).
 *
 * @param request - Incoming App Router request.
 * @returns The upstream response.
 */
export async function proxyGiftsStatsGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/gifts/stats');
}

/**
 * Proxies GET /messages/stats to the 21.gifts api.
 *
 * @param request - Incoming App Router request.
 * @returns The upstream response.
 */
export async function proxyMessagesStatsGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/messages/stats');
}

/**
 * Proxies GET /trust-chain to the 21.gifts api (Bearer forwarded).
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyTrustChainGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/trust-chain');
}

/**
 * Proxies GET /trust/proposals to the 21.gifts api (staff Bearer).
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyTrustProposalsGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/trust/proposals');
}

/**
 * Proxies POST /trust/verify to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON `{ accountId }`).
 * @returns The upstream response.
 */
export async function proxyTrustVerifyPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/trust/verify');
}

/**
 * Proxies POST /trust/propose-moderator to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON `{ accountId }`).
 * @returns The upstream response.
 */
export async function proxyTrustProposeModeratorPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/trust/propose-moderator');
}

/**
 * Proxies POST /trust/confirm-moderator to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON `{ accountId }`).
 * @returns The upstream response.
 */
export async function proxyTrustConfirmModeratorPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/trust/confirm-moderator');
}

/**
 * Proxies POST /trust/reject-moderator to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON `{ accountId }`).
 * @returns The upstream response.
 */
export async function proxyTrustRejectModeratorPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/trust/reject-moderator');
}

/**
 * Proxies POST /trust/appoint-moderator to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON `{ accountId }`).
 * @returns The upstream response.
 */
export async function proxyTrustAppointModeratorPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/trust/appoint-moderator');
}

/**
 * Proxies POST /funding/apply to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyFundingApplyPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/funding/apply');
}

/**
 * Proxies GET /funding/applications to the 21.gifts api (staff Bearer).
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyFundingApplicationsGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/funding/applications');
}

/**
 * Proxies GET /funding/applications/:accountId to the 21.gifts api (staff Bearer).
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param accountId - Subject account id from the route.
 * @returns The upstream response.
 */
export async function proxyFundingApplicationGet(
  request: Request,
  accountId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/funding/applications/${encodeURIComponent(accountId)}`);
}

/**
 * Proxies POST /funding/trial to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON `{ accountId }`).
 * @returns The upstream response.
 */
export async function proxyFundingTrialPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/funding/trial');
}

/**
 * Proxies POST /funding/admit to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON `{ accountId }`).
 * @returns The upstream response.
 */
export async function proxyFundingAdmitPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/funding/admit');
}

/**
 * Proxies POST /funding/reject to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON `{ accountId }`).
 * @returns The upstream response.
 */
export async function proxyFundingRejectPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/funding/reject');
}

/**
 * Proxies GET /gifts to the 21.gifts api (forwards `day` query).
 *
 * @param request - Incoming App Router request.
 * @returns The upstream response.
 */
export async function proxyGiftsGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/gifts');
}

/**
 * Proxies GET /messages to the 21.gifts api (app path `/forum/messages`).
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyMessagesGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/messages');
}

/**
 * Proxies GET /messages/compose-target to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyMessagesComposeTargetGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/messages/compose-target');
}

/**
 * Proxies GET /translate to the 21.gifts api.
 *
 * @param request - Incoming App Router request.
 * @returns The upstream response.
 */
export async function proxyTranslateAvailableGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/translate');
}

/**
 * Proxies POST /translate `{ messageId, target }` to api
 * `POST /messages/:id/translate`.
 *
 * @param request - Incoming App Router request (JSON body).
 * @returns The upstream response, or 400 for invalid JSON or a missing/non-string `messageId` or `target`.
 */
export async function proxyTranslateNotePost(request: Request): Promise<Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (
    typeof input !== 'object' ||
    input === null ||
    !('messageId' in input) ||
    typeof input.messageId !== 'string' ||
    !('target' in input) ||
    typeof input.target !== 'string'
  ) {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { messageId, target } = input;
  const headers = new Headers();
  const authorization = request.headers.get('authorization');
  if (authorization !== null) {
    headers.set('authorization', authorization);
  }
  headers.set('content-type', 'application/json');
  const forwarded = new Request(request.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ target }),
  });
  return proxyApiRequest(forwarded, `/messages/${encodeURIComponent(messageId)}/translate`);
}

/**
 * Proxies POST `/conversations/:conversationId/messages/:messageId/translate`
 * `{ target }` to the matching 21.gifts api path.
 *
 * @param request - Incoming App Router request (JSON body).
 * @param conversationId - Conversation UUID from the dynamic route segment.
 * @param messageId - Conversation message id from the dynamic route segment.
 * @returns The upstream response, or 400 for invalid JSON or a missing/non-string `target`.
 */
export async function proxyTranslateConversationMessagePost(
  request: Request,
  conversationId: string,
  messageId: string,
): Promise<Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (
    typeof input !== 'object' ||
    input === null ||
    !('target' in input) ||
    typeof input.target !== 'string'
  ) {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { target } = input;
  const headers = new Headers();
  const authorization = request.headers.get('authorization');
  if (authorization !== null) {
    headers.set('authorization', authorization);
  }
  headers.set('content-type', 'application/json');
  const forwarded = new Request(request.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ target }),
  });
  return proxyApiRequest(
    forwarded,
    `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(
      messageId,
    )}/translate`,
  );
}

/**
 * Proxies GET /messages/hidden to the 21.gifts api (app path `/forum/messages/hidden`).
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyMessagesHiddenGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/messages/hidden');
}

/**
 * Proxies GET /messages/places (app path /forum/messages/places). Bearer session. Returns the upstream response.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The proxied upstream response.
 */
export async function proxyMessagesPlacesGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/messages/places');
}

/**
 * Proxies POST /messages to the 21.gifts api (app path `/forum/messages`).
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyMessagesPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/messages');
}

/**
 * Proxies GET /messages/:id/replies to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param messageId - Parent forum message UUID.
 * @returns The upstream response.
 */
export async function proxyMessagesRepliesGet(
  request: Request,
  messageId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(messageId)}/replies`);
}

/**
 * Proxies GET /messages/:id to the 21.gifts api (authenticated).
 *
 * App path is `/forum/messages/:id`. Staff sessions receive soft-hidden rows.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param messageId - Forum message UUID.
 * @returns The upstream response.
 */
export async function proxyForumMessageGet(request: Request, messageId: string): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(messageId)}`);
}

/**
 * Proxies GET /messages/:id to the 21.gifts api (public; no auth).
 *
 * App path is `/public-messages/:id` so `/messages/:id` can serve HTML.
 *
 * @param request - Incoming App Router request.
 * @param messageId - Forum message UUID.
 * @returns The upstream response.
 */
export async function proxyPublicMessageGet(
  request: Request,
  messageId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(messageId)}`);
}

/**
 * Proxies GET /links/:code to the 21.gifts api (public; no auth).
 *
 * App path is `/links/:code`. The visitor redirect lives at `/l/:code`.
 *
 * @param request - Incoming App Router request.
 * @param code - Short-link code from the route.
 * @returns The upstream response.
 */
export async function proxyShortLinkGet(request: Request, code: string): Promise<Response> {
  return proxyApiRequest(request, `/links/${encodeURIComponent(code)}`);
}

/**
 * Proxies GET /messages/:id/replies to the 21.gifts api (public; no auth).
 *
 * App path is `/public-messages/:id/replies` so `/messages/:id` can serve HTML.
 *
 * @param request - Incoming App Router request.
 * @param messageId - Parent forum message UUID.
 * @returns The upstream response.
 */
export async function proxyPublicMessageRepliesGet(
  request: Request,
  messageId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(messageId)}/replies`);
}

/**
 * Proxies POST /messages/:id/invoice to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @param messageId - Forum message UUID from the public JSON.
 * @returns The upstream response.
 */
export async function proxyMessagesInvoicePost(
  request: Request,
  messageId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(messageId)}/invoice`);
}

/**
 * Proxies GET /messages/:id/repayment to the 21.gifts api.
 *
 * @param request - Incoming App Router request. No session is required.
 * @param messageId - Credit note id.
 * @returns The upstream response.
 */
export async function proxyMessagesRepaymentGet(
  request: Request,
  messageId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(messageId)}/repayment`);
}

/**
 * Proxies POST /messages/:id/repayment to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param messageId - Credit note id.
 * @returns The upstream response.
 */
export async function proxyMessagesRepaymentPost(
  request: Request,
  messageId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(messageId)}/repayment`);
}

/**
 * Proxies POST /contact to the 21.gifts api (same-origin path `/contact/submit`).
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyContactPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/contact');
}

/**
 * Proxies GET /conversations to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyConversationsGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/conversations');
}

/**
 * Proxies POST /conversations to the 21.gifts api (open from a forum note).
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyConversationsPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/conversations');
}

/**
 * Proxies GET /conversations/moderator-group to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyModeratorGroupGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/conversations/moderator-group');
}

/**
 * Proxies GET /conversations/:id to the 21.gifts api.
 *
 * Forwards the incoming query string (including `sinceMessageId` long-poll).
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param conversationId - Conversation UUID.
 * @returns The upstream response.
 */
export async function proxyConversationGet(
  request: Request,
  conversationId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/conversations/${encodeURIComponent(conversationId)}`);
}

/**
 * Proxies POST /conversations/:id to the 21.gifts api (append a reply).
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @param conversationId - Conversation UUID.
 * @returns The upstream response.
 */
export async function proxyConversationPost(
  request: Request,
  conversationId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/conversations/${encodeURIComponent(conversationId)}`);
}

/**
 * Proxies POST /conversations/:id/invoice to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @param conversationId - Conversation UUID.
 * @returns The upstream response.
 */
export async function proxyConversationInvoicePost(
  request: Request,
  conversationId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/conversations/${encodeURIComponent(conversationId)}/invoice`);
}

/**
 * Proxies POST /conversations/:id/read to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param conversationId - Conversation UUID.
 * @returns The upstream response.
 */
export async function proxyConversationReadPost(
  request: Request,
  conversationId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/conversations/${encodeURIComponent(conversationId)}/read`);
}

/**
 * Proxies GET /conversations/:id/messages/:messageId/photo or an indexed
 * photo file to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param conversationId - Conversation UUID from the dynamic route segment.
 * @param messageId - Conversation message id from the dynamic route segment.
 * @param file - Optional indexed photo filename such as `1.jpg`.
 * @returns The upstream response (raw image bytes).
 */
export async function proxyConversationMessagePhotoGet(
  request: Request,
  conversationId: string,
  messageId: string,
  file?: string,
): Promise<Response> {
  const base = `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/photo`;
  return proxyApiRequest(request, file === undefined || file === '' ? base : `${base}/${file}`);
}

/**
 * Proxies GET /notifications to the 21.gifts api (app path `/forum/notifications`).
 *
 * HTML `/notifications` is the page; Next.js forbids a `route.ts` beside that
 * `page.tsx`, so notification HTTP lives under `/forum/notifications`.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyNotificationsGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/notifications');
}

/**
 * Proxies POST /notifications/read-all to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyNotificationsReadAllPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/notifications/read-all');
}

/**
 * Proxies POST /notifications/:id/read to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @param id - Notification id from the dynamic route segment.
 * @returns The upstream response.
 */
export async function proxyNotificationReadPost(request: Request, id: string): Promise<Response> {
  return proxyApiRequest(request, `/notifications/${encodeURIComponent(id)}/read`);
}

/**
 * Proxies GET /messages/:id/photo or an indexed photo file to the 21.gifts api.
 *
 * @param request - Incoming App Router request.
 * @param id - Forum message id from the dynamic route segment.
 * @param file - Optional indexed photo filename such as `1.jpg`.
 * @returns The upstream response (raw image bytes).
 */
export async function proxyMessagesPhotoGet(
  request: Request,
  id: string,
  file?: string,
): Promise<Response> {
  const base = `/messages/${encodeURIComponent(id)}/photo`;
  return proxyApiRequest(request, file === undefined || file === '' ? base : `${base}/${file}`);
}

/**
 * Proxies GET /messages/:id/video.mp4, video.webm, or video.mov to the 21.gifts api (public; no auth).
 *
 * @param request - Incoming App Router request.
 * @param id - Forum message id from the dynamic route segment.
 * @param ext - Video file extension (`mp4` | `webm` | `mov`).
 * @returns The upstream response (raw video bytes).
 */
export async function proxyMessagesVideoGet(
  request: Request,
  id: string,
  ext: 'mp4' | 'webm' | 'mov',
): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(id)}/video.${ext}`);
}

/**
 * Proxies GET /view/:viewKey to the 21.gifts api (public; no auth).
 *
 * @param request - Incoming App Router request.
 * @param viewKey - 64-hex view key from the URL.
 * @returns The upstream response.
 */
export async function proxyViewGet(request: Request, viewKey: string): Promise<Response> {
  return proxyApiRequest(request, `/view/${encodeURIComponent(viewKey)}`);
}

/**
 * Proxies GET /view/:viewKey/activity to the 21.gifts api (public; no auth).
 *
 * @param request - Incoming App Router request.
 * @param viewKey - 64-hex view key from the URL.
 * @returns The upstream response.
 */
export async function proxyViewActivityGet(request: Request, viewKey: string): Promise<Response> {
  return proxyApiRequest(request, `/view/${encodeURIComponent(viewKey)}/activity`);
}

/**
 * Proxies GET /view/:viewKey/about/photo to the 21.gifts api (public; no auth).
 *
 * App path is `/view-key/:viewKey/about/photo`.
 *
 * @param request - Incoming App Router request.
 * @param viewKey - 64-hex view key from the URL.
 * @returns The upstream response (raw image bytes).
 */
export async function proxyViewAboutPhotoGet(request: Request, viewKey: string): Promise<Response> {
  return proxyApiRequest(request, `/view/${encodeURIComponent(viewKey)}/about/photo`);
}

/**
 * Proxies GET /push/vapid-public to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session).
 * @returns The upstream response.
 */
export async function proxyPushVapidPublicGet(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/push/vapid-public');
}

/**
 * Proxies POST /me/push-subscriptions to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyMePushSubscriptionsPost(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/push-subscriptions');
}

/**
 * Proxies DELETE /me/push-subscriptions to the 21.gifts api.
 *
 * @param request - Incoming App Router request (Bearer session + JSON body).
 * @returns The upstream response.
 */
export async function proxyMePushSubscriptionsDelete(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/me/push-subscriptions');
}

/**
 * Proxies a moderator's DELETE /messages/:id request.
 *
 * @param request - Incoming Bearer request.
 * @param messageId - Forum message UUID.
 * @returns The upstream response.
 */
export async function proxyMessagesDelete(request: Request, messageId: string): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(messageId)}`);
}

/**
 * Proxies a moderator's PATCH /messages/:id/place request.
 *
 * @param request - Incoming Bearer request with JSON `{ place }`.
 * @param messageId - Forum message UUID.
 * @returns The upstream response.
 */
export async function proxyMessagesPlacePatch(
  request: Request,
  messageId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(messageId)}/place`);
}

/**
 * Proxies a moderator's PATCH /messages/:id/shop-account request.
 *
 * @param request - Incoming Bearer request with JSON `{ username }`.
 * @param messageId - Forum message UUID.
 * @returns The upstream response.
 */
export async function proxyMessagesShopAccountPatch(
  request: Request,
  messageId: string,
): Promise<Response> {
  return proxyApiRequest(request, `/messages/${encodeURIComponent(messageId)}/shop-account`);
}
