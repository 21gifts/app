import { redirect } from 'next/navigation';

/**
 * `/moderate/applications` redirects to the grants application queue.
 *
 * @returns This function does not return; it redirects.
 */
export default function FundingApplicationsPage(): never {
  redirect('/grants/applications');
}
