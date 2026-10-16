'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import {
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  BookOpen,
  ArrowRight,
  RotateCcw,
  X,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { api, UnderstandingOverview, RemediationStartData } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function UnderstandingContent() {
  const { user: _user } = useAuth();
  const searchParams = useSearchParams();
  const queryTopicId = searchParams.get('topic_id');
  const queryAction = searchParams.get('action');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UnderstandingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Remediation Modal State
  const [remediationOpen, setRemediationOpen] = useState(false);
  const [remediationLoading, setRemediationLoading] = useState(false);
  const [remediationData, setRemediationData] = useState<RemediationStartData | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [submittingRemediation, setSubmittingRemediation] = useState(false);
  const [remediationResult, setRemediationResult] = useState<any | null>(null);

  // Expanded evidence state
  const [expandedEvidence, setExpandedEvidence] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadUnderstanding();
    if (queryTopicId && queryAction === 'remediate') {
      handleStartRemediation(Number(queryTopicId));
    }
  }, [queryTopicId, queryAction]);

  const loadUnderstanding = async () => {
    setLoading(true);
    try {
      const res = await api.getUnderstanding();
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load understanding summary.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRemediation = async (topicId: number, roundNumber: number = 1) => {
    setRemediationOpen(true);
    setRemediationLoading(true);
    setRemediationResult(null);
    setUserAnswers({});
    try {
      const res = await api.startRemediation(topicId, roundNumber);
      setRemediationData(res);
    } catch (err: any) {
      alert(err.message || 'Could not launch remediation session.');
      setRemediationOpen(false);
    } finally {
      setRemediationLoading(false);
    }
  };

  const handleSubmitRemediation = async () => {
    if (!remediationData) return;
    setSubmittingRemediation(true);
    try {
      const answersList = Object.entries(userAnswers).map(([qid, ans]) => ({
        question_id: parseInt(qid),
        answer: ans
      }));
      const res = await api.submitRemediation(remediationData.session_id, answersList);
      setRemediationResult(res);
      // Reload understanding data in background to refresh scores and badges
      loadUnderstanding();
    } catch (err: any) {
      alert(err.message || 'Failed to submit remediation answers.');
    } finally {
      setSubmittingRemediation(false);
    }
  };

  const toggleEvidence = (topicId: number) => {
    setExpandedEvidence((prev) => ({
      ...prev,
      [topicId]: !prev[topicId]
    }));
  };

  const getLevelBadgeClass = (level: string) => {
    switch (level) {
      case 'Strong':
        return 'bg-success-soft text-success border-success/30';
      case 'Developing':
        return 'bg-warning-soft text-warning border-warning/30';
      case 'Weak':
        return 'bg-danger-soft text-danger border-danger/30';
      default:
        return 'bg-surface-2 text-fg-2 border-line';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Overall Summary */}
      <div className="bg-gradient-to-r from-[var(--hero-from)] to-[var(--hero-to)] rounded-3xl p-8 text-white shadow-card relative overflow-hidden">
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold uppercase tracking-wider text-white border border-white/20">
            <BrainCircuit className="w-4 h-4" />
            Learning Science & Mastery Engine
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            My Understanding
          </h1>
          <p className="text-white/85 text-sm sm:text-base leading-relaxed">
            Continuous Bayesian knowledge tracing and recency-weighted understanding metrics derived strictly from your practice answers.
          </p>

          {data && (
            <div className="pt-2">
              <div className="bg-white/10 rounded-2xl p-4 border border-white/20 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-white/90 uppercase tracking-wider">
                    Honest Synthesis (Stored Results Only)
                  </p>
                  <p className="text-sm font-medium mt-1 leading-relaxed">
                    {data.plain_summary}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Overall Score Badge */}
        {data && (
          <div className="mt-6 sm:mt-0 sm:absolute sm:top-8 sm:right-8 bg-white/10 rounded-2xl p-5 border border-white/20 text-center min-w-[180px]">
            <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">Overall Level</p>
            <div className="text-2xl font-black mt-1">
              {data.overall_level}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <div className="w-24 bg-white/20 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-white h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round(data.overall_score * 100))}%` }}
                />
              </div>
              <span className="text-xs font-bold">
                {Math.round(data.overall_score * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="py-16 text-center text-fg-3 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Calculating understanding scores from stored attempts...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-danger-soft border border-danger/30 text-danger rounded-xl text-sm">
          {error}
        </div>
      )}

      {data && !loading && (
        <div className="space-y-10">
          {/* Latest Quiz Diagnostic Suggestions */}
          {data.latest_quiz_suggestion && (
            <div className="p-6 rounded-3xl border shadow-card bg-surface border-line space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary-fg shrink-0" />
                  <h3 className="text-base font-bold text-fg">
                    Latest Quiz Diagnostic: {data.latest_quiz_suggestion.title}
                  </h3>
                </div>
                {data.latest_quiz_suggestion.mcq_score !== undefined && data.latest_quiz_suggestion.short_answer_score !== undefined && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary-soft text-primary-fg border border-primary/30 shrink-0 self-start sm:self-auto">
                    MCQ {Math.round(data.latest_quiz_suggestion.mcq_score * 100)}% · Written {Math.round(data.latest_quiz_suggestion.short_answer_score * 100)}%
                  </span>
                )}
              </div>

              <p className="text-xs text-fg-2 leading-relaxed font-medium">
                {data.latest_quiz_suggestion.diagnosis}
              </p>

              {data.latest_quiz_suggestion.suggestions?.length > 0 && (
                <ul className="space-y-1.5 text-xs text-fg-2">
                  {data.latest_quiz_suggestion.suggestions.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary-fg font-bold shrink-0">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}

              {data.latest_quiz_suggestion.missing_key_terms?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-line">
                  <span className="text-[11px] font-semibold text-fg-3">Key terms to review:</span>
                  {data.latest_quiz_suggestion.missing_key_terms.map((term, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-danger-soft text-danger text-xs font-semibold border border-danger/30">
                      {term}
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-2 flex items-center gap-3">
                <Link
                  href="/quiz"
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-xs shadow-xs transition flex items-center gap-1.5"
                >
                  <span>Launch Practice Drill</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* Top 3 Weak Concepts Panel */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-fg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  Concepts Requiring Attention (Top Weak Concepts)
                </h2>
                <p className="text-xs text-fg-3 mt-0.5">
                  Targeted misconceptions detected from quiz choices and keyword gaps. Click <strong>Learn this again</strong> to start a targeted remediation session.
                </p>
              </div>
            </div>

            {data.weak_concepts.length === 0 ? (
              <div className="p-8 border border-dashed border-success/40 bg-success-soft rounded-2xl text-center">
                <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2" />
                <h3 className="font-bold text-fg">No Weak Concepts Detected!</h3>
                <p className="text-xs text-fg-3 mt-1 max-w-md mx-auto">
                  You are performing consistently well across all assessed modules. Take an adaptive quiz to challenge yourself further.
                </p>
                <Link
                  href="/quiz"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-hover transition"
                >
                  Take Practice Quiz <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {data.weak_concepts.map((concept) => (
                  <div
                    key={concept.topic_id}
                    className="bg-surface border border-line rounded-2xl p-6 shadow-card hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getLevelBadgeClass(concept.level)}`}>
                          {concept.level} ({Math.round(concept.score * 100)}%)
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-fg">
                        {concept.concept_name}
                      </h3>

                      {/* Misconception Box */}
                      <div className="bg-warning-soft border border-warning/30 rounded-xl p-3 text-xs text-fg">
                        <span className="font-semibold block mb-0.5 text-warning">Misconception Detected:</span>
                        {concept.misconception}
                      </div>

                      {/* Evidence Dropdown */}
                      {concept.evidence && concept.evidence.length > 0 && (
                        <div className="pt-1">
                          <button
                            onClick={() => toggleEvidence(concept.topic_id)}
                            className="text-[11px] font-semibold text-primary-fg flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            {expandedEvidence[concept.topic_id] ? (
                              <>Hide Evidence ({concept.evidence.length}) <ChevronUp className="w-3.5 h-3.5" /></>
                            ) : (
                              <>Show Evidence ({concept.evidence.length} questions) <ChevronDown className="w-3.5 h-3.5" /></>
                            )}
                          </button>

                          {expandedEvidence[concept.topic_id] && (
                            <div className="mt-2 space-y-2 bg-surface-2 p-3 rounded-xl border border-line text-xs">
                              {concept.evidence.map((ev, idx) => (
                                <div key={idx} className="border-b border-line pb-2 last:border-b-0 last:pb-0">
                                  <p className="font-medium text-fg">{ev.question_text}</p>
                                  <p className="text-[11px] text-fg-3 mt-0.5">
                                    Your Answer: <span className="font-mono text-danger">{ev.student_answer}</span>
                                    {ev.score_awarded !== undefined && ` (Credit: ${ev.score_awarded})`}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Grounded Citation Excerpt */}
                      {concept.citations && concept.citations.length > 0 && (
                        <div className="text-[11px] text-fg-3 pt-1 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-primary-fg shrink-0" />
                          <span className="truncate">
                            Source: {concept.citations[0].document_name} (Page {concept.citations[0].page || concept.citations[0].slide || 1})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* CTA: Learn This Again */}
                    <div className="pt-5 mt-4 border-t border-line">
                      <button
                        onClick={() => handleStartRemediation(concept.topic_id, 1)}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Learn this again
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Topics Breakdown Table */}
          <div className="bg-surface border border-line rounded-2xl shadow-card overflow-hidden">
            <div className="p-6 border-b border-line flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-fg">
                  Concept Mastery & Trend Tracker
                </h2>
                <p className="text-xs text-fg-3 mt-0.5">
                  Detailed breakdown by course topic. Recency-weighted understanding score with historical trajectories.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 text-fg-3 uppercase tracking-wider font-semibold border-b border-line">
                  <tr>
                    <th className="py-3.5 px-6">Topic / Concept</th>
                    <th className="py-3.5 px-4">Level</th>
                    <th className="py-3.5 px-4">Understanding Score</th>
                    <th className="py-3.5 px-4">Attempts</th>
                    <th className="py-3.5 px-4">Historical Trend</th>
                    <th className="py-3.5 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.topics.map((t) => (
                    <tr key={t.topic_id} className="hover:bg-surface-2 transition">
                      <td className="py-4 px-6 font-semibold text-fg">
                        {t.topic_name}
                        {t.topic_code && <span className="text-[10px] text-fg-3 font-mono ml-2">[{t.topic_code}]</span>}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getLevelBadgeClass(t.understanding_level)}`}>
                          {t.understanding_level}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-surface-2 h-1.5 rounded-full overflow-hidden border border-line">
                            <div
                              className={`h-full rounded-full ${
                                t.understanding_score >= 0.8
                                  ? 'bg-success'
                                  : t.understanding_score >= 0.5
                                  ? 'bg-warning'
                                  : 'bg-danger'
                              }`}
                              style={{ width: `${Math.round(t.understanding_score * 100)}%` }}
                            />
                          </div>
                          <span className="font-bold text-fg">
                            {Math.round(t.understanding_score * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-fg-2 font-medium">
                        {t.total_attempts} attempts ({t.correct_attempts} correct)
                      </td>
                      <td className="py-4 px-4">
                        {t.trend === 'improving' && (
                          <span className="inline-flex items-center gap-1 text-success font-semibold text-[11px]">
                            <TrendingUp className="w-4 h-4" /> Improving
                          </span>
                        )}
                        {t.trend === 'declining' && (
                          <span className="inline-flex items-center gap-1 text-danger font-semibold text-[11px]">
                            <TrendingDown className="w-4 h-4" /> Declining
                          </span>
                        )}
                        {t.trend === 'steady' && (
                          <span className="inline-flex items-center gap-1 text-fg-3 text-[11px]">
                            <Minus className="w-4 h-4" /> Steady
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {t.understanding_level !== 'Strong' ? (
                          <button
                            onClick={() => handleStartRemediation(t.topic_id, 1)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-soft text-primary-fg font-bold rounded-lg hover:opacity-90 transition text-[11px] cursor-pointer border border-primary/30"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Learn this again
                          </button>
                        ) : (
                          <span className="text-success font-medium text-[11px] flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Mastered
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Strengths and Past Remediation Progress */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            <div className="bg-surface border border-line rounded-2xl p-6 shadow-card">
              <h3 className="font-bold text-base text-fg mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                Demonstrated Strengths
              </h3>
              <p className="text-xs text-fg-3 mb-4">
                Concepts where you have consistently scored ≥ 80% on practice and diagnostic assessments.
              </p>
              {data.strengths.length === 0 ? (
                <p className="text-xs text-fg-3 italic">No strong concepts established yet. Keep answering practice questions!</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.strengths.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-success-soft text-success border border-success/30 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-success" />
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Remediation Sessions History */}
            <div className="bg-surface border border-line rounded-2xl p-6 shadow-card">
              <h3 className="font-bold text-base text-fg mb-2 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-primary-fg" />
                Remediation Loop Progress
              </h3>
              <p className="text-xs text-fg-3 mb-4">
                Recent targeted re-teaching loops and their verification outcomes.
              </p>
              {data.remediation_sessions.length === 0 ? (
                <p className="text-xs text-fg-3 italic">No remediation sessions completed yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.remediation_sessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 bg-surface-2 border border-line rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-fg">{s.concept_name}</span>
                        <p className="text-[10px] text-fg-3">Round {s.round_number} • Score: {Math.round(s.score * 100)}%</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        s.is_improving
                          ? 'bg-success-soft text-success border-success/30'
                          : 'bg-warning-soft text-warning border-warning/30'
                      }`}>
                        {s.is_improving ? 'Improving' : s.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REMEDIATION MODAL / DRAWER */}
      {remediationOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-line w-full max-w-3xl rounded-3xl shadow-card p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary-fg">
                  Concept Remediation Loop • Round {remediationData?.round_number || 1} ({remediationData?.explanation_style?.replace('_', ' ') || 'simpler'})
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-fg mt-1">
                  Re-teaching: {remediationData?.concept_name}
                </h2>
              </div>
              <button
                onClick={() => setRemediationOpen(false)}
                className="p-2 text-fg-3 hover:text-fg rounded-full hover:bg-surface-2 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {remediationLoading && (
              <div className="py-16 text-center text-fg-3 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                <p className="text-sm font-medium">Generating patient re-explanation and checking prerequisites...</p>
              </div>
            )}

            {!remediationLoading && remediationData && (
              <div className="space-y-6">
                {/* Prerequisite Context */}
                {remediationData.weak_prerequisite && (
                  <div className="p-3 bg-primary-soft border border-primary/30 rounded-xl text-xs text-fg">
                    <strong>Prerequisite Note:</strong> This concept relies on foundations from{' '}
                    <span className="underline font-bold text-primary-fg">{remediationData.weak_prerequisite}</span>. We will bridge those foundations first.
                  </div>
                )}

                {/* Misconception Targeted */}
                <div className="p-3 bg-warning-soft border border-warning/30 rounded-xl text-xs text-fg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-warning">Addressing Detected Misconception:</strong>
                    <p className="mt-0.5">{remediationData.misconception_addressed}</p>
                  </div>
                </div>

                {/* Explanation */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-fg-3">
                    Patient Step-by-Step Re-Explanation
                  </h4>
                  <div className="p-4 bg-surface-2 rounded-2xl border border-line text-sm leading-relaxed text-fg whitespace-pre-line">
                    {remediationData.explanation_text}
                  </div>
                </div>

                {/* Worked Example */}
                {remediationData.worked_example && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-fg-3">
                      Targeted Worked Example
                    </h4>
                    <div className="p-4 bg-surface-2 rounded-2xl border border-line text-sm leading-relaxed text-fg whitespace-pre-line font-mono text-xs">
                      {remediationData.worked_example}
                    </div>
                  </div>
                )}

                {/* Check Questions Section */}
                {!remediationResult && (
                  <div className="space-y-4 pt-4 border-t border-line">
                    <h3 className="font-bold text-base text-fg flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-primary-fg" />
                      Check Your Understanding (2-3 Questions)
                    </h3>
                    <p className="text-xs text-fg-3">
                      Answer these questions to confirm mastery. Score ≥ 80% to schedule spaced review and graduate this concept.
                    </p>

                    <div className="space-y-6">
                      {remediationData.check_questions.map((q, idx) => (
                        <div key={q.id} className="p-4 bg-surface-2 border border-line rounded-2xl space-y-3">
                          <p className="text-sm font-semibold text-fg">
                            {idx + 1}. {q.question_text}
                          </p>

                          {/* Options if MCQ */}
                          {q.options && q.options.length > 0 ? (
                            <div className="space-y-2">
                              {q.options.map((opt) => (
                                <label
                                  key={opt.key}
                                  className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${
                                    userAnswers[q.id] === opt.key
                                      ? 'border-primary bg-primary-soft font-semibold text-primary-fg'
                                      : 'border-line bg-surface hover:border-line-strong'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`q_${q.id}`}
                                    value={opt.key}
                                    checked={userAnswers[q.id] === opt.key}
                                    onChange={(e) =>
                                      setUserAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                                    }
                                    className="mt-0.5 text-primary focus:ring-focus"
                                  />
                                  <span>
                                    <strong className="mr-1">{opt.key}:</strong> {opt.text}
                                  </span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="pt-1">
                              <input
                                type="text"
                                placeholder={q.question_type === 'numerical' ? 'Enter numerical value...' : 'Explain the concept...'}
                                value={userAnswers[q.id] || ''}
                                onChange={(e) =>
                                  setUserAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                                }
                                className="w-full px-3 py-2 bg-surface border border-line-strong rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-focus text-fg placeholder:text-fg-3"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button
                        onClick={handleSubmitRemediation}
                        disabled={
                          submittingRemediation ||
                          Object.keys(userAnswers).length < remediationData.check_questions.length
                        }
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        {submittingRemediation ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Submit Check Answers
                      </button>
                    </div>
                  </div>
                )}

                {/* Remediation Results View */}
                {remediationResult && (
                  <div className="space-y-4 pt-4 border-t border-line">
                    <div className={`p-4 rounded-2xl border ${
                      remediationResult.is_improving
                        ? 'bg-success-soft border-success text-fg'
                        : 'bg-warning-soft border-warning text-fg'
                    }`}>
                      <h4 className="font-bold text-sm mb-1 text-fg">
                        {remediationResult.is_improving ? 'Remediation Succeeded!' : 'Targeted Check Result'}
                      </h4>
                      <p className="text-xs leading-relaxed text-fg-2">{remediationResult.message}</p>
                    </div>

                    {/* Graded Details breakdown */}
                    {remediationResult.graded_results && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-fg-3">Question Feedback:</h4>
                        {remediationResult.graded_results.map((gr: any, idx: number) => (
                          <div key={idx} className="p-3 bg-surface-2 rounded-xl border border-line text-xs space-y-1">
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-fg">Question {idx + 1}</span>
                              <span className={gr.score >= 0.8 ? 'text-success' : gr.score >= 0.5 ? 'text-warning' : 'text-danger'}>
                                Score: {gr.score}
                              </span>
                            </div>
                            <p className="text-fg-2">{gr.feedback}</p>
                            {gr.missing_keywords && gr.missing_keywords.length > 0 && (
                              <p className="text-danger text-[11px]">Missing key ideas: {gr.missing_keywords.join(', ')}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Next Round Action or Reading Suggestions */}
                    <div className="pt-2 flex justify-end gap-3">
                      {remediationResult.status === 'needs_another_round' && (
                        <button
                          onClick={() => handleStartRemediation(remediationData.topic_id, remediationResult.next_round)}
                          className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Proceed to Round {remediationResult.next_round} ({remediationResult.next_style})
                        </button>
                      )}

                      {remediationResult.suggested_readings && remediationResult.suggested_readings.length > 0 && (
                        <div className="w-full space-y-2">
                          <h4 className="text-xs font-bold text-fg-3 uppercase">Suggested Course Readings:</h4>
                          {remediationResult.suggested_readings.map((sr: any, idx: number) => (
                            <div key={idx} className="p-3 bg-surface-2 rounded-xl text-xs text-fg border border-line">
                              <p className="font-bold">{sr.document_name} (Page {sr.page || sr.slide || 1})</p>
                              <p className="text-[11px] text-fg-3 mt-1 italic">&ldquo;{sr.excerpt}&rdquo;</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => setRemediationOpen(false)}
                        className="px-4 py-2 border border-line text-fg hover:bg-surface-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UnderstandingPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center p-12 text-fg-3">Loading understanding analysis...</div>}>
      <UnderstandingContent />
    </Suspense>
  );
}
