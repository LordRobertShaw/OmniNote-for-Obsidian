/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileText, Tag, Folder, Eye, CheckCircle2, AlertTriangle, RefreshCw, Edit2, Check, X, Sparkles } from 'lucide-react';
import { RawNote, ConvertedNote } from '../types.js';

interface NotePreviewCardProps {
  key?: string;
  raw: RawNote;
  converted?: ConvertedNote;
  onUpdate: (id: string, updates: Partial<ConvertedNote>) => void;
  isExcluded?: boolean;
  onToggleExclude?: () => void;
}

export default function NotePreviewCard({ raw, converted, onUpdate, isExcluded, onToggleExclude }: NotePreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(converted?.title || raw.title);
  const [editCategory, setEditCategory] = useState(converted?.categoryPath || "");
  const [editTags, setEditTags] = useState(converted?.tags.join(', ') || raw.labels.join(', '));
  const [showMarkdown, setShowMarkdown] = useState(false);

  const handleSave = () => {
    onUpdate(raw.id, {
      title: editTitle,
      categoryPath: editCategory,
      tags: editTags.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0),
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(converted?.title || raw.title);
    setEditCategory(converted?.categoryPath || "");
    setEditTags(converted?.tags.join(', ') || raw.labels.join(', '));
    setIsEditing(false);
  };

  const sourceName = raw.source === 'keep' ? 'Google Keep' : raw.source === 'samsung' ? 'Samsung Note' : 'Imported Note';
  const sourceColor = raw.source === 'keep' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20';

  return (
    <div className={`border transition-all shadow-inner backdrop-blur-md rounded-3xl overflow-hidden ${
      isExcluded 
        ? 'bg-red-950/5 border-rose-500/20 opacity-40 hover:opacity-60' 
        : 'bg-slate-900/40 border-white/5 hover:border-violet-500/20'
    }`}>
      {/* Top Header line */}
      <div className="px-5 py-3.5 bg-black/40 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <span className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full border ${sourceColor}`}>
            {sourceName}
          </span>
          {raw.isPinned && !isExcluded && (
            <span className="text-[10px] bg-violet-600 text-white font-bold px-2 py-0.5 rounded-lg tracking-widest shadow-[0_0_10px_rgba(124,58,237,0.3)]">
              PINNED
            </span>
          )}
          {isExcluded && (
            <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold px-2.5 py-0.5 rounded-lg tracking-widest">
              EXCLUDED / REDUNDANT
            </span>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs">
          {!converted && (
            <span className="flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-widest text-[10px]">
              <span className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
              Queued
            </span>
          )}
          {converted && converted.status === 'processing' && (
            <span className="flex items-center gap-1.5 text-violet-400 font-bold uppercase tracking-widest text-[10px]">
              <RefreshCw className="w-3 h-3 animate-spin text-violet-400" />
              AI Pipeline...
            </span>
          )}
          {converted && converted.status === 'completed' && (
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-widest text-[10px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Ready
            </span>
          )}
          {converted && converted.status === 'failed' && (
            <span className="flex items-center gap-1.5 text-rose-400 font-bold uppercase tracking-widest text-[10px]">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              Failed
            </span>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="p-5 space-y-4">
        {isEditing ? (
          /* Editing Panel */
          <div className="space-y-3.5 bg-[#050507]/60 p-5 rounded-2xl border border-white/5">
            {/* Title field */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Obsidian Filename</label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full text-sm bg-black/40 border border-white/10 hover:border-violet-500/30 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 rounded-xl px-3 py-2 text-white focus:outline-none transition-all font-medium"
              />
            </div>

            {/* Folder field */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Vault Subfolder Path</label>
              <input
                type="text"
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                placeholder="e.g. Work/Projects"
                className="w-full text-sm bg-black/40 border border-white/10 hover:border-violet-500/30 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 rounded-xl px-3 py-2 text-white focus:outline-none transition-all font-medium"
              />
            </div>

            {/* Tags field */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Tags (comma separated)</label>
              <input
                type="text"
                value={editTags}
                onChange={e => setEditTags(e.target.value)}
                placeholder="e.g. recipes, work, urgent"
                className="w-full text-sm bg-black/40 border border-white/10 hover:border-violet-500/30 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 rounded-xl px-3 py-2 text-white focus:outline-none transition-all font-medium"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 justify-end">
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-violet-700 transition-colors shadow-[0_0_15px_rgba(124,58,237,0.3)]"
              >
                <Check className="w-3.5 h-3.5" /> Keep Edits
              </button>
            </div>
          </div>
        ) : (
          /* Static Display Mode */
          <div className="space-y-3">
            <div>
              <h4 className="font-bold text-base text-white tracking-tight">
                {converted?.title || raw.title || "Untitled Note"}
                <span className="text-xs font-mono font-normal text-slate-500 ml-1.5">.md</span>
              </h4>
              {converted?.summary && (
                <div id={`ai-summary-${raw.id}`} className="mt-3 p-3 bg-violet-500/5 border border-violet-500/10 rounded-2xl space-y-1 shadow-inner">
                  <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-widest text-violet-400">
                    <Sparkles className="w-3 h-3 text-violet-400" />
                    <span>AI Executive Summary</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    "{converted.summary}"
                  </p>
                </div>
              )}
            </div>

            {/* Metadata Badges */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400 pt-3.5 border-t border-white/5">
              <span className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">Path:</span>
                <span className="font-mono text-[11px] text-slate-300">
                  {converted ? (converted.categoryPath || "/") : "/"}
                </span>
              </span>

              {(converted?.tags && converted.tags.length > 0) || (raw.labels && raw.labels.length > 0) ? (
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">Tags:</span>
                  <span className="flex flex-wrap gap-1">
                    {(converted?.tags || raw.labels).map((tag, idx) => (
                      <span key={idx} className="bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono">
                        #{tag}
                      </span>
                    ))}
                  </span>
                </span>
              ) : null}
            </div>

            {/* Body snippet */}
            {!showMarkdown && (
              <div className="bg-black/20 border border-white/5 rounded-2xl p-4 text-xs text-slate-400 font-mono line-clamp-3 whitespace-pre-wrap leading-relaxed">
                {raw.content}
              </div>
            )}
          </div>
        )}

        {/* Obsidian Markdown Output View */}
        {showMarkdown && converted?.markdown && (
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-slate-500">
              <span>Obsidian Raw File Content (.md)</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-lg">Markdown</span>
            </div>
            <pre className="bg-black p-4 rounded-2xl text-xs font-mono text-slate-300 overflow-x-auto max-h-56 leading-relaxed border border-white/5">
              {converted.markdown}
            </pre>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <span className="text-slate-500 font-mono text-[10px]">
            {raw.createdAt ? new Date(raw.createdAt).toLocaleDateString() : 'No date'}
          </span>

          <div className="flex items-center gap-2">
            {converted?.markdown && (
              <button
                onClick={() => setShowMarkdown(!showMarkdown)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-slate-300 hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-violet-400" />
                {showMarkdown ? "Hide Code" : "Raw Markdown"}
              </button>
            )}

            {onToggleExclude && (
              <button
                onClick={onToggleExclude}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[10px] font-bold uppercase tracking-widest cursor-pointer border ${
                  isExcluded
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                    : "bg-white/5 border-white/10 hover:border-rose-500/30 hover:text-rose-400 hover:bg-rose-500/5 text-slate-300"
                }`}
              >
                {isExcluded ? "Include Note" : "Exclude Duplicate"}
              </button>
            )}

            {!isEditing && (
              <button
                onClick={() => {
                  setEditTitle(converted?.title || raw.title);
                  setEditCategory(converted?.categoryPath || "");
                  setEditTags(converted?.tags.join(', ') || raw.labels.join(', '));
                  setIsEditing(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition-all text-[10px] font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(124,58,237,0.25)] hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-white" />
                Customize
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
