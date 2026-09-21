import type pg from 'pg';
import type { TalkConversation, TalkConversationSummary, TalkOptions, TalkSavedTurn } from '../../../../shared/talk';
import type { ConversationRepository } from '../../application/ports';

interface Row {
  id: string;
  title: string;
  options: string;
  voice: string | null;
  turns: string;
  created_at: number;
  updated_at: number;
}

type SummaryRow = Pick<Row, 'id' | 'title' | 'options' | 'turns' | 'updated_at'>;

/** As the SQLite one, in the dialect Vercel's database speaks. */
export class PostgresConversationRepository implements ConversationRepository {
  constructor(private readonly db: pg.Pool) {}

  async list(userId: string, limit: number): Promise<TalkConversationSummary[]> {
    const { rows } = await this.db.query<SummaryRow>(
      `SELECT id, title, options, turns, updated_at FROM conversations
       WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC, id DESC LIMIT $2`,
      [userId, limit],
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      level: (JSON.parse(row.options) as TalkOptions).level,
      turns: (JSON.parse(row.turns) as TalkSavedTurn[]).length,
      updatedAt: row.updated_at,
    }));
  }

  async find(userId: string, id: string): Promise<TalkConversation | null> {
    const { rows } = await this.db.query<Row>('SELECT * FROM conversations WHERE id = $1 AND user_id = $2', [
      id,
      userId,
    ]);
    const row = rows[0];
    if (!row) return null;
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

  async create(userId: string, conversation: TalkConversation): Promise<TalkConversation> {
    await this.db.query(
      `INSERT INTO conversations (id, user_id, title, options, voice, turns, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        conversation.id,
        userId,
        conversation.title,
        JSON.stringify(conversation.options),
        conversation.voice,
        JSON.stringify(conversation.turns),
        conversation.createdAt,
        conversation.updatedAt,
      ],
    );
    return conversation;
  }

  async save(userId: string, conversation: TalkConversation): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE conversations SET title = $1, options = $2, voice = $3, turns = $4, updated_at = $5
       WHERE id = $6 AND user_id = $7`,
      [
        conversation.title,
        JSON.stringify(conversation.options),
        conversation.voice,
        JSON.stringify(conversation.turns),
        conversation.updatedAt,
        conversation.id,
        userId,
      ],
    );
    return result.rowCount === 1;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM conversations WHERE id = $1 AND user_id = $2', [id, userId]);
    return result.rowCount === 1;
  }
}
