/**
 * Abort window for every server-side read of the 21.gifts api that a page,
 * metadata, or route handler awaits before it can answer: public note
 * metadata, short-link resolution, and the public shop page.
 */
export const API_FETCH_TIMEOUT_MS = 2500;
