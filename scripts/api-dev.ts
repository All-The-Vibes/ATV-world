/**
 * Runs api/ (the Static Web App's Azure Functions) inside the dev server, so /api/hq works locally.
 * Turn the website mirror on with a key: `HQ_PUBLISH_KEY=anything npm run dev`. In production, Azure
 * serves api/ instead.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Plugin } from 'vite';

const MAX_BODY_BYTES = 1_000_000;

interface FunctionResponse {
    status?: number;
    headers?: Record<string, string>;
    body?: string;
}

type HttpFunction = (
    context: { res?: FunctionResponse },
    req: { method?: string; headers: Record<string, unknown>; body?: unknown; params: Record<string, string> },
) => Promise<void>;

export function apiDevPlugin(): Plugin {
    return {
        name: 'atv-api-dev',
        apply: 'serve',
        configureServer(server) {
            const require = createRequire(path.join(server.config.root, 'package.json'));
            server.middlewares.use('/api/hq', async (req, res) => {
                try {
                    const run = require('./api/hq/index.js') as HttpFunction;
                    let raw = '';
                    let bytes = 0;
                    req.setEncoding('utf8');
                    for await (const chunk of req) {
                        bytes += Buffer.byteLength(chunk);
                        if (bytes > MAX_BODY_BYTES) {
                            res.statusCode = 413;
                            res.setHeader('content-type', 'application/json');
                            res.end(JSON.stringify({ error: 'Request body is too large.' }));
                            return;
                        }
                        raw += chunk;
                    }
                    let body: unknown;
                    try {
                        body = raw ? JSON.parse(raw) : undefined;
                    } catch {
                        body = raw;
                    }
                    const context: { res?: FunctionResponse } = {};
                    // Mounted at /api/hq, so what's left of the path is the route's {action?}.
                    const action = (req.url ?? '').split('?')[0].replace(/^\/+|\/+$/g, '');
                    await run(context, { method: req.method, headers: req.headers, body, params: action ? { action } : {} });
                    const out = context.res ?? {};
                    res.statusCode = out.status ?? 200;
                    for (const [name, value] of Object.entries(out.headers ?? {})) res.setHeader(name, value);
                    res.end(out.body ?? '');
                } catch (e) {
                    res.statusCode = 500;
                    res.end(String(e));
                }
            });
        },
    };
}
