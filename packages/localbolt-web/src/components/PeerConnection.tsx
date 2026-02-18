import { useEffect } from "react";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { TransferProgressBar } from "./file-upload/TransferProgress";
import { PeerCodeInput } from "./peer-connection/PeerCodeInput";
import { TargetPeerInput } from "./peer-connection/TargetPeerInput";
import { ConnectionStatus } from "./peer-connection/ConnectionStatus";
import { usePeerCode } from "@/hooks/use-peer-code";
import { useTransferProgress } from "@/hooks/use-transfer-progress";
import { usePeerConnection } from "@/hooks/use-peer-connection";
import { generateSecurePeerCode } from "@/lib/crypto-utils";

interface PeerConnectionProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
}

export const PeerConnection = ({ onConnectionChange }: PeerConnectionProps) => {
  const {
    targetPeerCode,
    setTargetPeerCode,
    connectedPeerCode,
    webrtc,
    setWebrtc,
    isConnected,
    setIsConnected,
    handleConnect,
    handleDisconnect,
    handleConnectionError
  } = usePeerConnection(onConnectionChange);

  const { peerCode, setPeerCode, copied, copyToClipboard } = usePeerCode();
  const { 
    transferProgress, 
    handleProgress, 
    handleCancelReceiving,
    handlePauseTransfer,
    handleResumeTransfer,
    clearProgress 
  } = useTransferProgress(webrtc);

  useEffect(() => {
    if (!isConnected && transferProgress) {
      clearProgress();
    }
  }, [isConnected, transferProgress, clearProgress]);

  useEffect(() => {
    if (webrtc && isConnected) {
      const remotePeer = webrtc.getRemotePeerCode();
      console.log('[UI] Remote peer code updated:', remotePeer);
    }
  }, [webrtc, isConnected]);

  useEffect(() => {
    if (!webrtc) {
      // Use cryptographically secure peer code generation
      const code = generateSecurePeerCode();
      setPeerCode(code);
      console.log('[WEBRTC] Creating new service with secure code:', code);
      const rtcService = new WebRTCService(code, handleFileReceive, handleConnectionError, handleProgress);
      rtcService.setConnectionStateHandler(handleConnectionStateChange);
      setWebrtc(rtcService);

      return () => {
        console.log('[WEBRTC] Cleaning up service');
        rtcService.disconnect();
        setIsConnected(false);
        onConnectionChange(false);
        clearProgress();
      };
    }
  }, []); 

  const handleConnectionStateChange = (state: RTCPeerConnectionState) => {
    console.log('[UI] Connection state changed:', state);
    const connected = state === 'connected';
    setIsConnected(connected);
    onConnectionChange(connected, webrtc || undefined);
    
    if (!connected && transferProgress) {
      clearProgress();
    }
    
    if (connected && webrtc) {
      const remotePeerCode = webrtc.getRemotePeerCode();
      console.log('[UI] Setting connected peer code:', remotePeerCode);
    } else {
      setTargetPeerCode("");
    }
  };

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
      
      <div className="space-y-4 touch-manipulation">
        <PeerCodeInput 
          peerCode={peerCode}
          copied={copied}
          onCopy={copyToClipboard}
        />

        <TargetPeerInput
          targetPeerCode={targetPeerCode}
          onTargetPeerCodeChange={setTargetPeerCode}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          isConnected={isConnected}
          remotePeerCode={webrtc?.getRemotePeerCode()}
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
