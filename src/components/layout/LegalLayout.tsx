import type { ReactNode } from "react";

interface LegalLayoutProps {
  icon: ReactNode;
  title: string;
  lastUpdatedLabel: string;
  onBack: () => void;
  children: ReactNode;
}

/** Light shell (matches the app theme) shared by the Privacy Policy and Terms pages. */
export function LegalLayout({
  icon,
  title,
  lastUpdatedLabel,
  onBack,
  children,
}: LegalLayoutProps) {
  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center bg-surface-container px-4 py-10 text-on-surface">
      <div className="mx-auto w-full max-w-[800px] rounded-3xl border border-outline-variant/40 bg-surface p-6 shadow-[0_8px_32px_rgba(1,114,90,0.08)] sm:p-9">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-outline-variant/40 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-primary" aria-hidden="true">
              {icon}
            </span>
            <div>
              <h1 className="text-2xl font-extrabold leading-tight">{title}</h1>
              <p className="mt-1 text-[13px] text-on-surface-variant">
                FindTrack Lost &amp; Found Platform
              </p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="shrink-0 cursor-pointer rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dim active:scale-95"
          >
            ← Go Back
          </button>
        </div>

        {children}

        <div className="mt-10 border-t border-outline-variant/40 pt-5 text-center text-xs text-on-surface-variant">
          Last updated: 5 November 2026 · {lastUpdatedLabel}
        </div>
      </div>
    </div>
  );
}
