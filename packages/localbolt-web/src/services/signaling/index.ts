// ─── Signaling Module ──────────────────────────────────────────────────────
// Barrel export for the signaling abstraction layer.

export type { SignalMessage, DiscoveredDevice, SignalingProvider } from './SignalingProvider';
export { WebSocketSignaling } from './WebSocketSignaling';
export { detectDeviceType, getDeviceName } from './device-detect';
