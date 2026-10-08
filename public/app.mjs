import { PRESETS, raster, field } from './model.mjs?v=636-1';

const $ = selector => document.querySelector(selector);
const mask = $('#mask');
const holeList = $('#hole-list');
const ranges = { x: $('#hole-x'), y: $('#hole-y') };
const status = $('#status');
const state = {
  points: PRESETS.pair.map(point => ({ ...point })),
  selected: 0,
  probe: { u: 0, v: 0 },
};
const svgNS = 'http://www.w3.org/2000/svg';

function svgElement(name, attributes) {
  const element = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function renderSource() {
  const maskWidth = mask.getBoundingClientRect().width;
  const hitRadius = maskWidth > 0 ? Math.max(.145, 45 / maskWidth) : .145;
  mask.replaceChildren(...state.points.map((point, index) => {
    const group = svgElement('g', {
      class: `hole${index === state.selected ? ' selected' : ''}`,
      'data-hole-index': index,
      'data-x': point.x,
      'data-y': point.y,
    });
    group.append(
      svgElement('circle', { cx: point.x, cy: -point.y, r: hitRadius, fill: 'transparent' }),
      svgElement('circle', { cx: point.x, cy: -point.y, r: .068, class: 'halo' }),
      svgElement('circle', { cx: point.x, cy: -point.y, r: .025, class: 'pin' }),
    );
    return group;
  }));
  if (holeList.children.length !== state.points.length) {
    holeList.replaceChildren(...state.points.map((_, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `Hole ${index + 1}`;
      button.addEventListener('click', () => selectHole(index));
      return button;
    }));
  }
  [...holeList.children].forEach((button, index) => {
    button.setAttribute('aria-pressed', String(index === state.selected));
  });
  const point = state.points[state.selected];
  for (const axis of ['x', 'y']) {
    ranges[axis].value = point[axis];
    $(`#hole-${axis}-value`).textContent = point[axis].toFixed(2);
  }
  $('#hole-count').textContent = `${state.points.length} of 8 holes`;
}

function selectHole(index) {
  state.selected = index;
  status.textContent = '';
  renderSource();
}

function renderProbe() {
  for (const axis of ['u', 'v']) {
    $(`#probe-${axis}`).value = state.probe[axis];
    $(`#probe-${axis}-value`).textContent = state.probe[axis].toFixed(2);
  }
  const sum = field(state.points, state.probe.u, state.probe.v);
  $('#brightness').textContent = `Brightness: ${Math.round(100 * sum.intensity)}%`;
  drawWaves(sum);
}

function drawWaves(sum) {
  const diagram = $('#wave-diagram');
  const defs = svgElement('defs', {});
  for (const [id, color, size] of [['wave-tip', '#b9ddff', 7], ['sum-tip', '#ffd38a', 5]]) {
    const marker = svgElement('marker', {
      id, viewBox: '0 0 10 10', refX: 9, refY: 5,
      markerWidth: size, markerHeight: size, markerUnits: 'userSpaceOnUse', orient: 'auto',
    });
    marker.append(svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 Z', fill: color }));
    defs.append(marker);
  }
  // The raw-vector scale depends only on hole count, never on the sum or
  // intensity. The entire chain spans at most 160 units, including at a null.
  // Use this SAME scale for unit waves and the unnormalized resultant.
  const scale = 160 / state.points.length;
  const vertices = [{ x: 0, y: 0 }];
  for (const wave of sum.waves) {
    const last = vertices.at(-1);
    vertices.push({ x: last.x + scale * wave.re, y: last.y - scale * wave.im });
  }
  const xs = vertices.map(point => point.x);
  const ys = vertices.map(point => point.y);
  const offsetX = 180 - (Math.min(...xs) + Math.max(...xs)) / 2;
  const offsetY = 98 - (Math.min(...ys) + Math.max(...ys)) / 2;
  const chain = svgElement('g', { transform: `translate(${offsetX} ${offsetY})` });
  sum.waves.forEach((_, index) => {
    const start = vertices[index];
    const end = vertices[index + 1];
    chain.append(svgElement('line', {
      'data-wave': index, x1: start.x, y1: start.y, x2: end.x, y2: end.y,
      stroke: '#b9ddff', 'stroke-width': 3, 'marker-end': 'url(#wave-tip)',
    }));
  });
  chain.append(svgElement('line', {
    'data-resultant': '', x1: 0, y1: 0, x2: scale * sum.re, y2: -scale * sum.im,
    stroke: '#ffd38a', 'stroke-width': 1.5, 'stroke-dasharray': '4 3',
    // A null retains its raw endpoint and DOM element, but no artificial arrowhead.
    'marker-end': Math.hypot(sum.re, sum.im) > 1e-10 ? 'url(#sum-tip)' : 'none',
  }));
  const label = svgElement('text', { x: 180, y: 207, 'text-anchor': 'middle', fill: '#ffd38a' });
  label.textContent = 'Together';
  diagram.replaceChildren(defs, chain, label);
}

function sourceChanged() {
  renderSource();
  scheduleProbe();
  scheduleSky();
}

for (const button of document.querySelectorAll('[data-preset]')) {
  button.addEventListener('click', () => {
    state.points = PRESETS[button.dataset.preset].map(point => ({ ...point }));
    state.selected = 0;
    status.textContent = '';
    sourceChanged();
  });
}

for (const axis of ['x', 'y']) {
  ranges[axis].addEventListener('input', () => {
    moveHole({ ...state.points[state.selected], [axis]: Number(ranges[axis].value) });
  });
}

const sky = $('#sky');
const context = sky.getContext('2d');
let skyFrame = null;
let probeFrame = null;

function scheduleProbe() {
  if (probeFrame !== null) return;
  probeFrame = requestAnimationFrame(() => {
    probeFrame = null;
    renderProbe();
  });
}

for (const axis of ['u', 'v']) {
  $(`#probe-${axis}`).addEventListener('input', event => {
    state.probe[axis] = Number(event.target.value);
    scheduleProbe();
  });
}

function inspectSky(event) {
  const bounds = sky.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  // Use the displayed rectangle, not the 256-pixel raster dimensions.
  const snap = value => Math.max(-6, Math.min(6, Math.round(value / .05) * .05));
  state.probe.u = snap(-6 + 12 * (event.clientX - bounds.left) / bounds.width);
  state.probe.v = snap(6 - 12 * (event.clientY - bounds.top) / bounds.height);
  scheduleProbe();
}

let skyPointer = null;
sky.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || skyPointer !== null) return;
  skyPointer = event.pointerId;
  sky.setPointerCapture(event.pointerId);
  inspectSky(event);
  event.preventDefault();
});
sky.addEventListener('pointermove', event => {
  if (skyPointer === event.pointerId) inspectSky(event);
});
sky.addEventListener('pointerup', event => {
  if (skyPointer !== event.pointerId) return;
  inspectSky(event);
  skyPointer = null;
  if (sky.hasPointerCapture(event.pointerId)) sky.releasePointerCapture(event.pointerId);
});
function cancelSkyPointer(event) {
  if (skyPointer === event.pointerId) skyPointer = null;
}
sky.addEventListener('pointercancel', cancelSkyPointer);
sky.addEventListener('lostpointercapture', cancelSkyPointer);

function drawSky() {
  // A hidden or collapsed scene is redrawn when ResizeObserver sees it again.
  const bounds = sky.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return;
  context.putImageData(new ImageData(raster(state.points, 256), 256, 256), 0, 0);
}

function scheduleSky() {
  if (skyFrame !== null) return;
  skyFrame = requestAnimationFrame(() => {
    skyFrame = null;
    drawSky();
  });
}

new ResizeObserver(scheduleSky).observe(sky);
new ResizeObserver(renderSource).observe(mask);

const messages = {
  limit: 'Eight holes is enough for this sky. Remove one to make room.',
  near: 'Leave a little space between holes.',
  minimum: 'Keep one hole to light the screen.',
  edge: 'The whole mask has reached the edge.',
};
const roundCoordinate = value => Math.round(value * 1e10) / 1e10;

// Build and validate the entire translated mask before changing any state.
// Round only the edited axis; the untouched coordinates retain their exact values.
function moveMask(dx, dy) {
  const candidate = state.points.map(point => ({
    x: dx === 0 ? point.x : roundCoordinate(point.x + dx),
    y: dy === 0 ? point.y : roundCoordinate(point.y + dy),
  }));
  if (candidate.some(point => point.x < -1 || point.x > 1 || point.y < -1 || point.y > 1)) {
    status.textContent = messages.edge;
    return;
  }
  state.points = candidate;
  status.textContent = '';
  sourceChanged();
}

for (const [direction, dx, dy] of [
  ['left', -.1, 0], ['right', .1, 0], ['up', 0, .1], ['down', 0, -.1],
]) {
  $(`#move-${direction}`).addEventListener('click', () => moveMask(dx, dy));
}

// Check every opening and pair before assigning any part of a new mask.
function maskCandidateMessage(candidate) {
  if (candidate.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y)
      || point.x < -1 || point.x > 1 || point.y < -1 || point.y > 1)) return messages.edge;
  for (let index = 0; index < candidate.length; index++) {
    for (let other = 0; other < index; other++) {
      if (Math.hypot(candidate[index].x - candidate[other].x,
        candidate[index].y - candidate[other].y) < .08) return messages.near;
    }
  }
  return '';
}

function changeMask(transform) {
  const candidate = state.points.map(transform);
  const rejection = maskCandidateMessage(candidate);
  status.textContent = rejection;
  if (rejection || candidate.every((point, index) =>
    point.x === state.points[index].x && point.y === state.points[index].y)) return;
  state.points = candidate;
  sourceChanged();
}

for (const [id, transform] of [
  ['mask-turn-left', point => ({
    x: roundCoordinate(-point.y), y: roundCoordinate(point.x),
  })],
  ['mask-reflect', point => ({ x: roundCoordinate(-point.x), y: point.y })],
  ['mask-shrink', point => ({
    x: roundCoordinate(point.x * .8), y: roundCoordinate(point.y * .8),
  })],
  ['mask-expand', point => ({
    x: roundCoordinate(point.x * 1.25), y: roundCoordinate(point.y * 1.25),
  })],
]) {
  // Keep rejected actions available: the same candidate guard reports why.
  $(`#${id}`).addEventListener('click', () => changeMask(transform));
}

function validPoint(point, skip = -1) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)
      || point.x < -1 || point.x > 1 || point.y < -1 || point.y > 1) {
    status.textContent = messages.edge;
    return false;
  }
  if (state.points.some((other, index) => index !== skip
      && Math.hypot(other.x - point.x, other.y - point.y) < .08)) {
    status.textContent = messages.near;
    return false;
  }
  return true;
}

function moveHole(point) {
  point = { x: roundCoordinate(point.x), y: roundCoordinate(point.y) };
  if (!validPoint(point, state.selected)) {
    renderSource(); // Restore a rejected native range edit to the actual position.
    return;
  }
  status.textContent = '';
  const previous = state.points[state.selected];
  if (point.x === previous.x && point.y === previous.y) return;
  state.points[state.selected] = point;
  sourceChanged();
}

function addHole(point) {
  if (state.points.length === 8) {
    status.textContent = messages.limit;
    return;
  }
  point = { x: roundCoordinate(point.x), y: roundCoordinate(point.y) };
  if (!validPoint(point)) return;
  state.points.push(point);
  state.selected = state.points.length - 1;
  status.textContent = '';
  sourceChanged();
}

$('#remove-hole').addEventListener('click', () => {
  if (state.points.length === 1) {
    status.textContent = messages.minimum;
    return;
  }
  state.points.splice(state.selected, 1);
  state.selected = Math.min(state.selected, state.points.length - 1);
  status.textContent = '';
  sourceChanged();
});

function maskPoint(event) {
  const bounds = mask.getBoundingClientRect();
  return {
    x: -1 + 2 * (event.clientX - bounds.left) / bounds.width,
    y: 1 - 2 * (event.clientY - bounds.top) / bounds.height,
  };
}

let gesture = null;
mask.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || gesture) return;
  const hole = event.target.closest('[data-hole-index]');
  const index = hole ? Number(hole.dataset.holeIndex) : null;
  if (index !== null) selectHole(index);
  gesture = {
    id: event.pointerId,
    index,
    start: maskPoint(event),
    origin: index === null ? null : { ...state.points[index] },
    clientX: event.clientX,
    clientY: event.clientY,
    moved: false,
  };
  // Capture on the persistent plane: its hole children are replaced during edits.
  mask.setPointerCapture(event.pointerId);
  event.preventDefault();
});
mask.addEventListener('pointermove', event => {
  if (!gesture || gesture.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) > 8) {
    gesture.moved = true;
  }
  if (gesture.index === null) return;
  const point = maskPoint(event);
  moveHole({
    x: gesture.origin.x + point.x - gesture.start.x,
    y: gesture.origin.y + point.y - gesture.start.y,
  });
});
mask.addEventListener('pointerup', event => {
  if (!gesture || gesture.id !== event.pointerId) return;
  const finished = gesture;
  gesture = null;
  if (mask.hasPointerCapture(event.pointerId)) mask.releasePointerCapture(event.pointerId);
  // Only an empty-plane tap adds; a drag never becomes an add on release.
  if (finished.index === null && !finished.moved) addHole(maskPoint(event));
});
function cancelGesture(event) {
  if (gesture?.id === event.pointerId) gesture = null;
}
mask.addEventListener('pointercancel', cancelGesture);
mask.addEventListener('lostpointercapture', cancelGesture);

renderSource();
renderProbe();
drawSky();
