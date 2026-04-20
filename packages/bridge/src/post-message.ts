// Typed postMessage bridge — for editor-ui ↔ preview iframe.
//
// Caller provides Zod schemas for both directions so messages are validated at
// the trust boundary. Accepts messages only from the expected origin; drops
// everything else.

import type { ZodTypeAny, z } from 'zod';

export interface PostMessageBridge<In, Out> {
  send(msg: Out): void;
  on(handler: (msg: In) => void): () => void;
  dispose(): void;
}

export interface CreatePostMessageBridgeOptions<InSchema extends ZodTypeAny, OutSchema extends ZodTypeAny> {
  target: Window;
  targetOrigin: string;
  acceptOrigin: string | RegExp;
  inboundSchema: InSchema;
  outboundSchema: OutSchema;
}

export function createPostMessageBridge<InSchema extends ZodTypeAny, OutSchema extends ZodTypeAny>({
  target,
  targetOrigin,
  acceptOrigin,
  inboundSchema,
  outboundSchema,
}: CreatePostMessageBridgeOptions<InSchema, OutSchema>): PostMessageBridge<
  z.infer<InSchema>,
  z.infer<OutSchema>
> {
  const handlers = new Set<(msg: z.infer<InSchema>) => void>();

  const onMessage = (ev: MessageEvent) => {
    if (typeof acceptOrigin === 'string') {
      if (ev.origin !== acceptOrigin && acceptOrigin !== '*') return;
    } else if (!acceptOrigin.test(ev.origin)) {
      return;
    }
    const parsed = inboundSchema.safeParse(ev.data);
    if (!parsed.success) return;
    for (const h of handlers) h(parsed.data);
  };

  window.addEventListener('message', onMessage);

  return {
    send(msg) {
      outboundSchema.parse(msg);
      target.postMessage(msg, targetOrigin);
    },
    on(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    dispose() {
      window.removeEventListener('message', onMessage);
      handlers.clear();
    },
  };
}
