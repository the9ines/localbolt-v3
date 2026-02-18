import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { DragDropArea } from "./DragDropArea";
import { FileList } from "./FileList";
import { TransferProgressBar } from "./TransferProgress";
import { Button } from "@/components/ui/button";
import WebRTCService from "@/services/webrtc/WebRTCService";
import type { TransferProgress } from "@/services/webrtc/WebRTCService";

interface UploadContainerProps {
  webrtc: WebRTCService;
}

export const UploadContainer = ({ webrtc }: UploadContainerProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFiles(selectedFiles);
  };

  const handleFiles = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    toast({
      title: "Files added",
      description: `${newFiles.length} file(s) ready to transfer`,
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProgress = (transferProgress: TransferProgress) => {
    console.log('[TRANSFER] Progress update in UI:', transferProgress);
    setProgress(transferProgress);
    
    if (transferProgress.status === 'canceled_by_sender' || 
        transferProgress.status === 'canceled_by_receiver') {
      // Remove the cancelled file from the queue
      setFiles(prevFiles => prevFiles.filter(file => file.name !== transferProgress.filename));
      
      // Clear progress after a short delay to show cancellation status
      setTimeout(() => setProgress(null), 1500);
      toast({
        title: "Transfer cancelled",
        description: "The file transfer was cancelled"
      });
    } else if (transferProgress.status === 'error') {
      // Remove the failed file from the queue
      setFiles(prevFiles => prevFiles.filter(file => file.name !== transferProgress.filename));
      
      setTimeout(() => setProgress(null), 3000);
      toast({
        title: "Transfer error",
        description: "An error occurred during the transfer",
        variant: "destructive"
      });
    } else if (transferProgress.status === 'completed') {
      // Remove the completed file from the queue
      setFiles(prevFiles => prevFiles.filter(file => file.name !== transferProgress.filename));
      
      // Clear progress after showing completion
      setTimeout(() => setProgress(null), 2000);
      toast({
        title: "Transfer complete",
        description: `${transferProgress.filename} has been sent successfully`
      });
    }
  };

  const handlePauseTransfer = () => {
    if (webrtc && progress) {
      webrtc.pauseTransfer(progress.filename);
    }
  };

  const handleResumeTransfer = () => {
    if (webrtc && progress) {
      webrtc.resumeTransfer(progress.filename);
    }
  };

  const cancelTransfer = () => {
    if (webrtc && progress) {
      console.log('[UI] Initiating transfer cancellation for:', progress.filename);
      webrtc.cancelTransfer(progress.filename);
      // Don't immediately set progress to null - let the cancellation complete naturally
      // The progress will be cleared by the handleProgress callback when cancellation is complete
    }
  };

  const startTransfer = async () => {
    if (!webrtc) {
      toast({
        title: "Connection error",
        description: "No peer connection available",
        variant: "destructive"
      });
      return;
    }

    try {
      const file = files[0];
      if (!file) return;
      
      console.log('Starting transfer for:', file.name);
      
      webrtc.setProgressCallback(handleProgress);
      await webrtc.sendFile(file);
      
      console.log('Transfer completed for:', file.name);
      
      toast({
        title: "Transfer complete",
        description: `${file.name} has been sent successfully`
      });

      setFiles(prevFiles => prevFiles.slice(1));
    } catch (error) {
      console.error('Transfer error:', error);
      if (error.message !== "Transfer cancelled by user") {
        toast({
          title: "Transfer failed",
          description: "Failed to send file",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      <DragDropArea
        isDragging={isDragging}
        onDragIn={handleDragIn}
        onDragOut={handleDragOut}
        onDrag={handleDrag}
        onDrop={handleDrop}
        onFileSelect={handleFileInput}
      />

      {(files.length > 0 || progress) && (
        <div className="space-y-4 animate-fade-up">
          {files.length > 0 && (
            <FileList 
              files={files} 
              onRemove={removeFile}
              disabled={progress !== null}
              activeTransfer={progress?.filename}
            />
          )}

          {progress && progress.status && (
            <TransferProgressBar
              progress={progress}
              onCancel={cancelTransfer}
              onPause={handlePauseTransfer}
              onResume={handleResumeTransfer}
            />
          )}

          <Button
            onClick={startTransfer}
            className="w-full bg-neon text-black hover:bg-neon/90"
            disabled={progress !== null}
          >
            Start Transfer
          </Button>
        </div>
      )}
    </div>
  );
};
