'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Bot, Send, User, Sparkles, BookOpen, FileText, Presentation, 
  Video, AlertTriangle, ArrowRight, CornerDownLeft, ExternalLink, Calculator, ChevronDown, ChevronUp, CheckCircle2 
} from 'lucide-react';
import { api, Course, Topic, ChatMessage, SourceCitation, Conversation, PracticeProblem } from '@/lib/api';
import { SourcePreviewModal } from '@/components/source-preview-modal';

function TutorContent() {
  const searchParams = useSearchParams();
  const paramCourseId = searchParams.get('course_id');
  const paramTopicId = searchParams.get('topic_id');

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number>(paramCourseId ? Number(paramCourseId) : 1);
  const [selectedTopicId, setSelectedTopicId] = useState<number | undefined>(paramTopicId ? Number(paramTopicId) : undefined);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [activeCitation, setActiveCitation] = useState<SourceCitation | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'sessions' | 'problems'>('sessions');
  const [practiceProblems, setPracticeProblems] = useState<PracticeProblem[]>([]);
  const [loadingProblems, setLoadingProblems] = useState<boolean>(false);
  const [revealedSolutions, setRevealedSolutions] = useState<Record<number, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Pre-baked suggested study prompts for quick demonstration
  const samplePrompts = [
    "What is the primary objective of Gradient Descent?",
    "Explain how Transformers compute Scaled Dot-Product Attention.",
    "What is the difference between Batch and Stochastic Gradient Descent?",
    "What are quantum topological surface codes? (Tests honest abstention)"
  ];

  const loadPracticeProblems = async (courseId: number, topicId?: number) => {
    setLoadingProblems(true);
    try {
      const crs = courses.find((c) => c.id === courseId);
      const targetTopicId = topicId || (crs?.topics && crs.topics[0]?.id) || 1;
      const res = await api.getTopicPracticeProblems(courseId, targetTopicId);
      setPracticeProblems(res);
    } catch (e) {
      // ignore
    } finally {
      setLoadingProblems(false);
    }
  };

  const loadConversations = async (courseId: number) => {
    try {
      const convos = await api.getConversations(courseId);
      setConversations(convos);
      if (convos.length > 0 && !activeConversationId) {
        setActiveConversationId(convos[0].id);
        const fullConvo = await api.getConversation(convos[0].id);
        setMessages(fullConvo.messages);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    api.getCourses()
      .then((cList) => {
        setCourses(cList);
        if (cList.length > 0) {
          setSelectedCourseId(cList[0].id);
          loadConversations(cList[0].id);
        }
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    if (selectedCourseId) {
      loadPracticeProblems(selectedCourseId, selectedTopicId);
    }
  }, [selectedCourseId, selectedTopicId]);

  const handleSendMessage = async (queryText?: string) => {
    const text = queryText || inputQuery;
    if (!text.trim() || isSending) return;

    setInputQuery('');
    setIsSending(true);

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      conversation_id: activeConversationId || 0,
      role: 'user',
      content: text,
      citations: [],
      is_grounded: true,
      has_insufficient_evidence: false,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const assistantMsg = await api.sendChatMessage({
        course_id: selectedCourseId,
        conversation_id: activeConversationId,
        topic_id: selectedTopicId,
        message: text
      });

      setActiveConversationId(assistantMsg.conversation_id);
      setMessages((prev) => [...prev, assistantMsg]);
      await loadConversations(selectedCourseId);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: Date.now() + 1,
        conversation_id: activeConversationId || 0,
        role: 'assistant',
        content: `Error: ${err.message || 'Unable to connect to tutor service.'}`,
        citations: [],
        is_grounded: false,
        has_insufficient_evidence: true,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectConversation = async (convoId: number) => {
    setActiveConversationId(convoId);
    try {
      const full = await api.getConversation(convoId);
      setMessages(full.messages);
    } catch (e) {
      // ignore
    }
  };

  const activeCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950">
      {/* Top Filter Bar */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Adaptive AI Study Companion</h2>
            <p className="text-[11px] text-slate-400">Source Grounding • Strict Academic Citations</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCourseId}
            onChange={(e) => {
              const id = Number(e.target.value);
              setSelectedCourseId(id);
              setSelectedTopicId(undefined);
              loadConversations(id);
            }}
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-300"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}: {c.title}
              </option>
            ))}
          </select>

          {activeCourse && activeCourse.topics.length > 0 && (
            <select
              value={selectedTopicId || ''}
              onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : undefined)}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-300"
            >
              <option value="">All Module Topics</option>
              {activeCourse.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main Chat Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left History & Practice Problems Sidebar */}
        <div className="hidden md:flex w-72 flex-col border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-3 space-y-3">
          {/* Sidebar Tab Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSidebarTab('sessions')}
              className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer ${
                sidebarTab === 'sessions'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Sessions
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('problems')}
              className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer flex items-center justify-center gap-1 ${
                sidebarTab === 'problems'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Problems ({practiceProblems.length})</span>
            </button>
          </div>

          {sidebarTab === 'sessions' ? (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Chat History</span>
                <button
                  onClick={() => {
                    setActiveConversationId(undefined);
                    setMessages([]);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 cursor-pointer"
                >
                  + New Session
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {conversations.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => handleSelectConversation(convo.id)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-medium transition truncate block cursor-pointer ${
                      activeConversationId === convo.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {convo.title}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Topic Problems
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold truncate max-w-[120px]">
                  {activeCourse?.topics.find((t) => t.id === selectedTopicId)?.name || 'Course Material'}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {loadingProblems ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading topic problems...</div>
                ) : practiceProblems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No problems available for this topic.</div>
                ) : (
                  practiceProblems.map((prob, idx) => {
                    const isRev = !!revealedSolutions[idx];
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
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[10px] uppercase text-indigo-600 dark:text-indigo-400">
                            {prob.difficulty}
                          </span>
                          {cit && (
                            <button
                              type="button"
                              onClick={() => setActiveCitation(cit as SourceCitation)}
                              className="text-[10px] text-slate-400 hover:text-indigo-600 flex items-center gap-0.5 cursor-pointer"
                            >
                              <FileText className="w-3 h-3" />
                              <span>p.{cit.page || cit.slide || 1}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>

                        <p className="text-slate-800 dark:text-slate-200 font-medium line-clamp-3">
                          {prob.stem}
                        </p>

                        {prob.expression && (
                          <div className="font-mono text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded">
                            {prob.expression}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => setRevealedSolutions((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                            className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-semibold cursor-pointer"
                          >
                            {isRev ? 'Hide Solution' : 'View Solution'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendMessage(`Please explain how to solve this problem step-by-step: "${prob.stem}"`)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Bot className="w-3 h-3" />
                            <span>Ask Tutor</span>
                          </button>
                        </div>

                        {isRev && (
                          <div className="p-2 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 text-[11px] text-indigo-900 dark:text-indigo-200 space-y-1 mt-1 border border-indigo-100 dark:border-indigo-900/40">
                            {prob.answer !== undefined && (
                              <p className="font-bold">Answer: {prob.answer} {prob.unit || ''}</p>
                            )}
                            <p className="leading-tight text-[10px]">{prob.worked_solution}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-[10px] text-slate-500 space-y-0.5">
            <span className="font-semibold text-slate-700 dark:text-slate-300 block">Strict Grounding</span>
            Problems and explanations derived exclusively from uploaded slides and textbook passages.
          </div>
        </div>

        {/* Chat Messages Feed */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {messages.length === 0 ? (
              <div className="py-16 text-center max-w-xl mx-auto space-y-6">
                <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-md">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    What would you like to explore?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ask questions grounded directly in your uploaded textbook chapters, lecture slides, and notes.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
                  {samplePrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(p)}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-indigo-50/50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-2xs transition flex items-center justify-between gap-2 text-left cursor-pointer"
                    >
                      <span>{p}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3.5 max-w-3xl ${
                    m.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                      m.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-indigo-600 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className="space-y-3">
                    <div
                      className={`p-5 rounded-3xl text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : m.has_insufficient_evidence
                          ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 shadow-xs'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-xs whitespace-pre-line'
                      }`}
                    >
                      {m.has_insufficient_evidence && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Honest Abstention • Insufficient Source Grounding</span>
                        </div>
                      )}
                      <div>{m.content}</div>
                    </div>

                    {/* Interactive Citation Badges */}
                    {m.citations && m.citations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 pl-1">
                        <span className="text-[11px] font-semibold text-slate-400">Source Citations:</span>
                        {m.citations.map((c, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveCitation(c)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-xs font-medium text-indigo-700 dark:text-indigo-300 shadow-2xs transition cursor-pointer"
                          >
                            {c.source_type === 'pdf' ? (
                              <FileText className="w-3.5 h-3.5 text-indigo-500" />
                            ) : c.source_type === 'pptx' ? (
                              <Presentation className="w-3.5 h-3.5 text-indigo-500" />
                            ) : (
                              <Video className="w-3.5 h-3.5 text-indigo-500" />
                            )}
                            <span>{c.document_name}</span>
                            {c.page && <span className="font-bold">• p.{c.page}</span>}
                            {c.slide && <span className="font-bold">• Slide {c.slide}</span>}
                            <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {isSending && (
              <div className="flex items-center gap-3 text-slate-400 text-xs py-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
                  <Bot className="w-3.5 h-3.5 animate-spin" />
                </div>
                <span>Retrieving source passages and synthesizing explanation...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Query Input Box */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="max-w-4xl mx-auto flex items-center gap-3"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask any question grounded in your course documents..."
                className="flex-1 px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || isSending}
                className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/25 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                <span>Send</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Interactive Citation Drawer Modal */}
      <SourcePreviewModal
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </div>
  );
}

export default function TutorPage() {
  return (
    <React.Suspense fallback={<div className="flex-1 flex items-center justify-center p-12 text-slate-400">Loading AI tutor workspace...</div>}>
      <TutorContent />
    </React.Suspense>
  );
}
