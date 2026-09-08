import React, { useState, useEffect } from 'react';
import { Item } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, BrainCircuit, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { auth } from '../firebase';
import { useTranslation } from 'react-i18next';

interface MatchmakerProps {
  item: Item;
  allOppositeItems: Item[];
  onResolveItem: (itemId: string, matchingItemId: string) => Promise<void>;
  userUid?: string;
}

interface AIMatch {
  itemId: string;
  confidenceScore: number;
  matchReason: string;
}

export default function Matchmaker({ item, allOppositeItems, onResolveItem, userUid }: MatchmakerProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [aiMatches, setAiMatches] = useState<AIMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const triggerAIMatch = async () => {
    if (!item || allOppositeItems.length === 0) {
      setAiMatches([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/ai-matchmaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: JSON.stringify({
          itemId: item.id,
          candidateIds: allOppositeItems.filter(i => i.status === 'active').map(i => i.id),
        }),
      });
      if (!response.ok) throw new Error('Could not compute similarity profile via Gemini.');
      const data = await response.json();
      setAiMatches(Array.isArray(data.matches) ? data.matches : []);
    } catch (err) {
      console.error('Matchmaker request exception:', err);
      setError('Failed to compute recommendations. Please check system key configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { triggerAIMatch(); }, [item, allOppositeItems]);

  const handleConfirmMatch = async (matchedItem: Item) => {
    setResolvingId(matchedItem.id);
    try { await onResolveItem(item.id, matchedItem.id); }
    catch (err) { console.error('Core match resolution failed:', err); }
    finally { setResolvingId(null); }
  };

  const renderMatches = aiMatches.map(match => {
    const matchedRecord = allOppositeItems.find(i => i.id === match.itemId);
    if (!matchedRecord || matchedRecord.status !== 'active') return null;
    return { ...match, item: matchedRecord };
  }).filter((m): m is AIMatch & { item: Item } => m !== null);

  const isOwner = item.userId === userUid;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary-container/10 p-4" id="matchmaker-section">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center space-x-2"><BrainCircuit className="h-5 w-5 text-primary" /><h4 className="font-sans text-sm font-bold text-on-surface">{t('itemDetail.geminiAiMatchmaker')}</h4></div>
        <button onClick={triggerAIMatch} disabled={loading || allOppositeItems.length === 0} title={t('itemDetail.recalculateMatches')} className="rounded-xl p-1.5 text-primary hover:bg-primary-container/10 disabled:opacity-40 transition-all shrink-0"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      <p className="font-sans text-xs text-on-surface-variant mb-4 leading-relaxed">{t('itemDetail.cognitiveComparisonExplanation')}</p>
      {loading ? <div className="flex flex-col items-center justify-center py-8 space-y-2"><Sparkles className="h-6 w-6 text-primary-dim animate-spin" /><p className="font-sans text-xs font-medium text-primary">{t('itemDetail.generatingCognitiveSimilarity')}</p></div> : error ? <div className="flex items-start bg-red-50/85 p-3 rounded-xl border border-red-100 text-red-700 font-sans text-xs space-x-2"><AlertCircle className="h-4 w-4 text-error shrink-0" /><span>{error}</span></div> : allOppositeItems.length === 0 ? <div className="flex items-center bg-surface-container p-3 rounded-xl border border-outline-variant text-on-surface-variant font-sans text-xs space-x-2"><AlertCircle className="h-4 w-4 text-on-surface-variant shrink-0" /><span>{t('itemDetail.noOppositeElements')}</span></div> : renderMatches.length === 0 ? <div className="text-center py-6 border border-dashed border-outline-variant rounded-xl bg-surface-container-lowest"><Sparkles className="h-5 w-5 text-slate-300 mx-auto mb-1.5" /><p className="font-sans text-xs text-on-surface-variant">{t('itemDetail.noConfidences')}</p></div> : (
        <div className="space-y-3"><AnimatePresence>{renderMatches.map(match => {
          const scoreColor = match.confidenceScore >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : match.confidenceScore >= 60 ? 'text-amber-600 bg-tertiary-container/10 border-tertiary-container/30' : 'text-primary bg-primary-container/10 border-primary/30';
          const progressColor = match.confidenceScore >= 80 ? 'bg-emerald-500' : match.confidenceScore >= 60 ? 'bg-amber-400' : 'bg-primary-container/10';
          return <motion.div key={match.item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 shadow-sm hover:border-primary/30 transition-all" id={`ai-match-card-${match.item.id}`}>
            <div className="flex items-start justify-between gap-3 mb-2"><div className="min-w-0"><h5 className="font-sans text-xs font-bold text-on-surface group-hover:text-primary truncate">{match.item.title}</h5><span className="font-mono text-[9px] text-primary uppercase font-bold">{match.item.category} • {match.item.location}</span></div><span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold border shrink-0 ${scoreColor}`}>{t('itemDetail.percentMatch', { percent: match.confidenceScore })}</span></div>
            <p className="font-sans text-xs text-on-surface-variant bg-surface-container p-2 rounded border border-outline-variant/50 italic leading-relaxed mb-3">{match.matchReason}</p>
            <div className="flex items-center gap-3"><div className="flex-1 h-1.5 bg-slate-150 rounded-full overflow-hidden"><div className={`h-full ${progressColor}`} style={{ width: `${match.confidenceScore}%` }} /></div>{isOwner ? <button onClick={() => handleConfirmMatch(match.item)} disabled={resolvingId !== null} className="inline-flex items-center space-x-1 rounded bg-slate-900 hover:bg-slate-850 px-2 py-1 font-sans text-[10px] font-bold text-white shrink-0 shadow-sm transition-all">{resolvingId === match.item.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-emerald-400" />}<span>{t('itemDetail.resolveMatch')}</span></button> : <span className="font-sans text-[10px] text-slate-450 shrink-0 italic">{t('itemDetail.loginAsCreator')}</span>}</div>
          </motion.div>;
        })}</AnimatePresence></div>
      )}
    </div>
  );
}
