'use client';

import React, { useEffect, useState } from 'react';
import { 
  Calculator, X, FileText, ExternalLink, ChevronDown, 
  ChevronUp, Bot, CheckCircle2 
} from 'lucide-react';
import { api, PracticeProblem, SourceCitation } from '@/lib/api';
import { SourcePreviewModal } from './source-preview-modal';

interface PracticeProblemsModalProps {
  courseId: number;
  topicId: number;
  topicName: string;
  isOpen: boolean;
  onClose: () => void;
  onAskTutor?: (question: string) => void;
}

export function PracticeProblemsModal({
  courseId,
  topicId,
  topicName,
  isOpen,
  onClose,
  onAskTutor
}: PracticeProblemsModalProps) {
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedSolutions, setRevealedSolutions] = useState<Record<number, boolean>>({});
  const [activeCitation, setActiveCitation] = useState<SourceCitation | null>(null);

  useEffect(() => {
    if (!isOpen || !courseId || !topicId) return;

    setLoading(true);
    setError(null);
    setRevealedSolutions({});

    api.getTopicPracticeProblems(courseId, topicId)
      .then((res) => {
        setProblems(res);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch practice problems');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, courseId, topicId]);

  if (!isOpen) return null;

  const toggleSolution = (index: number) => {
    setRevealedSolutions((prev) => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-success-soft text-success border border-success/30">
            Easy • Direct Substitution
          </span>
        );
      case 'medium':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-warning-soft text-warning border border-warning/30">
            Medium • Formula Rearrangement
          </span>
        );
      case 'hard':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary-soft text-primary-fg border border-primary/30">
            Hard • Multi-Formula Synthesis
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-surface-2 text-fg-2 border border-line">
            {difficulty}
          </span>
        );
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl bg-surface rounded-3xl shadow-card border border-line overflow-hidden flex flex-col max-h-[88vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary-soft text-primary-fg">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-fg text-base leading-tight">
                  Suggested Practice Problems
                </h3>
                <p className="text-xs text-fg-3 mt-0.5">
                  Topic: <strong className="text-primary-fg">{topicName}</strong> • Grounded in Course Material
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-2 rounded-xl text-fg-3 hover:text-fg hover:bg-surface-2 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-fg-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs">Extracting formulas and analyzing quantitative problems...</p>
              </div>
            ) : error ? (
              <div className="p-4 rounded-2xl bg-danger-soft border border-danger/30 text-danger text-xs">
                {error}
              </div>
            ) : problems.length === 0 ? (
              <div className="py-12 text-center text-fg-3 text-xs">
                No quantitative practice problems found for this topic yet.
              </div>
            ) : (
              problems.map((prob, idx) => {
                const isRevealed = !!revealedSolutions[idx];
                const cit = prob.source_citation || (prob.source_doc ? {
                  chunk_id: 0,
                  document_id: 0,
                  document_name: prob.source_doc,
                  source_type: 'pdf',
                  page: prob.source_page,
                  slide: prob.source_slide,
                  quote: prob.worked_solution || ''
                } : null);

                return (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl border border-line bg-surface-2 shadow-xs space-y-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-fg-2">#{idx + 1}</span>
                        {getDifficultyBadge(prob.difficulty)}
                      </div>
                      {prob.expression && (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface text-fg border border-line">
                          {prob.expression}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-fg leading-relaxed">
                      {prob.stem}
                    </p>

                    {prob.params && Object.keys(prob.params).length > 0 && (
                      <div className="p-3 rounded-xl bg-surface border border-line text-xs text-fg-2 flex flex-wrap gap-3">
                        <span className="font-semibold text-fg">Given values:</span>
                        {Object.entries(prob.params).map(([k, v]) => (
                          <span key={k} className="font-mono">
                            {k} = {String(v)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Toggle Worked Solution Button */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSolution(idx)}
                          className="px-3 py-1.5 rounded-lg bg-surface-3 hover:bg-surface text-fg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-line"
                        >
                          {isRevealed ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Hide Worked Solution</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>Show Worked Solution</span>
                            </>
                          )}
                        </button>

                        {onAskTutor && (
                          <button
                            type="button"
                            onClick={() => {
                              onAskTutor(`How do I solve this problem from ${topicName}? "${prob.stem}"`);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-primary-soft text-primary-fg hover:bg-primary-soft/80 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Bot className="w-3.5 h-3.5" />
                            <span>Ask Tutor</span>
                          </button>
                        )}
                      </div>

                      {/* Source Citation button */}
                      {cit && (
                        <button
                          type="button"
                          onClick={() => setActiveCitation(cit as SourceCitation)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-fg hover:underline cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>
                            {cit.document_name}
                            {cit.page ? ` (p. ${cit.page})` : cit.slide ? ` (Slide ${cit.slide})` : ''}
                          </span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </button>
                      )}
                    </div>

                    {/* Collapsible Worked Solution Box */}
                    {isRevealed && (
                      <div className="p-4 rounded-xl bg-primary-soft border border-primary/30 space-y-2 text-xs text-fg animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5 text-primary-fg">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Worked Derivation & Solution:</span>
                          </span>
                          {prob.answer !== undefined && (
                            <span className="font-mono font-bold bg-surface px-2.5 py-0.5 rounded border border-line text-fg">
                              Answer: {prob.answer} {prob.unit || ''}
                            </span>
                          )}
                        </div>
                        <p className="leading-relaxed whitespace-pre-line text-fg">
                          {prob.worked_solution || 'No detailed steps provided.'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Citation Preview Modal */}
      <SourcePreviewModal
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </>
  );
}
