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

/**
 * The passwords of eight characters or more that are tried first by anyone
 * guessing — from the lists of leaked passwords, the English ones and those
 * Chinese and Russian speakers use most. Short, so it costs the page nothing;
 * a guesser who gets past it still meets the limits on sign-in.
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'iloveyou', 'sunshine', 'princess',
  'football', 'baseball', 'superman', 'trustno1', 'letmein1', 'welcome1', 'welcome123', 'whatever', 'starwars',
  'dragon12', 'monkey123', 'computer', 'internet', 'michelle', 'jennifer', 'qwertyui', 'qwertyuiop', 'qwerty12',
  'qwerty123', 'qwerty1234', 'asdfghjk', 'asdfasdf', 'zxcvbnm1', 'zxcvbnma', '1q2w3e4r', '1q2w3e4r5t', '1qaz2wsx',
  'zaq12wsx', 'q1w2e3r4', 'q1w2e3r4t5', '123qweasd', 'qweasdzxc', 'abcd1234', 'abc12345', 'abcdefgh', 'admin123',
  'administrator', '12345678', '123456789', '1234567890', '0123456789', '87654321', '987654321', '12341234',
  '11223344', '12344321', '123123123', '147258369', '159753456', '123654789', '11111111', '00000000', '88888888',
  '66666666', '12121212', '11112222', 'woaini520', 'woaini1314', '5201314520', '52013145', 'nihao123', 'iloveyou1',
  'qwertyqwerty', 'parol123', 'privet123', 'hanziworkshop', 'chinese1', 'chinese123',
]);

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
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'That is one of the passwords everyone tries first: pick another.';
  return null;
}
