import type { BrokenKey } from '../../../shared/keys';
import { AppError } from '../domain/errors';
import type { Clock, SecretRepository } from './ports';

/**
 * Keys a service turned away (K18), kept beside the key itself as
 * `<service>:broken`: one answer that the key is refused or has no balance is
 * enough to stop calling with it — every further try would fail the same way
 * and say so again. Cleared when the key is saved again or forgotten, or by
 * "Try again".
 */
export class BrokenKeys {
  constructor(private readonly deps: { secrets: SecretRepository; clock: Clock }) {}

  private name = (service: string) => `${service}:broken`;

  async get(userId: string, service: string): Promise<BrokenKey | null> {
    const raw = await this.deps.secrets.get(userId, this.name(service));
    if (!raw) return null;
    try {
      const b = JSON.parse(raw) as Partial<BrokenKey>;
      if ((b.reason === 'key' || b.reason === 'balance') && typeof b.message === 'string' && typeof b.at === 'number') return { reason: b.reason, message: b.message, at: b.at };
    } catch {
      /* an unreadable mark is no mark */
    }
    return null;
  }

  async mark(userId: string, service: string, reason: BrokenKey['reason'], message: string): Promise<void> {
    const at = this.deps.clock.now();
    await this.deps.secrets.set(userId, this.name(service), JSON.stringify({ reason, message: message.slice(0, 300), at }), at);
  }

  clear(userId: string, service: string): Promise<void> {
    return this.deps.secrets.delete(userId, this.name(service));
  }

  /** Refuses before the service is called, when the key is known to be turned away. */
  async guard(userId: string, service: string): Promise<void> {
    const b = await this.get(userId, service);
    if (b) throw new AppError('unavailable', `${b.message} Nothing more is sent with this key: save it again once it is fixed, or Try again, in Settings › Keys & services.`);
  }
}
