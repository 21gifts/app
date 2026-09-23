import type { ReactElement } from 'react';
import { PayLinkScreen } from '@/components/PayLinkScreen';

/**
 * Public Open CryptoPay landing page for a single LNURL recipient.
 *
 * @param props - Promise of query parameters containing `lightning`.
 * @returns The public payment screen.
 */
export default async function PayLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ lightning?: string | string[] }>;
}): Promise<ReactElement> {
  const { lightning } = await searchParams;
  const value = Array.isArray(lightning) ? (lightning[0] ?? '') : (lightning ?? '');
  return <PayLinkScreen lightning={value} />;
}
