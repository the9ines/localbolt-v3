
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useRef } from "react";

interface DragDropAreaProps {
  isDragging: boolean;
  onDragIn: (e: React.DragEvent) => void;
  onDragOut: (e: React.DragEvent) => void;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const DragDropArea = ({
  isDragging,
  onDragIn,
  onDragOut,
  onDrag,
  onDrop,
  onFileSelect,
}: DragDropAreaProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
        isDragging ? "border-neon bg-neon/5" : "border-white/10 hover:border-white/20"
      }`}
      onDragEnter={onDragIn}
      onDragLeave={onDragOut}
      onDragOver={onDrag}
      onDrop={onDrop}
    >
      <input
        type="file"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={onFileSelect}
      />
      
      <div className="space-y-4">
        <Upload className="w-12 h-12 mx-auto text-white/50" />
        <div>
          <p className="text-lg font-medium">Drop files here</p>
          <p className="text-sm text-white/50">or click to select files</p>
        </div>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="bg-dark-accent"
        >
          Select Files
        </Button>
      </div>
    </div>
  );
};
