// ─── Signaling Module ──────────────────────────────────────────────────────
// Barrel export for the signaling abstraction layer.

export type { SignalMessage, DiscoveredDevice, SignalingProvider } from './SignalingProvider.js';
export { WebSocketSignaling } from './WebSocketSignaling.js';
export { DualSignaling } from './DualSignaling.js';
export { detectDeviceType, getDeviceName } from './device-detect.js';
