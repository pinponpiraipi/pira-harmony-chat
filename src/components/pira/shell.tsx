import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home,
  MessageCircle,
  UserPlus,
  Settings,
  Monitor,
  Smartphone,
  Smile,
  Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePira } from "@/lib/pira/session";
import { jstNowParts } from "@/lib/pira/format";

export function PiraClock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    setNow(jstNowParts());
    const t = window.setInterval(() => setNow(jstNowParts()), 10_000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="font-display text-xs text-muted-foreground tabular-nums">{now}</span>;
}

const NAV = [
  { to: "/", label: "ホーム", icon: Home },
  { to: "/talks", label: "トーク", icon: MessageCircle },
  { to: "/add", label: "友だち追加", icon: UserPlus },
  { to: "/settings", label: "設定", icon: Settings },
] as const;

/** App frame: switches between a phone-sized column and a wide desktop layout. */
export function AppShell({
  children,
  title,
  right,
}: {
  children: React.ReactNode;
  title?: string;
  right?: React.ReactNode;
}) {
  const { device, setDevice, loading, session, profile } = usePira();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!session) void navigate({ to: "/auth", replace: true });
    else if (!profile && pathname !== "/setup") void navigate({ to: "/setup", replace: true });
  }, [loading, session, profile, navigate, pathname]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 text-sm text-muted-foreground">読み込み中…</div>
      </div>
    );
  }

  const isMobile = device === "mobile";

  return (
    <div className="flex min-h-screen justify-center px-2 py-3 sm:px-4">
      <div
        className={`flex w-full flex-col ${isMobile ? "max-w-[420px]" : "max-w-[1100px]"}`}
        style={{ minHeight: "calc(100vh - 1.5rem)" }}
      >
        <header className="glass mb-2 flex items-center gap-2 rounded-2xl px-3 py-2">
          <span className="font-display text-lg font-bold text-foreground">
            {title ?? "PIRA"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <PiraClock />
            <button
              onClick={() => setDevice(isMobile ? "desktop" : "mobile")}
              className="rounded-full glass-soft p-2 text-foreground"
              aria-label={isMobile ? "PC表示に切り替え" : "スマホ表示に切り替え"}
            >
              {isMobile ? <Monitor size={16} /> : <Smartphone size={16} />}
            </button>
            {right}
          </div>
        </header>

        <div className={isMobile ? "flex-1" : "flex flex-1 gap-2"}>
          {!isMobile && (
            <nav className="glass flex w-48 shrink-0 flex-col gap-1 rounded-2xl p-2">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground [&.active]:bg-primary [&.active]:text-primary-foreground"
                  activeOptions={{ exact: item.to === "/" }}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
          <main className="min-w-0 flex-1 pb-16 sm:pb-0">{children}</main>
        </div>

        {isMobile && (
          <nav className="glass fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[420px] items-center justify-around rounded-t-2xl px-2 py-2">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-[10px] font-semibold text-muted-foreground [&.active]:text-primary"
                activeOptions={{ exact: item.to === "/" }}
              >
                <item.icon size={20} />
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
