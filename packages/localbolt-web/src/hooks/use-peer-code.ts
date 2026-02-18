
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export const usePeerCode = () => {
  const [peerCode, setPeerCode] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(peerCode);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Peer code has been copied to your clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  return {
    peerCode,
    setPeerCode,
    copied,
    copyToClipboard
  };
};
