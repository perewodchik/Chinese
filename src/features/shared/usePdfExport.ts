import { useCallback, useState } from 'react';
import type { RenderResult } from '../../pdf/render';
import { deliverPdf, safeFileName } from '../../platform/files';
import { useToast } from '../../ui/toast';

export interface PdfJob {
  /** what the file is called, before the date goes on */
  title: string;
  render: () => Promise<RenderResult>;
  /** once the file is out: anything else to do, and a sentence to add to the message */
  after?: () => string | void;
}

/**
 * Building a PDF and getting it out of the browser, with one message either way.
 *
 * Every download button in the app does the same four things — build it, name
 * it, save or download it, say so — and they used to be written out four times,
 * with four slightly different messages.
 *
 * `busy` is the key of the job running, so a screen with several buttons can
 * tell which one to disable.
 */
export function usePdfExport() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async (key: string, job: PdfJob) => {
      setBusy(key);
      try {
        const { bytes, pages } = await job.render();
        const fileName = safeFileName(job.title);
        const where = await deliverPdf(fileName, bytes);
        const extra = job.after?.();
        const done = where === 'folder' ? `Saved ${fileName} to your folder` : `Downloaded ${fileName}`;
        toast(`${done} — ${pages} page${pages === 1 ? '' : 's'}.${extra ? ` ${extra}` : ''}`);
      } catch (err) {
        toast(`Could not build the PDF: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );

  return { busy, run };
}
