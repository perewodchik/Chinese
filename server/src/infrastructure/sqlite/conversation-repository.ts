import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { TalkConversation, TalkConversationSummary, TalkOptions, TalkSavedTurn } from '../../../../shared/talk';
import type { ConversationRepository } from '../../application/ports';

interface Row {
  id: string;
  user_id: string;
  title: string;
  options: string;
  voice: string | null;
  turns: string;
  created_at: number;
  updated_at: number;
}

interface SummaryRow {
  id: string;
  title: string;
  options: string;
  turns: string;
  updated_at: number;
}

/**
 * Conversations, one row each, the turns as a JSON document inside it.
 *
 * Every read and write is scoped by user id as well as conversation id — not
 * because a stranger is expected to guess one, but because the id is the whole
 * of the address and a scoped query cannot be talked out of it.
 */
export class SqliteConversationRepository implements ConversationRepository {
  private readonly listForUser: StatementSync;
  private readonly oneForUser: StatementSync;
  private readonly insert: StatementSync;
  private readonly update: StatementSync;
  private readonly remove: StatementSync;

  constructor(db: DatabaseSync) {
    // The turns come back with the summary so the list can say how long a
    // conversation is; they are counted here rather than kept as a column
    // that could disagree with them.
    this.listForUser = db.prepare(
      `SELECT id, title, options, turns, updated_at FROM conversations
       WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC, id DESC LIMIT ?`,
    );
    this.oneForUser = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?');
    this.insert = db.prepare(
      `INSERT INTO conversations (id, user_id, title, options, voice, turns, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.update = db.prepare(
      `UPDATE conversations SET title = ?, options = ?, voice = ?, turns = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    );
    this.remove = db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?');
  }

  async list(userId: string, limit: number): Promise<TalkConversationSummary[]> {
    const rows = this.listForUser.all(userId, limit) as unknown as SummaryRow[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      level: (JSON.parse(row.options) as TalkOptions).level,
      turns: (JSON.parse(row.turns) as TalkSavedTurn[]).length,
      updatedAt: row.updated_at,
    }));
  }

  async find(userId: string, id: string): Promise<TalkConversation | null> {
    const row = this.oneForUser.get(id, userId) as Row | undefined;
    return row ? hydrate(row) : null;
  }

  async create(userId: string, conversation: TalkConversation): Promise<TalkConversation> {
    this.insert.run(
      conversation.id,
      userId,
      conversation.title,
      JSON.stringify(conversation.options),
      conversation.voice,
      JSON.stringify(conversation.turns),
      conversation.createdAt,
      conversation.updatedAt,
    );
    return conversation;
  }

  async save(userId: string, conversation: TalkConversation): Promise<boolean> {
    const result = this.update.run(
      conversation.title,
      JSON.stringify(conversation.options),
      conversation.voice,
      JSON.stringify(conversation.turns),
      conversation.updatedAt,
      conversation.id,
      userId,
    );
    return Number(result.changes) === 1;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    return Number(this.remove.run(id, userId).changes) === 1;
  }
}

function hydrate(row: Row): TalkConversation {
  return {
    id: row.id,
    title: row.title,
    options: JSON.parse(row.options) as TalkOptions,
    voice: row.voice,
    turns: JSON.parse(row.turns) as TalkSavedTurn[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
