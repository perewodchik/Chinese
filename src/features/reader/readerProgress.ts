/**
 * How far down a text has been read, 0 to 1: how much of it has gone up past
 * the top of the room it is read in, over how much can. All of it once its
 * end is in the room (a pixel or two short counts), and a text shorter than
 * the room is all of it at once.
 *
 * @param scrolled how far the text's top has gone above the room's top
 * @param height the text's height
 * @param room the height it is read in, between the bar and the foot
 */
export function scrolledShare(scrolled: number, height: number, room: number): number {
  const can = height - room;
  if (can <= 2 || scrolled >= can - 2) return 1;
  return Math.min(1, Math.max(0, scrolled / can));
}
