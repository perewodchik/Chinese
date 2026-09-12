/**
 * Copying, with a fallback that actually works on a tablet.
 *
 * `navigator.clipboard` needs a *secure context*, and this app is meant to be
 * opened from another machine on the same Wi-Fi — `http://192.168.…` — which
 * is not one. So on the device where the copy matters most, the modern API is
 * simply not there, and the whole Texts feature is a prompt you cannot get out
 * of the page.
 *
 * The old `execCommand('copy')` path still works there, but not the textbook
 * version of it: iOS Safari will not copy from a `readonly` field, will not
 * copy from something it considers off-screen, and ignores `select()` on a
 * textarea. It wants a real selection Range over an editable element that is
 * within the viewport. Hence the contortions below, which are all load-bearing.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the old way */
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    // In the viewport, but invisible and 1px: off-screen elements are not
    // selectable on iOS, and a font under 16px makes Safari zoom the page.
    ta.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;' +
      'outline:0;opacity:0;font-size:16px;';
    ta.contentEditable = 'true';
    ta.readOnly = false;
    document.body.appendChild(ta);

    const selection = window.getSelection();
    const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    const range = document.createRange();
    range.selectNodeContents(ta);
    selection?.removeAllRanges();
    selection?.addRange(range);
    ta.setSelectionRange(0, text.length);

    const ok = document.execCommand('copy');

    ta.remove();
    // Put back whatever the reader had selected before pressing the button.
    selection?.removeAllRanges();
    if (previous) selection?.addRange(previous);
    return ok;
  } catch {
    return false;
  }
}
