/** When a try was, so a week later it still says when: today, yesterday, the weekday this week, else the date — with the time. */
export function whenOf(at: number, short = false): string {
  const d = new Date(at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (at >= today.getTime()) return `today, ${time}`;
  if (at >= today.getTime() - 86_400_000) return `yesterday, ${time}`;
  // Short, for the one row above the score that a phone shares with two chips: Tue 14:37.
  if (at >= today.getTime() - 6 * 86_400_000) return short ? `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${time}` : `${d.toLocaleDateString('en-GB', { weekday: 'long' })}, ${time}`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}
