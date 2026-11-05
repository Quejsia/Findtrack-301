import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Item, Claim } from '../types';
import { submitClaim } from '../lib/claimApi';
import { motion, AnimatePresence } from 'motion/react';
import { getCategoryIcon } from './ItemCard';
import Matchmaker from './Matchmaker';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  setDoc, 
  doc, 
  serverTimestamp, 
  collection, 
  query, 
  where, 
  onSnapshot,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  orderBy
} from 'firebase/firestore';
import { 
  X, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  User, 
  PhoneCall, 
  FileClock, 
  Lock, 
  Trash2, 
  Loader2,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Send,
  Radio,
  Tag,
  Lightbulb,
  Key
} from 'lucide-react';

interface ItemDetailProps {
  item: Item;
  onClose: () => void;
  allOppositeItems: Item[]; 
  onResolveItem: (itemId: string, matchingItemId: string) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  currentUserUid?: string;
  onStartChat?: (otherUserUid: string, itemId: string) => void;
}

export default function ItemDetail({
  item,
  onClose,
  allOppositeItems,
  onResolveItem,
  onDeleteItem,
  currentUserUid,
  onStartChat,
}: ItemDetailProps) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const [openClaimModal, setOpenClaimModal] = useState(false);
  const [claimView, setClaimView] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimErrorObj, setClaimErrorObj] = useState<string | null>(null);

  // Real-time Claims tracking
  const [existingClaim, setExistingClaim] = useState<Claim | null>(null);
  const [fetchingClaim, setFetchingClaim] = useState(false);
  const [activeView, setActiveView] = useState<'details' | 'chat'>('details');

  const isOwner = item.userId === currentUserUid;
  const isResolved = item.status === 'resolved';

  const hasSecurityQuestion = !!item.securityQuestion && item.securityQuestion.trim().length > 0;

  // Sync claim state
  useEffect(() => {
    if (!currentUserUid || !item.id || isOwner) {
      setExistingClaim(null);
      return;
    }
    setFetchingClaim(true);
    const claimsRef = collection(db, 'claims');
    const q = query(claimsRef, where('itemId', '==', item.id), where('claimerId', '==', currentUserUid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFetchingClaim(false);
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        setExistingClaim({ id: docSnap.id, ...docSnap.data() } as Claim);
      } else {
        setExistingClaim(null);
      }
    }, (err) => {
      console.error("Error setting up claim onSnapshot:", err);
      setFetchingClaim(false);
    });

    return () => unsubscribe();
  }, [item.id, currentUserUid, isOwner]);

  const dateToParse = item.date && !isNaN(new Date(item.date).getTime()) 
    ? item.date 
    : (item.createdAt ? item.createdAt : new Date().toISOString());

  const formattedDate = new Date(dateToParse).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const formattedPostedDate = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : 'Just now';

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Query for any approved claims on this item
      const claimsRef = collection(db, "claims");
      const q = query(claimsRef, where("itemId", "==", item.id), where("status", "==", "approved"));
      const querySnapshot = await getDocs(q);
      
      let hasApprovedClaim = false;
      let claimantName = "";
      
      if (!querySnapshot.empty) {
        hasApprovedClaim = true;
        const approvedClaimDoc = querySnapshot.docs[0].data() as Claim;
        claimantName = approvedClaimDoc.claimerName || "Someone";
      }

      let confirmed = false;
      if (hasApprovedClaim) {
        confirmed = window.confirm(`This item has already been claimed by ${claimantName}. Are you sure you want to delete it? This cannot be undone and will remove their access to your contact credentials.`);
      } else {
        confirmed = window.confirm(`Are you sure you want to delete this listing? This cannot be undone.`);
      }

      if (!confirmed) {
        setDeleting(false);
        return;
      }

      await onDeleteItem(item.id);
      onClose();
    } catch (err) {
      console.error('Delete click exception:', err);
      alert('Failed to delete registry entry.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUserUid) return;

    if (!answer.trim()) {
      setError('Verification answer cannot be empty 🫙');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }
    setError('');

    setSubmittingClaim(true);
    setClaimErrorObj(null);

    const claimId = `claim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const claimsPath = `claims/${claimId}`;

    try {
      let autoApproved = false;
      const hasSecurityQuestion = !!item.securityQuestion && item.securityQuestion.trim().length > 0;

      // The server checks the answer and creates the claim (approved on a match, pending
      // for manual review otherwise) because clients may not write full claim documents.
      let result;
      try {
        result = await submitClaim(item.id, answer, !hasSecurityQuestion);
      } catch (e) {
        console.error("Claim request failed:", e);
        setClaimErrorObj("Your claim could not be processed due to a secure backend connection error. Please try again.");
        setSubmittingClaim(false);
        return;
      }

      if (result.status === 409) {
        // The owner never set a private answer: fall back to manual review.
        result = await submitClaim(item.id, answer, true);
      } else if (hasSecurityQuestion && !result.match) {
        setClaimErrorObj(`Verification Failed: ${result.reason || "Your answer did not match the owner's answer."}`);
        setSubmittingClaim(false);
        return;
      }
      autoApproved = result.match === true;

      if (autoApproved) {
        alert('Ownership verified successfully! Contact details unlocked.');
      } else {
        alert('Claim submitted for manual review by the owner.');
      }

      setAnswer('');
      setOpenClaimModal(false);
      setClaimView(false);
    } catch (err: any) {
      console.error("Failed to post claim:", err);
      setClaimErrorObj(err.message || String(err));
      try {
        handleFirestoreError(err, OperationType.WRITE, claimsPath);
      } catch (e) {}
    } finally {
      setSubmittingClaim(false);
    }
  };

  // Check if contact info should be hidden under security rules
  const isCredentialsLocked = hasSecurityQuestion && !isOwner && (!existingClaim || existingClaim.status !== 'approved');

  if (claimView) {
    return (
      <div className="fixed z-[1000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" style={{ top: 0, left: 0, right: 0, height: '100dvh' }} id="dedicated-claim-page">
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-4px); }
            40%, 80% { transform: translateX(4px); }
          }
          .animate-shake {
            animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
          }
        `}</style>
        <div className="relative w-full max-w-2xl bg-surface-container-lowest rounded-md shadow-2xl flex flex-col shrink-0 border border-slate-700 max-h-[85dvh]">
          
          {/* THE HEADER: Keep the teal "Log Ownership Claim / Prove-It Verification Layer" header clean and isolated at the top. */}
          <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-teal-800 to-teal-600 text-white shrink-0 rounded-t-md shadow-md z-10 border-b border-teal-900/30">
            <div className="flex flex-col">
              <span className="text-xl md:text-2xl font-black text-white leading-tight tracking-tight">{t('itemDetail.logOwnershipClaim')}</span>
              <span className="text-teal-100 text-[10px] font-mono font-bold tracking-widest mt-1 uppercase text-opacity-90">Prove-It Verification Layer</span>
            </div>
            <button
              type="button"
              onClick={() => setClaimView(false)}
              className="text-white hover:text-teal-50 bg-teal-900/40 hover:bg-teal-900/70 px-4 py-2 rounded border border-teal-500/30 text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-sm active:scale-95 shrink-0 ml-4"
            >
              ← Back
            </button>
          </div>

          {/* MAIN WRAPPER: Use a clean vertical flex container with proper padding so elements don't collide */}
          <div className="p-6 flex flex-col gap-6 w-full bg-surface-container flex-1 overflow-y-auto rounded-b-md">
            
            {/* ITEM SUMMARY CARD */}
            <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-sm border-l-4 border-l-teal-500 hover:shadow-md transition">
              <span className="text-[11px] font-extrabold text-sky-600 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5"><Tag className="h-4 w-4" /> Current Claim Item</span>
              <h4 className="text-xl font-black text-on-surface">{item?.title || 'Unknown Item'}</h4>
              <p className="text-sm font-medium text-on-surface-variant mt-1">{item?.location || 'Unknown Location'} · {formattedDate || 'Unknown Date'}</p>
            </div>

            <div className={`flex flex-col gap-3 ${isShaking ? 'animate-shake border-red-500' : ''}`}>
              {/* VERIFICATION QUESTION - Read Only */}
              <div className="mb-4">
                <label className="text-sm font-bold tracking-wider text-on-surface-variant uppercase">
                  VERIFICATION QUESTION
                </label>
                {item?.securityQuestion && item.securityQuestion.trim() ? (
                  <div className="w-full mt-2 p-4 border-2 border-sky-500 rounded-md bg-[#fefce8] text-black shadow-sm">
                    <p className="font-bold text-sm mb-2 text-[#854d0e] uppercase tracking-wide"><Key className="h-4 w-4 inline mr-1" /> OWNER'S SECRET QUESTION</p>
                    <p className="italic text-[#713f12] text-lg font-medium tracking-tight">e.g. "{item?.securityQuestion}"</p>
                  </div>
                ) : (
                  <div className="w-full mt-2 p-4 border-2 border-sky-500 rounded-md bg-surface-container-lowest text-black cursor-default select-text font-medium shadow-sm">
                    <p className="text-lg text-on-surface leading-relaxed font-semibold">How can we verify that this is your item? Describe it in detail.</p>
                  </div>
                )}
              </div>

              <label htmlFor="claim-answer-textarea" className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mt-2 block">
                YOUR ANSWER
              </label>
              <textarea
                id="claim-answer-textarea"
                rows={6}
                value={answer}
                onChange={(e) => { 
                  setAnswer(e.target.value); 
                  if (error) setError(''); 
                }}
                placeholder="Provide your exact verification answer or physical proof details here..."
                className="w-full px-4 py-4 border-2 border-sky-500 rounded-md bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-4 focus:ring-sky-500/20 text-base md:text-lg min-h-40 shadow-inner font-medium placeholder-slate-400"
              />
              {error && <p className="text-sm font-bold text-error mt-2 animate-pulse">{error}</p>}
              <p className="text-xs text-primary italic mt-2 font-medium">
                The finder will inspect this proof and action your contact credentials request.
              </p>
            </div>

            {/* TIPS CARD */}
            <div className="mt-5 p-5 border-2 border-teal-600/30 rounded-md bg-primary-container/20/50 space-y-2 shadow-sm">
              <span className="text-sm font-bold text-sky-800 uppercase tracking-widest block mb-2 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-tertiary-container" /> Tips for a strong claim
              </span>
              <p className="text-sm text-on-surface leading-relaxed font-medium pb-1">• State items inside (e.g. specific cards, quantity of cash, etc.)</p>
              <p className="text-sm text-on-surface leading-relaxed font-medium pb-1">• Mention distinct scratches, custom keychains, stickers, or wallpaper setups</p>
              <p className="text-sm text-on-surface leading-relaxed font-medium">• State the exact date, time range and place you lost or found it</p>
            </div>

            {claimErrorObj && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-md flex flex-col gap-2 shadow-sm mt-2">
                <div className="text-red-800 text-sm font-bold flex items-center gap-2">
                  <X className="h-5 w-5" /> Verification Failed
                </div>
                <div className="text-red-700 text-sm font-medium pl-7">
                  {claimErrorObj}
                </div>
              </div>
            )}

            {/* CLEAN BUTTON LAYOUT: Move the "Cancel" and "Submit Answer" buttons BELOW the text input area. */}
            <div className="flex items-center gap-3 mt-5">
              <button
                type="button"
                onClick={() => setClaimView(false)}
                className="px-6 py-4 border-2 border-sky-500 rounded-md text-primary bg-surface-container-lowest text-base font-bold transition shadow-sm hover:bg-surface-container active:scale-95"
              >
                    {t('generated.string_511')} {/* Close/Cancel */}
                  </button>
              <button
                type="button"
                disabled={submittingClaim}
                onClick={() => handleSubmit()}
                className="flex-1 px-6 py-4 border-2 border-red-500 rounded-md bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold text-base flex items-center justify-center gap-2 shadow-md transition active:scale-95"
              >
                {submittingClaim ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Submit Answer</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" style={{ top: 0, left: 0, right: 0, height: '100dvh' }} id="item-details-drawer">
      <motion.div
        layoutId={`card-container-${item.id}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative w-full max-w-2xl overflow-hidden rounded-md bg-surface-container-lowest shadow-2xl transition-all duration-300 ${
          activeView === 'chat' 
            ? 'h-[85vh] sm:h-[600px] flex flex-col justify-between' 
            : 'h-auto pb-6'
        }`}
      >
        {activeView === 'details' ? (
          <>
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-primary font-semibold text-sm px-4 py-3"
            >
              ← {t('itemDetail.backToResults')}
            </button>

            {/* Header Ribbon */}
            <div className={`p-4 flex items-center justify-between border-b ${
              item.type === 'lost' 
                ? 'bg-error-container/20/50 border-error/30 text-rose-800' 
                : 'bg-emerald-50/50 border-emerald-100 text-emerald-900'
            }`}>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-bold font-sans uppercase ${
                  item.type === 'lost' ? 'bg-rose-100' : 'bg-emerald-100'
                }`}>
                  {item.type}
                </span>
                <span className="font-mono text-xs text-on-surface-variant font-semibold tracking-wide capitalize">
                  {item.category} {t('itemDetail.registryItem')}
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1 text-on-surface-variant hover:bg-surface-variant hover:text-on-surface-variant transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="max-h-[80vh] overflow-y-auto p-6 space-y-6">
              
              {/* Hero Banner Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Left side: Photo or placeholder */}
                <div className="sm:col-span-1">
                  {item.imageUrl ? (
                    <div className="relative aspect-square w-full rounded-md border border-outline-variant overflow-hidden bg-surface-container">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className={`aspect-square w-full rounded-md border flex flex-col items-center justify-center ${
                      item.type === 'lost' 
                        ? 'bg-error-container/20/50 border-error/30 text-error' 
                        : 'bg-emerald-50/50 border-emerald-100 text-emerald-600'
                    }`}>
                      {getCategoryIcon(item.category, "h-12 w-12")}
                      <span className="font-mono text-[9px] font-bold text-on-surface-variant mt-2 uppercase">{item.category}</span>
                    </div>
                  )}
                </div>

                {/* Right side: Summary Details */}
                <div className="sm:col-span-2 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <h3 className="font-sans text-xl font-bold text-on-surface">{item.title}</h3>
                    <p className="font-sans text-xs text-on-surface-variant leading-relaxed">{item.description}</p>
                  </div>

                  {/* Status and metadata tags */}
                  <div className="grid grid-cols-2 gap-3 text-on-surface-variant font-sans text-xs">
                    <div className="flex items-center space-x-2 bg-surface-container p-2 rounded-md border border-outline-variant/50">
                      <MapPin className="h-4 w-4 text-on-surface-variant shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-[10px] text-on-surface-variant uppercase font-semibold">{t('itemDetail.location')}</p>
                        <p className="font-sans font-medium text-on-surface truncate">{item.location}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 bg-surface-container p-2 rounded-md border border-outline-variant/50">
                      <Calendar className="h-4 w-4 text-on-surface-variant shrink-0" />
                      <div>
                        <p className="font-sans text-[10px] text-on-surface-variant uppercase font-semibold">{t('itemDetail.dateLogged')}</p>
                        <p className="font-sans font-medium text-on-surface">{formattedDate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Details (PII Privacy-first protection) */}
              <div className="border border-outline-variant rounded-md p-4 bg-surface-container" id="contact-credentials">
                <h4 className="font-sans text-xs font-bold text-on-surface tracking-wider uppercase mb-3 flex items-center space-x-1">
                  <User className="h-3.5 w-3.5" />
                  <span>{t('itemDetail.contactCredentials')}</span>
                </h4>

                {currentUserUid ? (
                  <div>
                    {isOwner ? (
                      /* OWNER VIEW */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div className="flex items-center space-x-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-container/10 border border-primary/30 text-primary font-bold text-sm shrink-0">
                            {item.contactName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-sans text-[10px] text-on-surface-variant font-medium">{t('itemDetail.reporterYourListing')}</p>
                            <p className="font-sans text-xs text-on-surface font-bold">{item.contactName}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 border border-emerald-100 text-emerald-600 shrink-0">
                            <PhoneCall className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-sans text-[10px] text-on-surface-variant font-medium">{t('generated.string_473')}</p>
                            <p className="font-sans text-xs text-on-surface font-bold truncate">{item.contactInfo}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* NON-OWNER VIEW (ZERO TRUST SHIELD) */
                      <div>
                        {isCredentialsLocked ? (
                          /* Mask PII Details behind claims block */
                          <div className="space-y-4">
                            <div className="flex items-start space-x-3 bg-surface-container-lowest p-3.5 rounded-md border border-outline-variant/60 shadow-sm">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-container/10 text-primary shrink-0 border border-primary/30">
                                <Lock className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <p className="font-sans text-xs font-bold text-on-surface">{t('itemDetail.piiPrivacyLockActive')}</p>
                                <p className="text-[11px] text-on-surface-variant font-medium mt-0.5 leading-relaxed">
                                  {t('itemDetail.piiLockExplanation')}
                                </p>
                              </div>
                            </div>

                            {/* Claims progress or claim submission button */}
                            {existingClaim ? (
                              <div className="p-4 bg-surface-container-lowest border border-outline-variant/80 rounded-md shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] uppercase font-bold text-on-surface-variant font-sans tracking-wide">
                                    {t('itemDetail.claimResponseHistory')}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase ${
                                    existingClaim.status === 'pending' ? 'bg-tertiary-container/20 text-tertiary' : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {existingClaim.status}
                                  </span>
                                </div>

                                <p className="font-sans text-xs font-semibold text-on-surface bg-surface-container p-2.5 rounded-md border border-outline-variant/50 leading-relaxed italic">
                                  "{existingClaim.securityQuestion}"
                                </p>
                                
                                <p className="text-[11px] text-on-surface-variant font-semibold font-sans">
                                  <Key className="h-3 w-3 inline text-on-surface-variant mr-1" /> {t('itemDetail.yourSubmittedAnswer')} <span className="font-normal font-sans italic text-on-surface-variant">"{existingClaim.providedAnswer}"</span>
                                </p>

                                <div className="flex items-center space-x-2 pt-1 border-t border-outline-variant/50">
                                  <div className="h-1.5 w-1.5 rounded-full bg-tertiary-container/100 animate-ping" />
                                  <p className="text-[10px] text-on-surface-variant font-medium">
                                    {existingClaim.status === 'pending' 
                                      ? t('itemDetail.underReviewByReporter') 
                                      : t('itemDetail.declinedByReporter')}
                                  </p>
                                </div>
                                
                                <div className="flex flex-col space-y-3 w-full pt-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onStartChat) {
                                        onStartChat(item.userId, item.id);
                                        onClose();
                                      }
                                    }}
                                    className="w-full flex items-center justify-center space-x-1.5 bg-teal-850 hover:bg-teal-900 border border-teal-800 text-white font-sans text-xs font-bold py-3.5 px-4 rounded-md shadow-md cursor-pointer transition active:scale-95 duration-200"
                                  >
                                    <MessageSquare className="h-4 w-4 shrink-0 text-white/90" />
                                    <span>{t('itemDetail.messageFinder')}</span>
                                  </button>
                                  
                                  {existingClaim.status === 'rejected' && (
                                    <button
                                      type="button"
                                      onClick={() => setClaimView(true)}
                                      className="w-full flex items-center justify-center space-x-1.5 py-3.5 px-4 rounded-md bg-slate-900 text-white font-sans text-xs font-bold hover:bg-slate-800 transition active:scale-95 duration-200 cursor-pointer shadow-md"
                                    >
                                      <ShieldQuestion className="h-4 w-4 text-emerald-400 shrink-0" />
                                      <span>{t('itemDetail.submitCustomProof')}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* Open submit claim trigger buttons */
                              <div className="flex flex-col space-y-3.5 w-full pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onStartChat) {
                                      onStartChat(item.userId, item.id);
                                      onClose();
                                    }
                                  }}
                                  className="w-full flex items-center justify-center space-x-1.5 bg-teal-850 hover:bg-teal-900 border border-teal-800 text-white font-sans text-xs font-bold py-3.5 px-4 rounded-md shadow-md cursor-pointer transition active:scale-95 duration-200"
                                >
                                  <MessageSquare className="h-4 w-4 shrink-0 text-white/90" />
                                  <span>{t('itemDetail.messageFinder')}</span>
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => setClaimView(true)}
                                  className="w-full flex items-center justify-center space-x-1.5 bg-surface-container-lowest border border-slate-300 hover:bg-surface-container/50 text-on-surface font-sans text-xs font-bold py-3.5 px-4 rounded-md shadow-sm cursor-pointer transition active:scale-95 duration-200"
                                >
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                                  <span>{t('itemDetail.proveOwnershipAndClaim')}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* UNLOCKED VIEW (Approved Claim or No Questions registered) */
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                              <div className="flex items-center space-x-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-container/10 border border-primary/30 text-primary font-bold text-sm shrink-0">
                                  {item.contactName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-sans text-[10px] text-on-surface-variant font-medium">{t('itemDetail.reporter')}</p>
                                  <p className="font-sans text-xs text-on-surface font-bold">{item.contactName}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 border border-emerald-100 text-emerald-600 shrink-0">
                                  <PhoneCall className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-sans text-[10px] text-on-surface-variant font-medium">{t('itemDetail.contactCoordinates')}</p>
                                  <p className="font-sans text-xs text-on-surface font-bold truncate">{item.contactInfo}</p>
                                </div>
                              </div>
                            </div>

                            {existingClaim?.status === 'approved' && (
                              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-md p-3 text-emerald-800 font-sans text-xs">
                                <ShieldCheck className="h-4.5 w-4.5 text-primary shrink-0" />
                                <p className="font-medium text-[11px] leading-snug">
                                  <strong>{t('itemDetail.proofApproved')}</strong> {t('itemDetail.proofApprovedExplanation')}
                                </p>
                              </div>
                            )}

                            <div className="flex flex-col space-y-3 w-full pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (onStartChat) {
                                    onStartChat(item.userId, item.id);
                                    onClose();
                                  }
                                }}
                                className="w-full flex items-center justify-center space-x-1.5 bg-teal-850 hover:bg-teal-900 border border-teal-800 text-[#1a1a1a] font-sans text-xs font-bold py-3.5 px-4 rounded-md shadow-md cursor-pointer transition active:scale-95 duration-200"
                              >
                                <MessageSquare className="h-4 w-4 shrink-0 text-[#1a1a1a]" />
                                <span>{t('itemDetail.directChatRoom')}</span>
                              </button>

                              {!existingClaim && (
                                <button
                                  type="button"
                                  onClick={() => setClaimView(true)}
                                  className="w-full flex items-center justify-center space-x-1.5 bg-surface-container-lowest border border-slate-300 hover:bg-surface-container/50 text-on-surface font-sans text-xs font-bold py-3.5 px-4 rounded-md shadow-sm cursor-pointer transition active:scale-95 duration-200"
                                >
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                                  <span>{t('itemDetail.logOwnershipClaim')}</span>
                                </button>
                              )}
                              
                              {existingClaim && existingClaim.status !== 'approved' && (
                                <div className="py-2.5 text-center font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-md border border-emerald-100 uppercase tracking-wider">
                                  ✓ Claim Status: {existingClaim.status}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-2 text-on-surface-variant font-sans text-xs space-y-1.5">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-tertiary-container/10 border border-tertiary-container/30 text-tertiary-container">
                      <Lock className="h-4 w-4" />
                    </div>
                    <p className="font-bold text-on-surface">{t('itemDetail.credentialsLayerLocked')}</p>
                    <p className="text-[11px] leading-relaxed max-w-sm mx-auto">
                      {t('itemDetail.piiPrivacyPreservation')}
                    </p>
                  </div>
                )}
              </div>

              {/* AI Matchmaker Panel (Active entries only) */}
              {!isResolved && (
                <div className="mt-6 border border-outline-variant/50 bg-surface-container/80 p-4 rounded-md animate-fade-in" id="gemini-matchmaker-container">
                  <Matchmaker
                    item={item}
                    allOppositeItems={allOppositeItems}
                    onResolveItem={onResolveItem}
                    userUid={currentUserUid}
                  />
                </div>
              )}

              {/* Technical Metadata logs */}
              <div className="flex flex-wrap items-center justify-between text-on-surface-variant font-sans text-[10px] pt-4 border-t border-outline-variant/50 gap-2">
                <span className="flex items-center gap-1 uppercase font-semibold">
                  <FileClock className="h-3.5 w-3.5 text-slate-350" />
                  <span>{t('itemDetail.registered')}{formattedPostedDate}</span>
                </span>

                {/* Owner controls: allow Delete */}
                {isOwner && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center space-x-1 text-error hover:text-error transition cursor-pointer"
                  >
                    {deleting ? (
                      <Loader2 className="h-3 animate-spin w-3" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    <span className="font-bold">{t('itemDetail.deleteEntry')}</span>
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          currentUserUid && (
            <div className="w-full h-full flex flex-col" id="embedded-chat-view" style={{ minHeight: '350px' }}>
              <ChatView
                chatId={[currentUserUid, item.userId, item.id].sort().join("_")}
                itemId={item.id}
                currentUserUid={currentUserUid}
                itemTitle={item.title}
                otherUserId={item.userId}
                reporterName={item.contactName}
                onBack={() => setActiveView('details')}
              />
            </div>
          )
        )}
      </motion.div>

      {/* ── CLAIMS VERIFICATION MODAL COHESIVE WITH OUR STYLE (Item 2) ── */}
      <AnimatePresence>
        {openClaimModal && (
          <div className="fixed inset-0 z-[60] bg-surface/60 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-y-auto" id="claims-verification-modal">
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              className="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-[24px] shadow-xl shadow-primary-dim/5 flex flex-col p-8 text-center border border-surface-variant overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#9af4d6] via-[#01725a] to-[#9af4d6] opacity-30"></div>
              
              <div className="w-20 h-20 rounded-full bg-primary-container/20 flex items-center justify-center mx-auto mb-6 shadow-sm">
                <ShieldCheck className="h-10 w-10 text-primary-dim" strokeWidth={1.5} />
              </div>
              
              <h2 className="font-semibold text-[24px] text-on-surface mb-3 tracking-tight">{t('itemDetail.proveItVerification')}</h2>
              
              <p className="text-[14px] text-on-surface-variant mb-6 px-2">
                {t('itemDetail.authenticateYourClaims')} <strong>{item.title}</strong> {t('itemDetail.soListingRecorder')}
              </p>

              <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 text-left">
                <div className="space-y-2">
                  <label className="block text-[9px] font-mono font-bold text-on-surface-variant uppercase tracking-widest text-center">
                    {t('itemDetail.verificationQuestion')}
                  </label>
                  {hasSecurityQuestion ? (
                    <div className="bg-tertiary-container/10 border border-tertiary-container/50 rounded-md p-4 text-on-tertiary-container text-center">
                      <p className="font-bold text-xs mb-1"><Key className="h-3 w-3 inline" /> {t('itemDetail.ownersSecretQuestion')}</p>
                      <p className="font-sans text-xs italic leading-relaxed">"{item.securityQuestion}"</p>
                    </div>
                  ) : (
                    <div className="bg-surface-container border border-slate-205/65 rounded-md p-4 text-center">
                      <p className="font-sans text-xs text-on-surface leading-relaxed font-medium">
                        {t('itemDetail.howCanWeVerify')}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className={`space-y-2 ${isShaking ? 'animate-shake border-red-500' : ''}`}>
                  <label htmlFor="claimer-answer-modal" className="block text-[9px] font-mono font-bold text-on-surface-variant uppercase tracking-widest mt-2 text-center">
                    {t('itemDetail.yourConfidentialAnswer')}
                  </label>
                  <textarea
                    id="claimer-answer-modal"
                    rows={4}
                    value={answer}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      setIsShaking(false);
                    }}
                    placeholder={hasSecurityQuestion ? t('itemDetail.typeExactAnswer') : t('itemDetail.provideSpecificDetails')}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none transition"
                    required
                  />
                  {isShaking && (
                    <p className="text-error text-xs font-medium text-center">{t('itemDetail.pleaseProvideValidAnswer')}</p>
                  )}
                </div>

                <div className="w-full flex flex-col gap-3 mt-4">
                  <button
                    type="submit"
                    disabled={submittingClaim}
                    className="w-full bg-primary text-white font-medium text-[14px] py-3 px-6 rounded-xl shadow-md hover:bg-primary-dim transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {submittingClaim ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {t('itemDetail.encrypting', 'Encrypting...')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        {t('generated.string_495')}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenClaimModal(false)}
                    disabled={submittingClaim}
                    className="w-full bg-transparent text-primary border border-primary font-medium text-[14px] py-3 px-6 rounded-xl hover:bg-primary-container/20 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {t('generated.string_511')} {/* Close/Cancel */}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ChatViewProps {
  chatId: string;
  itemId: string;
  currentUserUid: string;
  itemTitle: string;
  otherUserId: string;
  reporterName: string;
  onBack: () => void;
}

function ChatView({ chatId, itemId, currentUserUid, itemTitle, otherUserId, reporterName, onBack }: ChatViewProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!chatId) return;
    setLoading(true);
    const messagesCollection = collection(db, 'chats', chatId, 'messages');
    const messagesQuery = query(messagesCollection, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs: any[] = [];
      snapshot.forEach(docSnap => {
        msgs.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      console.error("Firestore message listener error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [chatId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    const textToSend = inputText.trim();
    setInputText('');

    try {
      const chatDocRef = doc(db, 'chats', chatId);
      // Reading a chat that does not exist yet is denied by the rules: treat that as "no chat yet".
      let chatExists = false;
      try {
        chatExists = (await getDoc(chatDocRef)).exists();
      } catch (readErr: any) {
        if (readErr?.code !== 'permission-denied') throw readErr;
      }
      if (!chatExists) {
        // Only the fields the Firestore rules allow on a new chat.
        await setDoc(chatDocRef, {
          chatId,
          participants: [currentUserUid, otherUserId],
          itemId,
          lastMessage: textToSend,
          timestamp: serverTimestamp()
        });
      }

      const messagesCollection = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesCollection, {
        senderId: currentUserUid,
        text: textToSend,
        createdAt: serverTimestamp()
      });

      await updateDoc(chatDocRef, {
        lastMessage: textToSend,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col justify-between bg-surface-container-lowest text-on-surface overflow-hidden" id="item-conversation-container">
      {/* 1. Rigid Header Box shrink-0 */}
      <div className="w-full bg-gradient-to-r from-teal-800 to-slate-900 p-4 flex items-center gap-4 text-white shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 rounded-md bg-surface-container-lowest/10 text-xs font-bold hover:bg-surface-container-lowest/20 active:scale-95 transition cursor-pointer"
        >
          ← Back
        </button>

        <div className="flex flex-col items-start justify-center flex-1 min-w-0">
          <span className="text-sm font-bold truncate block w-full">
            {reporterName}
          </span>
          <span className="text-[10px] text-teal-300 font-medium block">
            {t('generated.string_496')}
          </span>
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-container/200/20 text-teal-300 ring-1 ring-teal-400/30 shrink-0">
          <Radio className="h-4 w-4 animate-pulse" />
        </div>
      </div>

      {/* 2. Middle messaging board independent scroll zone */}
      <div className="flex-1 overflow-y-auto bg-surface-container/50 p-4 space-y-4 font-sans text-xs">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center space-y-2 text-on-surface-variant">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="font-sans text-xs font-medium">{t('generated.string_497')}</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/20 text-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-sans font-bold text-on-surface text-sm">{t('generated.string_498')}</h4>
              <p className="font-sans text-[11px] text-on-surface-variant max-w-xs mt-1 leading-relaxed">
                {t('generated.string_499')}
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === currentUserUid;
            return (
              <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[80%] flex flex-col space-y-1">
                  <div className={`px-4 py-2.5 rounded-md text-xs font-sans shadow-sm break-words ${
                    isMe 
                      ? 'bg-gradient-to-tr from-teal-800 to-indigo-900 text-white' 
                      : 'bg-surface-container-lowest border border-outline-variant text-on-surface'
                  }`}>
                    {msg.text}
                  </div>
                  <span className={`font-mono text-[8.5px] text-on-surface-variant block px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messageEndRef} />
      </div>

      {/* 3. Input layout locked safely directly above global elements */}
      <form onSubmit={handleSendMessage} className="border-t border-outline-variant/50 bg-surface-container-lowest p-3 flex items-center space-x-2 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t('generated.string_446')}
          className="shadow-sm flex-1 rounded-xl border border-outline-variant bg-surface-container/50 px-4 py-3 text-xs font-sans focus:border-primary/30 focus:bg-surface-container-lowest focus:outline-none transition placeholder:text-on-surface-variant duration-155"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || sending}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-tr from-teal-850 to-indigo-950 text-white shadow-md transition-all active:scale-95 duration-150 disabled:opacity-50 cursor-pointer"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4 transform rotate-45 text-teal-300" />
          )}
        </button>
      </form>
    </div>
  );
}
