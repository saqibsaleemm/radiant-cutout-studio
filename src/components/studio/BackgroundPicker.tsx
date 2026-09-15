import { useRef } from "react";
import { Image as ImageIcon, Grid2x2, Palette, Blend } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { loadImage, type BackgroundOption } from "@/lib/cutout";

const SOLIDS: string[] = ["#ffffff", "#0f1115", "#f5e9d7", "#0d4f4a", "#1f3a8a", "#b91c3c", "#e11d74"];
const GRADIENTS: Array<{ from: string; to: string }> = [
  { from: "#a3e635", to: "#22d3ee" },
  { from: "#fda4af", to: "#fcd34d" },
  { from: "#0ea5e9", to: "#1e1b4b" },
  { from: "#f97316", to: "#be123c" },
  { from: "#111827", to: "#4b5563" },
];

type Props = {
  value: BackgroundOption;
  onChange: (value: BackgroundOption) => void;
  onError: (message: string) => void;
};

export function BackgroundPicker({ value, onChange, onError }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      onChange({ type: "image", image });
    } catch {
      onError("That background image could not be opened.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={value.type === "transparent" ? "toolActive" : "tool"}
          onClick={() => onChange({ type: "transparent" })}
        >
          <Grid2x2 className="size-4" aria-hidden="true" />
          Transparent
        </Button>
        <Button
          size="sm"
          variant={value.type === "color" ? "toolActive" : "tool"}
          onClick={() => onChange({ type: "color", color: SOLIDS[0] ?? "#ffffff" })}
        >
          <Palette className="size-4" aria-hidden="true" />
          Color
        </Button>
        <Button
          size="sm"
          variant={value.type === "gradient" ? "toolActive" : "tool"}
          onClick={() =>
            onChange({ type: "gradient", from: GRADIENTS[0]?.from ?? "#a3e635", to: GRADIENTS[0]?.to ?? "#22d3ee", angle: 135 })
          }
        >
          <Blend className="size-4" aria-hidden="true" />
          Gradient
        </Button>
        <Button
          size="sm"
          variant={value.type === "image" ? "toolActive" : "tool"}
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon className="size-4" aria-hidden="true" />
          Photo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => void pickImage(e.target.files?.[0])}
        />
      </div>

      {value.type === "color" && (
        <div className="flex flex-wrap items-center gap-2">
          {SOLIDS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Use ${color} background`}
              onClick={() => onChange({ type: "color", color })}
              style={{ backgroundColor: color }}
              className={`size-8 rounded-lg border transition-transform hover:scale-110 ${
                value.color === color ? "border-primary ring-2 ring-ring" : "border-border"
              }`}
            />
          ))}
          <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            Custom
            <input
              type="color"
              value={value.color}
              onChange={(e) => onChange({ type: "color", color: e.target.value })}
              className="size-8 cursor-pointer rounded-lg border border-border bg-transparent p-0"
            />
          </label>
        </div>
      )}

      {value.type === "gradient" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {GRADIENTS.map((g) => (
              <button
                key={g.from + g.to}
                type="button"
                aria-label={`Use gradient from ${g.from} to ${g.to}`}
                onClick={() => onChange({ ...value, from: g.from, to: g.to })}
                style={{ backgroundImage: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                className={`h-8 w-14 rounded-lg border transition-transform hover:scale-105 ${
                  value.from === g.from && value.to === g.to
                    ? "border-primary ring-2 ring-ring"
                    : "border-border"
                }`}
              />
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Angle · {value.angle}°</p>
            <Slider
              value={[value.angle]}
              min={0}
              max={360}
              step={5}
              onValueChange={(v) => onChange({ ...value, angle: v[0] ?? value.angle })}
            />
          </div>
        </div>
      )}

      {value.type === "image" && (
        <Button size="sm" variant="tool" onClick={() => fileRef.current?.click()}>
          Choose a different photo
        </Button>
      )}
    </div>
  );
}
