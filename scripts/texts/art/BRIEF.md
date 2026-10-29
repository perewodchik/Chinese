# Drawing a story's pictures by hand

When Gemini cannot draw (no key, no quota), Claude draws a text's pictures
itself, as SVG, with the kit in `kit.mjs`, renders them to JPEG through
Chromium (`render.mjs`) and puts them in with `put.mts`. This is the brief to
read before drawing one — written after a first try where arms, ears and tails
floated loose from the bodies and every scene was a strip of grass under a
gradient.

## What the pictures are for

A glance beside a paragraph, on a phone, 100–230 px wide: one clear moment,
readable at thumbnail size. A tap shows it at full width, where it must still
look made with care. Children's picture book, soft and warm, never busy.

## Characters are puppets, not loose shapes

- Every character is one group built around a skeleton: hips, shoulders,
  neck, the root of a tail. Each limb is a path from a joint **inside** the
  body to the hand or foot, and is drawn **before** the body so the body
  covers the joint. Nothing is placed next to a body and hoped to touch it.
- One outline for everything: `--ink` 3px, round joins, on every shape of a
  character — body, limbs, ears, tail, props they hold. The outline is what
  holds a figure together at 100 px.
- No displacement or blur filter on a character. The watercolour wash belongs
  to the background only; on a figure it tears the parts apart.
- Feet stand on the ground: a soft shadow ellipse under each figure, at the
  ground line, and the feet on it.
- Hands end in a round hand (Ash: green gloves) at the end of the arm path;
  a held thing (an apple) overlaps the hand.
- Proportions stay fixed between pictures: Ash about 2.6 heads tall, Pikachu
  about half Ash's height, its head larger than its body.

## The cast, as the kit draws them

- **Ash (小智)**: spiky black hair showing under a red cap with a white front
  and a red visor, zigzag marks under the eyes, blue short jacket open over a
  white T-shirt, green fingerless gloves, blue jeans, red-and-white shoes.
- **Pikachu (皮卡丘)**: round yellow body, big head, long ears with black tips,
  red round cheeks, two brown stripes on the back, a lightning-bolt tail
  rooted at the lower back with a brown base. Says only 皮卡.

Expressions are what carries the joke: eyes (open, squeezed, ^ ^ laughing,
looking up), eyebrows, mouth. Give every figure one.

## Scenes

- Three depths: far (pale, low contrast hills or buildings), middle (trees,
  houses), near (the ground the figures stand on, with a few details). Never a
  single stripe of grass.
- Light from the upper right; a soft warm glow there, shadows to the lower left.
- The figures take a third to a half of the height and sit near the middle,
  so a square crop of the 4:3 picture (the phone's thumbnail) keeps them.
- Motion and feeling with small marks: speed lines, sweat drops, stars,
  sparkles, rumble lines — drawn in ink, sparingly.
- No letters, numbers or Chinese anywhere in the picture.
- Palette: soft and natural; the characters' colours are the strongest thing
  in the picture.

## Checking

Render, then look at the contact sheet at thumbnail size and at full size
before putting anything in. Look for: a limb or tail not joined to its body,
a figure floating above the ground, a face covered by something held, a
character cut off by the square crop, the same pose twice in a row.
