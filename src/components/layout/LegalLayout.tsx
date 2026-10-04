import type { ReactNode } from "react";

interface LegalLayoutProps {
  icon: string;
  title: string;
  lastUpdatedLabel: string;
  onBack: () => void;
  children: ReactNode;
}

/** Dark, glass-style shell shared by the Privacy Policy and Terms pages. */
export function LegalLayout({
  icon,
  title,
  lastUpdatedLabel,
  onBack,
  children,
}: LegalLayoutProps) {
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_bottom,#1e293b_0%,#0f172a_100%)] px-4 py-10 text-slate-50">
      <div className="mx-auto w-full max-w-[800px] rounded-3xl border border-white/10 bg-slate-800/70 p-6 shadow-2xl backdrop-blur-xl sm:p-9">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">
              {icon}
            </span>
            <div>
              <h1 className="text-2xl font-extrabold leading-tight">{title}</h1>
              <p className="mt-1 text-[13px] text-white/50">
                FindTrack Lost &amp; Found Platform
              </p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-white/20"
          >
            ← Go Back
          </button>
        </div>

        {children}

        <div className="mt-10 border-t border-white/10 pt-5 text-center text-xs text-white/40">
          Last updated: {today} · {lastUpdatedLabel}
        </div>
      </div>
    </div>
  );
}
