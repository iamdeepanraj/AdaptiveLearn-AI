'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  Award, CheckCircle2, AlertTriangle, ArrowRight, BookOpen, 
  PlayCircle, Sparkles, TrendingUp, RefreshCw, Layers 
} from 'lucide-react';
import { api, AssessmentReport } from '@/lib/api';
import { BKTBadge } from '@/components/bkt-badge';

function AssessmentResultContent() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Number(params?.id || 0);

  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    api.getAssessmentReport(sessionId)
      .then((res) => setReport(res))
      .catch((err) => setError(err.message || 'Failed to generate assessment report'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Synthesizing topic diagnostic report and misconceptions...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-center">
          <p className="font-semibold mb-1">Assessment Report Error</p>
          <p className="text-xs">{error || 'Report not found'}</p>
          <Link href="/quiz" className="mt-4 inline-block px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold">
            Return to Quizzes
          </Link>
        </div>
      </div>
    );
  }

  const isPassed = report.score_percentage >= 70;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Score Header Card */}
      <div className={`p-8 rounded-3xl border shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 ${
        isPassed
          ? 'bg-gradient-to-tr from-emerald-900 to-indigo-900 text-white border-emerald-800/50'
          : 'bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 text-white border-slate-800'
      }`}>
        <div className="space-y-2 text-center sm:text-left">
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 text-indigo-200">
            Assessment Results Summary
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {report.course_title}
          </h1>
          <p className="text-xs text-indigo-200">
            Completed on {new Date(report.completed_at).toLocaleDateString()} • {report.total_questions} Questions Evaluated
          </p>
        </div>

        <div className="text-center p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shrink-0">
          <span className="text-4xl sm:text-5xl font-black block tracking-tight">
            {report.score_percentage}%
          </span>
          <span className="text-xs text-indigo-200 mt-1 block">
            {report.correct_count} of {report.total_questions} Correct
          </span>
        </div>
      </div>

      {/* Topic-Level Breakdown */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Topic-Level Diagnostic Breakdown</h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {report.topic_breakdowns.map((tb) => (
            <div key={tb.topic_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{tb.topic_name}</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {tb.questions_correct} of {tb.questions_attempted} correct ({tb.accuracy_percentage}%)
                </p>
              </div>

              <div className="flex items-center gap-3">
                <BKTBadge pMastery={tb.p_mastery} state={tb.mastery_state} size="sm" />
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                  tb.status === 'strength'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : tb.status === 'weak'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                }`}>
                  {tb.status}
                </span>
                {tb.status !== 'strength' && (
                  <Link
                    href={`/understanding?topic_id=${tb.topic_id}&action=remediate`}
                    className="px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Learn this again</span>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Misconceptions & Strengths Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identified Misconceptions */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Identified Misconceptions</h3>
          </div>
          {report.identified_misconceptions.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">No misconceptions detected! Clean response accuracy.</p>
          ) : (
            <div className="space-y-2">
              {report.identified_misconceptions.map((m, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 text-xs text-rose-800 dark:text-rose-300">
                  {m}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Strengths */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Demonstrated Strengths</h3>
          </div>
          <div className="space-y-2">
            {report.strengths.map((s, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 text-xs text-emerald-800 dark:text-emerald-300">
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommended Next Actions */}
      <div className="p-6 rounded-3xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 space-y-3">
        <h3 className="font-bold text-sm text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>Recommended Learning Trajectory</span>
        </h3>
        <ul className="space-y-2 text-xs text-indigo-950 dark:text-indigo-200">
          {report.recommended_next_steps.map((step, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <span>{step}</span>
            </li>
          ))}
        </ul>

        <div className="pt-3 flex flex-wrap items-center gap-3">
          <Link
            href="/understanding"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open "My Understanding" Dashboard</span>
          </Link>
          <Link
            href="/quiz"
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition flex items-center gap-2"
          >
            <PlayCircle className="w-4 h-4 text-indigo-600" />
            <span>Practice Another Drill</span>
          </Link>
          <Link
            href="/tutor"
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Review with AI Tutor</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AssessmentResultPage() {
  return (
    <React.Suspense fallback={<div className="flex-1 flex items-center justify-center p-12 text-slate-400">Loading assessment report...</div>}>
      <AssessmentResultContent />
    </React.Suspense>
  );
}
