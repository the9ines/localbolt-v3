import { useEffect, useRef, useState, useCallback } from "react";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { WebRTCError, SignalingError } from "@/types/webrtc-errors";
import { WebSocketSignaling, detectDeviceType, getDeviceName } from "@/services/signaling";
import type { DiscoveredDevice } from "@/services/signaling/SignalingProvider";
import { TransferProgressBar } from "./file-upload/TransferProgress";
import { ConnectionStatus } from "./peer-connection/ConnectionStatus";
import { DeviceDiscovery } from "./peer-connection/DeviceDiscovery";
import { useTransferProgress } from "@/hooks/use-transfer-progress";
import { usePeerConnection } from "@/hooks/use-peer-connection";
import { generateSecurePeerCode } from "@/lib/crypto-utils";
import { useToast } from "@/hooks/use-toast";

interface PeerConnectionProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
}

export const PeerConnection = ({ onConnectionChange }: PeerConnectionProps) => {
  const {
    webrtc,
    setWebrtc,
    isConnected,
    setIsConnected,
    handleDisconnect,
    handleConnectionError,
  } = usePeerConnection(onConnectionChange);

  const {
    transferProgress,
    handleProgress,
    handleCancelReceiving,
    handlePauseTransfer,
    handleResumeTransfer,
    clearProgress,
  } = useTransferProgress(webrtc);

  const { toast } = useToast();

  const [discoveredPeers, setDiscoveredPeers] = useState<DiscoveredDevice[]>([]);
  const [connectingTo, setConnectingTo] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<DiscoveredDevice | null>(null);

  const discoveredPeersRef = useRef<DiscoveredDevice[]>([]);
  const signalingRef = useRef<WebSocketSignaling | null>(null);
  const rtcServiceRef = useRef<WebRTCService | null>(null);

  useEffect(() => {
    discoveredPeersRef.current = discoveredPeers;
  }, [discoveredPeers]);

  useEffect(() => {
    if (!isConnected && transferProgress) {
      clearProgress();
    }
  }, [isConnected, transferProgress, clearProgress]);

  useEffect(() => {
    if (!webrtc) {
      const code = generateSecurePeerCode();
      console.log('[WEBRTC] Creating new service with secure code:', code);

      const wsUrl = import.meta.env.VITE_SIGNAL_URL || 'ws://localhost:3001';
      const signaling = new WebSocketSignaling(wsUrl);
      signalingRef.current = signaling;

      signaling.onPeerDiscovered((peer) => {
        setDiscoveredPeers((prev) => {
          if (prev.some((p) => p.peerCode === peer.peerCode)) return prev;
          return [...prev, peer];
        });
      });

      signaling.onPeerLost((peerCode) => {
        setDiscoveredPeers((prev) => prev.filter((p) => p.peerCode !== peerCode));
      });

      signaling.connect(code, getDeviceName(), detectDeviceType()).then(() => {
        const rtcService = new WebRTCService(
          signaling,
          code,
          handleFileReceive,
          handleConnectionError,
          handleProgress,
        );
        rtcService.setConnectionStateHandler(handleConnectionStateChange);
        rtcServiceRef.current = rtcService;
        setWebrtc(rtcService);
      }).catch((err) => {
        console.error('[SIGNALING] Failed to connect:', err);
        handleConnectionError(new SignalingError('Signaling connection failed', err));
      });

      return () => {
        console.log('[WEBRTC] Cleaning up service');
        rtcServiceRef.current?.disconnect();
        rtcServiceRef.current = null;
        signalingRef.current?.disconnect();
        signalingRef.current = null;
        setIsConnected(false);
        setDiscoveredPeers([]);
        setConnectedDevice(null);
        setConnectingTo(null);
        onConnectionChange(false);
        clearProgress();
      };
    }
  }, []);

  const handleConnectionStateChange = (state: RTCPeerConnectionState) => {
    console.log('[UI] Connection state changed:', state);
    const connected = state === 'connected';
    setIsConnected(connected);
    onConnectionChange(connected, rtcServiceRef.current || undefined);

    if (connected && rtcServiceRef.current) {
      const remotePeerCode = rtcServiceRef.current.getRemotePeerCode();
      const device = discoveredPeersRef.current.find(
        (p) => p.peerCode === remotePeerCode,
      );
      setConnectedDevice(device || null);
      setConnectingTo(null);
    } else {
      setConnectedDevice(null);
      setConnectingTo(null);
    }

    if (!connected && transferProgress) {
      clearProgress();
    }
  };

  const handleSelectPeer = useCallback(
    async (peerCode: string) => {
      if (!webrtc || isConnected) return;
      setConnectingTo(peerCode);

      try {
        await webrtc.connect(peerCode);
      } catch (error) {
        setConnectingTo(null);
        if (error instanceof WebRTCError) {
          handleConnectionError(error);
        } else {
          toast({
            title: "Connection Failed",
            description: "Unable to connect to device. Please try again.",
            variant: "destructive",
          });
        }
      }
    },
    [webrtc, isConnected, handleConnectionError, toast],
  );

  const handleDisconnectDevice = useCallback(() => {
    setConnectedDevice(null);
    setConnectingTo(null);
    handleDisconnect();
  }, [handleDisconnect]);

  const handleFileReceive = (file: Blob, filename: string) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <ConnectionStatus isConnected={isConnected} />

      <div className="touch-manipulation">
        <DeviceDiscovery
          peers={discoveredPeers}
          onSelectPeer={handleSelectPeer}
          connectingTo={connectingTo}
          isConnected={isConnected}
          connectedDevice={connectedDevice}
          onDisconnect={handleDisconnectDevice}
        />
      </div>

      {transferProgress && (
        <div className="space-y-2 animate-fade-up">
          <TransferProgressBar
            progress={transferProgress}
            onCancel={handleCancelReceiving}
            onPause={handlePauseTransfer}
            onResume={handleResumeTransfer}
          />
        </div>
      )}
    </div>
  );
};
