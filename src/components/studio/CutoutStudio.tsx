import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Eraser,
  Loader2,
  Paintbrush,
  RotateCcw,
  Trash2,
  Undo2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { UploadZone } from "@/components/studio/UploadZone";
import { BackgroundPicker } from "@/components/studio/BackgroundPicker";
import {
  buildMask,
  cloneCanvas,
  downloadBlob,
  exportCanvas,
  fileToCanvas,
  paintStroke,
  renderComposite,
  type BackgroundOption,
  type Progress as ProgressState,
} from "@/lib/cutout";

type Tool = "erase" | "restore";

export function CutoutStudio() {
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<HTMLCanvasElement[]>([]);
  const viewRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const drawingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<ProgressState | null>(null);
  const [tool, setTool] = useState<Tool>("erase");
  const [brushSize, setBrushSize] = useState(48);
  const [hardness, setHardness] = useState(60);
  const [feather, setFeather] = useState(1);
  const [background, setBackground] = useState<BackgroundOption>({ type: "transparent" });
  const [showOriginal, setShowOriginal] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [fileName, setFileName] = useState("cutout");
  const [historyDepth, setHistoryDepth] = useState(0);

  const draw = useCallback(() => {
    const view = viewRef.current;
    const source = sourceRef.current;
    const mask = maskRef.current;
    if (!view || !source || !mask) return;
    if (showOriginal) {
      view.width = source.width;
      view.height = source.height;
      const ctx = view.getContext("2d");
      ctx?.clearRect(0, 0, view.width, view.height);
      ctx?.drawImage(source, 0, 0);
      return;
    }
    renderComposite(view, source, mask, feather, background);
  }, [background, feather, showOriginal]);

  useEffect(() => {
    if (ready) draw();
  }, [draw, ready]);

  const handleFile = useCallback(
    async (file: File) => {
      setBusy({ label: "Reading your photo", value: 4 });
      setReady(false);
      setShowOriginal(false);
      historyRef.current = [];
      setHistoryDepth(0);
      setFileName(file.name.replace(/\.(png|jpe?g)$/i, "") || "cutout");
      try {
        const source = await fileToCanvas(file);
        sourceRef.current = source;
        setDimensions({ width: source.width, height: source.height });
        const mask = await buildMask(source, setBusy);
        maskRef.current = mask;
        setReady(true);
        toast.success("Background removed", {
          description: `${source.width} × ${source.height} px cutout ready to refine.`,
        });
      } catch (error) {
        console.error(error);
        toast.error("We couldn't process that image", {
          description: error instanceof Error ? error.message : "Please try another photo.",
        });
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const view = viewRef.current;
    if (!view) return null;
    const rect = view.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * view.width,
      y: ((event.clientY - rect.top) / rect.height) * view.height,
    };
  };

  const brushRadius = () => {
    const view = viewRef.current;
    if (!view) return brushSize;
    const rect = view.getBoundingClientRect();
    const scale = rect.width > 0 ? view.width / rect.width : 1;
    return (brushSize / 2) * scale;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ready || showOriginal || !maskRef.current) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    historyRef.current = [...historyRef.current.slice(-19), cloneCanvas(maskRef.current)];
    setHistoryDepth(historyRef.current.length);
    drawingRef.current = true;
    lastPointRef.current = point;
    paintStroke(maskRef.current, tool, point, point, brushRadius(), hardness / 100);
    draw();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !maskRef.current) return;
    const point = pointFromEvent(event);
    const last = lastPointRef.current;
    if (!point || !last) return;
    paintStroke(maskRef.current, tool, last, point, brushRadius(), hardness / 100);
    lastPointRef.current = point;
    draw();
  };

  const endStroke = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const undo = () => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    maskRef.current = previous;
    setHistoryDepth(historyRef.current.length);
    draw();
  };

  const resetCutout = async () => {
    const source = sourceRef.current;
    if (!source) return;
    setBusy({ label: "Re-running the AI", value: 10 });
    try {
      maskRef.current = await buildMask(source, setBusy);
      historyRef.current = [];
      setHistoryDepth(0);
      draw();
    } finally {
      setBusy(null);
    }
  };

  const download = async (format: "png" | "jpeg") => {
    const view = viewRef.current;
    if (!view) return;
    const wasOriginal = showOriginal;
    if (wasOriginal) setShowOriginal(false);
    const source = sourceRef.current;
    const mask = maskRef.current;
    if (!source || !mask) return;
    const out = document.createElement("canvas");
    renderComposite(out, source, mask, feather, background);
    const blob = await exportCanvas(out, format);
    downloadBlob(blob, `${fileName}-cutout.${format === "png" ? "png" : "jpg"}`);
    toast.success(`Saved as ${format === "png" ? "transparent PNG" : "JPEG"}`);
  };

  const startOver = () => {
    sourceRef.current = null;
    maskRef.current = null;
    historyRef.current = [];
    setHistoryDepth(0);
    setReady(false);
  };

  if (!ready && !busy) {
    return <UploadZone onFile={(f) => void handleFile(f)} onInvalid={(m) => toast.error(m)} />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="panel relative overflow-hidden p-3 sm:p-4">
        <div className="checkerboard relative flex min-h-[280px] items-center justify-center overflow-hidden rounded-lg">
          <canvas
            ref={viewRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            onPointerCancel={endStroke}
            className="max-h-[62vh] w-auto max-w-full touch-none select-none"
            style={{ cursor: showOriginal ? "default" : "crosshair" }}
          />

          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/85 px-6 text-center backdrop-blur-sm">
              <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
              <div className="w-full max-w-xs space-y-2">
                <p className="font-display text-sm font-medium">{busy.label}…</p>
                <Progress value={busy.value} />
              </div>
            </div>
          )}
        </div>

        {ready && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={showOriginal ? "toolActive" : "tool"}
              onClick={() => setShowOriginal((v) => !v)}
            >
              <Eye className="size-4" aria-hidden="true" />
              {showOriginal ? "Showing original" : "Compare original"}
            </Button>
            <Button size="sm" variant="tool" onClick={undo} disabled={historyDepth === 0}>
              <Undo2 className="size-4" aria-hidden="true" />
              Undo
            </Button>
            <Button size="sm" variant="tool" onClick={() => void resetCutout()}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset cutout
            </Button>
            <Button size="sm" variant="ghost" onClick={startOver}>
              <Trash2 className="size-4" aria-hidden="true" />
              New image
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              {dimensions.width} × {dimensions.height} px
            </span>
          </div>
        )}
      </div>

      <div className="space-y-5">
        <section className="panel space-y-4 p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Refine
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={tool === "erase" ? "toolActive" : "tool"}
              onClick={() => setTool("erase")}
            >
              <Eraser className="size-4" aria-hidden="true" />
              Eraser
            </Button>
            <Button
              variant={tool === "restore" ? "toolActive" : "tool"}
              onClick={() => setTool("restore")}
            >
              <Paintbrush className="size-4" aria-hidden="true" />
              Restore
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Brush size · {brushSize} px</p>
            <Slider
              value={[brushSize]}
              min={6}
              max={200}
              step={2}
              onValueChange={(v) => setBrushSize(v[0] ?? brushSize)}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Brush softness · {100 - hardness}%</p>
            <Slider
              value={[hardness]}
              min={5}
              max={100}
              step={5}
              onValueChange={(v) => setHardness(v[0] ?? hardness)}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Edge feather · {feather.toFixed(1)} px — smooths hair and glass
            </p>
            <Slider
              value={[feather]}
              min={0}
              max={8}
              step={0.5}
              onValueChange={(v) => setFeather(v[0] ?? feather)}
            />
          </div>
        </section>

        <section className="panel space-y-4 p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Background
          </h2>
          <BackgroundPicker
            value={background}
            onChange={setBackground}
            onError={(m) => toast.error(m)}
          />
        </section>

        <section className="panel space-y-3 p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Export
          </h2>
          <Button variant="hero" className="w-full" onClick={() => void download("png")}>
            <Download className="size-4" aria-hidden="true" />
            Download transparent PNG
          </Button>
          <Button variant="tool" className="w-full" onClick={() => void download("jpeg")}>
            <Download className="size-4" aria-hidden="true" />
            Download JPEG
          </Button>
          <p className="text-xs text-muted-foreground">
            Exports keep the full resolution of your upload, up to 4K.
          </p>
        </section>

        <UploadZone compact onFile={(f) => void handleFile(f)} onInvalid={(m) => toast.error(m)} />
      </div>
    </div>
  );
}
