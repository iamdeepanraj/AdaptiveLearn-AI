'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  BookOpen, GitFork, Lock, CheckCircle2, Sparkles, PlayCircle, 
  HelpCircle, ArrowRight, Layers, FileText, ChevronRight, Calculator 
} from 'lucide-react';
import { api, Course, PrerequisiteGraph } from '@/lib/api';
import { BKTBadge } from '@/components/bkt-badge';
import { PracticeProblemsModal } from '@/components/practice-problems-modal';

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [graph, setGraph] = useState<PrerequisiteGraph | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activePracticeTopic, setActivePracticeTopic] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    api.getCourses()
      .then((res) => {
        setCourses(res);
        if (res.length > 0) {
          setSelectedCourse(res[0]);
          return api.getPrerequisites(res[0].id);
        }
        return null;
      })
      .then((g) => {
        if (g) setGraph(g);
      })
      .catch((err) => setError(err.message || 'Failed to load courses'))
      .finally(() => setLoading(false));
  }, []);

  const handleSelectCourse = async (c: Course) => {
    setSelectedCourse(c);
    try {
      const g = await api.getPrerequisites(c.id);
      setGraph(g);
    } catch (e) {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading course curriculum and prerequisite graphs...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Course Library & Prerequisite Map
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Explore structured curriculum hierarchies and unlock advanced modules as you master prerequisites.
        </p>
      </div>

      {/* Course Selector Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {courses.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSelectCourse(c)}
            className={`px-5 py-3 rounded-2xl text-sm font-semibold transition whitespace-nowrap flex items-center gap-2.5 cursor-pointer ${
              selectedCourse?.id === c.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{c.code}: {c.title}</span>
          </button>
        ))}
      </div>

      {selectedCourse && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Topics List (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {selectedCourse.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedCourse.description}</p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {selectedCourse.topics.length} Modules
                </span>
              </div>

              <div className="space-y-4">
                {selectedCourse.topics.map((t, index) => {
                  const node = graph?.nodes.find((n) => n.id === t.id);
                  const isLocked = node?.status === 'locked';

                  return (
                    <div
                      key={t.id}
                      className={`p-5 rounded-2xl border transition-all ${
                        isLocked
                          ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 opacity-70'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isLocked
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                              : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                          }`}>
                            {isLocked ? <Lock className="w-4 h-4" /> : index + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{t.name}</h3>
                              {t.code && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600">
                                  {t.code}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                              {t.description}
                            </p>
                          </div>
                        </div>

                        {node && (
                          <div className="shrink-0 flex items-center gap-2">
                            <BKTBadge pMastery={node.mastery_prob} state={node.status} size="sm" />
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                        {t.prerequisite_ids.length > 0 ? (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <GitFork className="w-3.5 h-3.5" />
                            Requires prior prerequisite completion
                          </span>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-medium">Foundational Module</span>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActivePracticeTopic({ id: t.id, name: t.name })}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Calculator className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Practice Problems</span>
                          </button>
                          <Link
                            href={`/tutor?course_id=${selectedCourse.id}&topic_id=${t.id}`}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-medium transition flex items-center gap-1.5"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Ask Tutor</span>
                          </Link>
                          <Link
                            href={`/quiz?course_id=${selectedCourse.id}&topic_id=${t.id}`}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-2xs transition flex items-center gap-1.5"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>Practice Quiz</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Visual Prerequisite Dependency Graph */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                  <GitFork className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Prerequisite Graph</h3>
                  <p className="text-xs text-slate-500">Knowledge hierarchy & unlocks</p>
                </div>
              </div>

              {graph ? (
                <div className="space-y-4 pt-2">
                  <div className="space-y-3">
                    {graph.nodes.map((node, i) => (
                      <div key={node.id} className="relative">
                        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                          node.status === 'mastered'
                            ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900'
                            : node.status === 'locked'
                            ? 'bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800 opacity-60'
                            : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 shadow-2xs'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                              node.status === 'mastered'
                                ? 'bg-emerald-600 text-white'
                                : node.status === 'locked'
                                ? 'bg-slate-300 text-slate-600'
                                : 'bg-indigo-600 text-white'
                            }`}>
                              {i + 1}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">{node.name}</p>
                              <p className="text-[10px] text-slate-500 capitalize">{node.status} • Est: {Math.round(node.mastery_prob * 100)}%</p>
                            </div>
                          </div>

                          {node.status === 'mastered' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : node.status === 'locked' ? (
                            <Lock className="w-4 h-4 text-slate-400" />
                          ) : (
                            <span className="text-[10px] font-semibold text-indigo-600 uppercase">Unlocked</span>
                          )}
                        </div>

                        {/* Visual Connector Edge */}
                        {i < graph.nodes.length - 1 && (
                          <div className="w-0.5 h-4 bg-slate-200 dark:bg-slate-700 mx-auto my-1" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-500 leading-relaxed">
                    💡 <strong>Prerequisite Rule:</strong> Topics unlock for diagnostic mastery once their direct dependencies achieve an estimated mastery $P(L) \ge 0.60$.
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center">No prerequisite map data.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activePracticeTopic && selectedCourse && (
        <PracticeProblemsModal
          courseId={selectedCourse.id}
          topicId={activePracticeTopic.id}
          topicName={activePracticeTopic.name}
          isOpen={true}
          onClose={() => setActivePracticeTopic(null)}
        />
      )}
    </div>
  );
}
