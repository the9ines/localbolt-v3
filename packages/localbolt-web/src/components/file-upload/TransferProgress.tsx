
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

const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond === 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const exponent = Math.min(Math.floor(Math.log(bytesPerSecond) / Math.log(1024)), units.length - 1);
  return `${(bytesPerSecond / Math.pow(1024, exponent)).toFixed(2)} ${units[exponent]}`;
};

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return 'calculating...';
  if (seconds === 0) return '0s';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, exponent)).toFixed(2)} ${units[exponent]}`;
};

export const TransferProgressBar = ({ progress, onCancel, onPause, onResume }: TransferProgressProps) => {
  const isPaused = progress.status === 'paused';
  const isActive = progress.status === 'transferring' || progress.status === 'paused';
  
  // Calculate progress percentage using loaded/total values
  const progressPercent = progress.total > 0 
    ? Math.round((progress.loaded / progress.total) * 100) 
    : 0;

  return (
    <div className="space-y-2 w-full">
      <div className="flex items-center gap-2 w-full bg-dark-accent rounded-lg p-3">
        <File className="w-5 h-5 shrink-0 text-white/50" />
        <div className="flex flex-col flex-1 min-w-0">
          <span className="truncate text-sm">{progress.filename}</span>
          <span className="text-xs text-white/50">
            {formatSize(progress.loaded)} of {formatSize(progress.total)} ({progressPercent}%)
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2 w-full">
        <Progress 
          value={progressPercent}
          className="h-2 flex-1 bg-neon/20"
        />
        
        {isActive && (
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

      {progress.stats && (
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
          <div>Speed: {formatSpeed(progress.stats.speed)}</div>
          <div>Avg: {formatSpeed(progress.stats.averageSpeed)}</div>
          <div>
            {formatSize(progress.loaded)} / {formatSize(progress.total)}
          </div>
          <div>
            {progress.stats.estimatedTimeRemaining > 0 
              ? `~${formatTime(progress.stats.estimatedTimeRemaining)} remaining` 
              : 'Calculating...'}
          </div>
          {progress.stats.retryCount > 0 && (
            <div className="col-span-2 text-yellow-500">
              Retries: {progress.stats.retryCount}/{progress.stats.maxRetries}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
