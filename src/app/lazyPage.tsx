import { lazy, Suspense, type ComponentType } from 'react';

/**
 * A page fetched only when it is opened (R5): Read, a text and the cards come
 * with the app; videos, Speak, settings, the account, the admin pages and
 * everything that prints are pieces of their own. While a piece loads, the
 * page's place is held at its height, so nothing jumps when it arrives.
 */
export function lazyPage<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string): ComponentType {
  const Lazy = lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
  function LazyPage() {
    return (
      <Suspense fallback={<div className="page-loading" aria-busy="true" aria-label="Loading" />}>
        <Lazy />
      </Suspense>
    );
  }
  LazyPage.displayName = `Lazy(${name})`;
  return LazyPage;
}
