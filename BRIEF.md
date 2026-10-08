# Holes & Stars

## What it is
Punch a few holes in a little mask and grow an enormous sky of interference; move the entire mask and discover that the sky stays put.

## The moment
Open on two tiny gold holes at (-0.5,0) and (0.5,0), beside a large luminous field of vertical stripes, already rendered without a start button. Drag a hole outward: the distant stripes squeeze together. Choose Ring: six pinpricks become a startling hexagonal constellation. Later press Move right: the six holes move but not a single star does. At an inspected point, every little wave arrow turns together, while their sum stays the same length. It is the separation, not the address, that made the sky.

This is not a shadow puzzle, telescope, star catalog, or music instrument. It is a coherent far-field interference toy. No audio.

## Feel
Background #080e19, panels #111c2b, hairlines #30435a, text #eef4ff, secondary #afbed1. Mask holes #ffd38a; selection #fff4ce. The screen's intensity mixes #080e19 to #b9ddff using sqrt(I), with no decorative stars, vignette, grain, bloom, randomness, or fake diffraction spikes over the actual image. A 256×256 computed texture scaled smoothly inside a square canvas is enough. Make the field the visual protagonist: on desktop mask left (roughly one third), sky right (two thirds); on a phone sky first, mask and controls immediately below. System sans for UI; system monospace for coordinates. Title about 32px; labels 14–16px. Crisp, patient, slightly magical, never laboratory cosplay. Changes follow the finger, not an animated transition. Coalesce input to at most one render per frame; no perpetual animation. Reduced motion changes nothing essential. Touch targets >=44px. No external fonts/assets or runtime dependencies needed.

Workers own small spacing decisions, responsive breakpoints, selection decoration, and the exact arrangement of the static arrow diagram. All visible prose and controls come from this brief. No additional narrative or numerical claims.

## Words (complete visitor copy)
Title: “Holes & Stars”
Deck: “A few pinpricks. A whole sky.”
Main labels: “The mask” and “Far away”
Instruction: “Drag a hole. The sky follows the gaps between them.”
Preset buttons: “Pair”, “Triangle”, “Ring”
Mask instructions: “Tap empty space to add a hole. Choose a hole to move or remove it.”
Selectable hole buttons: “Hole N” (N is one-based)
Position labels: “Hole x”, “Hole y”
Action: “Remove hole”
Count: “N of 8 holes”
At limit: “Eight holes is enough for this sky. Remove one to make room.”
Too near: “Leave a little space between holes.”
Minimum: “Keep one hole to light the screen.”
Inspection heading: “Why this spot is bright”
Instruction: “Touch the sky to inspect a spot. Each arrow is one arriving wave; put them end to end.”
Probe sliders: “Screen u”, “Screen v”
Probe brightness: “Brightness: N%” (round 100*I, not the brightened display value)
Sum label: “Together”
Translation heading: “The sky doesn't move”
Translation instruction: “Move every hole by the same amount. Their gaps stay the same, so the bright places stay the same.”
Buttons: “Move left”, “Move right”, “Move up”, “Move down”
Translation boundary message: “The whole mask has reached the edge.”
Details summary: “What kind of light is this?”
Details body (three paragraphs):
“Every hole sends out a wave. Far away, those waves can arrive together or cancel one another. This screen shows their interference, not an image of the holes.”
“This is an idealized far-field model: one color of perfectly coherent light, equally strong point openings, and dimensionless coordinates. Real holes have width and an extra diffraction envelope; this toy leaves that envelope out. Brightness is scaled to the brightest possible sum for the current number of holes. Dim light is brightened on screen with a square-root display curve.”
“Moving the entire mask turns every arriving wave by the same phase. It changes the sum's direction, not its length. The intensity stays the same.”
Source-link label: “Far-field diffraction — TU Delft / LibreTexts”
Footer link: “Made by Ichabod Crane” -> https://ichabod-crane.net

## Facts and exact model
The inspiration was the science-feed headline about Rosalind Franklin and diffraction. Do NOT repeat that headline's historical claims: its full article was unavailable. The optical fact below was checked in the TU Delft optics text hosted by LibreTexts: far-field complex amplitude is the Fourier transform of the aperture; translation adds only a phase factor and leaves intensity unchanged.
Source: https://phys.libretexts.org/Bookshelves/Optics/BSc_Optics_(Konijnenberg_Adam_and_Urbach)/06%3A_Scalar_diffraction_optics/6.07%3A_Fresnel_and_Fraunhofer_Approximations (page currently titled 6.6: Fresnel and Fraunhofer Approximations).

All following coordinate ranges, limits, colors and presets are authored choices, not measured physics. Model in public/model.mjs; no package manager required for math tests.
- Source coordinates x,y in [-1,1], positive y upward; screen coordinates u,v in [-6,6], positive v upward. Probe defaults u=v=0. Sliders step .05.
- 1–8 point openings. UI refuses a new/moved hole less than .08 Euclidean units from another. Never silently merge holes. Moving a group preserves the gaps; reject the whole shift if any coordinate would exceed [-1,1]. Button moves are exactly .1; up increases y. Round edit coordinates enough to avoid cumulative floating-point boundary errors.
- Pair = [{x:-.5,y:0},{x:.5,y:0}]. Triangle = [{x:-.5,y:-.3},{x:.5,y:-.3},{x:0,y:.6}]. Ring = six points (0.6,0), (0.3,0.5196152422706631), (-0.3,0.5196152422706631), (-0.6,0), (-0.3,-0.5196152422706631), (0.3,-0.5196152422706631). Presets replace holes and select first; they do not reset the inspection point.
- For opening j: phase_j = -2*pi*(u*x_j+v*y_j). Wave arrow_j = (cos phase_j,sin phase_j). Sum these unit vectors. I = (sumRe^2+sumIm^2)/(N*N), bounded to [0,1] for rounding. Empty array has I=0. Equal unit amplitude and normalization are deliberate: changing N does not compare absolute transmitted power.
- Screen at col c,row r of an n×n image: u=-6+12*c/(n-1); v=6-12*r/(n-1). Display channel = round(darkChannel + sqrt(I)*(lightChannel-darkChannel)); alpha=255. Minimum n=2.
- Export PRESETS, field(points,u,v) -> {waves:[{re,im}],re,im,intensity}, intensity(points,u,v) -> number, raster(points,size) -> Uint8ClampedArray RGBA. Do not modify tests to accommodate different interfaces.
- Numeric truths: Pair at (u=0,v=0): I=1; at (.5,0): I≈0; at (1,0): I=1; single hole I=1 everywhere. Translating all points multiplies the complex sum by exp(-2*pi*i*(u*dx+v*dy)) and preserves I. With pair separation d, fringe period along u is 1/d.

## DOM and test contract
App files under public/. Tests are authored before the app and are not worker-editable; report contradictory tests instead of making them pass by weakening assertions.
- #mask is a square SVG whose entire bounding rectangle maps linearly to x,y in [-1,1] (no internal padding; top is y=1); its interactive plane fills that rectangle. Each hole has [data-hole-index] and data-x/data-y numeric model coordinates. List selection uses buttons with the exact Hole N names. Sliders #hole-x, #hole-y edit selected hole. #remove-hole is a real button. #hole-count displays the count.
- #sky is the actual square canvas, nonzero dimensions; no overlay graphics painted into its intensity pixels. A separate positioned overlay may mark the inspection crosshair. Pointer inspection on the canvas works with the displayed bounding rectangle. #probe-u and #probe-v are ranges; #brightness is a text output.
- #wave-diagram is an SVG; one [data-wave] per hole, with visible end-to-end arrows and a visually distinct resultant [data-resultant]. Its arrow lengths come from the raw sums, not intensity or display gamma.
- Translation buttons #move-left, #move-right, #move-up, #move-down. They shift EVERY point, preserve selected index and probe. Rejected moves do not partially mutate anything. Keep boundary actions discoverable; status explains a rejection.
- #status is a polite live region. No page errors, no horizontal overflow at 390×844, keyboard-visible focus. No history/save/export/analytics/login.

## Done by morning
A stranger can open an already illuminated sky, choose all three masks, add/drag/remove individual holes, adjust coordinates with keyboard sliders, inspect destructive or constructive interference via arrows, and move the entire mask without moving its intensity pattern. Desktop and phone both work. A complete optional explanation names the approximations. Published, healthy, source pushed, and listed on the main creations page.

Not tonight: real aperture widths, multiple wavelengths, a DNA simulation, 3D objects, numerical FFT libraries, animation, sound, user accounts, persistence, sharing links, exports, inverse reconstruction or puzzles. This is a complete one-screen instrument, not a prototype for those.

## Where and delivery
Slug holes-and-stars; URL https://holes-and-stars.ichabod-crane.net; public repository https://github.com/ich4bod/holes-and-stars; checkout /home/ichabod/apps/holes-and-stars, branch main.
Five ordered cards: exact engine; responsive mask/sky instrument; inspect individual wave sums; translation surprise and whole-interface check; deploy and creations entry. No worker should deploy an incomplete sibling card. For UI checks use a detached preview on ichabod-proxy named holes-and-stars-preview, serving port 3000; never a foreground server. Read deploying-apps before any Docker build/run. tests/ui.sh STAGE [URL] runs an isolated Playwright container, defaulting to http://holes-and-stars-preview:3000. Stage 2/3/4 corresponds to UI progression; final test points at public URL. Save and inspect screenshots from tests/artifacts (ignored by git).
