/**
 * BrowserAppTransport -- orchestrator for browser-to-daemon transport.
 *
 * Strategy: WebTransport primary -> WS fallback -> WebRTC fallback.
 *
 * 1. If WebTransport URL configured and browser supports it, attempts WT.
 * 2. On WT failure (or not configured), falls back to WebSocket.
 * 3. On WS failure, falls back to WebRTC via existing DualSignaling +
 *    WebRTCService path.
 *
 * The active transport is transparent to the caller after connect().
 */

import { WsDataTransport } from './WsDataTransport.js';
import { WtDataTransport } from './WtDataTransport.js';
import type { WsDataTransportOptions } from './WsDataTransport.js';
import type { WtDataTransportOptions } from './WtDataTransport.js';
import type WebRTCService from '../webrtc/WebRTCService.js';
import type { TransferProgress, VerificationInfo } from '../webrtc/types.js';

// ─── Options ────────────────────────────────────────────────────────────────

export interface BrowserAppTransportOptions {
  /** Daemon WebSocket URL, e.g. "ws://localhost:9100" */
  daemonUrl: string;
  /** WS connection timeout in ms. Default: 5000 */
  wsConnectTimeout?: number;

  // ── WebTransport options ──
  /** Daemon WebTransport URL, e.g. "https://localhost:4433". If set, WT is attempted first. */
  webTransportUrl?: string;
  /** WT connection timeout in ms. Default: 5000 */
  wtConnectTimeout?: number;

  // ── WebRTC fallback options ──
  /** Signaling server URL for WebRTC fallback. */
  signalingUrl?: string;
  /** Remote peer code for WebRTC fallback. */
  peerCode?: string;

  // ── Shared options ──
  /** Ed25519 identity keypair. */
  identity?: { publicKey: Uint8Array; secretKey: Uint8Array };
  /** Ed25519 identity public key. */
  identityPublicKey?: Uint8Array;
  /** Verification state callback. */
  onVerification?: (info: VerificationInfo) => void;
  /** Fired when a complete file is received. */
  onReceiveFile?: (file: Blob, filename: string) => void;
  /** Transfer progress callback. */
  onProgress?: (progress: TransferProgress) => void;
  /** Fired with the active transport mode ('webtransport' | 'ws' | 'webrtc'). */
  onTransportMode?: (mode: 'webtransport' | 'ws' | 'webrtc') => void;
  /** Error callback. */
  onError?: (error: Error) => void;
  /** Enable BTR capability. Default: false. */
  btrEnabled?: boolean;
  /** Force-disable WebTransport even if webTransportUrl is set and browser supports it (WTI4 kill-switch).
   *  Default: true when webTransportUrl is provided. Set to false to force WS-only. */
  webTransportEnabled?: boolean;

  /**
   * Factory for creating a WebRTC fallback service.
   * Injected to avoid hard dependency on signaling setup.
   * If not provided, WebRTC fallback is unavailable and connect()
   * will throw when both WT and WS fail.
   */
  createWebRTCFallback?: () => Promise<WebRTCService>;
}

// ─── BrowserAppTransport ────────────────────────────────────────────────────

export class BrowserAppTransport {
  private wtTransport: WtDataTransport | null = null;
  private wsTransport: WsDataTransport | null = null;
  private webrtcService: WebRTCService | null = null;
  private transportMode: 'webtransport' | 'ws' | 'webrtc' | null = null;
  private readonly options: BrowserAppTransportOptions;

  constructor(options: BrowserAppTransportOptions) {
    this.options = options;
  }

  /** Current transport mode, or null if not connected. */
  get mode(): 'webtransport' | 'ws' | 'webrtc' | null {
    return this.transportMode;
  }

  /**
   * Connect using WT primary -> WS fallback -> WebRTC fallback.
   * Throws if all transports fail.
   */
  async connect(): Promise<void> {
    // Derive WT enablement: configured URL + not force-disabled + browser API exists
    const wtEnabled = !!this.options.webTransportUrl
      && this.options.webTransportEnabled !== false
      && typeof globalThis.WebTransport !== 'undefined';

    // 1. Try WebTransport primary (if enabled)
    if (wtEnabled) {
      const wtOk = await this.tryWtConnect();
      if (wtOk) {
        this.transportMode = 'webtransport';
        this.options.onTransportMode?.('webtransport');
        console.log('[WT_TRANSPORT] Using WebTransport transport');
        return;
      }
      console.log('[TRANSPORT_FALLBACK] WebTransport failed, falling back to WebSocket');
    }

    // 2. Try WS
    const wsOk = await this.tryWsConnect();
    if (wsOk) {
      this.transportMode = 'ws';
      this.options.onTransportMode?.('ws');
      console.log('[WS_TRANSPORT] Using WebSocket transport');
      return;
    }

    // 3. WS failed -> automatic WebRTC fallback
    console.log('[TRANSPORT_FALLBACK] WS failed, falling back to WebRTC');
    await this.connectWebRTC();
    this.transportMode = 'webrtc';
    this.options.onTransportMode?.('webrtc');
    console.log('[TRANSPORT_FALLBACK] Using WebRTC transport');
  }

  /**
   * Attempt WebTransport connection with timeout.
   * Returns true on success, false on failure.
   */
  private async tryWtConnect(): Promise<boolean> {
    try {
      this.wtTransport = new WtDataTransport({
        daemonUrl: this.options.webTransportUrl!,
        connectTimeout: this.options.wtConnectTimeout ?? 5000,
        identity: this.options.identity,
        identityPublicKey: this.options.identityPublicKey,
        onVerification: this.options.onVerification,
        onReceiveFile: this.options.onReceiveFile,
        onProgress: this.options.onProgress,
        onTransportMode: this.options.onTransportMode,
        onError: this.options.onError,
        btrEnabled: this.options.btrEnabled,
        onDisconnect: () => {
          console.log('[WT_TRANSPORT] Disconnected from daemon');
        },
      });

      const ok = await this.wtTransport.connect();
      if (!ok) {
        this.wtTransport = null;
        return false;
      }
      return true;
    } catch {
      this.wtTransport = null;
      return false;
    }
  }

  /**
   * Attempt WS connection with timeout.
   * Returns true on success, false on failure.
   */
  private async tryWsConnect(): Promise<boolean> {
    try {
      this.wsTransport = new WsDataTransport({
        daemonUrl: this.options.daemonUrl,
        connectTimeout: this.options.wsConnectTimeout ?? 5000,
        identity: this.options.identity,
        identityPublicKey: this.options.identityPublicKey,
        onVerification: this.options.onVerification,
        onReceiveFile: this.options.onReceiveFile,
        onProgress: this.options.onProgress,
        onTransportMode: this.options.onTransportMode,
        onError: this.options.onError,
        btrEnabled: this.options.btrEnabled,
        webTransportEnabled: !!this.options.webTransportUrl && this.options.webTransportEnabled !== false,
        onDisconnect: () => {
          console.log('[WS_TRANSPORT] Disconnected from daemon');
        },
      });

      const ok = await this.wsTransport.connect();
      if (!ok) {
        this.wsTransport = null;
        return false;
      }
      return true;
    } catch {
      this.wsTransport = null;
      return false;
    }
  }

  /**
   * Connect via WebRTC using the injected factory.
   * Throws if no factory provided or connection fails.
   */
  private async connectWebRTC(): Promise<void> {
    if (!this.options.createWebRTCFallback) {
      throw new Error('[TRANSPORT_FALLBACK] WebRTC fallback not configured — no createWebRTCFallback factory');
    }

    this.webrtcService = await this.options.createWebRTCFallback();

    if (this.options.peerCode) {
      await this.webrtcService.connect(this.options.peerCode);
    }
  }

  /** Send a file via the active transport. */
  async sendFile(file: File): Promise<void> {
    if (this.transportMode === 'webtransport' && this.wtTransport) {
      return this.wtTransport.sendFile(file);
    }
    if (this.transportMode === 'ws' && this.wsTransport) {
      return this.wsTransport.sendFile(file);
    }
    if (this.transportMode === 'webrtc' && this.webrtcService) {
      return this.webrtcService.sendFile(file);
    }
    throw new Error('No active transport — call connect() first');
  }

  /** Mark the connected peer as verified (TOFU). */
  async markPeerVerified(): Promise<void> {
    if (this.webrtcService) {
      return this.webrtcService.markPeerVerified();
    }
    if (this.wsTransport) {
      return this.wsTransport.markPeerVerified();
    }
  }

  /** Disconnect the active transport. */
  disconnect(): void {
    if (this.wtTransport) {
      this.wtTransport.disconnect();
      this.wtTransport = null;
    }
    if (this.wsTransport) {
      this.wsTransport.disconnect();
      this.wsTransport = null;
    }
    if (this.webrtcService) {
      this.webrtcService.disconnect();
      this.webrtcService = null;
    }
    this.transportMode = null;
  }
}
