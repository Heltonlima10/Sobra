import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/finance/model";

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  return (
    <button
      type={type}
      className={cn(
        "press inline-flex h-12 items-center justify-center rounded-md px-4 text-base font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40",
        variant === "primary" && "bg-ink text-surface",
        variant === "ghost" && "bg-transparent text-ink",
        variant === "danger" && "bg-transparent text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </div>
  );
}

export const fieldClass =
  "h-12 w-full min-w-0 rounded-md border border-line bg-surface px-3 text-base text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function Meter({
  value,
  max,
  label,
  over = false,
}: {
  value: number;
  max: number;
  label: string;
  over?: boolean;
}) {
  const pct = max <= 0 ? (value > 0 ? 100 : 0) : Math.min(100, (value / max) * 100);
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-track"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.max(max, 1)}
      aria-valuenow={Math.min(value, Math.max(max, 1))}
    >
      <div className={cn("h-full rounded-full", over ? "bg-danger" : "bg-ink")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border border-line bg-surface p-4", className)}>{children}</section>;
}

const toneClass: Record<Tone, string> = {
  alert: "text-danger",
  warn: "text-ink",
  good: "text-good",
  info: "text-muted",
};

const toneLabel: Record<Tone, string> = {
  alert: "Atenção",
  warn: "Ajuste",
  good: "Folga",
  info: "Nota",
};

export function ToneLine({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <p className={cn("text-sm leading-6", toneClass[tone])}>{children}</p>;
}

export function InsightCard({
  tone,
  title,
  body,
}: {
  tone: Tone;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-xl border border-line p-4">
      <p className={cn("text-sm font-medium", toneClass[tone])}>{toneLabel[tone]}</p>
      <h3 className="mt-1 text-base font-medium text-ink">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted">{body}</p>
    </article>
  );
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false} handleOnly>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-xl bg-surface outline-none">
          <Drawer.Handle className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-line" />
          <div className="overflow-y-auto px-5 pt-4 pb-8">
            <Drawer.Title className="font-display text-2xl font-medium text-ink">{title}</Drawer.Title>
            {description ? (
              <Drawer.Description className="mt-1 text-sm text-muted">{description}</Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{title}</Drawer.Description>
            )}
            <div className="mt-5">{children}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
