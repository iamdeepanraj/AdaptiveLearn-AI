'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Presentation, Video, X, ExternalLink, Image as ImageIcon, Clock } from 'lucide-react';
import { api, SourcePreview, SourceCitation } from '@/lib/api';

interface SourcePreviewModalProps {
  citation: SourceCitation | null;
  onClose: () => void;
}

export function SourcePreviewModal({ citation, onClose }: SourcePreviewModalProps) {
  const [preview, setPreview] = useState<SourcePreview | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!citation) {
      setPreview(null);
      return;
    }

    setLoading(true);
    setError(null);

    api.getDocumentPreview({
      documentId: citation.document_id,
      page: citation.page,
      slide: citation.slide,
      timestamp: citation.timestamp_start
    })
      .then((data) => setPreview(data))
      .catch((err) => setError(err.message || 'Failed to load source preview'))
      .finally(() => setLoading(false));
  }, [citation]);

  if (!citation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              {citation.source_type === 'pdf' ? (
                <FileText className="w-5 h-5" />
              ) : citation.source_type === 'pptx' ? (
                <Presentation className="w-5 h-5" />
              ) : citation.source_type === 'video' ? (
                <Video className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base leading-tight">
                {citation.document_name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                <span className="uppercase font-medium tracking-wider">{citation.source_type} Source</span>
                {citation.page && <span>• Page {citation.page}</span>}
                {citation.slide && <span>• Slide {citation.slide}</span>}
                {citation.timestamp_start !== undefined && (
                  <span>
                    • Timestamp {Math.floor((citation.timestamp_start || 0) / 60)}:
                    {((citation.timestamp_start || 0) % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p>Retrieving exact source excerpt and figures...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 text-center">
              {error}
            </div>
          ) : (
            <>
              {/* Highlighted Citation Quote */}
              <div className="rounded-xl p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block mb-1">
                  Verified Citation Grounding
                </span>
                <p className="text-slate-800 dark:text-slate-200 font-medium italic">
                  &ldquo;{citation.quote}&rdquo;
                </p>
              </div>

              {/* Figure/Diagram Preview */}
              {(citation.figure_description || preview?.figure_description) && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-0.5">
                      Extracted Visual / Architectural Diagram
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {citation.figure_description || preview?.figure_description}
                    </p>
                  </div>
                </div>
              )}

              {/* Full Surrounding Context */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Surrounding Document Excerpt
                </h4>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-line text-sm">
                  {preview?.excerpt || citation.quote}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/70 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Strictly Grounded in Uploaded Materials</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-lg transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
