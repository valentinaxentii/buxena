# BUXENA — "The Ritual": the one prompt

One continuous take, no cuts: arrive, open the door, light the stove, sit,
throw the water, steam. No faces. All sound generated with the picture.

Use **Google Veo 3.1** (native synced audio) or **Kling 3.0 Omni** (native audio,
cheaper, holds an audio timeline across a multi-shot sequence). Not Sora 2 — it
shuts down 24 September 2026.

Veo caps a single generation at 8 seconds. Paste the whole prompt anyway, then
use **Extend** to carry it forward, or feed the last frame of each pass back in
as the first frame of the next. The prompt stays the same every pass; the model
keeps its place because the beats are timestamped.

---

## The prompt

```
A single continuous unbroken first-person POV shot, no cuts, filmed as one take.
A person arrives at a wood-fired barrel sauna at dusk in a Connecticut back yard,
goes inside, lights the stove, sits down, and throws water on the hot stones.
Their face is never seen — only their hands enter the frame. The camera is their
eyes.

THE PLACE: a thermowood barrel sauna standing on a low deck at the edge of a
birch and maple tree line, late autumn. Chocolate-brown horizontal staves, three
stainless steel hoops, a brown-tinted tempered glass door, a bitumen shingle
roof, thin blue-grey woodsmoke rising from the chimney. Inside: pale alder
benches, a black cast-iron wood-burning stove on the right with dark grey basalt
stones stacked on top, a small square window above the bench, a wooden bucket and
a long-handled wooden ladle on the floor, one folded oatmeal linen towel.

THE ACTION:
0-5s: walking slowly toward the sauna over damp leaves, the camera swaying gently
with each step, faint breath fog at the bottom of the frame, warm amber light
glowing behind the tinted glass door.
5-8s: a bare right hand enters from the bottom right and closes around the dark
wooden handle. The walk stops.
8-12s: the hand pulls the door open — the heavy hinge gives a low dry creak, the
catch releases with a knock, and warm air and amber light spill out across the
lens in a brief haze.
12-16s: the camera steps up and through the doorway, dipping slightly as the head
ducks under the lintel. Inside now. The hand reaches back and pulls the door
closed, and the outside wind cuts off. The room is close and quiet.
16-20s: the camera lowers to knee height at the open firebox. Two hands lay a
split birch log and a handful of thin kindling inside. A match is struck against
the iron and flares.
20-26s: the flame takes — small yellow tongues climbing, thin smoke curling,
orange light rising up the hands and across the wood wall behind. The hand swings
the cast-iron door shut and turns the latch; firelight now flickers through the
small glass panel.
26-31s: the camera rises, turns, and settles down onto the upper alder bench with
the small weight-shift of someone sitting. One bench creak. Hands come to rest on
knees at the bottom of the frame, an oatmeal linen towel across them. The frame
holds still. Firelight pulses over the curved wooden ceiling, heat shimmer rises
off the stones, and a bead of condensation runs down the corner of the window,
now deep blue with night.
31-35s: a hand lowers the long wooden ladle into the bucket; the water rocks and
drips. The ladle lifts, dripping, and moves toward the stones, which glow dark
red under a grey crust.
35-38s: the water pours across the stones and vanishes instantly into a violent
white burst of steam that expands fast, climbs, and folds out across the curved
wooden ceiling. A second, smaller pour follows.
38-45s: the ladle lowers back into the bucket. Steam rolls slowly along the
ceiling and folds back down the walls, thinning as it goes. A blade of dim blue
window light cuts through it. The steam settles, the wood darkens where the
moisture lands, and the room goes still — only heat shimmer above the stones.

THE SOUND, all of it diegetic and in sync, and no music of any kind: damp leaves
and gravel crunching underfoot, wind moving through bare branches, one distant
crow; a hollow wooden knock as the hand meets the handle; the dry hinge creak,
the clack of the catch, a low whoosh of moving air; one deep footstep on a hollow
wooden floor and the muffled thud of the door closing, after which the outdoor
wind vanishes completely and the room tone goes close, dry and dead with no echo;
the dry knock of wood on wood, the scrape and flare of the match, kindling
catching in fine ticking crackles, the low draw of air pulling into the flue, the
heavy clank and squeak of the iron door and its latch; one wooden bench creak;
the steady low roar of fire drawing inside the stove with sharp pops of burning
wood and the faint metallic tick of hot iron expanding; one slow deep breath; the
hollow knock of the ladle against the wooden bucket, water sloshing and dripping;
then a hard sharp HISS and crackle as the water hits the stones, rising and
falling away into a soft steady seethe; a final dry crack of a settling log, and
deep quiet.

THE LOOK: real cinematography, documentary realism, shot on an ARRI Alexa 35 with
a 32mm spherical prime at T2.0, handheld with the natural micro-movement and
weight of a real operator. Practical light only — firelight, one small window, the
last of the dusk sky. A muted warm natural palette of linen, birch, ember and
bronze. Fine natural sensor grain, real motion blur, focus that is not perfect.
Physically accurate fire, smoke and steam behaviour. Real wood with uneven grain,
knots, dark tannin streaks and faint water marks.

NOT THIS: no colour grade, no orange-and-teal, no lens flare, no bloom, no HDR
glow, no oversaturation. No slow motion, no drone shot, no whip pan, no cuts. No
CGI, 3D render, cartoon or video-game look. No plastic or waxy surfaces, no
smooth plastic wood, no perfect symmetry, no glossy advertising look. No
fog-machine haze, no flames without smoke, no impossible physics, no morphing
hands or extra fingers. No faces, no one looking at the camera. No text, no logo,
no watermark, no subtitles. No music, no score, no voiceover.
```

---

## Three things that decide whether it works

**Attach a photo of your own barrel** — a VIRU or EDA hero image as a reference
image. Otherwise you pay to make a beautiful film of someone else's sauna.

**Carry the last frame forward** between passes. It is the only reliable way to
stop the sauna quietly changing — different wood, different stove, different
window — halfway through.

**Export twice.** The site hero (`Hero.astro`) plays `autoplay muted loop`, so
every sound above is thrown away there: cut a silent 16:9 loop for
`public/media/hero.mp4`, and a 9:16 cut with full sound for Instagram, TikTok and
paid ads, where the fire and the löyly hiss are what actually sell.

Generate it three or four times and keep one. Budget for that.

---

## Why these words

The things that make AI video look like AI video, and what fights each one:

- **Too clean.** Real cameras have grain, imperfect focus and motion blur. All
  three are asked for by name.
- **Too graded.** "Cinematic, 8K, hyperrealistic, masterpiece" is what pushes a
  model toward the glossy stock-footage look. None of those words appear.
  "Practical light only" and "no colour grade" do.
- **Too perfect.** Knots, tannin streaks, water marks, one bead of condensation.
  Imperfection is what reads as real.
- **Wrong physics.** The steam is described the way löyly actually behaves — a
  hard burst that climbs, folds across the ceiling and dies away — not as
  drifting fog.
- **The face problem.** Faces are where AI video falls apart fastest. This never
  shows one, which is both safer and better: the viewer is the person in the
  sauna.

---

## Fallback: the same film cut into six 8-second prompts

If you would rather generate shot by shot than extend one take, the six-shot
version of this same film is in the git history of this file (commit before this
one), or split the timestamps above at 8s, 16s, 26s, 31s, 38s and 45s and give
each piece its own copy of THE PLACE, THE LOOK and NOT THIS blocks.
