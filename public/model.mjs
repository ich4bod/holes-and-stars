// Ideal coherent point openings: deliberately no finite-hole envelope.
const freezePoints = points => Object.freeze(points.map(point => Object.freeze(point)));

export const PRESETS = Object.freeze({
  pair: freezePoints([{ x: -.5, y: 0 }, { x: .5, y: 0 }]),
  triangle: freezePoints([{ x: -.5, y: -.3 }, { x: .5, y: -.3 }, { x: 0, y: .6 }]),
  ring: freezePoints([
    { x: .6, y: 0 },
    { x: .3, y: .5196152422706631 },
    { x: -.3, y: .5196152422706631 },
    { x: -.6, y: 0 },
    { x: -.3, y: -.5196152422706631 },
    { x: .3, y: -.5196152422706631 },
  ]),
  row: freezePoints([{ x: -.6, y: 0 }, { x: -.2, y: 0 }, { x: .2, y: 0 }, { x: .6, y: 0 }]),
  broken: freezePoints([{ x: -.6, y: 0 }, { x: -.2, y: 0 }, { x: .2, y: 0 }, { x: .8, y: 0 }]),
  square: freezePoints([{ x: -.4, y: -.4 }, { x: .4, y: -.4 }, { x: .4, y: .4 }, { x: -.4, y: .4 }]),
  ladder: freezePoints([
    { x: -.6, y: -.2 },
    { x: .6, y: -.2 },
    { x: -.6, y: .2 },
    { x: .6, y: .2 },
  ]),
  diamond: freezePoints([
    { x: 0, y: -.6 },
    { x: .6, y: 0 },
    { x: 0, y: .6 },
    { x: -.6, y: 0 },
  ]),
  narrow: freezePoints([
    { x: -.2, y: -.6 },
    { x: .2, y: -.6 },
    { x: .2, y: .6 },
    { x: -.2, y: .6 },
  ]),
});

function normalizedIntensity(re, im, count) {
  return count === 0 ? 0 : Math.max(0, Math.min(1, (re * re + im * im) / (count * count)));
}

const sinc = value => value === 0 ? 1 : Math.sin(Math.PI * value) / (Math.PI * value);
const envelope = (u, v, options) => sinc((options.width ?? 0) * u) * sinc((options.height ?? 0) * v);
const sourceAmplitude = (index, amplitude, options) => amplitude
  * (options.strengthMode === 'alternate-half' && index % 2 === 1 ? .5 : 1);

export function field(points, u, v, options = {}) {
  const waves = [];
  let re = 0;
  let im = 0;
  const amplitude = envelope(u, v, options);
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    if (options.onlyIndex !== null && options.onlyIndex !== undefined && index !== options.onlyIndex) {
      waves.push({ re: 0, im: 0 });
      continue;
    }
    const phase = -2 * Math.PI * (u * point.x + v * point.y)
      + (options.phaseMode === 'alternate' ? Math.PI * index
        : options.phaseMode === 'quarter' ? Math.PI * index / 2 : 0);
    const source = sourceAmplitude(index, amplitude, options);
    const wave = { re: source * Math.cos(phase), im: source * Math.sin(phase) };
    waves.push(wave);
    re += wave.re;
    im += wave.im;
  }
  return { waves, re, im, intensity: normalizedIntensity(re, im, points.length) };
}

// The raster only needs intensity, so avoid allocating individual wave arrows.
export function intensity(points, u, v, options = {}) {
  let re = 0;
  let im = 0;
  const amplitude = envelope(u, v, options);
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    if (options.onlyIndex !== null && options.onlyIndex !== undefined && index !== options.onlyIndex) continue;
    const phase = -2 * Math.PI * (u * point.x + v * point.y)
      + (options.phaseMode === 'alternate' ? Math.PI * index
        : options.phaseMode === 'quarter' ? Math.PI * index / 2 : 0);
    const source = sourceAmplitude(index, amplitude, options);
    re += source * Math.cos(phase);
    im += source * Math.sin(phase);
  }
  return normalizedIntensity(re, im, points.length);
}

export function raster(points, size, options = {}) {
  if (!Number.isInteger(size) || size < 2) {
    throw new RangeError('Raster size must be an integer of at least 2.');
  }
  const pixels = new Uint8ClampedArray(size * size * 4);
  let offset = 0;
  for (let row = 0; row < size; row++) {
    const v = 6 - 12 * row / (size - 1);
    for (let col = 0; col < size; col++) {
      const u = -6 + 12 * col / (size - 1);
      const brightness = Math.sqrt(intensity(points, u, v, options));
      pixels[offset++] = Math.round(8 + brightness * (185 - 8));
      pixels[offset++] = Math.round(14 + brightness * (221 - 14));
      pixels[offset++] = Math.round(25 + brightness * (255 - 25));
      pixels[offset++] = 255;
    }
  }
  return pixels;
}
