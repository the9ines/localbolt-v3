// @the9ines/localbolt-browser - Browser-layer code for LocalBolt web apps.
//
// Extracted from bolt-core-sdk/ts/bolt-transport-web as part of the
// headless-core migration. These are product/browser-layer concerns,
// not SDK authority.

// Components
export { createConnectionStatus } from './components/connection-status.js';
export { createDeviceDiscovery } from './components/device-discovery.js';
export {
  createFileUpload,
  setWebrtcRef,
  setDirectTransportRef,
} from './components/file-upload.js';
export {
  createTransferProgress,
  formatSpeed,
  formatTime,
  formatSize,
} from './components/transfer-progress.js';
export { createVerificationStatus } from './components/verification-status.js';

// UI utilities
export { showToast } from './ui/toast.js';
export { icons } from './ui/icons.js';

// State
export { AppStore, store } from './state/store.js';
export type { AppState, ConnectionRequest } from './state/store.js';

// Signaling
export type { SignalMessage, DiscoveredDevice, SignalingProvider } from './services/signaling/SignalingProvider.js';
export { WebSocketSignaling } from './services/signaling/WebSocketSignaling.js';
export { DualSignaling } from './services/signaling/DualSignaling.js';
export { detectDeviceType, getDeviceName } from './services/signaling/device-detect.js';

// Identity & TOFU persistence
export { IndexedDBIdentityStore, getOrCreateIdentity, zeroizeIdentityKey } from './services/identity/identity-store.js';
export type { IdentityPersistence } from './services/identity/identity-store.js';
export { IndexedDBPinStore } from './services/identity/pin-store.js';
export type { PinPersistence, PinRecord, PinVerifyResult } from './services/identity/pin-store.js';

// WebRTC (legacy tribute - browser↔browser)
export { default as WebRTCService } from './services/webrtc/WebRTCService.js';
export type { TransferProgress, TransferStats, WebRTCServiceOptions, VerificationInfo, VerificationState } from './services/webrtc/WebRTCService.js';

// WS/WT Transport (forward-path browser↔app)
export { WsDataTransport, WtDataTransport, BrowserAppTransport } from './services/ws-transport/index.js';
export type { WsDataTransportOptions, WtDataTransportOptions, DataTransport, BrowserAppTransportOptions } from './services/ws-transport/index.js';

// Platform / Lib
export { escapeHTML } from './lib/sanitize.js';
export {
  detectDevice,
  getDeviceName as getPlatformDeviceName,
  getMaxChunkSize,
  getPlatformICEServers,
  getLocalOnlyRTCConfig,
  isPrivateIP,
  isLocalCandidate,
} from './lib/platform-utils.js';

// Protocol WASM
export { initProtocolWasm, getProtocolAuthorityMode } from './services/webrtc/ProtocolWasmLoader.js';
export type { ProtocolAuthorityMode } from './services/webrtc/ProtocolWasmLoader.js';

// Transfer Metrics
export { setTransferMetricsEnabled } from './services/webrtc/transferMetrics.js';

// Policy
export { initPolicyAdapter, getPolicyAdapter } from './services/webrtc/PolicyAdapter.js';
export type { PolicyAdapter, ScheduleDecision, StallResult, ProgressResult } from './services/webrtc/PolicyAdapter.js';

// Error types
export { SignalingError } from './types/webrtc-errors.js';
export { WebRTCError, ConnectionError, TransferError, EncryptionError } from './types/webrtc-errors.js';
