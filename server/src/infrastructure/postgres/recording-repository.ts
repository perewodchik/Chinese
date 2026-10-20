import type pg from 'pg';
import type { Recording, RecordingRepository, VoiceInfo } from '../../application/ports';

/** Sentences read aloud at home, in Postgres, for the website to play. */
export class PostgresRecordingRepository implements RecordingRepository {
  constructor(private readonly db: pg.Pool) {}

  async find(key: string): Promise<Uint8Array | null> {
    const { rows } = await this.db.query<{ mp3: Buffer }>('SELECT mp3 FROM recordings WHERE key = $1', [key]);
    const row = rows[0];
    return row ? new Uint8Array(row.mp3) : null;
  }

  async have(keys: readonly string[]): Promise<Set<string>> {
    if (!keys.length) return new Set();
    const { rows } = await this.db.query<{ key: string }>('SELECT key FROM recordings WHERE key = ANY($1::text[])', [[...keys]]);
    return new Set(rows.map((r) => r.key));
  }

  async save(r: Recording): Promise<void> {
    await this.db.query(
      `INSERT INTO recordings (key, voice, voice_name, gender, text, mp3, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (key) DO NOTHING`,
      [r.key, r.voice.id, r.voice.name, r.voice.gender, r.text, Buffer.from(r.mp3), r.createdAt],
    );
  }

  async voices(): Promise<VoiceInfo[]> {
    const { rows } = await this.db.query<{ voice: string; voice_name: string; gender: string }>(
      `SELECT voice, MIN(voice_name) AS voice_name, MIN(gender) AS gender
       FROM recordings GROUP BY voice ORDER BY voice`,
    );
    return rows.map((r) => ({ id: r.voice, name: r.voice_name, gender: r.gender === 'male' ? 'male' : 'female' }));
  }
}
