import { redirect } from 'next/navigation';

/**
 * `/profile/apply` redirects to the grants apply walk.
 *
 * @returns This function does not return; it redirects.
 */
export default function FundingApplyPage(): never {
  redirect('/grants/apply');
}
