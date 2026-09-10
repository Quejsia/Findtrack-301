import React, { useState } from 'react';
import { ShieldCheck, Info, ArrowRight, CheckCircle2, Lightbulb } from 'lucide-react';
import { db, auth } from '../../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface Props {
  itemId: string;
  itemTitle: string;
  imageUrl?: string;
  finderId: string;
  securityQuestion: string;
  onCancel: () => void;
  onViewMyClaims: () => void;
}

export const ClaimSubmissionForm: React.FC<Props> = ({
  itemId,
  itemTitle,
  imageUrl,
  finderId,
  securityQuestion,
  onCancel,
  onViewMyClaims,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser?.emailVerified) return;

    const form = e.target as HTMLFormElement;
    const answer = (form.elements.namedItem('claimAnswer') as HTMLTextAreaElement)?.value.trim();
    if (!answer || answer.length > 200) return;

    setIsSubmitting(true);
    try {
      const claimId = "claim_" + crypto.randomUUID();
      await setDoc(doc(db, "claims", claimId), {
        id: claimId,
        itemId,
        claimerId: currentUser.uid,
        finderId,
        status: "pending",
        isReadByFinder: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setIsSuccess(true);
    } catch (error) {
      console.error("Failed to submit claim", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 p-8 text-center flex flex-col items-center justify-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center text-primary mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-2xl font-bold text-on-surface mb-2 font-headline-md">Claim Submitted!</h3>
        <p className="text-on-surface-variant font-body-md mb-8 max-w-md mx-auto">
          The finder will review your proof and respond. You'll receive a notification once they decide.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button onClick={onViewMyClaims} className="w-full sm:w-auto px-6 py-2.5 bg-primary text-on-primary font-label-md rounded-full hover:bg-primary-dim transition-colors">View My Claims</button>
          <button onClick={onCancel} className="w-full sm:w-auto px-6 py-2.5 border border-outline-variant text-on-surface font-label-md rounded-full hover:bg-surface-variant transition-colors">Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-8">
        <div className="bg-surface-container-lowest rounded-xl border-2 border-primary/20 p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none -mr-4 -mt-4"></div>
          <div className="relative z-10">
            <h3 className="text-[12px] font-label-md text-primary tracking-widest uppercase mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Verification Question</h3>
            <p className="text-[16px] font-body-lg text-on-surface italic bg-surface-container-highest/50 p-4 rounded-xl border border-outline-variant/20">"{securityQuestion || 'Describe this item in enough detail to prove ownership (e.g. scratches, contents, background).'}"</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="claimAnswer" className="block text-[12px] font-label-md font-medium text-on-surface mb-2">Your Answer</label>
            <textarea id="claimAnswer" name="claimAnswer" required maxLength={200} rows={5} disabled={isSubmitting} placeholder="Please provide specific details to prove ownership..." className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-4 text-[14px] font-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-y shadow-inner disabled:opacity-50"></textarea>
          </div>
          <div className="flex items-start gap-3 p-3 bg-secondary-fixed/30 rounded-xl border border-secondary-fixed-dim/50">
            <Info className="h-5 w-5 text-secondary-dim shrink-0 mt-0.5" />
            <p className="text-[14px] font-body-md text-on-secondary-container leading-relaxed">The finder will inspect this proof and action your contact credentials request. <span className="font-medium text-error-dim">False claims may result in account suspension.</span></p>
          </div>
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-outline-variant/30 mt-8">
            <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-6 py-2.5 text-[12px] font-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-primary text-on-primary px-8 py-2.5 rounded-xl text-[12px] font-label-md hover:bg-primary-dim hover:shadow-md transition-all active:scale-95 group disabled:opacity-50">{isSubmitting ? 'Submitting...' : 'Submit Claim'}{!isSubmitting && <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />}</button>
          </div>
        </form>
      </div>
      <div className="lg:col-span-4 mt-6 lg:mt-0">
        <div className="bg-surface-container-highest rounded-xl p-6 border border-tertiary-fixed/40 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-tertiary-fixed"></div>
          <div className="flex items-center gap-3 mb-4 mt-2"><div className="w-10 h-10 rounded-full bg-tertiary-container flex items-center justify-center text-on-tertiary-container"><Lightbulb className="h-5 w-5" fill="currentColor" /></div><h3 className="text-[18px] font-headline-md font-semibold text-on-surface">Tips for a Strong Claim</h3></div>
          <ul className="space-y-4 mt-6">
            <li className="flex items-start gap-3"><CheckCircle2 className="h-5 w-5 text-tertiary-dim mt-0.5 shrink-0" /><div><strong className="block text-[12px] font-label-md text-on-surface">Be Specific</strong><span className="text-[14px] font-body-md text-on-surface-variant">Mention unique marks, exact brand names, or highly specific contents.</span></div></li>
            <li className="flex items-start gap-3"><CheckCircle2 className="h-5 w-5 text-tertiary-dim mt-0.5 shrink-0" /><div><strong className="block text-[12px] font-label-md text-on-surface">Provide Context</strong><span className="text-[14px] font-body-md text-on-surface-variant">If relevant to the question, describe exactly where or when the item was lost.</span></div></li>
            <li className="flex items-start gap-3"><CheckCircle2 className="h-5 w-5 text-tertiary-dim mt-0.5 shrink-0" /><div><strong className="block text-[12px] font-label-md text-on-surface">Be Patient</strong><span className="text-[14px] font-body-md text-on-surface-variant">Finders are community volunteers; review times may vary based on their availability.</span></div></li>
          </ul>
        </div>
      </div>
    </div>
  );
};
