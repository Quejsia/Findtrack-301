import React from 'react';
import { Claim } from '../../types';
import { CheckCircle2, Clock, XCircle, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  claims: Claim[];
  onViewItem: (itemId: string) => void;
}

export const MyClaimsView: React.FC<Props> = ({ claims, onViewItem }) => {
  const { t } = useTranslation();

  if (claims.length === 0) {
    return (
      <div className="py-16 text-center border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-lowest">
        <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4 border border-outline-variant">
          <Search className="h-8 w-8 text-outline" />
        </div>
        <h3 className="font-headline-md text-lg font-bold text-on-surface mb-2">No Claims Submitted</h3>
        <p className="font-body-md text-on-surface-variant">
          You haven't submitted any ownership claims yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {claims.map((claim) => (
        <article
          key={claim.id}
          className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-shadow relative flex flex-col"
        >
          <div className="flex justify-between items-start mb-4">
            {claim.status === 'pending' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-tertiary-container text-on-tertiary-container rounded-full text-[10px] font-label-md uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" /> Pending Review
              </span>
            ) : claim.status === 'approved' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-container text-on-primary-container rounded-full text-[10px] font-label-md uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-error-container text-on-error-container rounded-full text-[10px] font-label-md uppercase tracking-wider">
                <XCircle className="w-3.5 h-3.5" /> Rejected
              </span>
            )}
            <span className="text-xs text-on-surface-variant font-label-md">
              {claim.createdAt?.seconds ? new Date(claim.createdAt.seconds * 1000).toLocaleDateString() : 'Recent'}
            </span>
          </div>
          
          <div className="mb-4 flex-1">
            <h3 className="font-headline-md text-lg text-on-surface mb-2">Claim on {(claim as any).itemTitle || `Item #${claim.itemId ? claim.itemId.substring(0,6).toUpperCase() : 'UNKNOWN'}`}</h3>
            <p className="text-sm font-body-md text-on-surface-variant line-clamp-3">
              <span className="font-medium">Your answer: </span>
              {claim.providedAnswer}
            </p>
          </div>
          
          <button
            onClick={() => onViewItem(claim.itemId)}
            className="w-full text-center py-2 bg-surface-container hover:bg-surface-variant transition-colors text-on-surface text-sm font-label-md rounded-xl border border-outline-variant"
          >
            View Related Item
          </button>
        </article>
      ))}
    </div>
  );
};
