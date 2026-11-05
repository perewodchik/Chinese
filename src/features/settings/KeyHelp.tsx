import { useState } from 'react';
import { Icon } from '../../ui/Icon';

/**
 * Where a key of the learner's own comes from, folded under its card until
 * asked for: the steps, what it costs, and how to paste it here.
 *
 * What the services say about themselves was read on their own sites on
 * 5 November 2026 (speechsuper.com/pricing.html and /free-trial.html;
 * platform.minimax.io/docs/guides/quickstart-preparation and /pricing). It
 * changes: check it again before changing a word of it, and move the date.
 */

const CHECKED = 'As the services described it on 5 November 2026.';

const HELP = {
  speechsuper: {
    steps: [
      'SpeechSuper sells to companies: there is no page to sign yourself up. Ask for a trial key at speechsuper.com/free-trial.html, with an e-mail address of your work — they answer within a working day.',
      'Their e-mail gives you an appKey and a secretKey. Paste each into its box here and save.',
      'After the trial it is paid as you go: $0.006 a sentence scored, with $20 a month the least they bill.',
    ],
    link: { href: 'https://www.speechsuper.com/free-trial.html', label: 'Ask SpeechSuper for a trial key' },
  },
  minimax: {
    steps: [
      'Make an account at platform.minimax.io.',
      'In API Keys, choose Create new secret key, and copy it.',
      'In Billing, Balance, put a few dollars on the account: readings are paid from it. A text of a few hundred characters costs a few cents; a voice made from a description costs $3 the first time it reads.',
      'Paste the key into the box here and save.',
    ],
    link: { href: 'https://platform.minimax.io/user-center/basic-information/interface-key', label: 'Open MiniMax’s API Keys' },
  },
} as const;

export function KeyHelp({ service }: { service: keyof typeof HELP }) {
  const [open, setOpen] = useState(false);
  const help = HELP[service];
  return (
    <div className="key-help">
      <button type="button" className="btn quiet sm key-help-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        Where to get {service === 'speechsuper' ? 'the keys' : 'the key'}
        <Icon name="down" size={16} />
      </button>
      {open && (
        <div className="key-help-body">
          <ol className="small">
            {help.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="small" style={{ margin: 0 }}>
            On the iPhone, copy it there (hold on it, then Copy), come back, and hold in the box here to Paste. Pasted on the
            computer instead, it is in your account on every device.
          </p>
          <a className="small" href={help.link.href} target="_blank" rel="noreferrer">
            {help.link.label}
          </a>
          <p className="tiny muted" style={{ margin: 0 }}>
            {CHECKED} Nothing here is needed to read, write or hear a line: the key adds {service === 'speechsuper' ? 'the scores' : 'a narrator’s voice'}.
          </p>
        </div>
      )}
    </div>
  );
}
