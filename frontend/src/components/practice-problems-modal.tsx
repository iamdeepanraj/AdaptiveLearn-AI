'use client';

import React, { useEffect, useState } from 'react';
import { 
  Calculator, X, Sparkles, FileText, ExternalLink, ChevronDown, 
  ChevronUp, Bot, HelpCircle, CheckCircle2, Hash 
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
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            Easy • Direct Substitution
          </span>
        );
      case 'medium':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            Medium • Formula Rearrangement
          </span>
        );
      case 'hard':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
            Hard • Multi-Formula Synthesis
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            {difficulty}
          </span>
        );
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[88vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
                  Suggested Practice Problems
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Topic: <strong className="text-indigo-600 dark:text-indigo-400">{topicName}</strong> • Grounded in Course Material
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs">Extracting formulas and analyzing quantitative problems...</p>
              </div>
            ) : error ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {error}
              </div>
            ) : problems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
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
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 shadow-xs space-y-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                        {getDifficultyBadge(prob.difficulty)}
                      </div>
                      {prob.expression && (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {prob.expression}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                      {prob.stem}
                    </p>

                    {prob.params && Object.keys(prob.params).length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-3">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Given values:</span>
                        {Object.entries(prob.params).map(([k, v]) => (
                          <span key={k} className="font-mono">
                            {k} = {String(v)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Toggle Worked Solution Button */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSolution(idx)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
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
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
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
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
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
                      <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-2 text-xs text-indigo-950 dark:text-indigo-200 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Worked Derivation & Solution:</span>
                          </span>
                          {prob.answer !== undefined && (
                            <span className="font-mono font-bold bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200">
                              Answer: {prob.answer} {prob.unit || ''}
                            </span>
                          )}
                        </div>
                        <p className="leading-relaxed whitespace-pre-line">
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
