'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Sparkles, BookOpen, Brain, Award, ShieldCheck, CheckCircle2, 
  ArrowRight, FileText, Presentation, Video, Layers, Compass, BarChart2 
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LandingPage() {
  const { user, switchDemoRole } = useAuth();

  return (
    <div className="flex-1 flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-b from-white via-indigo-50/30 to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Gen Source-Grounded Learning Companion</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight leading-[1.15]">
              Master Complex Concepts with{' '}
              <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-800 bg-clip-text text-transparent">
                Adaptive AI Grounding
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              Convert your textbooks, lecture slides, and videos into an interactive knowledge base. Experience true source-grounded tutoring, Bayesian Knowledge Tracing, and personalized adaptive assessments.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
              <button
                onClick={() => switchDemoRole('student')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Launch Student Workspace</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>

              <button
                onClick={() => switchDemoRole('teacher')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm border border-slate-200 dark:border-slate-700 shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Explore Teacher Dashboard</span>
              </button>
            </div>

            {/* Quick Guarantees */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>100% Verified Citations (Zero Hallucinated Pages)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                <span>Interpretable Bayesian Knowledge Tracing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                <span>Honest Abstention on Missing Evidence</span>
              </div>
            </div>
          </div>

          {/* Interactive Feature Showcase Card */}
          <div className="mt-14 max-w-5xl mx-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-slate-500 ml-2">Live AI Tutor Preview • CS101 Machine Learning</span>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                P(L) = 0.72 (Proficient)
              </span>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 text-sm max-w-xl">
                <p className="font-medium text-slate-500 text-xs mb-1">Student Question:</p>
                What is the primary objective of Gradient Descent in neural network optimization?
              </div>

              <div className="p-5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-slate-800 dark:text-slate-200 text-sm space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    AdaptiveLearn Tutor
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-semibold">
                    Source Grounded
                  </span>
                </div>
                <p>
                  Based directly on <strong>Neural_Networks_Fundamentals.pdf (Page 3)</strong>, the primary objective of Gradient Descent is to minimize the empirical risk loss function by iteratively updating model parameters in the direction opposite to the gradient.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500">Verified Evidence:</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-xs font-medium text-indigo-700 dark:text-indigo-300 shadow-2xs">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    Neural_Networks_Fundamentals.pdf • Page 3
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars Grid */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              An End-to-End Educational Intelligence System
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base">
              Engineered with rigorous retrieval metrics, mathematical learner models, and multimodal parsing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4 hover:border-indigo-200 dark:hover:border-indigo-800 transition">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Multimodal Source Grounding
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                PyMuPDF for page-exact PDFs, python-pptx for slide numbers and notes, and audio timestamp alignment. Every answer links to verified coordinates.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4 hover:border-indigo-200 dark:hover:border-indigo-800 transition">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Bayesian Knowledge Tracing (BKT)
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Maintains calibrated probabilities of topic mastery using prior $P(L_0)$, transition $P(T)$, slip $P(S)$, and guess $P(G)$ updates with SuperMemo spaced repetition.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4 hover:border-indigo-200 dark:hover:border-indigo-800 transition">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <BarChart2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Teacher Diagnostics & Misconceptions
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Instructors view aggregate cohort struggle percentages, identify common conceptual misconceptions, and review individual student mastery trajectories.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 AdaptiveLearn AI. Designed for academic rigor, transparent citations, and adaptive mastery.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-indigo-600 transition">Sign In</Link>
            <Link href="/register" className="hover:text-indigo-600 transition">Register</Link>
            <Link href="/dashboard" className="hover:text-indigo-600 transition">Student View</Link>
            <Link href="/teacher" className="hover:text-indigo-600 transition">Teacher Hub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
