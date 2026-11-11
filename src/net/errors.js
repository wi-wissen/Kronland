// Errors of the network layer: a code (i18n key) plus parameters for its placeholders.
// Codes: packs.err.* (config, catalog, packs), auth.err.* (sign-in), saves.err.* (cloud saves, see src/save/format.js),
// net.err.* (transport). Server answers carry their own code (contract/schemas/error.schema.json).

export class NetError extends Error {
  /** @param {string} code i18n key @param {Record<string, any>} [params] @param {unknown} [cause] */
  constructor(code, params = {}, cause = undefined) {
    super(code);
    this.name = 'NetError';
    this.code = code;
    this.params = params;
    if (cause) this.cause = cause;
  }
}

/** Is this the failure of a request that never got an answer (offline, DNS, CORS)? */
export const isOffline = (e) => e instanceof NetError && (e.code === 'net.err.offline' || e.code === 'packs.err.network');

/**
 * Message for a user: the error's own text if the dictionary knows the code, otherwise a generic one.
 * @param {unknown} e @param {(key: string, params?: any) => string} t @param {(key: string) => boolean} has
 */
export function errorMessage(e, t, has) {
  if (e instanceof NetError || (e && typeof e === 'object' && typeof e.code === 'string' && 'params' in e)) {
    // @ts-ignore code and params exist (checked above)
    return has(e.code) ? t(e.code, e.params) : t('net.err.unknown', { code: e.code });
  }
  return t('net.err.unknown', { code: String(e?.message ?? e) });
}
