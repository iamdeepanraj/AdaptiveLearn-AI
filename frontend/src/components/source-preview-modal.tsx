'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Presentation, Video, X, Image as ImageIcon } from 'lucide-react';
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

    api
      .getDocumentPreview({
        documentId: citation.document_id,
        page: citation.page,
        slide: citation.slide,
        timestamp: citation.timestamp_start,
      })
      .then((data) => setPreview(data))
      .catch((err) => setError(err.message || 'Failed to load source preview'))
      .finally(() => setLoading(false));
  }, [citation]);

  if (!citation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-surface rounded-2xl shadow-card border border-line overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary-soft text-primary-fg">
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
              <h3 className="font-semibold text-fg text-base leading-tight">
                {citation.document_name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-fg-3">
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
            aria-label="Close preview modal"
            className="p-1.5 rounded-lg text-fg-3 hover:text-fg hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-fg-3 gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p>Retrieving exact source excerpt and figures...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-danger-soft border border-danger/30 text-danger text-center">
              {error}
            </div>
          ) : (
            <>
              {/* Highlighted Citation Quote */}
              <div className="rounded-xl p-4 bg-primary-soft border border-primary/30">
                <span className="text-xs font-semibold text-primary-fg uppercase tracking-wider block mb-1">
                  Verified Citation Grounding
                </span>
                <p className="text-fg font-medium italic">
                  &ldquo;{citation.quote}&rdquo;
                </p>
              </div>

              {/* Figure/Diagram Preview */}
              {(citation.figure_description || preview?.figure_description) && (
                <div className="p-4 rounded-xl bg-surface-2 border border-line flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-warning-soft text-warning shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-2 mb-0.5">
                      Extracted Visual / Architectural Diagram
                    </h4>
                    <p className="text-xs text-fg-3">
                      {citation.figure_description || preview?.figure_description}
                    </p>
                  </div>
                </div>
              )}

              {/* Full Surrounding Context */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-3 mb-2">
                  Surrounding Document Excerpt
                </h4>
                <div className="p-4 rounded-xl bg-surface-2 border border-line text-fg leading-relaxed whitespace-pre-line text-sm">
                  {preview?.excerpt || citation.quote}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-surface border-t border-line flex items-center justify-between text-xs text-fg-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            <span>Strictly Grounded in Uploaded Materials</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-fg font-medium rounded-lg border border-line transition cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
