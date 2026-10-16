'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  BookOpen, GitFork, Lock, CheckCircle2, PlayCircle, 
  HelpCircle, Calculator 
} from 'lucide-react';
import { api, Course, PrerequisiteGraph } from '@/lib/api';
import { BKTBadge } from '@/components/bkt-badge';
import { PracticeProblemsModal } from '@/components/practice-problems-modal';

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [graph, setGraph] = useState<PrerequisiteGraph | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [_error, setError] = useState<string | null>(null);
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
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-fg-3 gap-3">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading course curriculum and prerequisite graphs...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-fg tracking-tight">
          Course Library & Prerequisite Map
        </h1>
        <p className="text-sm text-fg-3 mt-1">
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
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface border border-line text-fg hover:bg-surface-2'
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
            <div className="p-6 rounded-3xl bg-surface border border-line shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h2 className="text-lg font-bold text-fg">
                    {selectedCourse.title}
                  </h2>
                  <p className="text-xs text-fg-3 mt-0.5">{selectedCourse.description}</p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-surface-2 text-fg-2 border border-line">
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
                          ? 'bg-surface-2 border-line'
                          : 'bg-surface-2 border-line shadow-xs hover:border-line-strong'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isLocked
                              ? 'bg-surface-3 text-fg-2'
                              : 'bg-primary-soft text-primary-fg'
                          }`}>
                            {isLocked ? <Lock className="w-4 h-4" /> : index + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm text-fg">{t.name}</h3>
                              {t.code && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface text-fg border border-line">
                                  {t.code}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-fg-2 mt-1 leading-relaxed">
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
                      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs">
                        {t.prerequisite_ids.length > 0 ? (
                          <span className="text-[11px] text-fg-2 flex items-center gap-1">
                            <GitFork className="w-3.5 h-3.5" />
                            Requires prior prerequisite completion
                          </span>
                        ) : (
                          <span className="text-[11px] text-success font-medium">Foundational Module</span>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActivePracticeTopic({ id: t.id, name: t.name })}
                            className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-3 text-fg font-medium transition flex items-center gap-1.5 cursor-pointer border border-line"
                          >
                            <Calculator className="w-3.5 h-3.5 text-primary-fg" />
                            <span>Practice Problems</span>
                          </button>
                          <Link
                            href={`/tutor?course_id=${selectedCourse.id}&topic_id=${t.id}`}
                            className="px-3 py-1.5 rounded-lg bg-primary-soft hover:bg-surface-3 text-primary-fg font-medium transition flex items-center gap-1.5 border border-primary/30"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Ask Tutor</span>
                          </Link>
                          <Link
                            href={`/quiz?course_id=${selectedCourse.id}&topic_id=${t.id}`}
                            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium shadow-xs transition flex items-center gap-1.5"
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
            <div className="p-6 rounded-3xl bg-surface border border-line shadow-card space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary-soft text-primary-fg">
                  <GitFork className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-fg">Prerequisite Graph</h3>
                  <p className="text-xs text-fg-3">Knowledge hierarchy & unlocks</p>
                </div>
              </div>

              {graph ? (
                <div className="space-y-4 pt-2">
                  <div className="space-y-3">
                    {graph.nodes.map((node, i) => (
                      <div key={node.id} className="relative">
                        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                          node.status === 'mastered'
                            ? 'bg-success-soft border-success/30 text-fg'
                            : node.status === 'locked'
                            ? 'bg-surface-2 border-line text-fg'
                            : 'bg-surface border-line text-fg shadow-xs'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                              node.status === 'mastered'
                                ? 'bg-success text-white'
                                : node.status === 'locked'
                                ? 'bg-surface-3 text-fg-2'
                                : 'bg-primary text-white'
                            }`}>
                              {i + 1}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-fg leading-tight">{node.name}</p>
                              <p className="text-[10px] text-fg-2 capitalize">{node.status} • Est: {Math.round(node.mastery_prob * 100)}%</p>
                            </div>
                          </div>

                          {node.status === 'mastered' ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : node.status === 'locked' ? (
                            <Lock className="w-4 h-4 text-fg-2" />
                          ) : (
                            <span className="text-[10px] font-semibold text-primary-fg uppercase">Unlocked</span>
                          )}
                        </div>

                        {/* Visual Connector Edge */}
                        {i < graph.nodes.length - 1 && (
                          <div className="w-0.5 h-4 bg-line-strong mx-auto my-1" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-2 border border-line text-[11px] text-fg-2 leading-relaxed">
                    💡 <strong>Prerequisite Rule:</strong> Topics unlock for diagnostic mastery once their direct dependencies achieve an estimated mastery $P(L) \ge 0.60$.
                  </div>
                </div>
              ) : (
                <p className="text-xs text-fg-3 py-6 text-center">No prerequisite map data.</p>
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
