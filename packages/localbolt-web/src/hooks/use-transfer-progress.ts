
import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { TransferProgress } from '@/services/webrtc/WebRTCService';
import type WebRTCService from '@/services/webrtc/WebRTCService';

export const useTransferProgress = (webrtc: WebRTCService | null) => {
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!transferProgress?.status) return;

    // Only clear progress for completed or error states
    if (transferProgress.status === 'canceled_by_sender' || 
        transferProgress.status === 'canceled_by_receiver' ||
        transferProgress.status === 'error' ||
        transferProgress.status === 'completed') {
      // For completed transfers, show success message and clear after delay
      if (transferProgress.status === 'completed') {
        setTimeout(() => setTransferProgress(null), 2000);
      } else {
        setTransferProgress(null);
      }
    }
  }, [transferProgress?.status]);

  const handleProgress = useCallback((progress: TransferProgress) => {
    console.log('[PROGRESS] Received progress update:', progress);
    console.log('[PROGRESS] Status:', progress.status);
    
    if (progress.status === 'canceled_by_sender' || 
        progress.status === 'canceled_by_receiver' || 
        progress.status === 'error' ||
        progress.status === 'completed') {
      
      // Show appropriate toast message
      if (progress.status === 'canceled_by_sender') {
        setTransferProgress(null);
        toast({
          title: "Transfer Canceled",
          description: "The sender has canceled the transfer",
        });
      } else if (progress.status === 'canceled_by_receiver') {
        setTransferProgress(null);
        toast({
          title: "Transfer Canceled",
          description: "The receiver has canceled the transfer",
        });
      } else if (progress.status === 'error') {
        setTransferProgress(null);
        toast({
          title: "Transfer Error",
          description: "The transfer was terminated due to an error",
          variant: "destructive",
        });
      } else if (progress.status === 'completed') {
        // Show completion and let useEffect handle cleanup with delay
        setTransferProgress(progress);
        toast({
          title: "Transfer Complete",
          description: `${progress.filename} has been received successfully`,
        });
      }
      return;
    }

    // Preserve progress values during status changes
    setTransferProgress(prev => {
      // For pause/resume status changes, maintain the current progress values
      if ((progress.status === 'paused' || progress.status === 'transferring') && prev) {
        return {
          ...prev,
          status: progress.status,
          loaded: progress.loaded || prev.loaded,
          total: progress.total || prev.total,
          currentChunk: progress.currentChunk || prev.currentChunk,
          totalChunks: progress.totalChunks || prev.totalChunks,
          stats: progress.stats || prev.stats
        };
      }
      return progress;
    });
  }, [toast]);

  const handleCancelReceiving = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    console.log('[PROGRESS] Canceling transfer:', transferProgress.filename);
    webrtc.cancelTransfer(transferProgress.filename, true);
    setTransferProgress(null);
    
    toast({
      title: "Transfer Canceled",
      description: "You have canceled the file transfer",
    });
  }, [webrtc, transferProgress, toast]);

  const handlePauseTransfer = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    console.log('[PROGRESS] Pausing transfer:', transferProgress.filename);
    webrtc.pauseTransfer(transferProgress.filename);
    
    // Maintain current progress while updating status
    setTransferProgress(prev => {
      if (!prev) return null;
      return {
        ...prev,
        status: 'paused'
      };
    });
  }, [webrtc, transferProgress]);

  const handleResumeTransfer = useCallback(() => {
    if (!webrtc || !transferProgress?.filename) return;

    console.log('[PROGRESS] Resuming transfer:', transferProgress.filename);
    webrtc.resumeTransfer(transferProgress.filename);
    
    // Maintain current progress while updating status
    setTransferProgress(prev => {
      if (!prev) return null;
      return {
        ...prev,
        status: 'transferring'
      };
    });
  }, [webrtc, transferProgress]);

  const clearProgress = useCallback(() => {
    setTransferProgress(null);
  }, []);

  return {
    transferProgress,
    handleProgress,
    handleCancelReceiving,
    handlePauseTransfer,
    handleResumeTransfer,
    clearProgress
  };
};
