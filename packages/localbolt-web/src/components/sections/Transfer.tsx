
import { Card } from "@/components/ui/card";
import { PeerConnection } from "@/components/PeerConnection";
import { FileUpload } from "@/components/file-upload/FileUpload";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { ForwardedRef, forwardRef } from "react";

interface TransferProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
  isConnected: boolean;
  webrtc: WebRTCService | null;
}

export const Transfer = forwardRef(({
  onConnectionChange,
  isConnected,
  webrtc
}: TransferProps, ref: ForwardedRef<HTMLDivElement>) => {
  return (
    <Card
      ref={ref}
      className="relative overflow-hidden p-8 md:p-10 max-w-2xl mx-auto space-y-6 bg-dark-accent/40 backdrop-blur-xl border border-neon/20 shadow-[0_0_40px_rgba(20,255,106,0.12)] animate-fade-up transition-all duration-500 hover:shadow-[0_0_60px_rgba(20,255,106,0.2)] hover:border-neon/40"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-neon/5 via-transparent to-transparent opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-t from-dark/20 via-transparent to-transparent" />

      <div className="relative space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Fast, Private File Transfer
        </h2>
        <p className="text-sm text-muted-foreground">
          Share files directly between devices on the same network
        </p>
      </div>

      <div className="relative">
        <PeerConnection onConnectionChange={onConnectionChange} />

        {isConnected && webrtc && (
          <div className="animate-fade-in mt-6">
            <FileUpload webrtc={webrtc} />
          </div>
        )}
      </div>
    </Card>
  );
});

Transfer.displayName = 'Transfer';
