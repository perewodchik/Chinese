/**
 * Bundles the production server into dist-server/server.mjs.
 *
 * Only the server's own code and `shared/` go into the bundle; packages stay in
 * node_modules, where Node finds them at run time.
 *
 *   node scripts/build-server.mjs
 */
import { build } from 'esbuild';

await build({
  entryPoints: { server: 'server/src/main.ts' },
  outdir: 'dist-server',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});
