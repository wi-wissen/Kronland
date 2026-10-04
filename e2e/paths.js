// Addresses of the website for the E2E tests in one place: the game lives under play/.

/** Path of the game (relative to the baseURL from playwright.config.js). */
export const PLAY = '/play/';

/**
 * Address of the game with optional URL parameters.
 * @param {string} [query] e.g. '?seed=42&fog=off'
 */
export const playUrl = (query = '') => PLAY + String(query).replace(/^\/+/, '');
