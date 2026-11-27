// Red Rock Mail Run: keyboard and mouse. Arrows / WASD fly the plane (Up climbs),
// Shift throttles up, Control throttles down, Space is the afterburner, and
// the mouse is a virtual stick: its offset from the centre of the screen
// banks and pitches the plane, so the game is playable with mouse alone.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, active: false };
  let muted = false;

  function keyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') muted = !muted;
  }

  function keyUp(event) {
    keys.delete(event.code);
  }

  function mouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const scale = Math.min(rect.width, rect.height) / 2;
    mouse.x = Math.max(-1, Math.min(1, (event.clientX - cx) / (scale * 0.7)));
    mouse.y = Math.max(-1, Math.min(1, (event.clientY - cy) / (scale * 0.7)));
    mouse.active = true;
  }

  function mouseDown() {
    actions |= ACTION_CONFIRM;
  }

  function blur() {
    keys.clear();
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('mousemove', mouseMove);
  window.addEventListener('mousedown', mouseDown);
  window.addEventListener('blur', blur);

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  // The stick: keyboard and mouse add, clamped to [-1, 1].
  function stick() {
    let roll = 0;
    let pitch = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) roll -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) roll += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) pitch += 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) pitch -= 1;
    if (mouse.active) {
      roll += mouse.x;
      pitch += -mouse.y;
    }
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
    };
  }

  function control() {
    const s = stick();
    return {
      pitch: s.pitch,
      roll: s.roll,
      throttleUp: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      throttleDown: keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC'),
      boost: keys.has('Space'),
    };
  }

  function isMuted() {
    return muted;
  }

  return { takeActions, control, stick, isMuted };
}
