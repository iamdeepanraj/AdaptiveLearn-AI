'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Sparkles, BookOpen, Brain, CheckCircle2, 
  ArrowRight, FileText, BarChart2 
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LandingPage() {
  const { switchDemoRole } = useAuth();

  return (
    <div className="flex-1 flex flex-col bg-bg text-fg">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-line bg-gradient-to-b from-surface via-surface-2 to-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-soft border border-primary/30 text-primary-fg text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Gen Source-Grounded Learning Companion</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-fg tracking-tight leading-[1.15]">
              Master Complex Concepts with{' '}
              <span className="text-primary-fg">
                Adaptive AI Grounding
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-fg-2 leading-relaxed font-normal">
              Convert your textbooks, lecture slides, and videos into an interactive knowledge base. Experience true source-grounded tutoring, Bayesian Knowledge Tracing, and personalized adaptive assessments.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
              <button
                onClick={() => switchDemoRole('student')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-sm shadow-xs transition flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Launch Student Workspace</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>

              <button
                onClick={() => switchDemoRole('teacher')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-surface hover:bg-surface-2 text-fg font-semibold text-sm border border-line shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Explore Teacher Dashboard</span>
              </button>
            </div>

            {/* Quick Guarantees */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-fg-3 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>100% Verified Citations (Zero Hallucinated Pages)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary-fg" />
                <span>Interpretable Bayesian Knowledge Tracing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary-fg" />
                <span>Honest Abstention on Missing Evidence</span>
              </div>
            </div>
          </div>

          {/* Interactive Feature Showcase Card */}
          <div className="mt-14 max-w-5xl mx-auto rounded-2xl bg-surface border border-line shadow-card p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-danger" />
                <span className="w-3 h-3 rounded-full bg-warning" />
                <span className="w-3 h-3 rounded-full bg-success" />
                <span className="text-xs font-semibold text-fg-3 ml-2">Live AI Tutor Preview • CS101 Machine Learning</span>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-soft text-primary-fg border border-primary/30">
                P(L) = 0.72 (Proficient)
              </span>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-surface-2 border border-line text-fg text-sm max-w-xl">
                <p className="font-medium text-fg-3 text-xs mb-1">Student Question:</p>
                What is the primary objective of Gradient Descent in neural network optimization?
              </div>

              <div className="p-5 rounded-xl bg-primary-soft border border-primary/30 text-fg text-sm space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary-fg uppercase tracking-wider">
                    AdaptiveLearn Tutor
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-success-soft text-success border border-success/30 font-semibold">
                    Source Grounded
                  </span>
                </div>
                <p className="leading-relaxed">
                  Based directly on <strong>Neural_Networks_Fundamentals.pdf (Page 3)</strong>, the primary objective of Gradient Descent is to minimize the empirical risk loss function by iteratively updating model parameters in the direction opposite to the gradient.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-fg-3">Verified Evidence:</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-line text-xs font-medium text-primary-fg shadow-xs">
                    <FileText className="w-3.5 h-3.5 text-primary-fg" />
                    Neural_Networks_Fundamentals.pdf • Page 3
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars Grid */}
      <section className="py-20 bg-surface border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl font-bold text-fg tracking-tight">
              An End-to-End Educational Intelligence System
            </h2>
            <p className="text-fg-2 text-base">
              Engineered with rigorous retrieval metrics, mathematical learner models, and multimodal parsing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-line bg-surface-2 space-y-4 hover:border-line-strong transition">
              <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary-fg flex items-center justify-center font-bold">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-fg">
                Multimodal Source Grounding
              </h3>
              <p className="text-fg-2 text-sm leading-relaxed">
                PyMuPDF for page-exact PDFs, python-pptx for slide numbers and notes, and audio timestamp alignment. Every answer links to verified coordinates.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl border border-line bg-surface-2 space-y-4 hover:border-line-strong transition">
              <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary-fg flex items-center justify-center font-bold">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-fg">
                Bayesian Knowledge Tracing (BKT)
              </h3>
              <p className="text-fg-2 text-sm leading-relaxed">
                Maintains calibrated probabilities of topic mastery using prior P(L₀), transition P(T), slip P(S), and guess P(G) updates with SuperMemo spaced repetition.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-line bg-surface-2 space-y-4 hover:border-line-strong transition">
              <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary-fg flex items-center justify-center font-bold">
                <BarChart2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-fg">
                Teacher Diagnostics & Misconceptions
              </h3>
              <p className="text-fg-2 text-sm leading-relaxed">
                Instructors view aggregate cohort struggle percentages, identify common conceptual misconceptions, and review individual student mastery trajectories.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-line bg-surface py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-fg-3">
          <p>© 2026 AdaptiveLearn AI. Designed for academic rigor, transparent citations, and adaptive mastery.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-primary-fg transition">Sign In</Link>
            <Link href="/register" className="hover:text-primary-fg transition">Register</Link>
            <Link href="/dashboard" className="hover:text-primary-fg transition">Student View</Link>
            <Link href="/courses" className="hover:text-primary-fg transition">Courses</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
