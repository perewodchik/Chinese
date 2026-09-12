/**
 * Saving at the moments a browser gives notice of.
 *
 * The tab going into the background — the iPad's app switcher, a laptop lid —
 * is the last reliable chance to send anything, so unsaved work goes then
 * rather than after the usual pause. The tab coming back, or the connection
 * returning, is when it is worth asking whether another device saved something
 * in the meantime.
 */
export function followPageLifecycle(
  sync: { flush(): Promise<void>; refresh(): Promise<void> },
  outbox: { heartbeat(): void; release(): void },
): () => void {
  let lastLook = 0;
  // Coming back to a tab fires visibility and focus together; one look will do.
  const look = () => {
    const now = Date.now();
    if (now - lastLook < 5_000) return;
    lastLook = now;
    void sync.refresh();
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void sync.flush();
    else look();
  };
  const onOnline = () => void sync.refresh();
  const onPageHide = () => {
    void sync.flush();
    outbox.release();
  };
  const onPageShow = (e: PageTransitionEvent) => {
    if (!e.persisted) return;
    // Back from the back/forward cache: this tab is alive after all.
    outbox.heartbeat();
    look();
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', look);
  window.addEventListener('online', onOnline);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', look);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
  };
}
