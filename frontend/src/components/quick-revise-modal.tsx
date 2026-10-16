'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, RotateCw, CheckCircle2, XCircle, Sparkles, BookOpen, 
  ExternalLink, FileText, ChevronLeft, ChevronRight, Layers, Loader2 
} from 'lucide-react';
import { api, Topic, FlashcardItem, SourceCitation } from '@/lib/api';

interface QuickReviseModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: number;
  topics: Topic[];
  initialTopicId?: number;
  onOpenCitation?: (citation: SourceCitation) => void;
}

export function QuickReviseModal({
  isOpen,
  onClose,
  courseId,
  topics,
  initialTopicId,
  onOpenCitation
}: QuickReviseModalProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<number | undefined>(initialTopicId);
  const [cards, setCards] = useState<FlashcardItem[]>([]);
  const [cardIdx, setCardIdx] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [reviewedCards, setReviewedCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialTopicId) {
      setSelectedTopicId(initialTopicId);
    } else if (topics && topics.length > 0) {
      setSelectedTopicId(topics[0].id);
    }
  }, [initialTopicId, topics]);

  useEffect(() => {
    if (isOpen && courseId && selectedTopicId) {
      loadDeck(selectedTopicId);
    }
  }, [isOpen, courseId, selectedTopicId]);

  const loadDeck = async (tId: number) => {
    setLoading(true);
    setError(null);
    setCardIdx(0);
    setIsFlipped(false);
    setReviewFeedback(null);
    setReviewedCards({});

    try {
      const res = await api.getFlashcards(courseId, tId);
      setCards(res.cards);
    } catch (err: any) {
      setError(err.message || 'Failed to load topic flashcards');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (knewIt: boolean) => {
    if (!cards[cardIdx] || !selectedTopicId) return;
    const currentCard = cards[cardIdx];

    try {
      const res = await api.reviewFlashcard(courseId, selectedTopicId, currentCard.id, knewIt);
      setReviewFeedback(res.message);
      setReviewedCards((prev) => ({ ...prev, [currentCard.id]: knewIt }));
    } catch (e) {
      // ignore
    }
  };

  const handleNext = () => {
    if (cardIdx + 1 < cards.length) {
      setCardIdx((prev) => prev + 1);
      setIsFlipped(false);
      setReviewFeedback(null);
    }
  };

  const handlePrev = () => {
    if (cardIdx > 0) {
      setCardIdx((prev) => prev - 1);
      setIsFlipped(false);
      setReviewFeedback(null);
    }
  };

  if (!isOpen) return null;

  const currentCard = cards[cardIdx];
  const activeTopic = topics.find((t) => t.id === selectedTopicId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Quick Revise Flashcards</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Definitions, formulas & facts grounded strictly in course material
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Topic Selector */}
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 shrink-0">
            Topic:
          </label>
          <select
            value={selectedTopicId || ''}
            onChange={(e) => {
              const id = Number(e.target.value);
              setSelectedTopicId(id);
              loadDeck(id);
            }}
            className="flex-1 text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
          >
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Card Content */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-xs">Extracting grounded flashcards from course passages...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs text-center">
            {error}
          </div>
        ) : cards.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No flashcards generated for this topic yet. Ensure course materials are uploaded.
          </div>
        ) : currentCard ? (
          <div className="space-y-4">
            {/* Card Progress */}
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase">
                {currentCard.card_type}
              </span>
              <span>
                Card {cardIdx + 1} of {cards.length}
              </span>
            </div>

            {/* Flashcard Body (Flip View) */}
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="min-h-[220px] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex flex-col justify-between cursor-pointer hover:border-indigo-400 transition select-none shadow-inner"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                  {isFlipped ? 'Answer / Explanation (Click to flip back)' : 'Concept / Question (Click to reveal answer)'}
                </span>
                <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-line">
                  {isFlipped ? currentCard.back : currentCard.front}
                </p>
              </div>

              {/* Source Grounding Citation */}
              <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{currentCard.citation_text}</span>
                </span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                  <RotateCw className="w-3 h-3" />
                  <span>{isFlipped ? 'Front' : 'Flip'}</span>
                </span>
              </div>
            </div>

            {/* Review Feedback Banner */}
            {reviewFeedback && (
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-center text-xs font-semibold text-indigo-700 dark:text-indigo-300 animate-in fade-in">
                {reviewFeedback}
              </div>
            )}

            {/* Self-Rating Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleReview(false)}
                className={`py-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  reviewedCards[currentCard.id] === false
                    ? 'border-rose-600 bg-rose-600 text-white shadow-xs'
                    : 'border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span>Didn't know</span>
              </button>

              <button
                type="button"
                onClick={() => handleReview(true)}
                className={`py-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  reviewedCards[currentCard.id] === true
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                    : 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Knew it</span>
              </button>
            </div>

            {/* Navigation controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={cardIdx === 0}
                onClick={handlePrev}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                disabled={cardIdx + 1 >= cards.length}
                onClick={handleNext}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
