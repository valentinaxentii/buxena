# BUXENA — "The Ritual" sauna film: AI video prompts

A 6-shot sequence for an AI video model: approach the sauna, open the door,
light the stove, sit, throw water on the stones, steam. No faces. Real sound.

## Tool

Use **Google Veo 3.1**. It is the one that generates synchronised audio in the
same pass as the picture — the door creak, the fire, the hiss of water on hot
stones — which is the whole point of this film. Kling 3.0 Omni is the cheaper
alternative with native audio. Do not start on Sora 2; it is scheduled to shut
down 24 September 2026.

Two things about Veo that shape everything below:

- Clips are 4, 6 or 8 seconds. Six clips, stitched in an editor.
- It reads **timestamps**, not adverbs. `0–3s: the hand reaches for the handle`
  works. "slowly reaches" does not.

## Before you generate

1. Feed it a **real photo of an actual BUXENA barrel** (VIRU or EDA hero image)
   as a reference image. Then the film sells your product instead of a generic
   sauna.
2. Use the **last frame of each shot as the first frame of the next**
   ("Frames to Video"). This is what stops the sauna changing between clips.
3. Generate every shot 3–4 times and keep the best. Budget for that.

## Two exports, not one

- **16:9, no sound** → `public/media/hero.mp4`. The site hero autoplays muted
  and loops, so audio is wasted there. Cut it to loop cleanly.
- **9:16, with sound** → Instagram, TikTok, paid ads. This is where the fire
  and the löyly hiss do the selling. Social cut order: 1, 2, 3, 5, 6.

---

## The style block

Paste this at the end of **every** shot prompt. It is what keeps the six clips
looking like one film, and what keeps it from looking AI-generated.

```
Style: real cinematography, documentary realism. Shot on ARRI Alexa 35, 32mm
spherical prime at T2.0. Natural handheld micro-movement with the weight of a
real operator. Practical light only — firelight, one small window, dusk sky.
Muted warm natural palette of linen, birch, ember and bronze. No colour grade,
no orange-and-teal, no lens flare, no bloom. Fine natural sensor grain, real
motion blur, focus that is not perfect. Physically accurate fire, smoke and
steam behaviour.
Real wood: uneven grain, knots, dark tannin streaks, faint water marks.
Continuity — the same sauna in every shot: a thermowood barrel sauna, chocolate
brown horizontal staves, three stainless steel hoops, brown-tinted tempered
glass door, bitumen shingle roof. Inside: pale alder benches, a black cast-iron
wood-burning stove on the right with dark grey basalt stones stacked on top, a
small square window above the bench, one wooden bucket, one long-handled wooden
ladle, one folded oatmeal linen towel. Same dusk-into-night light throughout.
No faces. No text, no logo, no captions, no subtitles. No music.
```

## The negative prompt

If your interface has a negative prompt field, use this. If it does not (Flow,
the Gemini app), the style block above already covers the important half.

```
cartoon, illustration, 3D render, CGI, video game, plastic or waxy surfaces,
smooth plastic wood, oversaturated, HDR glow, teal and orange grade, lens flare,
bloom, slow motion, morphing hands, extra fingers, floating objects, impossible
physics, perfect symmetry, glossy advertising look, drone shot, whip pan, text,
watermark, logo, subtitles, faces, people looking at camera, unnatural fire,
flames without smoke, fog-machine haze, music, score, voiceover
```

---

## Shot 1 — The approach

```
Late autumn dusk in a New England back yard, Connecticut. First-person POV,
camera at adult eye height, walking slowly toward a thermowood barrel sauna on
a low deck at the edge of a birch and maple tree line. Thin blue-grey woodsmoke
drifts from the chimney. Warm amber light glows behind the brown-tinted glass
door.
0–3s: slow walk forward, the camera swaying gently with each step, faint breath
fog at the bottom of the frame.
3–6s: the barrel fills the frame — wet stave grain and stainless hoops catching
the last cold daylight.
6–8s: a bare right hand enters from the bottom right and closes around the dark
wooden door handle. The walk stops.
Audio: damp leaves and gravel crunching under slow footsteps, wind moving
through bare branches, one distant crow, a hollow wooden knock as the hand meets
the handle.
```

## Shot 2 — The door

```
Continuous first-person POV at the door of the thermowood barrel sauna, dusk.
0–2s: the hand pulls the brown-tinted glass door open. The heavy hinge gives a
low dry creak and the catch releases with a soft knock.
2–5s: warm amber light and a slow roll of hot air spill out across the lens, a
brief haze over the frame. The camera steps up and through the doorway and dips
slightly as the head ducks under the lintel.
5–8s: inside — pale alder benches, the black cast-iron stove on the right with
basalt stones stacked on top, a small square window holding the last blue of the
dusk. The hand reaches back and pulls the door closed.
Audio: dry hinge creak, the clack of the catch, a low whoosh of moving air, one
deep footstep on a hollow wooden floor, the muffled thud of the door closing —
and then the outside wind cuts off sharply and the room is close and quiet.
```

## Shot 3 — Lighting the stove

```
Inside the barrel sauna. Low angle, camera at knee height in front of the black
cast-iron wood-burning stove. No face in frame. The only light is the small
window and one dim wall lamp.
0–2s: two hands lay a split birch log and a handful of thin kindling into the
open firebox.
2–4s: a match is struck against the iron, flaring bright, and touched to the
kindling.
4–6s: the flame takes — small yellow tongues climbing, thin smoke curling,
orange light rising up the hands and across the wood wall behind.
6–8s: the hand swings the cast-iron door shut and turns the latch. Firelight now
flickers through the small glass panel and breathes across the alder benches.
Audio: the dry knock of wood on wood, the scrape and flare of a match, kindling
catching in fine ticking crackles, the low draw of air pulling into the flue, the
heavy clank and squeak of the iron door and its latch.
```

## Shot 4 — Sitting down

```
Inside the barrel sauna. The camera descends from standing height onto the upper
alder bench and settles, as if a person has just sat down. No face, no head, no
body in frame. It then holds a still, slightly wide view of the room: the black
stove with its bed of basalt stones glowing dull red at the base, a wooden bucket
and long-handled ladle on the floor beside it, the small window now deep blue
with night.
0–3s: the camera lowers and settles with the small weight-shift of someone
sitting down. One creak of the bench.
3–8s: the frame is completely still. A pair of hands rest on knees at the bottom
of frame, an oatmeal linen towel across them. Firelight pulses slowly over the
curved wooden ceiling. Heat shimmer rises off the stones. A single bead of
condensation runs down the corner of the window.
Audio: one wooden bench creak, the steady low roar of the fire drawing inside
the stove, occasional sharp pops and ticks of burning wood, the faint metallic
tick of hot iron expanding, one slow deep breath. The room tone is close, dry
and dead — no echo.
```

## Shot 5 — Löyly, water on the stones

```
Inside the barrel sauna, night. Medium close shot from bench height, framed on
the stove and its stones. No face in frame.
0–2s: a hand lowers a long-handled wooden ladle into a wooden bucket of water.
The water rocks and drips.
2–4s: the ladle lifts, dripping, and moves toward the stones — dark red under a
grey crust.
4–6s: the water pours across the stones and vanishes instantly into a violent
white burst of steam that expands fast, rolls upward and folds out across the
ceiling.
6–8s: a second, smaller pour. Steam fills the top of the frame and the light
through it goes soft and golden. The ladle lowers back into the bucket.
Audio: the hollow knock of the ladle against the wooden bucket, water sloshing
and dripping, then a hard sharp HISS and crackle as the water hits the stones,
rising and falling away into a soft steady seethe, with the fire still roaring
low inside the stove.
```

## Shot 6 — The steam

```
Inside the barrel sauna, night. Static wide shot from the opposite bench. No
people. The room is full of steam.
0–3s: dense white steam rolls slowly along the curved wooden ceiling and folds
back down the walls, thinning as it goes.
3–6s: a hard blade of dim blue light from the small window cuts through the
steam; moisture turns over inside it. Firelight from the stove glass pulses warm
against that cold window light.
6–8s: the steam thins and settles. The wood darkens where the moisture has
landed. The room goes still — only heat shimmer above the stones.
Audio: the soft dying seethe of steam on stone, the low steady roar of fire in
the stove, one dry crack of a log settling, faint ticks of expanding wood, then
deep quiet.
```

---

## Shot 7 — Optional ending, and the best hero loop

Almost nothing moves in this one, which is exactly why it loops well behind the
wordmark on the homepage.

```
Exterior, night, static wide shot. A thermowood barrel sauna glows warm amber
behind its brown-tinted glass door, standing on a deck at the edge of a dark
tree line. Woodsmoke rises straight up from the chimney into cold still air.
Frost on the deck boards. Steam bleeds from the roof vent.
0–8s: almost nothing moves — only the smoke drifting, the interior light pulsing
very slightly with the fire, and one slow gust moving the bare branches at the
edge of frame.
Audio: cold night wind, fire crackle muffled through the wall, the faint hiss of
steam from the vent, one owl far away.
```

---

## Why these words

The things that make AI video look like AI video, and what is doing the work
against each of them:

- **Too clean.** Real cameras have grain, imperfect focus and motion blur. All
  three are asked for explicitly.
- **Too graded.** "Cinematic, 8K, hyperrealistic, masterpiece" pushes the model
  toward a glossy stock-footage look. None of those words appear here. "No
  colour grade" and "practical light only" do.
- **Too perfect.** Knots, tannin streaks, water marks, one bead of condensation,
  frost. Imperfection reads as real.
- **Wrong physics.** Steam is described the way löyly actually behaves — a hard
  burst that climbs, folds across the ceiling and dies away — not as drifting
  fog.
- **The face problem.** Faces are where AI video falls apart fastest. This film
  never shows one, which is both safer and more effective: the viewer is the
  person in the sauna.
