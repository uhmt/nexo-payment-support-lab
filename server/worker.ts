import { api, secureHeaders } from './api.js';
import { d1Store, type D1 } from './store.js';
// Replaced by the build script with the compiled application assets.
import assets from '../.generated/assets.json';
export default {
  async fetch(req: Request, env: { DB: D1 }) {
    const path = new URL(req.url).pathname;
    if (path.startsWith('/api/')) return api(req, d1Store(env.DB));
    const asset = (assets as Record<string, { body: string; type: string }>)[
      path === '/' ? '/index.html' : path
    ];
    if (!asset) return new Response('Not found', { status: 404 });
    return new Response(asset.body, {
      headers: { ...secureHeaders, 'Content-Type': asset.type, 'Cache-Control': 'no-cache' },
    });
  },
};
