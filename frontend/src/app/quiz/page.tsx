'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  PlayCircle, CheckCircle2, XCircle, AlertTriangle, Sparkles, ArrowRight, 
  HelpCircle, Award, FileText, ExternalLink, RefreshCw, BookOpen, RotateCcw,
  Check, ListFilter, Hash, MessageSquare, Layers, Clock
} from 'lucide-react';
import { api, Course, Topic, QuizSession, QuizResponseResult, SourceCitation } from '@/lib/api';
import { BKTBadge } from '@/components/bkt-badge';
import { SourcePreviewModal } from '@/components/source-preview-modal';

function QuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryCourseId = searchParams.get('course_id');
  const queryTopicId = searchParams.get('topic_id');

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number>(1);
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>(['mcq', 'short_answer', 'numerical']);
  const [difficultyMode, setDifficultyMode] = useState<string>('adaptive');
  const [questionCount, setQuestionCount] = useState<number>(5);
  
  // Active session state
  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeFeedback, setActiveFeedback] = useState<QuizResponseResult | null>(null);
  const [activeCitation, setActiveCitation] = useState<SourceCitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Cumulative results tracking for instant end-of-quiz dashboard
  const [answersHistory, setAnswersHistory] = useState<{
    question_id: number;
    question_text: string;
    question_type: string;
    topic_name: string;
    score_awarded: number;
    is_correct: boolean;
    feedback: string;
    topic_id?: number;
  }[]>([]);
  const [quizFinished, setQuizFinished] = useState<boolean>(false);

  useEffect(() => {
    api.getCourses().then((cList) => {
      setCourses(cList);
      if (queryCourseId) {
        const cId = Number(queryCourseId);
        setSelectedCourseId(cId);
        const currentCourse = cList.find((c) => c.id === cId);
        if (currentCourse && queryTopicId) {
          setSelectedTopicIds([Number(queryTopicId)]);
        } else if (currentCourse && currentCourse.topics) {
          setSelectedTopicIds(currentCourse.topics.map((t) => t.id));
        }
      } else if (cList.length > 0) {
        setSelectedCourseId(cList[0].id);
        if (cList[0].topics) {
          setSelectedTopicIds(cList[0].topics.map((t) => t.id));
        }
      }
    });
  }, [queryCourseId, queryTopicId]);

  // Update topic choices when selected course changes
  const handleCourseChange = (courseId: number) => {
    setSelectedCourseId(courseId);
    const crs = courses.find((c) => c.id === courseId);
    if (crs && crs.topics) {
      setSelectedTopicIds(crs.topics.map((t) => t.id));
    } else {
      setSelectedTopicIds([]);
    }
  };

  const toggleTopic = (tId: number) => {
    setSelectedTopicIds((prev) => 
      prev.includes(tId) ? prev.filter((id) => id !== tId) : [...prev, tId]
    );
  };

  const toggleQuestionType = (typeKey: string) => {
    setSelectedQuestionTypes((prev) => {
      if (prev.includes(typeKey)) {
        if (prev.length === 1) return prev; // Keep at least one type
        return prev.filter((t) => t !== typeKey);
      } else {
        return [...prev, typeKey];
      }
    });
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const currentTopics = selectedCourse?.topics || [];

  const handleStartQuiz = async () => {
    setError(null);
    setLoading(true);
    setActiveFeedback(null);
    setCurrentIdx(0);
    setUserAnswer('');
    setAnswersHistory([]);
    setQuizFinished(false);

    try {
      const topicIds = selectedTopicIds.length > 0 ? selectedTopicIds : undefined;
      const newSession = await api.startQuiz({
        course_id: selectedCourseId,
        topic_ids: topicIds,
        question_types: selectedQuestionTypes,
        difficulty_mode: difficultyMode,
        question_count: questionCount
      });
      setSession(newSession);
    } catch (err: any) {
      setError(err.message || 'Failed to start quiz session');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!session || !userAnswer.trim() || isSubmitting) return;

    const currentQuestion = session.questions[currentIdx];
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await api.submitQuizAnswer({
        quiz_session_id: session.id,
        question_id: currentQuestion.id,
        answer: userAnswer.trim(),
        response_time_sec: 15.0,
        confidence_level: 'high'
      });
      setActiveFeedback(result);
      setAnswersHistory((prev) => [
        ...prev,
        {
          question_id: currentQuestion.id,
          question_text: currentQuestion.question_text,
          question_type: currentQuestion.question_type,
          topic_name: currentQuestion.topic_name,
          score_awarded: result.score_awarded,
          is_correct: result.is_correct,
          feedback: result.feedback,
          topic_id: result.topic_id
        }
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to submit response');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextQuestion = () => {
    if (!session) return;
    setActiveFeedback(null);
    setUserAnswer('');

    if (currentIdx + 1 < session.questions.length) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      // Finished all questions - finalize and show results
      api.finishQuiz(session.id).catch(() => {});
      setQuizFinished(true);
    }
  };

  const currentQ = session?.questions[currentIdx];

  // Helper for short answer score pill
  const getShortAnswerBadge = (score: number) => {
    if (score >= 0.8) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          Correct (Score: {Math.round(score * 100)}%)
        </span>
      );
    } else if (score >= 0.5) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          Partially Correct (Score: {Math.round(score * 100)}%)
        </span>
      );
    } else {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
          Incorrect (Score: {Math.round(score * 100)}%)
        </span>
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Quiz Builder Screen (when no active quiz and not finished) */}
      {!session && !quizFinished && (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 mb-2">
              <PlayCircle className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Adaptive Practice & Diagnostic Drills
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              Design a custom drill from your uploaded materials. Each response is graded with precision (graded options, keyword matching, safe expression checks) and updates your Bayesian Knowledge Tracing profile.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6 max-w-2xl mx-auto">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 font-medium text-center">
                {error}
              </div>
            )}

            {/* Course Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Course Material
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => handleCourseChange(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-medium"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}: {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Topic Selection */}
            {currentTopics.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Target Topics
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedTopicIds.length === currentTopics.length) {
                        setSelectedTopicIds([]);
                      } else {
                        setSelectedTopicIds(currentTopics.map((t) => t.id));
                      }
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
                  >
                    {selectedTopicIds.length === currentTopics.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {currentTopics.map((topic) => {
                    const isChecked = selectedTopicIds.includes(topic.id);
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => toggleTopic(topic.id)}
                        className={`p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                          isChecked
                            ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-medium'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="text-xs truncate">{topic.name}</span>
                        {isChecked && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Question Types */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Assessment Types
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    id: 'mcq',
                    label: 'Graded MCQ',
                    desc: '1 correct, 1 partial, 2 wrong distractors',
                    icon: ListFilter
                  },
                  {
                    id: 'short_answer',
                    label: 'Keyword Short Answer',
                    desc: 'Key concept weights & paraphrases',
                    icon: MessageSquare
                  },
                  {
                    id: 'numerical',
                    label: 'Numerical Problem',
                    desc: 'Direct formulas & safe AST check',
                    icon: Hash
                  }
                ].map((qt) => {
                  const Icon = qt.icon;
                  const isSelected = selectedQuestionTypes.includes(qt.id);
                  return (
                    <button
                      key={qt.id}
                      type="button"
                      onClick={() => toggleQuestionType(qt.id)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 shadow-2xs'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                      <span className="text-xs font-bold block">{qt.label}</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{qt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Difficulty Calibration Mode */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Difficulty Calibration Mode
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'adaptive', label: 'Adaptive', desc: 'Auto-calibrates via BKT' },
                  { id: 'easy', label: 'Foundational', desc: 'Concept checks & substitutions' },
                  { id: 'medium', label: 'Standard', desc: 'Theoretical & two-step' },
                  { id: 'hard', label: 'Rigorous', desc: 'Multi-formula & deep synthesis' }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setDifficultyMode(mode.id)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      difficultyMode === mode.id
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-bold block">{mode.label}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{mode.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Questions per Session
              </label>
              <div className="flex items-center gap-2">
                {[3, 5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuestionCount(n)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      questionCount === n
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {n} Questions
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleStartQuiz}
              disabled={loading || selectedQuestionTypes.length === 0}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Begin Adaptive Assessment</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 2. Active Question Runner (one question at a time with instant feedback) */}
      {session && !quizFinished && (
        <div className="space-y-6">
          {/* Progress Bar & Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Question {currentIdx + 1} of {session.total_questions}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {currentQ?.topic_name}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 uppercase">
                {currentQ?.question_type.replace('_', ' ')}
              </span>
            </div>

            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 uppercase">
              {currentQ?.difficulty}
            </span>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentIdx + 1) / session.total_questions) * 100}%` }}
            />
          </div>

          {/* Question Card */}
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
              {currentQ?.question_text}
            </h2>

            {/* Answer Form by Type */}
            {currentQ?.question_type === 'mcq' && currentQ.options ? (
              <div className="space-y-3">
                {currentQ.options.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={activeFeedback !== null}
                    onClick={() => setUserAnswer(opt.key)}
                    className={`w-full p-4 rounded-2xl border text-left transition flex items-center gap-3.5 cursor-pointer ${
                      userAnswer === opt.key
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      userAnswer === opt.key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {opt.key}
                    </span>
                    <span className="text-sm leading-relaxed">{opt.text}</span>
                  </button>
                ))}
              </div>
            ) : currentQ?.question_type === 'numerical' ? (
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Enter Calculated Result (Deterministic AST tolerance verification):
                </label>
                <input
                  type="text"
                  disabled={activeFeedback !== null}
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="e.g. 0.0225"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400">
                  Tip: Round to standard decimal places if needed. Units are evaluated automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Short Answer Explanation (Evaluated against model answer keywords & paraphrase semantics):
                </label>
                <textarea
                  rows={4}
                  disabled={activeFeedback !== null}
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Explain the concept using your own words, referencing key mechanisms..."
                  className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Submit Button */}
            {!activeFeedback ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={!userAnswer.trim() || isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Submit Answer for Instant Grading</span>
                )}
              </button>
            ) : null}

            {/* Detailed Instant Pedagogical Feedback Card */}
            {activeFeedback && (
              <div className={`p-6 rounded-2xl border space-y-5 animate-in fade-in duration-300 ${
                activeFeedback.score_awarded >= 0.8
                  ? 'bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900'
                  : activeFeedback.score_awarded >= 0.5
                  ? 'bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900'
                  : 'bg-rose-50/60 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900'
              }`}>
                {/* Header status line */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {activeFeedback.score_awarded >= 0.8 ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : activeFeedback.score_awarded >= 0.5 ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    )}

                    <div>
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {currentQ?.question_type === 'mcq' ? (
                          activeFeedback.option_label === 'correct' ? 'Fully Correct (Score: 1.0)' :
                          activeFeedback.option_label === 'partial' ? 'Partially Correct (Score: 0.5)' :
                          'Incorrect (Score: 0.0)'
                        ) : currentQ?.question_type === 'short_answer' ? (
                          getShortAnswerBadge(activeFeedback.score_awarded)
                        ) : (
                          activeFeedback.is_correct ? 'Correct Numerical Calculation!' : 'Calculation Discrepancy'
                        )}
                      </span>
                    </div>
                  </div>

                  {/* BKT Mastery Delta Pill */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">BKT Update:</span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                      activeFeedback.mastery_delta >= 0
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                    }`}>
                      {activeFeedback.mastery_delta >= 0 ? '+' : ''}
                      {Math.round(activeFeedback.mastery_delta * 100)}% → {Math.round(activeFeedback.p_mastery_after * 100)}%
                    </span>
                    {activeFeedback.understanding_level && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        Level: {activeFeedback.understanding_level}
                      </span>
                    )}
                  </div>
                </div>

                {/* Explanation text */}
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {activeFeedback.feedback}
                </p>

                {/* Graded MCQ Specifics: Missing Detail or Misconception */}
                {activeFeedback.option_label === 'partial' && activeFeedback.missing_detail && (
                  <div className="p-3.5 rounded-xl bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300/60 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Missing Critical Nuance:</span>
                    </p>
                    <p>{activeFeedback.missing_detail}</p>
                  </div>
                )}

                {activeFeedback.option_label === 'wrong' && activeFeedback.misconception_tag && (
                  <div className="p-3.5 rounded-xl bg-rose-100/70 dark:bg-rose-950/40 border border-rose-300/60 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Identified Conceptual Misconception:</span>
                    </p>
                    <p>{activeFeedback.misconception_tag}</p>
                  </div>
                )}

                {/* Short Answer Keyword Coverage Breakdown */}
                {currentQ?.question_type === 'short_answer' && (activeFeedback.covered_keywords || activeFeedback.missing_keywords) && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Keyword & Concept Analysis:
                    </p>
                    {activeFeedback.covered_keywords && activeFeedback.covered_keywords.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-medium text-slate-500">Covered Ideas:</span>
                        {activeFeedback.covered_keywords.map((kw, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 text-xs font-semibold">
                            ✓ {kw}
                          </span>
                        ))}
                      </div>
                    )}
                    {activeFeedback.missing_keywords && activeFeedback.missing_keywords.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-medium text-slate-500">Missing Ideas:</span>
                        {activeFeedback.missing_keywords.map((kw, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 text-xs font-semibold">
                            ✗ {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Revealed Options Breakdown for Graded MCQs */}
                {activeFeedback.revealed_options && activeFeedback.revealed_options.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Option Diagnostics Breakdown:
                    </p>
                    <div className="space-y-2">
                      {activeFeedback.revealed_options.map((opt, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-xl border text-xs space-y-1 ${
                            opt.label === 'correct'
                              ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 text-emerald-950 dark:text-emerald-200'
                              : opt.label === 'partial'
                              ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 text-amber-950 dark:text-amber-200'
                              : 'bg-slate-50 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold">
                              {opt.key ? `Option ${opt.key}: ` : ''}{opt.text}
                            </span>
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              opt.label === 'correct'
                                ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                                : opt.label === 'partial'
                                ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                                : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                            }`}>
                              {opt.label} ({opt.score} pts)
                            </span>
                          </div>
                          {opt.rationale && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400">
                              <em>Rationale:</em> {opt.rationale}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grounded Citation References */}
                {activeFeedback.feedback_citations && activeFeedback.feedback_citations.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Source Passage:</span>
                    {activeFeedback.feedback_citations.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveCitation(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-indigo-600 hover:text-indigo-700 shadow-2xs transition cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{c.document_name}</span>
                        {c.page && <span>• p.{c.page}</span>}
                        {c.slide && <span>• Slide {c.slide}</span>}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleNextQuestion}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer mt-3"
                >
                  <span>
                    {currentIdx + 1 < session.total_questions ? 'Next Question' : 'Complete Drill & View Summary'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Quiz Completion Summary & Remediation Recommendations */}
      {quizFinished && (
        <div className="space-y-6">
          <div className="p-8 rounded-3xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center sm:text-left">
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  Assessment Complete
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight">
                  Performance & Concept Summary
                </h1>
                <p className="text-xs text-indigo-200">
                  {answersHistory.length} questions completed • Immediate BKT update applied
                </p>
              </div>

              <div className="text-center p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shrink-0">
                <span className="text-4xl sm:text-5xl font-black block tracking-tight">
                  {answersHistory.length > 0 
                    ? Math.round((answersHistory.reduce((acc, h) => acc + h.score_awarded, 0) / answersHistory.length) * 100)
                    : 0}%
                </span>
                <span className="text-xs text-indigo-200 mt-1 block">
                  Overall Accuracy Score
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-4 border-t border-indigo-800/60 flex flex-wrap items-center gap-3">
              <Link
                href="/understanding"
                className="px-5 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs shadow-lg shadow-indigo-500/30 transition flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Open "My Understanding" Dashboard</span>
              </Link>
              <button
                onClick={() => {
                  setSession(null);
                  setQuizFinished(false);
                }}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/15 transition flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Configure Another Drill</span>
              </button>
            </div>
          </div>

          {/* Drill Breakdown & Remediation Links */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Question-by-Question Diagnostics</span>
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {answersHistory.map((ans, idx) => (
                <div key={idx} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600">
                        {ans.topic_name}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        ans.score_awarded >= 0.8
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : ans.score_awarded >= 0.5
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        Score: {ans.score_awarded}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                      {ans.question_text}
                    </p>
                  </div>

                  {/* Remediation trigger CTA if weak or developing */}
                  {ans.score_awarded < 0.8 && ans.topic_id && (
                    <Link
                      href={`/understanding?topic_id=${ans.topic_id}&action=remediate`}
                      className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Learn this again</span>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Citation Preview Modal */}
      <SourcePreviewModal
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </div>
  );
}

export default function QuizPage() {
  return (
    <React.Suspense fallback={<div className="flex-1 flex items-center justify-center p-12 text-slate-400">Loading adaptive assessment workspace...</div>}>
      <QuizContent />
    </React.Suspense>
  );
}
