// ─── Browser↔App Transport (PM-RC-02, WTI3) ────────────────────────────────
// WebTransport primary -> WebSocket fallback -> WebRTC fallback
// for browser-to-daemon communication.

export { WsDataTransport } from './WsDataTransport.js';
export type { WsDataTransportOptions, DataTransport } from './WsDataTransport.js';
export { WtDataTransport, encodeFrame, FrameDeframer } from './WtDataTransport.js';
export type { WtDataTransportOptions } from './WtDataTransport.js';
export { BrowserAppTransport } from './BrowserAppTransport.js';
export type { BrowserAppTransportOptions } from './BrowserAppTransport.js';
