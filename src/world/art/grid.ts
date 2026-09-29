/**
 * A tiny letter canvas for drawing `.px` art in code — used by the art build
 * (scripts/world/art) and, for the hero's layers, by the game itself: fill, lines, ellipses,
 * patterns, and the one move that makes a sprite read as Pokémon Black/White
 * — a dark outline around everything drawn, added afterwards.
 */

export class Grid {
  readonly rows: string[][];

  constructor(readonly w: number, readonly h: number, fill = '.') {
    this.rows = Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
  }

  static from(lines: string[]): Grid {
    const g = new Grid(lines[0]!.length, lines.length);
    lines.forEach((l, y) => [...l].forEach((c, x) => g.set(x, y, c)));
    return g;
  }

  clone(): Grid {
    return Grid.from(this.lines());
  }

  get(x: number, y: number): string {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? '.' : this.rows[y]![x]!;
  }

  set(x: number, y: number, c: string): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h && c !== ' ') this.rows[y]![x] = c;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }

  hline(x: number, y: number, w: number, c: string): this {
    return this.rect(x, y, w, 1, c);
  }

  vline(x: number, y: number, h: number, c: string): this {
    return this.rect(x, y, 1, h, c);
  }

  /** A filled ellipse inside the box. */
  oval(x: number, y: number, w: number, h: number, c: string): this {
    const cx = x + (w - 1) / 2;
    const cy = y + (h - 1) / 2;
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        const dx = (i - cx) / (w / 2);
        const dy = (j - cy) / (h / 2);
        if (dx * dx + dy * dy <= 1.0) this.set(i, j, c);
      }
    }
    return this;
  }

  /** Paint `c` wherever `test(x, y, current)` holds. */
  where(test: (x: number, y: number, cur: string) => boolean, c: string | ((x: number, y: number, cur: string) => string)): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const cur = this.get(x, y);
        if (test(x, y, cur)) this.set(x, y, typeof c === 'string' ? c : c(x, y, cur));
      }
    }
    return this;
  }

  /** Swap letters: `{ r: 'n' }`. */
  swap(map: Record<string, string>): this {
    return this.where((_x, _y, c) => c in map, (_x, _y, c) => map[c]!);
  }

  /** Draw another grid on top, `.` letting this one show through. */
  stamp(g: Grid, x: number, y: number): this {
    for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.get(i, j) !== '.') this.set(x + i, y + j, g.get(i, j));
    return this;
  }

  mirror(): Grid {
    return Grid.from(this.lines().map((l) => [...l].reverse().join('')));
  }

  /**
   * The outline: every empty pixel next to a drawn one (4-way) becomes `c`.
   * Shadows (`_`) are not outlined and do not count as drawn.
   */
  outline(c = 'k', ignore = '_'): this {
    const add: Array<[number, number]> = [];
    const drawn = (x: number, y: number) => {
      const v = this.get(x, y);
      return v !== '.' && v !== ignore && v !== c;
    };
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const v = this.get(x, y);
        if (v !== '.' && v !== ignore) continue;
        if (drawn(x - 1, y) || drawn(x + 1, y) || drawn(x, y - 1) || drawn(x, y + 1)) add.push([x, y]);
      }
    }
    for (const [x, y] of add) this.set(x, y, c);
    return this;
  }

  /** Shift everything by (dx, dy), empty where it leaves. */
  shift(dx: number, dy: number): Grid {
    const g = new Grid(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) g.set(x + dx, y + dy, this.get(x, y));
    return g;
  }

  lines(): string[] {
    return this.rows.map((r) => r.join(''));
  }
}
