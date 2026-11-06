# Drawing a story's pictures by hand

Claude draws every text's pictures itself (the learner's choice: not Gemini),
as SVG, with the kit in `kit.mjs`, renders them to JPEG through Chromium
(`render.mjs`) and puts them in with `npm run texts -- put`. This is the brief to
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

## Drawn by hand

`svg()` gives every picture the look of coloured pencil on paper; a scene
draws nothing for it. The lines wander a little and tremble (a slow, small
displacement of the whole picture, so parts that touch move together — unlike
the wash, it never pulls a figure apart), colours are a touch softer on
grained paper, and pencil strokes at one slant show in the colour, more in the
darker parts and none on white. Keep shapes flat-coloured and outlined: the
hand is added at the end, not drawn into each shape.

## Poses: natural, so they go with the text instead of drawing the eye

The second try was told: Ash's arms grew to twice their length to reach a
branch, and he sat under the tree with a knee up and both legs off to one
side — nobody sits like that. A pose a reader notices is a pose that takes
them away from the Chinese.

- Bones keep their length. A pose is the angle at each joint (`ARMS`, `LEGS`
  in the kit), never a point the hand is dragged to. If a hand cannot reach
  something, move the figure or the thing, not the arm. `handOf` says where a
  hand is, to put a rod, a branch or a paw in it.
- Use the poses people actually make: arms hanging, hands on the tummy, hands
  on the head, a hand shading the eyes, holding something at the chest,
  pulling with the body leaning back (`lean`), running with the arms bent,
  hanging from a branch with the arms straight up beside the head.
- Sitting on the ground is cross-legged, the back against something; the
  hands in the lap or holding something at the chest.
- Joints bend the way joints bend: elbows and knees one way only, no arm
  through the head, no foot off the ground unless the figure is running,
  hanging or jumping.
- One pose, one idea: the pose says what the paragraph says (hungry → hands
  on the tummy), and nothing more.

## Layers: what is in front of what

- Back to front, a figure is: long hair, the arms that hang behind, the body,
  what it holds against its chest (`inArms`), the arms in front of the body,
  the neck and the head, a hand on the head (`over`). Each arm has its own
  layer when the two arms do different things (`scratch`, `carry`).
- Something held in both arms sits below the chin: the forearms cross its
  body, never its face, and its ears stop short of the holder's mouth.
- A thing carried over the shoulder (a sack) is drawn before the figure, the
  gripping hand in front of its neck.
- Behind a desk or a counter, the furniture is drawn after the figure; a
  figure in front of it, before.
- Put held things where `handOf` says the hand is, and a hand that touches
  something (a blanket, a paw) by standing the figure where its arm reaches.

## Check before putting anything in

Render the chapter, then look at a contact sheet and at close crops of every
hand, every held thing and every place two things meet. Look for: a limb
longer than its bone, a hand in the air short of what it should touch, an arm
through a head, hair over arms, a face hidden by something held, a figure
drawn twice, a figure overlapping a car or a table it should stand beside.

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

## Requirements for every chapter

The learner asked for pictures made "more professionally, more carefully and
more beautifully" (November 2026), and for them to be drawn here, by hand,
never by Gemini. Each chapter's set is held to all of these before it goes in:

1. **One picture a paragraph**, of the moment the paragraph is about, in the
   paragraph's order. Read the paragraph again before drawing it: who is
   there, what each one does, where, what time of day.
2. **Both versions.** Where the easier version changes something a picture
   shows (kneeling becomes sitting, a woodcutter becomes an old man), that
   paragraph gets a picture for each version, named `p6-book` and `p6-easy`.
   The rest are shared.
3. **The same people every time.** A person is one function with fixed
   colours and proportions, kept in the book's module and imported by every
   chapter after (西游记: `monkey` and its `HERO` coat in `xyj-ch1.mjs`;
   `person` with the master's pale robe and white beard in `xyj-ch2.mjs`).
   A change of clothes is part of the story and stays (Wukong's grey robe
   from chapter 2 on). The book's notes in the skill list each one in words.
4. **Every gesture means what the text says.** A pointing arm points at the
   thing (the woodcutter at the cave, not up into the sky); a held thing is in
   the hand or on the shoulder that carries it, never beside the head; a
   person looks at whom they speak to.
5. **Nothing floats and nothing collides.** Feet on the ground with a shadow;
   a raft on the water; props clear of faces; a figure clear of a burner, a
   table, another figure.
6. **No mark without a reason.** A star is magic or a knock on the head;
   speed lines are a jump; a tear is sadness. None in an empty sky.
7. **Three depths and the light.** Far, middle, near; light from the upper
   right (a lamp or the sun where the scene has one); the figures in the
   middle half so a square crop keeps them.
8. **The book's palette.** Soft and natural; the people's colours the
   strongest; night is deep blue with one warm light.
9. **Checked twice.** Render, look at the contact sheet at thumbnail size and
   at every picture at full size; crop every hand, held thing and meeting
   point. Fix, render, look again. Only then put them in.

## Improvements to make next time

What chapter 2 of 西游记 showed could be better, for whoever draws next:

- **People need more poses**: lying in bed (the master woke sitting up
  because there is no lying pose), walking away with hands behind the back
  (`behind` exists in `person` but hides the arms and has not been looked at
  in a scene), carrying in both arms.
- **Interiors are one cave.** Add a room (wooden beams, a paper window, a
  door) and a courtyard with a wall, so a whole chapter is not the same
  brown cave with the same glow.
- **The glow behind a cave scene is a large pale oval** that reads as a
  spotlight; make it softer and lower, or light from a doorway instead.
- **Faces at thumbnail size** lose their expression: make the eyes and mouth
  a touch bigger on secondary figures, and keep one clear expression each.
- **Transformations** (七十二变) need their own marks: a puff of smoke with
  the thing half out of it, the monkey's tail showing; chapter 2's pine with a
  tail is the pattern.
- **The somersault cloud** (`nimbus` in `xyj-ch2.mjs`) should be reused, not
  redrawn, so it looks the same in every chapter.
- **Look at the last chapter's pictures side by side** with the new ones
  before putting them in: same sizes for the same people, same sky colours
  for the same time of day.
