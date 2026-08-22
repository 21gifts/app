import { proxyMeLightningAddressDelete, proxyMeLightningAddressPost } from '@/lib/api-proxies';

/** App Router POST for `/me/lightning-address`. */
export const POST = proxyMeLightningAddressPost;

/** App Router DELETE for `/me/lightning-address`. */
export const DELETE = proxyMeLightningAddressDelete;
