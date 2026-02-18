
import { useEffect } from "react";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { UploadContainer } from "./UploadContainer";

interface FileUploadProps {
  webrtc?: WebRTCService;
}

export const FileUpload = ({ webrtc }: FileUploadProps) => {
  useEffect(() => {
    if (!webrtc) {
      // Reset progress when WebRTC instance changes (including disconnection)
      console.log('[UPLOAD] WebRTC instance changed or disconnected');
    }
  }, [webrtc]);

  if (!webrtc) {
    return null;
  }

  return <UploadContainer webrtc={webrtc} />;
};
