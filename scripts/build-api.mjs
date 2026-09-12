/**
 * Bundles the Vercel function into api/index.js.
 *
 * The same idea as build-server.mjs, for the same reason: the server's own code
 * goes into one file and the packages stay in node_modules. Here it also keeps
 * TypeScript away from Vercel's builder, which compiles a .ts function against
 * the root tsconfig and fails on every extensionless relative import.
 *
 * The result is committed, because that is how Vercel finds the function in the
 * first place; running this again is what keeps it honest.
 *
 *   node scripts/build-api.mjs
 */
import { build } from 'esbuild';

await build({
  entryPoints: { index: 'server/src/vercel.ts' },
  outdir: 'api',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  banner: { js: '// Built from server/src/vercel.ts by scripts/build-api.mjs — do not edit.' },
  logLevel: 'info',
});
