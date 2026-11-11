import { useState } from 'react';
import { CATALOG_LICENCES, type CatalogKind, type CatalogLicence } from '../../../shared/catalog';
import { publishBook } from '../../api/catalog';
import { ApiError } from '../../api/http';
import type { GeneratedText, TextSet } from '../../domain/text';
import { markPublished } from '../../store/commands';
import { Field } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { Seg } from '../../ui/Seg';
import { useToast } from '../../ui/toast';
import { messageFor } from '../auth/messages';
import { NotConfirmed, useFreshPassword } from '../auth/useFreshPassword';

const LEVELS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: String(n), label: n === 7 ? '7–9' : String(n) }));
const KINDS = [
  { id: 'texts', label: 'Texts' },
  { id: 'story', label: 'A story' },
] as const;
const hasHan = (s: string) => /\p{Script=Han}/u.test(s);

/**
 * For an admin, from a book's ⋯ menu: the book published to the shared
 * catalogue, for every learner to take (T1). Once published, the same
 * sheet publishes a new version of the same book.
 *
 * What goes to the library has to be the site's own or free to share: the
 * licence is chosen from those, and pages of a real book stay on the
 * admin's own shelf.
 *
 * States: filling in (title, level, kind, a line about it, source,
 * licence); publishing (the button says so, everything waits); refused (on
 * its field, or under the form; the password asked again first when it was
 * typed long ago); published (the sheet closes and a toast says which
 * version).
 */
export function PublishSheet({ set, texts, kind, onClose }: { set: TextSet; texts: GeneratedText[]; kind: CatalogKind; onClose: () => void }) {
  const toast = useToast();
  const { confirm, sheet } = useFreshPassword();
  const [title, setTitle] = useState(hasHan(set.name) ? '' : set.name);
  const [titleZh, setTitleZh] = useState(hasHan(set.name) ? set.name : '');
  const [level, setLevel] = useState('2');
  const [bookKind, setBookKind] = useState<CatalogKind>(kind);
  const [blurb, setBlurb] = useState(set.note ?? '');
  const [source, setSource] = useState('Written with Claude for this site');
  const [licence, setLicence] = useState<CatalogLicence | ''>('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const again = Boolean(set.catalog);
  const ready = Boolean(title.trim() && blurb.trim() && source.trim() && licence && texts.length);

  async function publish() {
    if (!ready || busy || !licence) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const made = await confirm(() =>
        publishBook({ title: title.trim(), titleZh: titleZh.trim(), level: Number(level), kind: bookKind, blurb: blurb.trim(), source: source.trim(), licence }, texts, set.catalog?.id),
      );
      markPublished(set.id, { id: made.id, version: made.version });
      toast(
        `In the library as version ${made.version}${made.missingPictures ? `; ${made.missingPictures} picture${made.missingPictures === 1 ? ' was' : 's were'} not on the server and left out` : ''}`,
      );
      onClose();
    } catch (err) {
      if (err instanceof NotConfirmed) return;
      // The schema's complaints name their place (book.title, texts.3.lines); the book's own go on their fields.
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setFields(Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k.replace(/^book\./, ''), v])));
        setError(err.message);
      } else setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={again ? 'Publish a new version' : 'Publish to the library'}
      subtitle={`${texts.length} text${texts.length === 1 ? '' : 's'}, without your progress, for every learner to add to their shelves.`}
      onClose={onClose}
      footer={
        <>
          <button className="btn quiet" type="button" onClick={onClose} disabled={busy}>
            Not now
          </button>
          <button className="btn primary publish-go" type="button" onClick={() => void publish()} disabled={!ready || busy}>
            {busy ? 'Publishing…' : again ? 'Publish again' : 'Publish'}
          </button>
        </>
      }
    >
      {sheet}
      <div className="publish-form">
        <Field label="Title" error={fields.title ?? null}>
          <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Title in Chinese" hint="If it has one." error={fields.titleZh ?? null}>
          <input className="hanzi" value={titleZh} maxLength={120} onChange={(e) => setTitleZh(e.target.value)} />
        </Field>
        <div className="field">
          HSK level it is written for
          <Seg value={level} options={LEVELS} onChange={setLevel} label="HSK level" size="sm" />
        </div>
        <div className="field">
          What it is
          <Seg value={bookKind} options={KINDS} onChange={setBookKind} label="What it is" size="sm" />
        </div>
        <Field label="A line about it" hint="What a learner reads before adding it." error={fields.blurb ?? null}>
          <textarea rows={2} value={blurb} maxLength={400} onChange={(e) => setBlurb(e.target.value)} />
        </Field>
        <Field label="Where it is from" error={fields.source ?? null}>
          <input value={source} maxLength={200} onChange={(e) => setSource(e.target.value)} />
        </Field>
        <Field label="Licence" hint="Only what was written for the site, or is free to share. Pages of a real book stay on your own shelf." error={fields.licence ?? null}>
          <select value={licence} onChange={(e) => setLicence(e.target.value as CatalogLicence | '')}>
            <option value="">Choose…</option>
            {CATALOG_LICENCES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
