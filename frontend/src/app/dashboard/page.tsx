'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Brain, Sparkles, TrendingUp, AlertCircle, Clock, BookOpen, 
  ArrowRight, CheckCircle2, PlayCircle, Layers, ChevronRight 
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
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-fg-3 gap-3">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Calculating Bayesian knowledge states and review schedules...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-surface border border-line shadow-card text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-danger-soft text-danger flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-fg">Unable to load dashboard data</h2>
        <p className="text-sm text-fg-3">{error || 'Please make sure you are logged in.'}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={loadDashboard}
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-sm transition cursor-pointer"
          >
            Retry
          </button>
          <Link
            href="/login"
            className="px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-fg font-semibold text-sm transition border border-line"
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
      {/* Hero Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[var(--hero-from)] to-[var(--hero-to)] text-white shadow-card">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-warning" />
            <span>Bayesian Knowledge Tracing Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Learner'}!
          </h1>
          <p className="text-white/85 text-sm max-w-xl">
            Your mastery estimates update dynamically after every assessment response and spaced review.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/quiz"
            className="px-5 py-3 rounded-xl bg-white text-primary hover:bg-white/90 font-semibold text-sm shadow-sm transition flex items-center gap-2"
          >
            <PlayCircle className="w-4 h-4 text-primary" />
            <span>Take Adaptive Quiz</span>
          </Link>
          <Link
            href="/tutor"
            className="px-5 py-3 rounded-xl bg-transparent border border-white text-white hover:bg-white/10 font-semibold text-sm transition flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>Ask AI Tutor</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Overall Mastery Card */}
        <div className="p-6 rounded-2xl bg-surface border border-line shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-fg-3 mb-2">
            <span className="text-xs font-semibold">Overall course mastery</span>
            <Brain className="w-5 h-5 text-primary-fg" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-fg">{overallMasteryPct}%</span>
              <span className="text-xs text-fg-3 font-medium">BKT Posterior P(L)</span>
            </div>
            <div className="w-full bg-surface-2 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-500" 
                style={{ width: `${overallMasteryPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Mastered Concepts */}
        <div className="p-6 rounded-2xl bg-surface border border-line shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-fg-3 mb-2">
            <span className="text-xs font-semibold">Mastered concepts</span>
            <CheckCircle2 className="w-5 h-5 text-success" />
          </div>
          <div>
            <span className="text-3xl font-extrabold text-fg">{data.topics_mastered_count}</span>
            <p className="text-xs text-fg-3 mt-1">Modules with P(L) ≥ {(data.mastery_threshold ?? 0.85).toFixed(2)}</p>
          </div>
        </div>

        {/* Spaced Revisions Due */}
        <div className="p-6 rounded-2xl bg-surface border border-line shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-fg-3 mb-2">
            <span className="text-xs font-semibold">Revisions due</span>
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div>
            <span className="text-3xl font-extrabold text-fg">{data.upcoming_revisions.length}</span>
            <p className="text-xs text-fg-3 mt-1">Spaced-repetition review queue</p>
          </div>
        </div>

        {/* Quiz Accuracy */}
        <div className="p-6 rounded-2xl bg-surface border border-line shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-fg-3 mb-2">
            <span className="text-xs font-semibold">Quiz accuracy</span>
            <TrendingUp className="w-5 h-5 text-primary-fg" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-fg">{data.overall_accuracy}%</span>
              <span className="text-xs text-fg-3 font-medium">({data.total_questions_answered} attempts)</span>
            </div>
            <p className="text-xs text-fg-3 mt-1">Across all difficulty levels</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Recommendations & Weak Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Personalized Next Actions (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prioritized Recommendations */}
          <div className="p-6 rounded-3xl bg-surface border border-line shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary-soft text-primary-fg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-fg">Recommended Next Steps</h3>
                  <p className="text-xs text-fg-3">Prerequisite-aware, targeted learning objectives</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {data.recommendations.length === 0 ? (
                <p className="text-xs text-fg-3 py-4 text-center">No active recommendations right now. Keep up the great work!</p>
              ) : (
                data.recommendations.map((rec) => (
                  <div 
                    key={rec.id} 
                    className="p-4 rounded-2xl bg-surface-2 border border-line flex items-start justify-between gap-4 hover:border-line-strong transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-fg">{rec.title}</span>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-primary-soft text-primary-fg">
                          {rec.recommendation_type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-fg-2 leading-relaxed">{rec.reason}</p>
                    </div>

                    <Link
                      href="/quiz"
                      className="shrink-0 p-2 rounded-xl bg-primary hover:bg-primary-hover text-white shadow-xs transition"
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
          <div className="p-6 rounded-3xl bg-surface border border-line shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-fg">All Course Topics</h3>
                <p className="text-xs text-fg-3">Bayesian estimates across curriculum modules</p>
              </div>
              <Link href="/courses" className="text-xs font-semibold text-primary-fg hover:underline flex items-center gap-1">
                <span>View Prerequisite Map</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-line">
              {[...data.weak_topics, ...data.strong_topics].map((topic) => (
                <div key={topic.topic_id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-fg">{topic.topic_name}</h4>
                    <p className="text-xs text-fg-3 mt-0.5">
                      {topic.total_attempts} attempts • {topic.accuracy}% accuracy
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <BKTBadge pMastery={topic.p_mastery} state={topic.mastery_state} size="sm" />
                    <Link
                      href={`/quiz?topic_id=${topic.topic_id}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-2 hover:bg-surface-3 text-fg transition border border-line"
                    >
                      Quiz
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Spaced Repetition Queue & Learning Shortcuts */}
        <div className="space-y-6">
          {/* Spaced Review Due Queue */}
          <div className="p-6 rounded-3xl bg-surface border border-line shadow-card space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-warning-soft text-warning">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-fg">Spaced Repetition</h3>
                <p className="text-xs text-fg-3">Scheduled to prevent memory decay</p>
              </div>
            </div>

            {data.upcoming_revisions.length === 0 ? (
              <div className="p-4 rounded-2xl bg-success-soft border border-success/30 text-center">
                <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-success">All caught up!</p>
                <p className="text-[11px] text-fg-3 mt-0.5">No reviews due today. Check back tomorrow.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.upcoming_revisions.map((rev) => (
                  <div key={rev.topic_id} className="p-3.5 rounded-xl bg-warning-soft border border-warning/30 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-fg line-clamp-2">{rev.topic_name}</p>
                      <p className="text-[10px] text-warning font-semibold">Due for review today</p>
                    </div>
                    <Link
                      href={`/quiz?topic_id=${rev.topic_id}`}
                      className="px-3 py-1 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold shrink-0 transition"
                    >
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="p-6 rounded-3xl bg-surface border border-line shadow-card space-y-3">
            <h4 className="text-xs font-bold text-fg-2">Learning shortcuts</h4>
            <div className="space-y-2">
              <Link
                href="/tutor"
                className="w-full p-3 rounded-xl bg-surface hover:bg-surface-3 border border-line flex items-center justify-between text-xs font-semibold text-fg transition"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-primary-fg" />
                  <span>Ask questions on textbook chapters</span>
                </div>
                <ChevronRight className="w-4 h-4 text-fg-3" />
              </Link>

              <Link
                href="/upload"
                className="w-full p-3 rounded-xl bg-surface hover:bg-surface-3 border border-line flex items-center justify-between text-xs font-semibold text-fg transition"
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-primary-fg" />
                  <span>Upload lecture slides or PDF notes</span>
                </div>
                <ChevronRight className="w-4 h-4 text-fg-3" />
              </Link>

              <Link
                href="/analytics"
                className="w-full p-3 rounded-xl bg-surface hover:bg-surface-3 border border-line flex items-center justify-between text-xs font-semibold text-fg transition"
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span>Inspect BKT learning curve history</span>
                </div>
                <ChevronRight className="w-4 h-4 text-fg-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
