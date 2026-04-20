// Browser-safe entry: client + post-message only. The Node server lives at
// `@product/bridge/server` and must not be imported from browser code.
export { createWSClient } from './client.js';
export type { WSClient } from './client.js';
export { createPostMessageBridge } from './post-message.js';
export type { PostMessageBridge } from './post-message.js';
