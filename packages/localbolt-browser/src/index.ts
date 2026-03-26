// @the9ines/localbolt-ui — Product UI components and state for LocalBolt browser apps.
//
// Extracted from bolt-core-sdk/ts/bolt-transport-web as part of the
// headless-core migration. These are product-layer concerns, not SDK authority.

// Components
export { createConnectionStatus } from './components/connection-status.js';
export { createDeviceDiscovery } from './components/device-discovery.js';
export {
  createFileUpload,
  setWebrtcRef,
  setDirectTransportRef,
} from './components/file-upload.js';
export { createTransferProgress } from './components/transfer-progress.js';
export { createVerificationStatus } from './components/verification-status.js';

// UI utilities
export { showToast } from './ui/toast.js';
export { icons } from './ui/icons.js';

// State
export { store } from './state/store.js';
