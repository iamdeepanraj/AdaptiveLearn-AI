'use client';

import React, { useEffect, useState, useRef } from 'react';
import { 
  UploadCloud, FileText, Presentation, Video, CheckCircle2, 
  AlertCircle, Clock, Trash2, ArrowRight, Eye, RefreshCw 
} from 'lucide-react';
import { api, Course, DocumentItem } from '@/lib/api';

export default function UploadPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number>(1);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async (courseId: number) => {
    try {
      const docs = await api.getDocuments(courseId);
      setDocuments(docs);
    } catch (e: any) {
      // ignore
    }
  };

  useEffect(() => {
    api.getCourses()
      .then((cList) => {
        setCourses(cList);
        if (cList.length > 0) {
          setSelectedCourseId(cList[0].id);
          loadDocuments(cList[0].id);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    setError(null);
    setSuccessMsg(null);
    setIsUploading(true);
    setUploadProgress(15);
    setUploadStage('Validating file format and size constraints...');

    // Progress simulation steps while backend processes
    const step1 = setTimeout(() => {
      setUploadProgress(45);
      setUploadStage('Parsing text, extracting exact page numbers, slide titles, and diagrams...');
    }, 400);

    const step2 = setTimeout(() => {
      setUploadProgress(75);
      setUploadStage('Generating dense semantic embeddings and indexing vector chunks...');
    }, 800);

    try {
      const newDoc = await api.uploadDocument(selectedCourseId, file);
      clearTimeout(step1);
      clearTimeout(step2);
      setUploadProgress(100);
      setUploadStage('Indexing completed successfully!');
      setSuccessMsg(`Successfully processed "${newDoc.filename}" (${newDoc.page_or_slide_count} units indexed).`);
      await loadDocuments(selectedCourseId);
    } catch (err: any) {
      clearTimeout(step1);
      clearTimeout(step2);
      setError(err.message || 'Failed to ingest file');
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setUploadProgress(0);
        setUploadStage('');
      }, 2000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Multimodal Knowledge Ingestion
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload textbooks, slides, and lecture media. Materials are parsed and indexed with exact source coordinates for citation grounding.
        </p>
      </div>

      {/* Course Selection */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Target Course:
        </label>
        <select
          value={selectedCourseId}
          onChange={(e) => {
            const id = Number(e.target.value);
            setSelectedCourseId(id);
            loadDocuments(id);
          }}
          className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.title}
            </option>
          ))}
        </select>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-10 rounded-3xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-4 ${
          isUploading
            ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-500 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 shadow-xs'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
          className="hidden"
          accept=".pdf,.pptx,.mp4,.mp3,.wav,.m4a,.png,.jpg"
        />

        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
          <UploadCloud className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {isUploading ? 'Ingesting Document...' : 'Drag and drop course material, or click to browse'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Supports PDF textbooks, PPTX slide decks, MP4/MP3 lecture recordings, and concept diagrams. Maximum file size 50MB.
          </p>
        </div>

        {/* Live Upload Progress */}
        {isUploading && (
          <div className="w-full max-w-md space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-indigo-600 font-semibold">
              <span>{uploadStage}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Ingested Documents List */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Indexed Knowledge Sources</h3>
            <p className="text-xs text-slate-500">Searchable vector chunks available to the AI tutor and quiz generator</p>
          </div>
          <button
            onClick={() => loadDocuments(selectedCourseId)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Refresh documents list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {documents.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">No documents indexed for this course yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {documents.map((doc) => (
              <div key={doc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 shrink-0">
                    {doc.file_type === 'pdf' ? (
                      <FileText className="w-5 h-5" />
                    ) : doc.file_type === 'pptx' ? (
                      <Presentation className="w-5 h-5" />
                    ) : (
                      <Video className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{doc.filename}</h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span className="uppercase font-medium">{doc.file_type}</span>
                      <span>• {doc.page_or_slide_count} {doc.file_type === 'pdf' ? 'Pages' : (doc.file_type === 'pptx' ? 'Slides' : 'Segments')}</span>
                      <span>• {(doc.file_size_bytes / 1024).toFixed(0)} KB</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                    doc.status === 'indexed'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
                      : doc.status === 'processing'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                  }`}>
                    {doc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
