/** The new Speak's choices about this device: whether a line plays as it opens, slowly, shadowing. */

export const AUTOPLAY = 'hanzi.speak.autoplay';
export const SHADOW = 'hanzi.speak.shadow';
export const SLOW = 'hanzi.speak.slow';

export const pref = (key: string, fallback: boolean) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
};

export const keepPref = (key: string, on: boolean) => {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // remembered for this visit
  }
};
