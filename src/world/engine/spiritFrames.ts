/**
 * The picture each spirit is drawn with (the props atlas), by spirit id —
 * shared by the engine's cutscenes and the page — and its woodcut in the
 * `woodcut` atlas (§13 V4: every lantern figure redrawn, each with an idle).
 */
const IDS = ['shishizi', 'jiuweihu', 'menshen', 'qilin', 'shihou', 'pixiu', 'nianshou', 'long', 'zaowang', 'tianguan'] as const;

export const SPIRIT_FRAMES: Readonly<Record<string, string>> = Object.fromEntries(IDS.map((id) => [id, `spirit-${id}/idle-0`]));

/** The woodcut picture's frame (48×48) for a spirit or the lantern's `family` place. */
export const woodcutOf = (id: string) => `figures/${id}`;
