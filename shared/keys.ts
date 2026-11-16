/**
 * A learner's key the service turned away (K18): not accepted, or no balance
 * left. Marked at the first such answer; nothing more is sent with it until
 * the key is saved again or "Try again" clears the mark.
 */
export interface BrokenKey {
  reason: 'key' | 'balance';
  /** what the service said, in a sentence */
  message: string;
  at: number;
}
