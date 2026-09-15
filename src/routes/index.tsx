import { createFileRoute } from "@tanstack/react-router";
import { Scissors, Sparkles, Cpu, Smartphone } from "lucide-react";
import { CutoutStudio } from "@/components/studio/CutoutStudio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cutout Studio — AI Background Remover for PNG & JPEG" },
      {
        name: "description",
        content:
          "Remove image backgrounds instantly with AI. Refine hair and glass edges with eraser, restore brush and feathering, then export transparent PNGs up to 4K.",
      },
      { property: "og:title", content: "Cutout Studio — AI Background Remover" },
      {
        property: "og:description",
        content:
          "Drag, drop and cut out any photo in seconds. Transparent PNG, solid, gradient or photo backgrounds — all in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: Cpu, title: "Edge-aware AI", text: "Tuned for hair, fur, glass and soft shadows." },
  { icon: Sparkles, title: "Manual refine", text: "Eraser, restore brush and edge feathering." },
  { icon: Smartphone, title: "Works anywhere", text: "Touch-ready and fast on phones and tablets." },
];

function Index() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10 space-y-5 text-center sm:mb-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
          <Scissors className="size-3.5 text-primary" aria-hidden="true" />
          Private, on-device background removal
        </span>
        <h1 className="font-display text-4xl font-bold leading-[1.05] sm:text-6xl">
          Cut anything out of <span className="text-gradient">any photo</span>
        </h1>
        <p className="mx-auto max-w-xl text-base text-muted-foreground sm:text-lg">
          Upload a PNG or JPEG and get a clean transparent cutout in seconds — then refine the edges
          and drop in a new background.
        </p>
      </header>

      <CutoutStudio />

      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <article key={title} className="panel p-5">
            <Icon className="size-5 text-primary" aria-hidden="true" />
            <h2 className="mt-3 font-display text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
