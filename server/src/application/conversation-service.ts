import {
  conversationTitle,
  TALK_SAVED_TURNS_MAX,
  type TalkConversation,
  type TalkConversationSummary,
  type TalkOptions,
  type TalkSavedTurn,
} from '../../../shared/talk';
import { NotFoundError } from '../domain/errors';
import type { Clock, ConversationRepository, Tokens } from './ports';

/** Enough to scroll through and choose from; past that, nobody is looking. */
const LIST_LIMIT = 60;

/**
 * Conversations a learner can come back to.
 *
 * The title is worked out here rather than asked for, because the learner has
 * already said what the conversation is about — in the topic they chose, or by
 * the question Claude opened with — and being made to name it afterwards is a
 * second, worse way of saying the same thing. It is recomputed on every save
 * while the topic is what names it, so changing the subject mid-conversation
 * does not leave the list describing the conversation it used to be.
 */
export class ConversationService {
  private readonly conversations: ConversationRepository;
  private readonly clock: Clock;
  private readonly tokens: Tokens;

  constructor(deps: { conversations: ConversationRepository; clock: Clock; tokens: Tokens }) {
    this.conversations = deps.conversations;
    this.clock = deps.clock;
    this.tokens = deps.tokens;
  }

  list(userId: string): Promise<TalkConversationSummary[]> {
    return this.conversations.list(userId, LIST_LIMIT);
  }

  async open(userId: string, id: string): Promise<TalkConversation> {
    const found = await this.conversations.find(userId, id);
    if (!found) throw new NotFoundError('That conversation');
    return found;
  }

  async start(userId: string, options: TalkOptions, voice: string | null): Promise<TalkConversation> {
    const now = this.clock.now();
    return this.conversations.create(userId, {
      id: this.tokens.id(),
      title: conversationTitle(options, []),
      options,
      voice,
      turns: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * The conversation as the page now has it. The page is the only writer — one
   * learner, one thread, in one tab at a time — so the last save wins rather
   * than being compared against a revision, as the workspace is.
   */
  async save(
    userId: string,
    id: string,
    patch: { options: TalkOptions; voice: string | null; turns: TalkSavedTurn[] },
  ): Promise<TalkConversation> {
    const existing = await this.open(userId, id);
    const turns = patch.turns.slice(-TALK_SAVED_TURNS_MAX);
    const next: TalkConversation = {
      ...existing,
      options: patch.options,
      voice: patch.voice,
      turns,
      title: conversationTitle(patch.options, turns),
      updatedAt: this.clock.now(),
    };
    if (!(await this.conversations.save(userId, next))) throw new NotFoundError('That conversation');
    return next;
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.conversations.delete(userId, id))) throw new NotFoundError('That conversation');
  }
}
