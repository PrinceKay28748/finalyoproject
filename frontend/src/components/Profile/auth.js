/**
 * Validates if a token exists and is structurally a valid JWT.
 * Prevents common "junk" strings from being sent to the backend.
 * 
 * @param {string|null} token 
 * @returns {boolean}
 */
export const isTokenValid = (token) => {
  if (!token || typeof token !== 'string') return false;
  const junkValues = ['undefined', 'null', '[object Object]'];
  if (junkValues.includes(token)) return false;
  // Support development mock tokens or standard 3-part JWTs
  return token === 'mock-token' || token.split('.').length === 3;
};