/**
 * Fullscreen.js
 * Optional true-fullscreen + landscape lock. Supported on Android browsers and
 * desktop; iPhone Safari and some embedded views refuse it, in which case the
 * button is simply hidden (the game already fills the viewport).
 */
export function canFullscreen() {
  const el = document.documentElement;
  return Boolean(document.fullscreenEnabled && el.requestFullscreen);
}

export function isFullscreen() {
  return Boolean(document.fullscreenElement);
}

/** Enters fullscreen and tries to lock landscape. Resolves to true on success. */
export async function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      await document.exitFullscreen();
      return false;
    }
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    try {
      await screen.orientation?.lock?.('landscape');
    } catch {
      /* orientation lock is optional */
    }
    return true;
  } catch {
    return false;
  }
}
