const env = import.meta.env as unknown as Record<string, string | undefined>;

export const PREVIEW_URL = env.VITE_PREVIEW_URL ?? 'http://localhost:5173';
export const SERVER_WS_URL = env.VITE_SERVER_WS_URL ?? 'ws://localhost:4000';
