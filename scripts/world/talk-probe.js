// The dialogue box (the 2026-09-29 dialogue rework), run by
// talk-probe.mjs in Playwright (the off-screen webkit-probe runs no animation
// frames, so the game never starts a talk there). It walks you to the 早点铺
// cook by itself (window.__world), starts the talk with Space, orders a 包子, says 再说一遍, says 就这些 and
// reports anything wider than the screen or cut off: the box, its head, the
// row above the field, the phone and its 付款.
(() => {
  if (window.__r) return window.__r;
  if (window.__started) return 'WAIT';
  if (!document.querySelector('.wc-rabbit')) return 'WAIT';
  window.__started = true;
  (async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
    const out = { problems: [], steps: {} };
    const key = (k) => { for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true })); };
    const tap = (el) => { if (!el) return; el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.click(); };
    const settle = () => { for (const a of document.getAnimations()) { try { a.finish(); } catch { a.cancel(); } } };
    const say = async (text) => {
      if (!document.querySelector('.wi-field')) { tap(document.querySelector('.wi-own')); await sleep(200); }
      const f = document.querySelector('.wi-field');
      if (!f) { out.problems.push('no field for ' + text); return; }
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(f, text);
      f.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(100);
      f.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await sleep(900);
    };
    const check = (tag) => {
      settle();
      const vw = innerWidth;
      const s = { stage: R(document.querySelector('.wd-stage')), phone: R(document.querySelector('.w-phone')), pay: R(document.querySelector('.w-phone-pay')), sw: document.documentElement.scrollWidth };
      out.steps[tag] = s;
      if (s.sw > vw) out.problems.push(`${tag}: page ${s.sw} wider than ${vw}`);
      for (const [sel, what] of [['.wd-head', 'head'], ['.w-phone-head', 'phone head'], ['.wd-plate', 'nameplate']]) {
        const el = document.querySelector(sel);
        if (el && el.scrollWidth > el.clientWidth + 1) out.problems.push(`${tag}: ${what} overflows (${el.scrollWidth} > ${el.clientWidth})`);
      }
      for (const el of document.querySelectorAll('.wd-stage, .wd, .w-phone, .wd-foot')) {
        const r = R(el);
        if (r.r > vw + 1 || r.l < -1) out.problems.push(`${tag}: ${el.className} past the edge`);
      }
      if (s.phone && s.pay && s.pay.b > s.phone.b) out.problems.push(`${tag}: 付款 below the phone`);
      if (s.phone && s.phone.t < 0) out.problems.push(`${tag}: phone above the screen`);
      if (s.stage && s.phone && s.stage.t < 0) out.problems.push(`${tag}: stage above the screen`);
    };
    await sleep(2500);
    window.__world?.travel({ map: 'zaodian', tile: [5, 3], facing: 'left' });
    await sleep(2500);
    for (let i = 0; i < 3 && !document.querySelector('.wd'); i++) { window.__world?.act(); await sleep(1500); }
    if (!document.querySelector('.wd')) { out.problems.push('no talk open'); window.__r = JSON.stringify(out); return; }
    await sleep(500); check('open');
    // the answers to tap (2026-10-02); a press must begin in the box, as a finger's does
    out.answers = [...document.querySelectorAll('.wi-answer .han')].map((b) => b.textContent);
    if (!out.answers.length) out.problems.push('no answers to tap');
    for (const b of document.querySelectorAll('.wi-answer')) { const r = R(b); if (r.r > innerWidth + 1) out.problems.push('open: an answer past the edge'); }
    tap(document.querySelector('.wi-own')); await sleep(200);
    out.want = document.querySelector('.wd-role')?.textContent;
    await say('我要一个包子'); check('ordered');
    tap([...document.querySelectorAll('.wi-row button')].find((b) => b.textContent.includes('再说一遍'))); await sleep(900); check('again');
    out.again = [...document.querySelectorAll('.wd-list li')].slice(-1)[0]?.textContent;
    await say('就这些'); await sleep(600); check('phone');
    out.paying = !!document.querySelector('.w-phone');
    window.__r = JSON.stringify(out);
  })().catch((e) => (window.__r = 'error ' + e));
  return 'WAIT';
})();
