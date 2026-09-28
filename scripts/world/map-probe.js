// Run inside the page by scripts/world/map-probe.ts through the WebKit probe:
// waits for the world to be ready, then reports whether the canvas drew and
// how long a frame takes. Prints WAIT until the game has started.
(() => {
  const shell = document.querySelector('.world-shell');
  if (!shell || shell.getAttribute('data-state') !== 'ready') return 'WAIT';
  const canvas = document.querySelector('.world-canvas canvas');
  if (!canvas) return 'FAIL no canvas';
  const w = window.__world;
  const fps = w && w.fps ? w.fps() : -1;
  return JSON.stringify({ ok: true, width: canvas.width, height: canvas.height, fps });
})();
