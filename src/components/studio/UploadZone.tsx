import { useCallback, useRef, useState } from "react";
import { ImageUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCEPTED_TYPES, isSupportedFile } from "@/lib/cutout";

type Props = {
  onFile: (file: File) => void;
  onInvalid: (message: string) => void;
  compact?: boolean;
};

export function UploadZone({ onFile, onInvalid, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!isSupportedFile(file)) {
        onInvalid("Please choose a PNG or JPEG image.");
        return;
      }
      onFile(file);
    },
    [onFile, onInvalid],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`panel relative flex flex-col items-center justify-center gap-4 border-dashed text-center transition-all duration-200 ${
        compact ? "p-6" : "p-10 sm:p-16"
      } ${dragging ? "glow-ring scale-[1.01] bg-secondary/40" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
        <ImageUp className="size-7" aria-hidden="true" />
      </span>

      <div className="space-y-1">
        <p className="font-display text-lg font-semibold">
          {compact ? "Swap in another photo" : "Drop a photo to cut it out"}
        </p>
        <p className="text-sm text-muted-foreground">
          Drag &amp; drop, paste, or browse — PNG or JPEG, up to 4K.
        </p>
      </div>

      <Button variant="hero" size="lg" onClick={() => inputRef.current?.click()}>
        <Sparkles className="size-4" aria-hidden="true" />
        Upload image
      </Button>

      {!compact && (
        <p className="text-xs text-muted-foreground">
          Your photo is processed for the cutout only — it is never stored.
        </p>
      )}
    </div>
  );
}
