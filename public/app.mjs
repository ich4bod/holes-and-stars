import { PRESETS, raster, field } from './model.mjs?v=655-1';

const $ = selector => document.querySelector(selector);
const mask = $('#mask');
const holeList = $('#hole-list');
const ranges = { x: $('#hole-x'), y: $('#hole-y') };
const status = $('#status');
const state = {
  points: PRESETS.pair.map(point => ({ ...point })),
  selected: 0,
  probe: { u: 0, v: 0 },
  opening: { shape: 'point', width: 0, height: 0 },
  phaseMode: 'equal',
  illuminationMode: 'all',
};
const svgNS = 'http://www.w3.org/2000/svg';
const undoButton = $('#mask-undo');
const redoButton = $('#mask-redo');
const past = [];
const future = [];
let keptMask = null;
const keepButton = $('#mask-keep');
const returnButton = $('#mask-return');
const forgetButton = $('#mask-forget');
const keptInfo = $('#mask-kept-info');
const showKeptSlice = $('#slice-show-kept');
const keptSliceLine = $('#slice-kept-line');
const sliceAxis = $('#slice-axis');
let selectedSliceAxis = 'row';
const copyPoints = points => points.map(point => ({ ...point }));
const snapshot = () => ({ points: copyPoints(state.points), selected: state.selected });
const sameMask = (a, b) => a.length === b.length && a.every((point, index) =>
  point.x === b[index].x && point.y === b[index].y);
const modelOptions = () => ({
  ...state.opening,
  phaseMode: state.phaseMode,
  onlyIndex: state.illuminationMode === 'chosen' ? state.selected : null,
});

function canReturnKeptMask() {
  return keptMask !== null && gesture === null
    && (!sameMask(keptMask.points, state.points) || keptMask.selected !== state.selected);
}

function updateKeptMask() {
  returnButton.disabled = !canReturnKeptMask();
  forgetButton.disabled = keptMask === null;
  keptInfo.textContent = keptMask === null
    ? 'No mask kept.' : `Kept mask: ${keptMask.points.length} holes.`;
  showKeptSlice.disabled = keptMask === null;
  if (keptMask === null) showKeptSlice.checked = false;
  keptSliceLine.toggleAttribute('hidden', keptMask === null || !showKeptSlice.checked);
}

keepButton.addEventListener('click', () => {
  keptMask = snapshot();
  updateKeptMask();
  scheduleProbe();
});
returnButton.addEventListener('click', () => {
  if (!canReturnKeptMask()) return;
  commitMask(keptMask.points, keptMask.selected);
});
forgetButton.addEventListener('click', () => {
  keptMask = null;
  updateKeptMask();
  scheduleProbe();
});

function updateHistoryButtons() {
  undoButton.disabled = gesture !== null || past.length === 0;
  redoButton.disabled = gesture !== null || future.length === 0;
  updateKeptMask();
  updateCenterButton();
}

function pushSnapshot(stack, saved) {
  stack.push(saved);
  if (stack.length > 32) stack.shift();
}

function recordMaskEdit(before) {
  if (sameMask(before.points, state.points)) return;
  pushSnapshot(past, before);
  future.length = 0;
}

// All accepted point mutations pass here. A captured drag previews changes
// immediately, but retains only the snapshot before its first accepted move.
function commitMask(points, selected = state.selected) {
  const changed = !sameMask(points, state.points);
  const before = changed ? snapshot() : null;
  if (changed && gesture !== null && gesture.index !== null && !gesture.before) {
    gesture.before = before;
  }
  state.points = copyPoints(points);
  state.selected = Math.max(0, Math.min(selected, state.points.length - 1));
  status.textContent = '';
  if (changed && (gesture === null || gesture.index === null)) recordMaskEdit(before);
  sourceChanged();
  updateHistoryButtons();
}

function restoreMask(from, to) {
  if (gesture !== null || from.length === 0) return;
  pushSnapshot(to, snapshot());
  const saved = from.pop();
  state.points = copyPoints(saved.points);
  state.selected = Math.max(0, Math.min(saved.selected, state.points.length - 1));
  status.textContent = '';
  sourceChanged();
  updateHistoryButtons();
}
undoButton.addEventListener('click', () => restoreMask(past, future));
redoButton.addEventListener('click', () => restoreMask(future, past));

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
  updateKeptMask();
  updateCenterButton();
}

function selectHole(index) {
  state.selected = index;
  status.textContent = '';
  renderSource();
  scheduleProbe();
  if (state.illuminationMode === 'chosen') scheduleSky();
}

function renderProbe() {
  for (const axis of ['u', 'v']) {
    $(`#probe-${axis}`).value = state.probe[axis];
    $(`#probe-${axis}-value`).textContent = state.probe[axis].toFixed(2);
  }
  const options = modelOptions();
  const sum = field(state.points, state.probe.u, state.probe.v, options);
  $('#brightness').textContent = `Brightness: ${Math.round(100 * sum.intensity)}%`;
  $('#selected-wave-label').textContent = `Hole ${state.selected + 1} arrives on the highlighted arrow.`;
  drawWaves(sum);
  drawSlice(sum, options);
}

function drawSlice(sum, options) {
  const sample = i => {
    const coordinate = -6 + i * .05;
    return selectedSliceAxis === 'row'
      ? { u: coordinate, v: state.probe.v }
      : { u: state.probe.u, v: coordinate };
  };
  const draw = points => Array.from({ length: 241 }, (_, i) => {
    const { u, v } = sample(i);
    const intensity = field(points, u, v, options).intensity;
    return `${10 + 380 * i / 240},${150 - 140 * intensity}`;
  });
  $('#slice-line').setAttribute('points', draw(state.points).join(' '));
  keptSliceLine.setAttribute('points', keptMask === null ? '' : draw(keptMask.points).join(' '));
  keptSliceLine.toggleAttribute('hidden', keptMask === null || !showKeptSlice.checked);
  const horizontal = selectedSliceAxis === 'row' ? state.probe.u : state.probe.v;
  $('#slice-probe').setAttribute('cx', 10 + (horizontal + 6) * 380 / 12);
  $('#slice-probe').setAttribute('cy', 150 - 140 * sum.intensity);
  $('#slice-direction').textContent = selectedSliceAxis === 'row' ? 'Left to right' : 'Bottom to top';
}

$('#opening-shape').addEventListener('change', event => {
  const shapes = {
    point: [0, 0], square: [.25, .25], wide: [.5, .1], tall: [.1, .5],
  };
  const [width, height] = shapes[event.target.value];
  state.opening = { shape: event.target.value, width, height };
  scheduleProbe();
  scheduleSky();
});

$('#illumination-phase').addEventListener('change', event => {
  state.phaseMode = event.target.value;
  scheduleProbe();
  scheduleSky();
});

$('#illumination-holes').addEventListener('change', event => {
  state.illuminationMode = event.target.value;
  scheduleProbe();
  scheduleSky();
});

sliceAxis.addEventListener('change', event => {
  selectedSliceAxis = event.target.value;
  scheduleProbe();
});

$('#screen-slice').addEventListener('toggle', () => {
  if ($('#screen-slice').open) scheduleProbe();
});
showKeptSlice.addEventListener('change', () => {
  keptSliceLine.toggleAttribute('hidden', keptMask === null || !showKeptSlice.checked);
});

function drawWaves(sum) {
  const diagram = $('#wave-diagram');
  const defs = svgElement('defs', {});
  for (const [id, color, size] of [
    ['wave-tip', '#b9ddff', 7], ['selected-wave-tip', '#fff0d0', 7], ['sum-tip', '#ffd38a', 5],
  ]) {
    const marker = svgElement('marker', {
      id, viewBox: '0 0 10 10', refX: 9, refY: 5,
      markerWidth: size, markerHeight: size, markerUnits: 'userSpaceOnUse', orient: 'auto',
    });
    marker.append(svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 Z', fill: color }));
    defs.append(marker);
  }
  // This same scale depends only on opening count, not envelope brightness.
  // Use it for envelope-scaled waves and their unnormalized resultant.
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
    const selected = index === state.selected;
    chain.append(svgElement('line', {
      'data-wave': index, 'data-selected': String(selected),
      x1: start.x, y1: start.y, x2: end.x, y2: end.y,
      stroke: selected ? '#fff0d0' : '#b9ddff', 'stroke-width': selected ? 4 : 3,
      'marker-end': `url(#${selected ? 'selected-wave-tip' : 'wave-tip'})`,
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
    commitMask(PRESETS[button.dataset.preset], 0);
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
  context.putImageData(new ImageData(raster(state.points, 256, modelOptions()), 256, 256), 0, 0);
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
  commitMask(candidate);
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
  commitMask(candidate);
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

function centeredMaskCandidate() {
  const count = state.points.length;
  const cx = state.points.reduce((sum, point) => sum + point.x, 0) / count;
  const cy = state.points.reduce((sum, point) => sum + point.y, 0) / count;
  return state.points.map(point => ({
    x: roundCoordinate(point.x - cx),
    y: roundCoordinate(point.y - cy),
  }));
}

function updateCenterButton() {
  const candidate = centeredMaskCandidate();
  const rejection = maskCandidateMessage(candidate);
  const unchanged = candidate.every((point, index) =>
    point.x === state.points[index].x && point.y === state.points[index].y);
  $('#mask-center').disabled = gesture !== null || Boolean(rejection) || unchanged;
}

$('#mask-center').addEventListener('click', () => {
  const candidate = centeredMaskCandidate();
  if (gesture !== null || maskCandidateMessage(candidate)
      || candidate.every((point, index) =>
        point.x === state.points[index].x && point.y === state.points[index].y)) return;
  commitMask(candidate, state.selected);
});

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
  const candidate = copyPoints(state.points);
  candidate[state.selected] = point;
  commitMask(candidate);
}

function addHole(point) {
  if (state.points.length === 8) {
    status.textContent = messages.limit;
    return;
  }
  point = { x: roundCoordinate(point.x), y: roundCoordinate(point.y) };
  if (!validPoint(point)) return;
  commitMask([...state.points, point], state.points.length);
}

$('#remove-hole').addEventListener('click', () => {
  if (state.points.length === 1) {
    status.textContent = messages.minimum;
    return;
  }
  commitMask(state.points.filter((_, index) => index !== state.selected));
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
    before: null,
  };
  updateHistoryButtons();
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
  const finished = finishGesture();
  if (mask.hasPointerCapture(event.pointerId)) mask.releasePointerCapture(event.pointerId);
  // Only an empty-plane tap adds; a drag never becomes an add on release.
  if (finished.index === null && !finished.moved) addHole(maskPoint(event));
});
function finishGesture() {
  const finished = gesture;
  gesture = null;
  if (finished.before) recordMaskEdit(finished.before);
  updateHistoryButtons();
  return finished;
}
function cancelGesture(event) {
  // Cancellation keeps the last accepted preview, just like release.
  if (gesture?.id === event.pointerId) finishGesture();
}
mask.addEventListener('pointercancel', cancelGesture);
mask.addEventListener('lostpointercapture', cancelGesture);

renderSource();
renderProbe();
drawSky();
