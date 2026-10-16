'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Bot, Send, User, Sparkles, BookOpen, FileText, Presentation, 
  Video, AlertTriangle, ArrowRight, ExternalLink, Calculator, 
  Paperclip, Edit2, Trash2, Loader2, Check, X, Globe, RefreshCw
} from 'lucide-react';
import { 
  api, Course, Topic, ChatMessage, SourceCitation, Conversation, 
  PracticeProblem, ChatHealthResponse 
} from '@/lib/api';
import { SourcePreviewModal } from '@/components/source-preview-modal';
import { QuickReviseModal } from '@/components/quick-revise-modal';

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

  // Chat Health / Ollama state
  const [chatHealth, setChatHealth] = useState<ChatHealthResponse | null>(null);

  // Quick Revise Modal state
  const [quickReviseOpen, setQuickReviseOpen] = useState<boolean>(false);

  // In-chat file attachment state
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [prioritizedDocId, setPrioritizedDocId] = useState<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Outside Knowledge toggle
  const [outsideKnowledgeEnabled, setOutsideKnowledgeEnabled] = useState<boolean>(false);

  // Rename session inline state
  const [editingConvoId, setEditingConvoId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeCourse = useMemo(() => courses.find((c) => c.id === selectedCourseId), [courses, selectedCourseId]);

  // Dynamic starter questions from student's own topics
  const starterQuestions = useMemo(() => {
    if (!activeCourse || !activeCourse.topics || activeCourse.topics.length === 0) {
      return [
        "What are the core foundational principles in this course?",
        "Can you explain the key equations and when to use them?",
        "Walk me through a worked example step-by-step."
      ];
    }
    return activeCourse.topics.slice(0, 4).map((t) => `Can you explain ${t.name} and provide a concrete example?`);
  }, [activeCourse]);

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

  const checkHealth = async () => {
    try {
      const h = await api.getChatHealth();
      setChatHealth(h);
    } catch (e) {
      setChatHealth({
        status: 'offline',
        provider: 'ollama',
        model_name: 'gemma4:e4b',
        model_badge: 'extractive · fallback',
        fix_command: 'ollama pull gemma4:e4b',
        message: 'Ollama is offline. Operating in labelled extractive mode.'
      });
    }
  };

  useEffect(() => {
    checkHealth();
    api.getCourses()
      .then((cList) => {
        setCourses(cList);
        if (cList.length > 0) {
          const initCourseId = paramCourseId ? Number(paramCourseId) : cList[0].id;
          setSelectedCourseId(initCourseId);
          loadConversations(initCourseId);
        }
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, uploadingFileName]);

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

    const fullPrompt = outsideKnowledgeEnabled
      ? `${text}\n[Note: Outside general knowledge is enabled if material is absent]`
      : text;

    // Optimistically add user message
    const userMsg: ChatMessage = {
      id: Date.now(),
      conversation_id: activeConversationId || 0,
      role: 'user',
      content: text,
      citations: [],
      is_grounded: true,
      has_insufficient_evidence: false,
      created_at: new Date().toISOString()
    };

    const assistantTempId = Date.now() + 1;
    const initialBadge = chatHealth?.status === 'ready' ? (chatHealth.model_badge || 'gemma4:e4b · local') : 'extractive · fallback';

    const assistantMsgPlaceholder: ChatMessage = {
      id: assistantTempId,
      conversation_id: activeConversationId || 0,
      role: 'assistant',
      content: '',
      citations: [],
      is_grounded: true,
      has_insufficient_evidence: false,
      model_badge: initialBadge,
      created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg, assistantMsgPlaceholder]);

    // Stream response token-by-token
    await api.streamChatMessage(
      {
        course_id: selectedCourseId,
        conversation_id: activeConversationId,
        topic_id: selectedTopicId,
        message: fullPrompt,
        prioritized_document_id: prioritizedDocId
      },
      (token: string) => {
        setMessages((prev) => prev.map((m) => m.id === assistantTempId ? { ...m, content: m.content + token } : m));
      },
      (doneData: any) => {
        setIsSending(false);
        if (doneData.conversation_id) {
          setActiveConversationId(doneData.conversation_id);
        }
        setMessages((prev) => prev.map((m) => {
          if (m.id === assistantTempId) {
            return {
              ...m,
              content: doneData.content || m.content,
              citations: doneData.citations || [],
              is_grounded: doneData.is_grounded,
              has_insufficient_evidence: doneData.has_insufficient_evidence,
              model_badge: doneData.model_badge || m.model_badge
            };
          }
          return m;
        }));
        loadConversations(selectedCourseId);
      },
      (err: any) => {
        setIsSending(false);
        setMessages((prev) => prev.map((m) => {
          if (m.id === assistantTempId) {
            return {
              ...m,
              content: m.content || `⚠️ Service error: ${err.message || 'Could not fetch explanation.'}`,
              model_badge: 'extractive · fallback'
            };
          }
          return m;
        }));
      }
    );
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

  const handleRenameSession = async (convoId: number) => {
    if (!editingTitle.trim()) {
      setEditingConvoId(null);
      return;
    }
    try {
      await api.renameConversation(convoId, editingTitle.trim());
      setEditingConvoId(null);
      await loadConversations(selectedCourseId);
    } catch (e) {
      alert('Failed to rename session');
    }
  };

  const handleDeleteSession = async (convoId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this study session?')) return;
    try {
      await api.deleteConversation(convoId);
      if (activeConversationId === convoId) {
        setActiveConversationId(undefined);
        setMessages([]);
      }
      await loadConversations(selectedCourseId);
    } catch (e) {
      alert('Failed to delete session');
    }
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFileName(file.name);
    try {
      const doc = await api.uploadDocument(selectedCourseId, file);
      setPrioritizedDocId(doc.id);
      setUploadingFileName(null);

      // Post system confirmation message in chat
      const sysMsg: ChatMessage = {
        id: Date.now(),
        conversation_id: activeConversationId || 0,
        role: 'system',
        content: `📄 ${file.name} is ready. Ask me anything about it.`,
        citations: [],
        is_grounded: true,
        has_insufficient_evidence: false,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, sysMsg]);
    } catch (err: any) {
      setUploadingFileName(null);
      alert(`File upload failed: ${err.message || 'Could not process file'}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Top Filter Bar */}
      <div className="shrink-0 h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 flex items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="hidden sm:block">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Adaptive AI Study Companion</h2>
            <p className="text-[11px] text-slate-400">Source Grounding • Strict Academic Citations</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Outside Knowledge Toggle */}
          <button
            type="button"
            onClick={() => setOutsideKnowledgeEnabled(!outsideKnowledgeEnabled)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              outsideKnowledgeEnabled
                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="When active, tutor may use general outside knowledge if no uploaded documents cover the question."
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Outside Knowledge</span>
            <span className={`w-2 h-2 rounded-full ${outsideKnowledgeEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`} />
          </button>

          {/* Course Selector */}
          <select
            value={selectedCourseId}
            onChange={(e) => {
              const id = Number(e.target.value);
              setSelectedCourseId(id);
              setSelectedTopicId(undefined);
              setActiveConversationId(undefined);
              setMessages([]);
              loadConversations(id);
            }}
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 max-w-[150px] sm:max-w-none truncate"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}: {c.title}
              </option>
            ))}
          </select>

          {/* Topic Selector */}
          {activeCourse && activeCourse.topics.length > 0 && (
            <select
              value={selectedTopicId || ''}
              onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : undefined)}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 max-w-[130px] sm:max-w-none truncate"
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

      {/* Offline Ollama Warning Banner */}
      {chatHealth && chatHealth.status === 'offline' && (
        <div className="shrink-0 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Local model offline:</strong> Start Ollama and run:{' '}
              <code className="px-1.5 py-0.5 rounded bg-amber-200/50 dark:bg-amber-900/50 font-mono font-bold text-[11px]">
                {chatHealth.fix_command || 'ollama pull gemma4:e4b'}
              </code>
              . Answers will fall back to labelled extractive mode.
            </span>
          </div>
          <button
            onClick={checkHealth}
            className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main Chat Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left History & Practice Problems Sidebar */}
        <div className="hidden md:flex w-72 flex-col border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-3 space-y-3 shrink-0">
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
                    setPrioritizedDocId(undefined);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 cursor-pointer"
                >
                  + New Session
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {conversations.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">No study sessions yet.</div>
                ) : (
                  conversations.map((convo) => {
                    const isSelected = activeConversationId === convo.id;
                    const isEditing = editingConvoId === convo.id;
                    const dateFormatted = new Date(convo.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric'
                    });

                    return (
                      <div
                        key={convo.id}
                        className={`group relative flex items-center justify-between p-2.5 rounded-xl text-xs transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => !isEditing && handleSelectConversation(convo.id)}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRenameSession(convo.id)}
                              className="flex-1 px-2 py-1 rounded bg-white dark:bg-slate-800 border border-indigo-400 text-xs font-medium"
                              autoFocus
                            />
                            <button
                              onClick={() => handleRenameSession(convo.id)}
                              className="p-1 text-emerald-600 hover:text-emerald-700"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingConvoId(null)}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0 pr-2">
                              <span className="truncate block font-medium">{convo.title}</span>
                              <span className="text-[10px] text-slate-400 block">{dateFormatted}</span>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingConvoId(convo.id);
                                  setEditingTitle(convo.title);
                                }}
                                className="p-1 hover:text-indigo-600 text-slate-400"
                                title="Rename session"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteSession(convo.id, e)}
                                className="p-1 hover:text-rose-600 text-slate-400"
                                title="Delete session"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
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

        {/* Chat Messages Feed & Fixed Bottom Prompt Bar */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Message List - Independently Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {messages.length === 0 ? (
              <div className="py-12 sm:py-16 text-center max-w-xl mx-auto space-y-6">
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
                  {starterQuestions.map((p, idx) => (
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
                        : m.role === 'system'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-white dark:bg-slate-800 text-indigo-600 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {m.role === 'user' ? <User className="w-4 h-4" /> : m.role === 'system' ? <Check className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Header with Model Badge */}
                    {m.role === 'assistant' && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Tutor</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {m.model_badge || 'gemma4:e4b · local'}
                        </span>
                      </div>
                    )}

                    <div
                      className={`p-4 sm:p-5 rounded-3xl text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : m.role === 'system'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200'
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
                            {c.timestamp_start !== undefined && (
                              <span className="font-bold">
                                • {Math.floor(c.timestamp_start / 60)}:{String(Math.floor(c.timestamp_start % 60)).padStart(2, '0')}
                              </span>
                            )}
                            <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* In-chat file processing chip */}
            {uploadingFileName && (
              <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300 shadow-sm animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Processing {uploadingFileName} · Indexing</span>
              </div>
            )}

            {isSending && (
              <div className="flex items-center gap-3 text-slate-400 text-xs py-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
                  <Bot className="w-3.5 h-3.5 animate-spin" />
                </div>
                <span>Synthesizing explanation from verified course passages...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* FIXED Prompt Bar at Bottom */}
          <div className="shrink-0 sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 z-10 shadow-lg">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="max-w-4xl mx-auto flex items-center gap-2 sm:gap-3"
            >
              {/* File Attachment Button */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAttachFile}
                className="hidden"
                accept=".pdf,.pptx,.png,.jpg,.jpeg,.mp4,.mp3,.wav,.vtt,.srt"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer shrink-0"
                title="Attach PDF, PPTX, Image, Audio, Video, or VTT/SRT transcript"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Quick Revise Button */}
              <button
                type="button"
                onClick={() => setQuickReviseOpen(true)}
                className="px-3 sm:px-4 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 border border-indigo-200/50 dark:border-indigo-800/50"
                title="Open Quick Revise flashcards on current topic"
              >
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline">Quick Revise</span>
              </button>

              {/* Input text field */}
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask any question grounded in your course documents..."
                className="flex-1 px-4 sm:px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputQuery.trim() || isSending}
                className="px-5 sm:px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/25 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer shrink-0"
              >
                <span className="hidden sm:inline">Send</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Quick Revise Flashcard Modal */}
      <QuickReviseModal
        isOpen={quickReviseOpen}
        onClose={() => setQuickReviseOpen(false)}
        courseId={selectedCourseId}
        topics={activeCourse?.topics || []}
        initialTopicId={selectedTopicId}
        onOpenCitation={(c) => setActiveCitation(c)}
      />

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
