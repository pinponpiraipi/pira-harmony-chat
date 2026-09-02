import { useEffect, useState } from "react";
import { resolveMedia } from "@/lib/pira/media";

export function GlassPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`glass rounded-2xl ${className}`}>{children}</div>;
}

export function PiraButton({
  children,
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "soft";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100";
  const styles = {
    primary: "bg-primary text-primary-foreground shadow-md hover:brightness-105",
    soft: "glass-soft text-foreground hover:brightness-105",
    ghost: "text-muted-foreground hover:text-foreground",
    danger: "bg-destructive text-destructive-foreground hover:brightness-105",
  }[variant];
  return (
    <button className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function PiraInput({
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl bg-input px-3 py-2 text-sm text-foreground outline-none ring-ring/60 placeholder:text-muted-foreground focus:ring-2 ${className}`}
      {...rest}
    />
  );
}

export function PiraTextarea({
  className = "",
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full resize-none rounded-xl bg-input px-3 py-2 text-sm text-foreground outline-none ring-ring/60 placeholder:text-muted-foreground focus:ring-2 ${className}`}
      {...rest}
    />
  );
}

export function useMediaUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    resolveMedia(path).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [path]);
  return url;
}

export function Avatar({
  path,
  name,
  size = 44,
  className = "",
}: {
  path: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const url = useMediaUrl(path);
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full glass-soft font-display text-foreground ${className}`}
      style={{ width: size, height: size, fontSize: size / 2.6 }}
    >
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span>{name.slice(0, 1)}</span>
      )}
    </div>
  );
}

export function StoredImage({
  path,
  alt,
  className = "",
}: {
  path: string | null;
  alt: string;
  className?: string;
}) {
  const url = useMediaUrl(path);
  if (!url) return <div className={`glass-soft animate-pulse rounded-xl ${className}`} />;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

export function StoredVideo({ path, className = "" }: { path: string | null; className?: string }) {
  const url = useMediaUrl(path);
  if (!url) return <div className={`glass-soft animate-pulse rounded-xl ${className}`} />;
  return <video src={url} controls className={className} />;
}
