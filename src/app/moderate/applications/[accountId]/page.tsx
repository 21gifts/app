import { redirect } from 'next/navigation';

/**
 * `/moderate/applications/[accountId]` redirects to the grants review.
 *
 * @param props - Dynamic route params (`accountId`).
 * @returns This function does not return; it redirects.
 */
export default async function FundingApplicationDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}): Promise<never> {
  const { accountId } = await params;
  redirect(`/grants/applications/${accountId}`);
}
