import { ApiError } from '../../api/http';

/** What went wrong sending a line to be scored, said so the learner knows what to do. */
export interface Trouble {
  title: string;
  text: string;
  /** the same recording can simply be sent again */
  retry: boolean;
  settings: boolean;
}

export function troubleOf(err: unknown): Trouble {
  if (err instanceof ApiError) {
    if (err.code === 'network') {
      return /too long/.test(err.message)
        ? { title: 'No answer in time', text: 'The scoring took too long — usually a slow connection. Your recording is kept: try again.', retry: true, settings: false }
        : { title: 'No connection', text: 'The server could not be reached. Check the internet, then try again: your recording is kept.', retry: true, settings: false };
    }
    if (err.status === 404) return { title: 'No pronunciation keys', text: err.message, retry: false, settings: true };
    if (err.status === 400) return { title: 'This recording cannot be scored', text: err.message, retry: false, settings: false };
    if (err.status === 401) return { title: 'Signed out', text: 'Sign in again, then say the line once more.', retry: false, settings: false };
    if (err.status === 429) return { title: 'Too many at once', text: 'Wait a minute, then try again.', retry: true, settings: false };
    return { title: 'The scoring service failed', text: `${err.message} Your recording is kept: try again.`, retry: true, settings: /key|sig|licen|expire|quota/i.test(err.message) };
  }
  return { title: 'Something went wrong', text: err instanceof Error ? err.message : 'Try again.', retry: true, settings: false };
}

export const NOTHING_HEARD = 'Nothing came through from the microphone, so nothing was sent to be scored. Say the line again; if it happens again, reload the page, and check the browser may use the microphone (on an iPad: Settings › Safari or Chrome › Microphone).';
