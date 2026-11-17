import { useEffect, useState } from 'react';
import { siteInfo } from '../../api/site';

const KEY = 'hanzi.announcement';
const kept = () => {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};

/**
 * The one line whoever runs the site put over Read (A11): works tonight, new
 * texts on Friday. The last one seen is kept on the device and shown at once,
 * so the page does not move when the answer comes; nothing when there is none.
 */
export function Announcement() {
  const [line, setLine] = useState(kept);
  useEffect(() => {
    let live = true;
    siteInfo().then(
      (r) => {
        if (!live) return;
        setLine(r.announcement);
        try {
          if (r.announcement) localStorage.setItem(KEY, r.announcement);
          else localStorage.removeItem(KEY);
        } catch {
          /* kept for this visit only */
        }
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  if (!line) return null;
  return (
    <p className="small site-announcement" role="status">
      {line}
    </p>
  );
}
