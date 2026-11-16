import { FEEDBACK_KINDS, FEEDBACK_MAX, FEEDBACK_STATUSES, type FeedbackItem, type FeedbackKind, type FeedbackStatus } from '../../../shared/feedback';
import { NotFoundError, ValidationError } from '../domain/errors';
import type { Clock, FeedbackRepository, Tokens, UserRepository } from './ports';

/**
 * Feedback sent from the site itself (A12): kept as plain text with the page
 * it came from, listed for admins with where each stands. Nothing of the
 * account's work goes with it.
 */
export class FeedbackService {
  constructor(private readonly deps: { feedback: FeedbackRepository; users: UserRepository; clock: Clock; tokens: Tokens }) {}

  async send(userId: string, input: { kind: string; message: string; page: string }): Promise<void> {
    const message = input.message.trim();
    if (!message) throw new ValidationError('Say what it is, in a line or two.', { message: 'Say what it is.' });
    if ([...message].length > FEEDBACK_MAX) throw new ValidationError(`At most ${FEEDBACK_MAX} characters.`, { message: 'Too long.' });
    const kind: FeedbackKind = (FEEDBACK_KINDS as readonly string[]).includes(input.kind) ? (input.kind as FeedbackKind) : 'wrong';
    const now = this.deps.clock.now();
    await this.deps.feedback.add({
      id: this.deps.tokens.id(),
      userId,
      kind,
      message,
      // A path on this site, and nothing more: no host, no query that might hold a code.
      page: (input.page.startsWith('/') ? input.page.split(/[?#]/)[0]! : '/').slice(0, 200),
      createdAt: now,
      status: 'new',
      updatedAt: now,
    });
  }

  async list(status?: FeedbackStatus): Promise<FeedbackItem[]> {
    const [items, users] = await Promise.all([this.deps.feedback.list({ status, limit: 200 }), this.deps.users.list()]);
    const name = new Map(users.map((u) => [u.id, u.username]));
    return items.map((f) => ({
      id: f.id,
      kind: (FEEDBACK_KINDS as readonly string[]).includes(f.kind) ? (f.kind as FeedbackKind) : 'wrong',
      message: f.message,
      page: f.page,
      username: name.get(f.userId) ?? null,
      createdAt: f.createdAt,
      status: (FEEDBACK_STATUSES as readonly string[]).includes(f.status) ? (f.status as FeedbackStatus) : 'new',
    }));
  }

  async setStatus(id: string, status: FeedbackStatus): Promise<void> {
    if (!(await this.deps.feedback.setStatus(id, status, this.deps.clock.now()))) throw new NotFoundError('That feedback');
  }
}
