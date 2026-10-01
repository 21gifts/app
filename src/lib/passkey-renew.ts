import { fetchMe, finishPasskeySeed, postPasskeyRenewReport, startPasskeySeed } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { reportDiagnostic } from '@/lib/diagnostics';
import {
  passkeyRenewClientCapabilities,
  passkeyRenewDebug,
  passkeyRenewDebugFields,
  type PasskeyRenewDebug,
} from '@/lib/passkey-renew-debug';
import { classifyWebAuthnError, obtainPrfFirst, prfEvalFirstSalt } from '@/lib/prf-mnemonic';
import { rememberPhraseFromPrf } from '@/lib/wallet/wallet-phrase';
import { creationOptionsFromJSON, credentialToJSON } from '@/lib/webauthn-browser';
import { useAuthStore } from '@/stores/auth-store';

/** Result of {@link renewPasskey}. `kind` and `prfFirst` stay in memory only. */
export type PasskeyRenewResult =
  | { outcome: 'ok'; account: Account; prfFirst: Uint8Array }
  | { outcome: 'cancelled' }
  | { outcome: 'stored'; account: Account }
  | {
      outcome: 'failed';
      kind: 'timeout' | 'prfUnsupported' | 'generic';
      account?: Account;
    };

const HTTP_SEED_FAILURE = /^Failed to (start|finish) passkey seed: \d+$/;

function isCurrentSession(token: string): boolean {
  return useAuthStore.getState().session === token;
}

function hasSeedPasskey(credentialId: string | null | undefined): boolean {
  return typeof credentialId === 'string' && credentialId !== '';
}

function isHttpSeedFailure(err: unknown): boolean {
  return err instanceof Error && HTTP_SEED_FAILURE.test(err.message);
}

function failKind(err: unknown): 'timeout' | 'prfUnsupported' | 'generic' {
  const message = err instanceof Error ? err.message : '';
  if (message === 'wallet.prfUnsupported' || message === 'prfUnsupported') {
    return 'prfUnsupported';
  }
  return classifyWebAuthnError(err) === 'timeout' ? 'timeout' : 'generic';
}

function errorNameOf(err: unknown): string {
  if (err !== null && typeof err === 'object' && 'name' in err) {
    const name = (err as { name: unknown }).name;
    if (typeof name === 'string' && name !== '') {
      return name;
    }
  }
  return 'Error';
}

function errorCodeOf(err: unknown): string | null {
  if (err === null || typeof err !== 'object' || !('code' in err)) {
    return null;
  }
  const code = (err as { code: unknown }).code;
  if (typeof code === 'string' || (typeof code === 'number' && Number.isFinite(code))) {
    return String(code);
  }
  return null;
}

function errorMessageOf(err: unknown): string {
  return (err instanceof Error ? err.message : String(err ?? '')).slice(0, 500);
}

async function reportRenew(
  sessionToken: string,
  stage: 'begin' | 'ceremony' | 'finish',
  outcome: 'failed' | 'cancelled',
  err: unknown,
  debug: PasskeyRenewDebug | null = null,
): Promise<Account | null> {
  try {
    const clientCapabilities = await passkeyRenewClientCapabilities();
    if (!isCurrentSession(sessionToken)) {
      return null;
    }
    return await postPasskeyRenewReport(sessionToken, {
      stage,
      outcome,
      errorName: errorNameOf(err),
      errorCode: errorCodeOf(err),
      httpStatus: null,
      message: errorMessageOf(err),
      ...passkeyRenewDebugFields(debug),
      ...(clientCapabilities === null ? {} : { clientCapabilities }),
    });
  } catch {
    // A failed report must not hide the local failure.
    return null;
  }
}

function openFailureAccount(reported: Account | null, latest: Account | null): Account | null {
  if (reported?.passkeyRenewFailed === true) {
    return reported;
  }
  if (latest?.passkeyRenewFailed === true) {
    return latest;
  }
  return null;
}

async function storedOrFailed(
  sessionToken: string,
  err: unknown,
  reported: Account | null,
): Promise<PasskeyRenewResult> {
  if (!isCurrentSession(sessionToken)) {
    return { outcome: 'cancelled' };
  }
  let latest: Account | null = null;
  let fetchFailed = false;
  try {
    latest = await fetchMe(sessionToken);
  } catch {
    fetchFailed = true;
  }
  if (!isCurrentSession(sessionToken)) {
    return { outcome: 'cancelled' };
  }
  if (!fetchFailed && latest !== null && hasSeedPasskey(latest.passkeyCredentialId)) {
    return { outcome: 'stored', account: latest };
  }
  const openFailure = openFailureAccount(reported, fetchFailed ? null : latest);
  const kind = failKind(err);
  if (openFailure === null) {
    return { outcome: 'failed', kind };
  }
  return { outcome: 'failed', kind, account: openFailure };
}

function diagnosticName(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('name' in error)) {
    return undefined;
  }
  const name = (error as { name: unknown }).name;
  return typeof name === 'string' ? name : undefined;
}

function diagnosticMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return undefined;
  }
  const message = (error as { message: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

function accountIdFromOptions(options: unknown): string | undefined {
  if (options === null || typeof options !== 'object') {
    return undefined;
  }
  const user = (options as { user?: unknown }).user;
  if (user === null || typeof user !== 'object') {
    return undefined;
  }
  const name = (user as { name?: unknown }).name;
  return typeof name === 'string' ? name : undefined;
}

function reportSeedDiagnostic(
  stage: 'begin' | 'ceremony' | 'finish',
  err: unknown,
  challengeId: string | undefined,
): void {
  if (stage === 'begin') {
    reportDiagnostic({
      event: 'client.passkey.seed.begin',
      stage: 'seed',
      name: diagnosticName(err),
      message: diagnosticMessage(err),
    });
    return;
  }
  if (stage === 'ceremony' && classifyWebAuthnError(err) === 'cancel') {
    reportDiagnostic({
      event: 'client.passkey.cancel',
      stage: 'seed',
      name: diagnosticName(err),
    });
    return;
  }
  reportDiagnostic({
    event: stage === 'finish' ? 'client.passkey.seed.finish' : 'client.passkey.seed.ceremony',
    stage: 'seed',
    ...(stage === 'finish' ? { challengeId } : {}),
    name: diagnosticName(err),
    message: diagnosticMessage(err),
  });
}

async function mergePrfExtension(
  options: PublicKeyCredentialCreationOptions,
): Promise<PublicKeyCredentialCreationOptions> {
  const salt = await prfEvalFirstSalt();
  const first = new Uint8Array(salt.byteLength);
  first.set(salt);
  const extensions = {
    ...(options.extensions ?? {}),
    prf: { eval: { first } },
  };
  return { ...options, extensions };
}

/**
 * Runs the signed-in seed-passkey ceremony (PRF recovery phrase). Does not
 * throw for ceremony failures; those are result values.
 *
 * @param sessionToken - Bearer session that started the ceremony.
 * @returns Outcome, and on success the finished account plus in-memory PRF bytes.
 */
export async function renewPasskey(sessionToken: string): Promise<PasskeyRenewResult> {
  let stage: 'begin' | 'ceremony' | 'finish' = 'begin';
  let challengeId: string | undefined;
  let debug: PasskeyRenewDebug | null = null;
  try {
    const begin = await startPasskeySeed(sessionToken);
    challengeId = begin.challengeId;
    if (!isCurrentSession(sessionToken)) {
      return { outcome: 'cancelled' };
    }
    reportDiagnostic({
      event: 'client.passkey.seed.begin',
      stage: 'seed',
      challengeId: begin.challengeId,
      accountId: accountIdFromOptions(begin.options),
    });
    stage = 'ceremony';
    const options = await mergePrfExtension(creationOptionsFromJSON(begin.options));
    const credential = (await navigator.credentials.create({
      publicKey: options,
    })) as PublicKeyCredential | null;
    if (!isCurrentSession(sessionToken)) {
      return { outcome: 'cancelled' };
    }
    if (!credential) {
      reportDiagnostic({
        event: 'client.passkey.seed.ceremony',
        stage: 'seed',
        message: 'no credential',
      });
      return { outcome: 'cancelled' };
    }
    debug = passkeyRenewDebug(credential, null);
    const prfFirst = await obtainPrfFirst(credential);
    if (!isCurrentSession(sessionToken)) {
      return { outcome: 'cancelled' };
    }
    if (!prfFirst) {
      debug = passkeyRenewDebug(credential, false);
      reportDiagnostic({
        event: 'client.passkey.seed.prf',
        prfPresent: false,
        stage: 'seed',
      });
      const prfErr = Object.assign(new Error('wallet.prfUnsupported'), { name: 'prfUnsupported' });
      const reported = await reportRenew(sessionToken, 'ceremony', 'failed', prfErr, debug);
      return storedOrFailed(sessionToken, prfErr, reported);
    }
    reportDiagnostic({
      event: 'client.passkey.seed.prf',
      prfPresent: true,
      stage: 'seed',
    });
    const credentialJson = credentialToJSON(credential);
    stage = 'finish';
    const nextAccount = await finishPasskeySeed(sessionToken, begin.challengeId, credentialJson);
    if (!isCurrentSession(sessionToken)) {
      return { outcome: 'cancelled' };
    }
    void rememberPhraseFromPrf({
      prfFirst,
      credentialId: credential.id,
      account: nextAccount,
      sessionToken,
    });
    return { outcome: 'ok', account: nextAccount, prfFirst };
  } catch (err) {
    reportSeedDiagnostic(stage, err, challengeId);
    if (!isCurrentSession(sessionToken)) {
      return { outcome: 'cancelled' };
    }
    if (isHttpSeedFailure(err)) {
      return storedOrFailed(sessionToken, err, null);
    }
    if (classifyWebAuthnError(err) === 'cancel') {
      await reportRenew(sessionToken, 'ceremony', 'cancelled', err, debug);
      return { outcome: 'cancelled' };
    }
    const reported = await reportRenew(sessionToken, stage, 'failed', err, debug);
    return storedOrFailed(sessionToken, err, reported);
  }
}
