'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, RotateCw, CheckCircle2, XCircle, Sparkles, 
  FileText, ChevronLeft, ChevronRight, Loader2 
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
  onOpenCitation: _onOpenCitation,
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
    } catch {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-surface border border-line shadow-card p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary-fg flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-fg flex items-center gap-2">
                <span>Quick Revise Flashcards</span>
              </h3>
              <p className="text-[11px] text-fg-3">
                Definitions, formulas & facts grounded strictly in course material
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full hover:bg-surface-2 flex items-center justify-center text-fg-3 hover:text-fg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Topic Selector */}
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-fg-3 shrink-0">
            Topic:
          </label>
          <select
            value={selectedTopicId || ''}
            onChange={(e) => {
              const id = Number(e.target.value);
              setSelectedTopicId(id);
              loadDeck(id);
            }}
            className="flex-1 text-xs px-3.5 py-2 rounded-xl border border-line-strong bg-surface-2 text-fg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {topics.map((t) => (
              <option key={t.id} value={t.id} className="bg-surface text-fg">
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Card Content */}
        {loading ? (
          <div className="py-20 text-center text-fg-3 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs">Extracting grounded flashcards from course passages...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-danger-soft border border-danger/30 text-danger text-xs text-center">
            {error}
          </div>
        ) : cards.length === 0 ? (
          <div className="py-12 text-center text-fg-3 text-xs">
            No flashcards generated for this topic yet. Ensure course materials are uploaded.
          </div>
        ) : currentCard ? (
          <div className="space-y-4">
            {/* Card Progress */}
            <div className="flex items-center justify-between text-xs text-fg-3 font-medium">
              <span className="px-2.5 py-0.5 rounded-full bg-surface-2 text-fg-2 text-[10px] font-bold uppercase">
                {currentCard.card_type}
              </span>
              <span>
                Card {cardIdx + 1} of {cards.length}
              </span>
            </div>

            {/* Flashcard Body (Flip View) */}
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="min-h-[220px] p-6 rounded-2xl border border-line bg-surface-2 flex flex-col justify-between cursor-pointer hover:border-line-strong transition select-none shadow-xs"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary-fg block">
                  {isFlipped ? 'Answer / Explanation (Click to flip back)' : 'Concept / Question (Click to reveal answer)'}
                </span>
                <p className="text-sm sm:text-base font-semibold text-fg leading-relaxed whitespace-pre-line">
                  {isFlipped ? currentCard.back : currentCard.front}
                </p>
              </div>

              {/* Source Grounding Citation */}
              <div className="pt-3 border-t border-line flex items-center justify-between text-[11px] text-fg-3">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary-fg" />
                  <span>{currentCard.citation_text}</span>
                </span>
                <span className="text-[10px] text-primary-fg font-bold flex items-center gap-1">
                  <RotateCw className="w-3 h-3" />
                  <span>{isFlipped ? 'Front' : 'Flip'}</span>
                </span>
              </div>
            </div>

            {/* Review Feedback Banner */}
            {reviewFeedback && (
              <div className="p-2.5 rounded-xl bg-primary-soft border border-primary/30 text-center text-xs font-semibold text-primary-fg animate-in fade-in">
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
                    ? 'border-danger bg-danger text-white shadow-xs'
                    : 'border-danger/30 bg-danger-soft text-danger hover:bg-danger-soft/80'
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span>Didn&apos;t know</span>
              </button>

              <button
                type="button"
                onClick={() => handleReview(true)}
                className={`py-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  reviewedCards[currentCard.id] === true
                    ? 'border-success bg-success text-white shadow-xs'
                    : 'border-success/30 bg-success-soft text-success hover:bg-success-soft/80'
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
                className="px-3.5 py-1.5 rounded-lg border border-line bg-surface-2 text-xs font-semibold text-fg-2 hover:bg-surface-3 hover:text-fg disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                disabled={cardIdx + 1 >= cards.length}
                onClick={handleNext}
                className="px-3.5 py-1.5 rounded-lg border border-line bg-surface-2 text-xs font-semibold text-fg-2 hover:bg-surface-3 hover:text-fg disabled:opacity-40 flex items-center gap-1 cursor-pointer"
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
