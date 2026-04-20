#!/usr/bin/env node
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { startServer } from './server.js';

// Load .env from the workspace root (two levels up from packages/server) and
// then from cwd, so either location works. Later loads do not overwrite keys
// already set in the environment — explicit env wins.
for (const candidate of [resolve(process.cwd(), '../../.env'), resolve(process.cwd(), '.env')]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
  }
}

const port = Number(process.env.PORT ?? '4000');
const projectRoot = resolve(process.env.PROJECT_ROOT ?? '../demo-app');

const apiKey = process.env.ANTHROPIC_API_KEY;
startServer({
  port,
  projectRoot,
  ...(apiKey ? { anthropicApiKey: apiKey } : {}),
})
  .then((s) => {
    const keyStatus = apiKey ? 'set' : 'MISSING (chat will error)';
    // eslint-disable-next-line no-console
    console.log(
      `[server] listening on ws://localhost:${s.port}, editing ${projectRoot} · ANTHROPIC_API_KEY: ${keyStatus}`,
    );
  })
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[server] failed to start:', err);
    process.exit(1);
  });
