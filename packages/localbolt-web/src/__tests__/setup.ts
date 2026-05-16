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

if (typeof window !== 'undefined') {
  const storage = new Map<string, string>();
  const localStorageMock: Storage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(storage.keys())[index] ?? null;
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    setItem(key: string, value: string) {
      storage.set(key, String(value));
    },
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
  });
}
