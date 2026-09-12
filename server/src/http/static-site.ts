import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type MiddlewareHandler } from 'hono';

/**
 * The built app, served beside the API.
 *
 * Two rules make client-side addresses work. Any path that is not a file and
 * has no extension gets `index.html`, so opening /collections/abc directly —
 * or reloading it — lands in the app, and the router in the browser decides
 * what that page is. A path *with* an extension that is not there is a plain
 * 404: answering a missing script with a web page fails far more confusingly
 * than not answering at all.
 */
export function staticSite(root: string) {
  const site = new Hono();
  const index = join(root, 'index.html');

  site.use('*', caching());
  site.use('*', serveStatic({ root }));
  site.get('*', async (c) => {
    if (extname(c.req.path)) return c.notFound();
    return c.html(await readFile(index, 'utf8'));
  });
  return site;
}

/**
 * Vite names what it builds after the content, so /assets can be kept for a
 * year. Everything else — the page itself, the character data, the fonts —
 * keeps its name across builds, so the browser asks each time and is told 304
 * when nothing has changed. Without the 304 that question would download five
 * megabytes of stroke outlines on every visit from the iPad.
 */
function caching(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    if (c.res.status !== 200) return;

    if (c.req.path.startsWith('/assets/')) {
      c.header('Cache-Control', 'public, max-age=31536000, immutable');
      return;
    }
    c.header('Cache-Control', 'no-cache');

    const since = c.req.header('if-modified-since');
    const modified = c.res.headers.get('last-modified');
    if (since && modified && Date.parse(modified) <= Date.parse(since)) {
      await c.res.body?.cancel();
      c.res = new Response(null, { status: 304, headers: { 'Last-Modified': modified } });
    }
  };
}
