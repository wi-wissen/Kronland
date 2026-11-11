// Reactive network state for the interface (small on purpose: components import this, the rest of src/net loads on demand).
import { reactive } from 'vue';

export const net = reactive({
  /** Configuration read (initNet finished) */
  ready: false,
  server: /** @type {string|null} */ (null),
  /** Sources named in the configuration file */
  sources: /** @type {string[]} */ ([]),
  /** Sources the player added */
  playerSources: /** @type {string[]} */ ([]),
  signedIn: false,
  /** { displayName, accountUrl } from GET /api/v1/me */
  user: /** @type {{ displayName: string, accountUrl: string }|null} */ (null),
  /** Last sign-in problem: { code, params } */
  error: /** @type {{ code: string, params: any }|null} */ (null),
});

/** Is there anywhere to discover levels from? Otherwise the game behaves as in stage 0. */
export const canDiscover = () => !!net.server || net.sources.length > 0 || net.playerSources.length > 0;

/** Packs the player opened (id -> true), filled from the kv store by initNet; the "New" badge reads it. */
export const seen = reactive(/** @type {Record<string, boolean>} */ ({}));

/** Packs of all sources for the library (filled by refreshLibrary in index.js; empty without server and sources). */
export const library = reactive({
  packs: /** @type {any[]} */ ([]),
  errors: /** @type {any[]} */ ([]),
  loading: false,
  loaded: false,
});
