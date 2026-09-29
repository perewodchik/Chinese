/**
 * The picture each spirit is drawn with (the props atlas), by spirit id —
 * shared by the engine's cutscenes and the page's lantern card, so it lives
 * apart from Phaser. A spirit not drawn yet (石猴, 灶王爷 until V4) shows a
 * lit lantern.
 */
export const SPIRIT_FRAMES: Readonly<Record<string, string>> = {
  shishizi: 'lion/awake',
  jiuweihu: 'fox/sway-0',
  menshen: 'door-gods/bright',
  qilin: 'qilin/awake',
  pixiu: 'pixiu/gold',
  nianshou: 'nianshou/awake',
  long: 'dragon/fly-0',
};
