// Hand-over from "Discover levels" to the world editor: an own pack opened from the server (id, media files).
// The editor is loaded on demand, so the pack waits here until the editor instance takes it.

/** @type {{ id: string, files: Map<string, Blob> }|null} */
let pending = null;

export const setPendingServerPack = (p) => { pending = p; };

/** Take the waiting pack (once). */
export function takePendingServerPack() {
  const p = pending;
  pending = null;
  return p;
}
