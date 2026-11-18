/** What Vite puts into the page from the environment at build time (VITE_… only). */
interface ImportMetaEnv {
  /**
   * The feedback form (a Google Form's prefilled link), with %PAGE% and %USER%
   * where the page's address and the account's name go (and %MESSAGE% for
   * what went wrong, from the error page). Unset: no feedback row.
   */
  readonly VITE_FEEDBACK_URL?: string;
  /** `on` builds the app with Speak (src/navigation/features.ts); anything else, without it. */
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
