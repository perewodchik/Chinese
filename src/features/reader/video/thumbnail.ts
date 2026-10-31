import type { VideoLook } from '../../../domain/textVideo';

/**
 * A video's thumbnail, the picture a feed or YouTube shows before it is
 * played: the cover picture filling it, and over its lower part the chapter's
 * name, large, with the book's name above it and the learner's signature —
 * 1280 × 720 for a wide video (YouTube's size), 1080 × 1920 for an upright one.
 */
export async function makeThumbnail(o: { title: string; book: string; cover: HTMLImageElement | null; look: VideoLook }): Promise<Blob | null> {
  const wide = o.look.shape === '16:9';
  const [w, h] = wide ? [1280, 720] : [1080, 1920];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  await document.fonts?.load('80px WenKai').catch(() => undefined);

  ctx.fillStyle = '#1b2027';
  ctx.fillRect(0, 0, w, h);
  const img = o.cover;
  if (img?.naturalWidth) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    ctx.drawImage(img, (w - img.naturalWidth * s) / 2, (h - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  }
  // A dark band under the words, so they read over any picture.
  const bandH = wide ? 300 : 620;
  const bandTop = wide ? h - bandH : h - bandH - 360;
  ctx.fillStyle = 'rgba(12, 15, 19, 0.62)';
  ctx.fillRect(0, bandTop, w, bandH);

  const font = (px: number) => (o.look.type === 'kai' ? `${px}px WenKai, "Kaiti SC", serif` : `${px}px "PingFang SC", "Noto Sans SC", sans-serif`);
  const say = (s: string, px: number, y: number, colour: string) => {
    let size = px;
    ctx.font = font(size);
    while (ctx.measureText(s).width > w - 100 && size > 30) ctx.font = font(--size);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.1;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.strokeText(s, w / 2, y);
    ctx.fillStyle = colour;
    ctx.fillText(s, w / 2, y);
  };

  // The chapter's name in one or two lines: 第一章 on its own when there is a space to break at.
  const [first, ...rest] = o.title.split(/\s+/);
  const twoLines = rest.length > 0 && o.title.length > 6;
  const big = wide ? 104 : 150;
  let y = bandTop + (wide ? 90 : 170);
  if (o.book) {
    say(o.book, wide ? 44 : 64, y - (wide ? 20 : 40), '#f2d16b');
    y += wide ? 20 : 40;
  }
  if (twoLines) {
    say(first!, Math.round(big * 0.6), y + big * 0.45, '#ffffff');
    say(rest.join(' '), big, y + big * 1.5, '#ffffff');
  } else say(o.title, big, y + big, '#ffffff');
  if (o.look.mark.trim()) {
    ctx.font = `600 ${wide ? 28 : 40}px "Fira Sans", sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(o.look.mark.trim(), w - 40, wide ? 50 : 300);
  }
  return new Promise((r) => canvas.toBlob((b) => r(b), 'image/jpeg', 0.9));
}
