import React, { useState } from 'react';
import { Claim, Item } from '../../types';
import { ArrowLeft, CheckCircle2, XCircle, ShieldCheck, User as UserIcon } from 'lucide-react';
import { db } from '../../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface Props {
  claim: Claim;
  item?: Item;
  onClose: () => void;
  triggerToast: (msg: string, type: 'success' | 'error') => void;
}

export const ClaimReviewView: React.FC<Props> = ({ claim, item, onClose, triggerToast }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "claims", claim.id), {
        status: "approved",
        updatedAt: serverTimestamp(),
      });
      // Optionally update the item status to 'resolved'
      if (claim.itemId) {
        await updateDoc(doc(db, "items", claim.itemId), {
          status: "resolved",
          claimed: true,
          updatedAt: serverTimestamp()
        });
      }
      triggerToast("Ownership claim approved! Credentials unlocked.", "success");
      onClose();
    } catch (err) {
      console.error("Error approving claim:", err);
      triggerToast("Action failed or unauthorized.", "error");
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "claims", claim.id), {
        status: "declined",
        updatedAt: serverTimestamp(),
      });
      triggerToast("Claim response declined.", "error");
      onClose();
    } catch (err) {
      console.error("Error rejecting claim:", err);
      triggerToast("Action failed.", "error");
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-6 md:p-8 animate-in fade-in duration-300">
      <button 
        onClick={onClose}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors font-label-md text-sm mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Alerts
      </button>

      <div className="mb-8">
        <h2 className="text-2xl font-headline-md font-bold text-on-surface flex items-center gap-2">
          Review Ownership Claim
        </h2>
        {item && (
          <p className="text-on-surface-variant mt-2 font-body-md">
            For item: <span className="font-semibold text-on-surface">{item.title}</span>
          </p>
        )}
      </div>

      <div className="bg-surface-container rounded-xl p-6 mb-6 border border-outline-variant">
        <h3 className="text-xs font-label-md text-primary tracking-widest uppercase mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Verification Question
        </h3>
        <p className="text-lg font-body-lg text-on-surface italic bg-surface-container-highest/50 p-4 rounded-xl">
          "{claim.securityQuestion}"
        </p>
      </div>

      <div className="bg-secondary-container/20 rounded-xl p-6 mb-8 border border-secondary-container">
        <h3 className="text-xs font-label-md text-secondary tracking-widest uppercase mb-3 flex items-center gap-2">
          <UserIcon className="h-4 w-4" />
          Claimant's Answer
        </h3>
        <p className="text-base font-body-md text-on-surface whitespace-pre-wrap">
          {claim.providedAnswer}
        </p>
      </div>

      {claim.status === 'pending' ? (
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-outline-variant">
          <button
            onClick={handleApprove}
            disabled={isProcessing}
            className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-label-md hover:bg-primary-dim transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5" /> Approve Claim
          </button>
          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="flex-1 bg-error text-on-error py-3 rounded-xl font-label-md hover:bg-error-container hover:text-on-error-container transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <XCircle className="w-5 h-5" /> Reject Claim
          </button>
        </div>
      ) : (
        <div className="p-4 bg-surface-variant rounded-xl text-center font-label-md text-on-surface-variant">
          This claim has already been {claim.status}.
        </div>
      )}
    </div>
  );
};
