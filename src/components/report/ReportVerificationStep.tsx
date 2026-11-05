import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';
import { Category } from '../../types';

interface Props {
  reportSecurityQuestion: string;
  setReportSecurityQuestion: (q: string) => void;
  reportTitle: string;
  reportType: string;
  reportCategory: Category;
}

export const ReportVerificationStep: React.FC<Props> = ({
  reportSecurityQuestion,
  setReportSecurityQuestion,
  reportTitle,
  reportType,
  reportCategory,
}) => {
  return (
    <div className="space-y-6 min-w-0">
      <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-6 border-2 border-primary/20 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none -mr-4 -mt-4"></div>
        
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-headline-md font-bold text-on-surface">Verification Question</h3>
            <p className="font-body-md text-sm text-on-surface-variant">Protect this item with a "Prove-It" question.</p>
          </div>
        </div>

        <div className="space-y-4 relative z-10">
          <div className="p-4 bg-secondary-container/30 text-on-secondary-container rounded-xl text-sm border border-secondary-container/50 flex items-start gap-3">
            <Info className="h-5 w-5 shrink-0 mt-0.5 text-secondary" />
            <p className="leading-relaxed">
              Ask a question only the true owner would know. This question will be displayed to anyone who attempts to claim this item.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block font-label-md font-bold text-on-surface">Custom Verification Question</label>
            <input
              type="text"
              value={reportSecurityQuestion}
              onChange={(e) => setReportSecurityQuestion(e.target.value)}
              placeholder='e.g., "What is the color of the strap at the back?"'
              className="w-full bg-surface-variant border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-on-surface font-body-md"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 border border-outline-variant/50 rounded-xl p-4 sm:p-6 bg-surface-container-lowest shadow-sm">
        <h4 className="font-headline-sm font-bold text-on-surface mb-4">Review Summary</h4>
        <div className="grid grid-cols-2 gap-y-4 text-sm font-body-md">
          <div className="text-on-surface-variant">Type:</div>
          <div className="font-medium text-on-surface capitalize">{reportType}</div>
          
          <div className="text-on-surface-variant">Title:</div>
          <div className="font-medium text-on-surface break-words min-w-0">{reportTitle || '—'}</div>
          
          <div className="text-on-surface-variant">Category:</div>
          <div className="font-medium text-on-surface capitalize">{reportCategory}</div>
          
          <div className="col-span-2 pt-3 border-t border-outline-variant/30 mt-1">
            <div className="text-on-surface-variant text-xs mb-1">Verification Question:</div>
            <div className="font-medium text-on-surface italic">
              "{reportSecurityQuestion || 'Not set'}"
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
