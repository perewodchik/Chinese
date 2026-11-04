/**
 * What this device keeps for one account, apart from another's.
 *
 * A tablet is shared: one learner signs out, another signs in. Anything kept
 * in localStorage under a plain name would be read by the next account — the
 * worst of it the tries waiting to be sent, which went into whichever account
 * was signed in when they were. Kept under `hanzi/<account id>/<name>`, each
 * account has its own, and signing in as someone else finds nothing of theirs.
 *
 * A device setting (the theme, a voice, the size of the squares) is not the
 * account's business and stays under its plain name.
 */

let account: string | null = null;
const moved = new Set<string>();

/** Called by the session, before any screen of the account renders. */
export function setStorageAccount(id: string | null): void {
  account = id;
  moved.clear();
}

/**
 * The key a per-account value is kept under. A value kept under the plain name
 * from before accounts had their own space is moved, once, into the account
 * that opens it first on this device — which is the learner whose device it is.
 */
export function accountKey(name: string): string {
  if (!account) return `hanzi/signed-out/${name}`;
  const key = `hanzi/${account}/${name}`;
  if (!moved.has(name)) {
    moved.add(name);
    try {
      const old = localStorage.getItem(name);
      if (old !== null) {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, old);
        localStorage.removeItem(name);
      }
    } catch {
      // storage refused (a private window): nothing to move
    }
  }
  return key;
}
