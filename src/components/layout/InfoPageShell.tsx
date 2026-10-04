import type { ReactNode } from "react";
import { MapPin } from "lucide-react";

interface InfoPageShellProps {
  title: string;
  onHome: () => void;
  children: ReactNode;
}

/** Light page shell (logo header + white card) shared by About, Safety, Help and Contact. */
export function InfoPageShell({ title, onHome, children }: InfoPageShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-10 sm:py-5">
        <button
          onClick={onHome}
          className="flex items-center gap-2 text-2xl font-bold text-primary"
        >
          <MapPin className="h-6 w-6" />
          FindTrack
        </button>
      </header>
      <main className="mx-auto my-6 w-full max-w-[800px] rounded-xl bg-white p-6 shadow-md sm:my-10 sm:p-10">
        <h1 className="mb-6 text-[28px] font-bold text-primary sm:text-[32px]">
          {title}
        </h1>
        <div className="space-y-5 text-base leading-relaxed text-slate-600">
          {children}
        </div>
      </main>
    </div>
  );
}
