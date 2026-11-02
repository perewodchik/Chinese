import { createHmac } from 'node:crypto';
import type { EvalKeys, EvalResult, Strictness, SyllableEval } from '../../../shared/speechEval';

/**
 * iFlytek's speech evaluation (语音评测, streaming), for Mandarin sentences:
 * a WebSocket signed with the learner's keys, the text, then the audio in
 * frames; the answer is an XML report scoring the whole and every syllable.
 *
 *   wss://ise-api.xfyun.cn/v2/open-ise   ent cn_vip, category read_sentence
 *
 * The docs describe perr_msg two ways — as one code per phone (1 sounds, 2
 * tone, 3 both), and per phone kind (on an initial, 1 is wrong; on a final,
 * 1 the final, 2 the tone, 3 both) — which agree wherever an initial's code
 * is read as "the initial was wrong", so that is how it is read here.
 */

const HOST = 'ise-api.xfyun.cn';
const PATH = '/v2/open-ise';
/** The largest frame the service takes: 0.6 s of 16 kHz 16-bit audio. */
const FRAME = 19_200;

export class EvaluatorRefused extends Error {
  constructor(
    message: string,
    readonly reason: 'keys' | 'failed',
  ) {
    super(message);
  }
}

/** The signed address: HMAC-SHA256 over host, date and the request line, with the API secret. */
export function signedUrl(keys: EvalKeys, date = new Date().toUTCString()): string {
  const origin = `host: ${HOST}\ndate: ${date}\nGET ${PATH} HTTP/1.1`;
  const signature = createHmac('sha256', keys.apiSecret).update(origin).digest('base64');
  const authorization = Buffer.from(
    `api_key="${keys.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`,
  ).toString('base64');
  return `wss://${HOST}${PATH}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${HOST}`;
}

/** Scores `pcm` (16 kHz, 16-bit, mono) as a reading of `text`. */
export async function evaluate(keys: EvalKeys, o: { text: string; pcm: Uint8Array; strictness: Strictness }): Promise<EvalResult> {
  const xml = await new Promise<string>((resolve, reject) => {
    const ws = new WebSocket(signedUrl(keys));
    const timer = setTimeout(() => {
      ws.close();
      reject(new EvaluatorRefused('iFlytek did not answer in time.', 'failed'));
    }, 30_000);
    const fail = (err: EvaluatorRefused) => {
      clearTimeout(timer);
      ws.close();
      reject(err);
    };
    ws.onerror = () => fail(new EvaluatorRefused('iFlytek could not be reached, or did not accept the keys.', 'keys'));
    ws.onopen = async () => {
      ws.send(
        JSON.stringify({
          common: { app_id: keys.appId },
          business: {
            sub: 'ise',
            ent: 'cn_vip',
            category: 'read_sentence',
            cmd: 'ssb',
            text: `﻿${o.text}`,
            tte: 'utf-8',
            ttp_skip: true,
            aue: 'raw',
            auf: 'audio/L16;rate=16000',
            rstcd: 'utf8',
            group: 'adult',
            check_type: o.strictness,
          },
          data: { status: 0 },
        }),
      );
      const frames = Math.max(1, Math.ceil(o.pcm.length / FRAME));
      for (let i = 0; i < frames; i++) {
        const last = i === frames - 1;
        const chunk = o.pcm.subarray(i * FRAME, (i + 1) * FRAME);
        ws.send(
          JSON.stringify({
            business: { cmd: 'auw', aus: last ? 4 : i === 0 ? 1 : 2, aue: 'raw' },
            data: { status: last ? 2 : 1, data: Buffer.from(chunk).toString('base64') },
          }),
        );
        // A breath between frames, as the service asks; a frame is 0.6 s of sound.
        if (!last) await new Promise((r) => setTimeout(r, 20));
      }
    };
    ws.onmessage = (e) => {
      let msg: { code?: number; message?: string; data?: { status?: number; data?: string } };
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (msg.code && msg.code !== 0) {
        const keysWrong = [10313, 10316, 11200, 10105, 10106, 10107].includes(msg.code) || /appid|auth|license|signature/i.test(msg.message ?? '');
        fail(new EvaluatorRefused(`iFlytek: ${msg.message ?? 'refused'} (${msg.code})`, keysWrong ? 'keys' : 'failed'));
        return;
      }
      if (msg.data?.status === 2 && msg.data.data) {
        clearTimeout(timer);
        ws.close();
        resolve(Buffer.from(msg.data.data, 'base64').toString('utf8'));
      }
    };
  });
  return parseReport(xml);
}

/* ------------------------------------------------------------ the report */

interface Node {
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
}

/** The report's elements as a tree: it is plain, attribute-only XML, read without a library. */
function tree(xml: string): Node {
  const root: Node = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const tagRe = /<(\/?)([\w:-]+)([^>]*?)(\/?)>/g;
  for (const m of xml.matchAll(tagRe)) {
    const [, closing, tag, rest, selfClosing] = m;
    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of rest!.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]!] = a[2]!;
    const node: Node = { tag: tag!, attrs, children: [] };
    stack[stack.length - 1]!.children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root;
}

const all = (n: Node, tag: string): Node[] => [...(n.tag === tag ? [n] : []), ...n.children.flatMap((c) => all(c, tag))];
const num = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
};
const SAID: Record<string, SyllableEval['said']> = { '0': 'ok', '16': 'missed', '32': 'added', '64': 'repeated', '128': 'replaced' };

/** The scores and each syllable's faults, from iFlytek's XML report. */
export function parseReport(xml: string): EvalResult {
  const root = tree(xml);
  // The scored sentence is the one under rec_paper; the outer element carries no scores.
  const scored = all(root, 'rec_paper').flatMap((p) => p.children)[0] ?? all(root, 'read_sentence').find((n) => n.attrs.total_score) ?? root;
  const sentence = all(scored, 'sentence')[0] ?? scored;
  const at = (k: string) => sentence.attrs[k] ?? scored.attrs[k];
  const syllables: SyllableEval[] = all(scored, 'syll')
    .filter((s) => (s.attrs.rec_node_type ?? 'paper') === 'paper' && s.attrs.content && !/^(sil|fil)$/.test(s.attrs.content))
    .map((s) => {
      const phones = all(s, 'phone');
      const perr = (yun: boolean) => phones.filter((p) => (p.attrs.is_yun === '1') === yun).map((p) => Number(p.attrs.perr_msg ?? 0));
      const initials = perr(false);
      const finals = perr(true);
      return {
        char: s.attrs.content!,
        symbol: s.attrs.symbol ?? '',
        said: SAID[s.attrs.dp_message ?? '0'] ?? 'ok',
        initial: initials.some((p) => p !== 0),
        final: finals.some((p) => p === 1 || p === 3),
        tone: finals.some((p) => p === 2 || p === 3),
        from: Number(s.attrs.beg_pos ?? 0) * 10,
        to: Number(s.attrs.end_pos ?? 0) * 10,
      };
    });
  return {
    total: num(at('total_score')),
    tone: num(at('tone_score')),
    sounds: num(at('phone_score')),
    fluency: num(at('fluency_score')),
    completeness: num(at('integrity_score')),
    rejected: (scored.attrs.is_rejected ?? sentence.attrs.is_rejected) === 'true',
    syllables,
  };
}
