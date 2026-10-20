import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { Recording, RecordingRepository, VoiceInfo } from '../../application/ports';

/** Sentences read aloud at home, kept in the one SQLite file. */
export class SqliteRecordingRepository implements RecordingRepository {
  private readonly byKey: StatementSync;
  private readonly insert: StatementSync;
  private readonly voiceList: StatementSync;

  constructor(private readonly db: DatabaseSync) {
    this.byKey = db.prepare('SELECT mp3 FROM recordings WHERE key = ?');
    this.insert = db.prepare(
      `INSERT INTO recordings (key, voice, voice_name, gender, text, mp3, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (key) DO NOTHING`,
    );
    this.voiceList = db.prepare(
      `SELECT voice, MIN(voice_name) AS voice_name, MIN(gender) AS gender
       FROM recordings GROUP BY voice ORDER BY voice`,
    );
  }

  async find(key: string): Promise<Uint8Array | null> {
    const row = this.byKey.get(key) as { mp3: Uint8Array } | undefined;
    return row ? new Uint8Array(row.mp3) : null;
  }

  async have(keys: readonly string[]): Promise<Set<string>> {
    if (!keys.length) return new Set();
    const rows = this.db
      .prepare(`SELECT key FROM recordings WHERE key IN (${keys.map(() => '?').join(', ')})`)
      .all(...keys) as Array<{ key: string }>;
    return new Set(rows.map((r) => r.key));
  }

  async save(r: Recording): Promise<void> {
    this.insert.run(r.key, r.voice.id, r.voice.name, r.voice.gender, r.text, r.mp3, r.createdAt);
  }

  async voices(): Promise<VoiceInfo[]> {
    const rows = this.voiceList.all() as Array<{ voice: string; voice_name: string; gender: string }>;
    return rows.map((r) => ({ id: r.voice, name: r.voice_name, gender: r.gender === 'male' ? 'male' : 'female' }));
  }
}
