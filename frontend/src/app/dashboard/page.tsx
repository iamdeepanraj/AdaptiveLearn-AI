'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Brain, Sparkles, TrendingUp, AlertCircle, Clock, BookOpen, 
  ArrowRight, CheckCircle2, PlayCircle, Layers, Calendar, ChevronRight 
} from 'lucide-react';
import { api, StudentDashboardData } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { BKTBadge } from '@/components/bkt-badge';

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = () => {
    setLoading(true);
    setError(null);
    api.getStudentDashboard()
      .then((res) => setData(res))
      .catch((err) => setError(err.message || 'Failed to load dashboard metrics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, [user]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Calculating Bayesian knowledge states and review schedules...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Unable to load dashboard data</h2>
        <p className="text-sm text-slate-500">{error || 'Please make sure you are logged in.'}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={loadDashboard}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition"
          >
            Retry
          </button>
          <Link
            href="/login"
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold text-sm transition"
          >
            Sign In Again
          </Link>
        </div>
      </div>
    );
  }

  const overallMasteryPct = Math.round(data.overall_mastery * 100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-xl shadow-indigo-950/20">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-700/60 text-indigo-200 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Bayesian Knowledge Tracing Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Learner'}!
          </h1>
          <p className="text-indigo-200 text-sm max-w-xl">
            Your mastery estimates update dynamically after every assessment response and spaced review.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/quiz"
            className="px-5 py-3 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 font-semibold text-sm shadow-md transition flex items-center gap-2"
          >
            <PlayCircle className="w-4 h-4 text-indigo-600" />
            <span>Take Adaptive Quiz</span>
          </Link>
          <Link
            href="/tutor"
            className="px-5 py-3 rounded-xl bg-indigo-700/80 hover:bg-indigo-700 text-white font-semibold text-sm border border-indigo-500/50 transition flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>Ask AI Tutor</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Overall Mastery Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Overall Course Mastery</span>
            <Brain className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{overallMasteryPct}%</span>
              <span className="text-xs text-slate-400 font-medium">BKT Posterior P(L)</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${overallMasteryPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Mastered Topics Count */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Mastered Concepts</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{data.topics_mastered_count}</span>
            <p className="text-xs text-slate-400 mt-1">Modules with P(L) ≥ {(data.mastery_threshold ?? 0.85).toFixed(2)}</p>
          </div>
        </div>

        {/* Spaced Revisions Due */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Revisions Due</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{data.upcoming_revisions.length}</span>
            <p className="text-xs text-slate-400 mt-1">Spaced-repetition review queue</p>
          </div>
        </div>

        {/* Questions Answered */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Quiz Accuracy</span>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{data.overall_accuracy}%</span>
              <span className="text-xs text-slate-400 font-medium">({data.total_questions_answered} attempts)</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Across all difficulty levels</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Recommendations & Weak Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Personalized Next Actions (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prioritized Recommendations */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Recommended Next Steps</h3>
                  <p className="text-xs text-slate-500">Prerequisite-aware, targeted learning objectives</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {data.recommendations.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No active recommendations right now. Keep up the great work!</p>
              ) : (
                data.recommendations.map((rec) => (
                  <div 
                    key={rec.id} 
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-start justify-between gap-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{rec.title}</span>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          {rec.recommendation_type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{rec.reason}</p>
                    </div>

                    <Link
                      href="/quiz"
                      className="shrink-0 p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
                      title="Practice this module"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Topics Mastery Overview */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">All Course Topics</h3>
                <p className="text-xs text-slate-500">Bayesian estimates across curriculum modules</p>
              </div>
              <Link href="/courses" className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                <span>View Prerequisite Map</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...data.weak_topics, ...data.strong_topics].map((topic) => (
                <div key={topic.topic_id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{topic.topic_name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {topic.total_attempts} attempts • {topic.accuracy}% accuracy
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <BKTBadge pMastery={topic.p_mastery} state={topic.mastery_state} size="sm" />
                    <Link
                      href={`/quiz?topic_id=${topic.topic_id}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition"
                    >
                      Quiz
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Spaced Repetition Queue & Weak Topics */}
        <div className="space-y-6">
          {/* Spaced Review Due Queue */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Spaced Repetition</h3>
                <p className="text-xs text-slate-500">Scheduled to prevent memory decay</p>
              </div>
            </div>

            {data.upcoming_revisions.length === 0 ? (
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">All caught up!</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">No reviews due today. Check back tomorrow.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.upcoming_revisions.map((rev) => (
                  <div key={rev.topic_id} className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{rev.topic_name}</p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Due for review today</p>
                    </div>
                    <Link
                      href={`/quiz?topic_id=${rev.topic_id}`}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition"
                    >
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="p-6 rounded-3xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Learning Shortcuts</h4>
            <div className="space-y-2">
              <Link
                href="/tutor"
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50/50 dark:hover:bg-slate-700/60 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 transition"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>Ask questions on textbook chapters</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                href="/upload"
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50/50 dark:hover:bg-slate-700/60 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 transition"
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Upload lecture slides or PDF notes</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                href="/analytics"
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50/50 dark:hover:bg-slate-700/60 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 transition"
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Inspect BKT learning curve history</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
