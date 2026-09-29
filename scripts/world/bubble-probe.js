// 兔儿爷's bubble, checked in WebKit (prompt §11 R4). Stand next to someone
// in the game first (the save keeps where you are), then:
//   .cache/webkit-probe http://localhost:5176/play/world 390 scripts/world/bubble-probe.js
// It opens him while walking, starts the talk with Space, asks Again → What
// did they say? → Help me answer → What did they say?, and reports anything
// that moved, changed height, scrolled sideways or covered the talk's name,
// tools, input or hint chips.
(() => {
  if (window.__r) return window.__r;
  if (window.__started) return 'WAIT';
  if (!document.querySelector('.wc-rabbit')) return 'WAIT';
  window.__started = true;
  (async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const R = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), h: Math.round(r.height) }; };
    const hit = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const out = { steps: [], problems: [] };
    const snap = (tag) => {
      // an off-screen WebKit view runs no animation frames: settle the pops and the hop first
      out.frozen = (out.frozen ?? 0) + document.getAnimations().filter((a) => a.playState === 'running' && a.currentTime === 0).length;
      for (const a of document.getAnimations()) { try { a.finish(); } catch { a.cancel(); } }
      const s ={ tag, wd: R('.wd'), rabbit: R('.wc-rabbit'), wb: R('.wb'), sw: document.documentElement.scrollWidth, vw: innerWidth };
      out.steps.push(s);
      const covers = [['.wd-name', 'name'], ['.wd-head .wd-tool', 'tools'], ['.wd-foot', 'input'], ['.wi-chip', 'hint chip']];
      for (const [sel, what] of covers) for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect(); const b = { l: r.left, t: r.top, r: r.right, b: r.bottom };
        if (hit(s.wb, b)) out.problems.push(`${tag}: bubble covers ${what}`);
        if (hit(s.rabbit, b)) out.problems.push(`${tag}: rabbit covers ${what}`);
      }
      if (s.sw > s.vw) out.problems.push(`${tag}: horizontal scroll ${s.sw} > ${s.vw}`);
      if (s.wb && s.wb.r > s.vw) out.problems.push(`${tag}: bubble past the edge`);
    };
    const pick = async (l) => { const b = [...document.querySelectorAll('.wb-opts button')].find((x) => x.textContent.includes(l)); if (!b) { out.problems.push('no option ' + l); return; } b.click(); await sleep(1600); snap(l); };
    await sleep(2500);
    // walking: open him, then close
    document.querySelector('.wc-rabbit').click(); await sleep(400);
    snap('walk-open');
    const walkH = R('.wb')?.h;
    document.querySelector('.wc-rabbit').click(); await sleep(300);
    for (let i = 0; i < 3 && !document.querySelector('.wd'); i++) {
      for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true }));
      await sleep(1500);
    }
    if (!document.querySelector('.wd')) { out.problems.push('no talk open (space did not start one)'); }
    else {
      await sleep(600); snap('talk');
      document.querySelector('.wc-rabbit').click(); await sleep(400); snap('open');
      await pick('Again'); await pick('What did they say'); await pick('Help me answer');
      await pick('What did they say');
      const hs = new Set(out.steps.filter((s) => s.wb).map((s) => s.wb.h)); if (hs.size !== 1) out.problems.push('bubble heights ' + [...hs]);
      const talkSteps = out.steps.filter((s) => s.tag !== 'walk-open');
      if (new Set(talkSteps.map((s) => JSON.stringify(s.wd))).size !== 1) out.problems.push('dialogue box moved');
      if (new Set(talkSteps.map((s) => JSON.stringify(s.rabbit))).size !== 1) out.problems.push('rabbit moved');
      out.summary = { walkH, wb: talkSteps[1]?.wb, rabbit: talkSteps[0]?.rabbit, wd: talkSteps[0]?.wd, rimOk: talkSteps[0] && Math.abs(talkSteps[0].rabbit.b - talkSteps[0].wd.t) <= 2 };
    }
    delete out.steps;
    window.__r = JSON.stringify(out);
  })().catch((e) => (window.__r = 'error ' + e));
  return 'WAIT';
})();
