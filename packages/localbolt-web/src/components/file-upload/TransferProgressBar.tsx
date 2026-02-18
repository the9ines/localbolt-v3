
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { File, Pause, Play, X } from "lucide-react";
import type { TransferProgress as TransferProgressType } from "@/services/webrtc/WebRTCService";

interface TransferProgressProps {
  progress: TransferProgressType;
  onCancel: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, exponent)).toFixed(2)} ${units[exponent]}`;
};

export const TransferProgressBar = ({ progress, onCancel, onPause, onResume }: TransferProgressProps) => {
  const isPaused = progress.status === 'paused';
  const showControls = progress.status === 'transferring' || progress.status === 'paused';
  
  // Calculate progress percentage
  const progressPercent = Math.round((progress.loaded / progress.total) * 100);
  
  return (
    <div className="space-y-2 w-full">
      <div className="flex items-center gap-2 w-full bg-dark-accent rounded-lg p-3">
        <File className="w-5 h-5 shrink-0 text-white/50" />
        <div className="flex flex-col flex-1 min-w-0">
          <span className="truncate text-sm">{progress.filename}</span>
          <span className="text-xs text-white/50">
            {formatSize(progress.loaded)} of {formatSize(progress.total)} ({progressPercent}%)
            {isPaused && " - Paused"}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2 w-full">
        <Progress 
          value={progressPercent}
          className="h-2 flex-1 bg-neon/20"
        />
        
        {showControls && (
          <div className="flex items-center gap-1">
            {onPause && onResume && (
              <Button
                variant="ghost"
                size="icon"
                onClick={isPaused ? onResume : onPause}
                className="h-8 w-8"
                title={isPaused ? "Resume transfer" : "Pause transfer"}
              >
                {isPaused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="h-8 w-8"
              title="Cancel transfer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
