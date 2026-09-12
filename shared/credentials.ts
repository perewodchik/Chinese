/**
 * What a name and a password have to be.
 *
 * Kept where both ends can read it: the form says what is wrong before anything
 * is sent, and the server refuses whatever gets past the form anyway. There are
 * deliberately few rules — a length, and a name made of characters that read
 * the same everywhere. Composition rules ("one capital, one symbol") make
 * passwords easier to guess rather than harder, and are left out on purpose.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;
export const PASSWORD_MIN = 8;
/** Long enough for any passphrase; short enough that hashing one is not a way to keep the server busy. */
export const PASSWORD_MAX = 256;

const NAME_SHAPE = /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u;

/** A name as it is kept: compatibility-normalised, so full-width and half-width letters agree, and trimmed. */
export const normaliseUsername = (raw: string) => raw.normalize('NFKC').trim();

/** A name as it is compared, so that "Kirill" and "kirill" are one account. */
export const usernameKey = (raw: string) => normaliseUsername(raw).toLowerCase();

export function usernameProblem(raw: string): string | null {
  const name = normaliseUsername(raw);
  const length = [...name].length;
  if (length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters.`;
  if (length > USERNAME_MAX) return `No more than ${USERNAME_MAX} characters.`;
  if (!NAME_SHAPE.test(name)) return 'Letters and digits, with . _ or - between them.';
  return null;
}

export function passwordProblem(password: string, username = ''): string | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN) return `At least ${PASSWORD_MIN} characters.`;
  if (length > PASSWORD_MAX) return `No more than ${PASSWORD_MAX} characters.`;
  if (username && usernameKey(password) === usernameKey(username)) {
    return 'Not the same as the name.';
  }
  return null;
}
