/**
 * Vitest setup — polyfill missing jsdom APIs that cause uncaught exceptions
 * under v8 coverage instrumentation.
 *
 * jsdom does not implement HTMLDialogElement.showModal(). When v8 coverage
 * keeps the process alive longer than usual, deferred requestAnimationFrame
 * callbacks fire and call showModal(), producing an uncaught TypeError that
 * exits vitest non-zero even though all tests and thresholds pass.
 */
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {};
  HTMLDialogElement.prototype.close = HTMLDialogElement.prototype.close || function () {};
}
