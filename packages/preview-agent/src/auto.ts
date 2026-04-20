// Side-effect import that starts the agent automatically. demo-app imports
// this in dev mode via `if (import.meta.env.DEV) import('@product/preview-agent/auto')`.
import { initAgent } from './agent.js';

if (typeof window !== 'undefined') {
  initAgent();
}
