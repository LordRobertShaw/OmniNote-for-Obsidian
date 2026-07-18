/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  FileCheck, Sparkles, FolderHeart, ShieldCheck, RefreshCw, 
  Trash2, ArrowRight, ArrowLeft, RotateCcw, AlertCircle, CheckCircle2 
} from 'lucide-react';

import { RawNote, ConvertedNote, MigrationConfig } from './types.js';
import UploadZone from './components/UploadZone.tsx';
import SyncSettings from './components/SyncSettings.tsx';
import NotePreviewCard from './components/NotePreviewCard.tsx';
import ObsidianExporter from './components/ObsidianExporter.tsx';
import { CodeTerminalHub } from './components/CodeTerminalHub.tsx';
import DuplicateDetector from './components/DuplicateDetector.tsx';
import { autoLinkNotes } from './utils/autoLinker.ts';
import { saveSession, loadSession, clearSession } from './utils/db.ts';

const DEFAULT_CONFIG: MigrationConfig = {
  aiFormatting: true,
  aiCategorization: true,
  aiTagging: true,
  defaultFolder: 'Inbox',
  appendImportMeta: true,
  autoWikilinks: true,
  targetSystem: 'obsidian',
};

export default function App() {
  // State variables
  const [rawNotes, setRawNotes] = useState<RawNote[]>([]);
  const [convertedNotes, setConvertedNotes] = useState<ConvertedNote[]>([]);
  const [excludedNoteIds, setExcludedNoteIds] = useState<string[]>([]);
  const [config, setConfig] = useState<MigrationConfig>(DEFAULT_CONFIG);
  
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState(true);
  
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [processedCount, setProcessedCount] = useState(0);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);

  // Check if Gemini is configured on startup & load session
  useEffect(() => {
    fetch('/api/config-status')
      .then(res => res.json())
      .then(data => {
        setGeminiConfigured(!!data.geminiConfigured);
      })
      .catch(err => {
        console.error("Error checking configuration status:", err);
      });

    // Restore session from IndexedDB
    async function restore() {
      try {
        const saved = await loadSession();
        if (saved) {
          if (saved.rawNotes && saved.rawNotes.length > 0) {
            setRawNotes(saved.rawNotes);
          }
          if (saved.convertedNotes && saved.convertedNotes.length > 0) {
            setConvertedNotes(saved.convertedNotes);
          }
          if (saved.excludedNoteIds) {
            setExcludedNoteIds(saved.excludedNoteIds);
          }
          if (saved.config) {
            setConfig(saved.config);
          }
          if (saved.currentStep) {
            setCurrentStep(saved.currentStep);
          }
        }
      } catch (err) {
        console.error("Session recovery failed:", err);
      } finally {
        setIsRestored(true);
      }
    }
    restore();
  }, []);

  // Save session to IndexedDB whenever states change
  useEffect(() => {
    if (!isRestored) return;
    saveSession({
      rawNotes,
      convertedNotes,
      excludedNoteIds,
      config,
      currentStep
    });
  }, [rawNotes, convertedNotes, excludedNoteIds, config, currentStep, isRestored]);

  // Handle uploaded notes
  const handleNotesLoaded = (notes: RawNote[]) => {
    setRawNotes(notes);
    // Initialize corresponding pending converted state
    const initialConverted: ConvertedNote[] = notes.map(n => ({
      id: n.id,
      title: n.title,
      markdown: '',
      tags: [...n.labels],
      categoryPath: config.defaultFolder,
      status: 'pending'
    }));
    setConvertedNotes(initialConverted);
    setCurrentStep(2); // Jump to review stage
    setGeneralError(null);
  };

  // Reset the migration process completely
  const handleReset = () => {
    setRawNotes([]);
    setConvertedNotes([]);
    setExcludedNoteIds([]);
    setProcessedCount(0);
    setCurrentStep(1);
    setGeneralError(null);
    clearSession().catch(err => console.error("Error clearing IndexedDB session:", err));
  };

  const handleToggleExcludeNote = (id: string) => {
    setExcludedNoteIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkExcludeNotes = (ids: string[]) => {
    setExcludedNoteIds(ids);
  };

  // Convert a single batch of notes through our Express proxy
  const processBatch = async (batch: RawNote[]): Promise<ConvertedNote[]> => {
    const response = await fetch('/api/process-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: batch, config }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data.results as ConvertedNote[];
  };

  // Trigger Gemini AI batch note processing
  const handleStartAIProcessing = async () => {
    setIsProcessingAI(true);
    setGeneralError(null);
    setProcessedCount(0);

    // Set all note statuses to 'processing'
    setConvertedNotes(prev => prev.map(note => ({
      ...note,
      status: 'processing'
    })));

    const batchSize = 10; // Batching note size protects against token limits and provides smooth progress UI
    const allResults: ConvertedNote[] = [];

    try {
      for (let i = 0; i < rawNotes.length; i += batchSize) {
        const batch = rawNotes.slice(i, i + batchSize);
        const batchIds = batch.map(n => n.id);

        try {
          const results = await processBatch(batch);
          
          // Map results back to update list state
          setConvertedNotes(prev => {
            const updated = [...prev];
            results.forEach(res => {
              const idx = updated.findIndex(u => u.id === res.id);
              if (idx !== -1) {
                updated[idx] = {
                  ...res,
                  status: 'completed'
                };
              }
            });
            return updated;
          });

          allResults.push(...results);
          setProcessedCount(prev => prev + batch.length);

        } catch (batchErr: any) {
          console.error(`Error processing batch starting at ${i}:`, batchErr);
          
          // Mark this batch as failed in UI, but keep going with other notes
          setConvertedNotes(prev => {
            const updated = [...prev];
            batchIds.forEach(id => {
              const idx = updated.findIndex(u => u.id === id);
              if (idx !== -1) {
                updated[idx] = {
                  ...updated[idx],
                  status: 'failed',
                  error: batchErr.message || 'Processing failed'
                };
              }
            });
            return updated;
          });
        }
      }

      // Check if we had at least some successful conversions
      const successCount = allResults.length;
      if (successCount === 0) {
        throw new Error("All note batches failed to process. Check if GEMINI_API_KEY is configured.");
      }

      // Execute cross-note dynamic linking if configured
      if (config.autoWikilinks) {
        setConvertedNotes(prev => autoLinkNotes(prev));
      }

    } catch (err: any) {
      setGeneralError(err.message || "An error occurred during note structuring.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Update a single converted note inline
  const handleUpdateNote = (id: string, updates: Partial<ConvertedNote>) => {
    setConvertedNotes(prev => prev.map(note => {
      if (note.id === id) {
        return {
          ...note,
          ...updates,
          // Re-generate markdown file if content changes to stay in sync
          markdown: note.markdown 
            ? regenerateMarkdown(note, updates) 
            : note.markdown
        };
      }
      return note;
    }));
  };

  // Re-generate the markdown metadata if fields are updated inline by user
  const regenerateMarkdown = (note: ConvertedNote, updates: Partial<ConvertedNote>): string => {
    const updatedTitle = updates.title || note.title;
    const updatedTags = updates.tags || note.tags;
    
    // Extract yaml frontmatter lines
    let md = note.markdown;
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
    const match = md.match(frontmatterRegex);

    if (match) {
      const existingFrontmatter = match[1];
      // Simple parse & replace in YAML block
      let lines = existingFrontmatter.split('\n');
      lines = lines.map(line => {
        if (line.startsWith('title:')) {
          return `title: "${updatedTitle}"`;
        }
        return line;
      });

      // Update tags block
      const tagsIdx = lines.findIndex(l => l.trim().startsWith('tags:'));
      if (tagsIdx !== -1) {
        // Remove old tags
        let endIdx = tagsIdx + 1;
        while (endIdx < lines.length && lines[endIdx].trim().startsWith('-')) {
          endIdx++;
        }
        lines.splice(tagsIdx + 1, endIdx - (tagsIdx + 1));
        
        // Add new tags
        const tagLines = updatedTags.map(t => `  - ${t}`);
        lines.splice(tagsIdx + 1, 0, ...tagLines);
      }

      const newFrontmatter = lines.join('\n');
      md = md.replace(frontmatterRegex, `---\n${newFrontmatter}\n---`);
    }

    return md;
  };

  return (
    <div id="main-application" className="min-h-screen bg-[#050507] text-slate-300 font-sans antialiased selection:bg-violet-500/20 selection:text-violet-300 relative overflow-x-hidden">
      
      {/* Immersive deep-space purple ambient gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#1e1b4b_0%,transparent_60%)] pointer-events-none opacity-50" />
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-violet-900/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-indigo-950/10 rounded-full blur-3xl pointer-events-none" />

      {/* Primary Container */}
      <div className="max-w-6xl mx-auto px-6 py-8 relative z-10 space-y-8">
        
        {/* Upper Header and Brand Identity */}
        <header id="main-header" className="h-24 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6 bg-black/20 backdrop-blur-xl -mx-6 px-6 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.5)]">
              <span className="text-white font-bold text-xl font-mono">O</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white uppercase">
                  OmniNote <span className="text-violet-400">for Obsidian</span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Seamless automated cross-platform note integration & session-recovered AI vault porter
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {rawNotes.length > 0 && (
              <button
                id="btn-global-reset"
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-white transition-all bg-white/5 border border-white/10 hover:border-white/20 rounded-xl"
              >
                <RotateCcw className="w-3.5 h-3.5 text-violet-400" /> Start Fresh
              </button>
            )}

            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Vault Connected</span>
            </div>
          </div>
        </header>

        {/* Step Indicator Header */}
        <div id="step-navigation" className="flex flex-wrap items-center gap-4 bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
          <div className={`flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${currentStep === 1 ? 'text-violet-400' : 'text-slate-500'}`}>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center border text-[11px] font-mono ${currentStep === 1 ? 'border-violet-500 bg-violet-500/20 text-white shadow-[0_0_10px_rgba(124,58,237,0.3)]' : 'border-white/10 bg-white/5'}`}>01</span>
            <span>Import Raw Notes</span>
          </div>
          <div className="h-px w-6 bg-white/10 hidden sm:block" />
          <div className={`flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${currentStep === 2 ? 'text-violet-400' : 'text-slate-500'}`}>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center border text-[11px] font-mono ${currentStep === 2 ? 'border-violet-500 bg-violet-500/20 text-white shadow-[0_0_10px_rgba(124,58,237,0.3)]' : 'border-white/10 bg-white/5'}`}>02</span>
            <span>AI Structuring & Review</span>
          </div>
          <div className="h-px w-6 bg-white/10 hidden sm:block" />
          <div className={`flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${currentStep === 3 ? 'text-violet-400' : 'text-slate-500'}`}>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center border text-[11px] font-mono ${currentStep === 3 ? 'border-violet-500 bg-violet-500/20 text-white shadow-[0_0_10px_rgba(124,58,237,0.3)]' : 'border-white/10 bg-white/5'}`}>03</span>
            <span>Sync to Obsidian</span>
          </div>
        </div>

        {/* Main Step Workspace Router */}
        <main id="step-workspace-container" className="space-y-6">
          
          {/* STEP 1: UPLOAD & SETTINGS */}
          {currentStep === 1 && (
            <div id="workspace-step-1" className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-6">
                <UploadZone 
                  onNotesLoaded={handleNotesLoaded} 
                  isLoading={isParsingFiles} 
                  setIsLoading={setIsParsingFiles} 
                />
              </div>
              <div className="lg:col-span-1">
                <SyncSettings 
                  config={config} 
                  onChange={setConfig} 
                  geminiConfigured={geminiConfigured} 
                />
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW & AI RESTRUCTURING */}
          {currentStep === 2 && (
            <div id="workspace-step-2" className="space-y-6">
              
              {/* Trigger AI Banner */}
              <div className="bg-gradient-to-r from-violet-950/30 to-slate-900/40 border border-violet-500/20 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="space-y-2 relative z-10">
                  <h3 className="font-bold text-xl text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
                    Structure {rawNotes.length} notes with Gemini Intelligence
                  </h3>
                  <p className="text-sm text-slate-400 max-w-xl">
                    Our AI pipeline is primed to sanitize markdown headers, create clean hierarchical tag mappings, resolve custom categories, and output compliant frontmatter YAML code.
                  </p>
                </div>

                <div className="flex items-center gap-3 relative z-10 flex-wrap">
                  <button
                    id="btn-back-to-step1"
                    onClick={() => setCurrentStep(1)}
                    className="px-5 py-3 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 font-bold uppercase text-xs tracking-widest text-slate-300 transition-all cursor-pointer"
                  >
                    Add More Files
                  </button>

                  <button
                    id="btn-trigger-ai"
                    onClick={handleStartAIProcessing}
                    disabled={isProcessingAI || !geminiConfigured}
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_25px_rgba(124,58,237,0.4)] hover:shadow-[0_0_35px_rgba(124,58,237,0.6)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isProcessingAI ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        Structuring ({processedCount}/{rawNotes.length})...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-white" />
                        Initiate AI Conversion
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Progress Indicator */}
              {isProcessingAI && (
                <div id="ai-progress-bar" className="w-full bg-slate-900/40 border border-white/5 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-400" /> Processing queue</span>
                    <span className="font-mono text-violet-400">{Math.round((processedCount / rawNotes.length) * 100)}% ({processedCount}/{rawNotes.length} notes)</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300 rounded-full shadow-[0_0_10px_rgba(124,58,237,0.5)]"
                      style={{ width: `${(processedCount / rawNotes.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Callout */}
              {generalError && (
                <div id="ai-general-error" className="p-4 bg-red-950/20 border border-red-900/30 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="text-sm font-bold text-red-400 uppercase tracking-wide">Processing Pipeline Halted</h5>
                    <p className="text-xs text-slate-300 leading-relaxed">{generalError}</p>
                  </div>
                </div>
              )}

              {/* Duplicate Detection and Mitigation Utility */}
              {rawNotes.length > 1 && (
                <DuplicateDetector 
                  rawNotes={rawNotes}
                  convertedNotes={convertedNotes}
                  excludedNoteIds={excludedNoteIds}
                  onToggleExclude={handleToggleExcludeNote}
                  onBulkExclude={handleBulkExcludeNotes}
                />
              )}

              {/* Converted Notes Review Layout */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Extracted Queue Workspace</h4>
                  <div className="flex items-center gap-2.5">
                    {convertedNotes.some(n => n.status === 'completed') && (
                      <button
                        id="btn-trigger-manual-linking"
                        onClick={() => {
                          setConvertedNotes(prev => autoLinkNotes(prev));
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 text-violet-300 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                        title="Runs concurrent concept cross-referencing to inject Obsidian Wikilinks"
                      >
                        <Sparkles className="w-3 h-3 text-violet-400" /> Link Concepts Concurrently
                      </button>
                    )}
                    <span className="text-xs text-slate-400 bg-white/5 border border-white/5 px-2.5 py-0.5 rounded-full font-mono">
                      {convertedNotes.filter(n => !excludedNoteIds.includes(n.id)).length} / {convertedNotes.length} active items
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {rawNotes.map(raw => {
                    const converted = convertedNotes.find(c => c.id === raw.id);
                    return (
                      <NotePreviewCard
                        key={raw.id}
                        raw={raw}
                        converted={converted}
                        onUpdate={handleUpdateNote}
                        isExcluded={excludedNoteIds.includes(raw.id)}
                        onToggleExclude={() => handleToggleExcludeNote(raw.id)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Operational Code Terminal Hub */}
              {convertedNotes.some(c => c.status === 'completed' && c.codeSegments && c.codeSegments.length > 0) && (
                <CodeTerminalHub convertedNotes={convertedNotes.filter(n => !excludedNoteIds.includes(n.id))} />
              )}

              {/* Next Step Navigation */}
              <div className="flex justify-end pt-6 border-t border-white/5">
                <button
                  id="btn-goto-step3"
                  onClick={() => setCurrentStep(3)}
                  disabled={isProcessingAI || convertedNotes.filter(c => c.status === 'completed' && !excludedNoteIds.includes(c.id)).length === 0}
                  className="flex items-center gap-2 bg-white hover:bg-slate-100 text-black px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest shadow-[0_0_30px_rgba(255,255,255,0.25)] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  Proceed to Export <ArrowRight className="w-4 h-4 text-black" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: EXPORT & INTEGRATION SYNC */}
          {currentStep === 3 && (
            <div id="workspace-step-3" className="space-y-6 max-w-3xl mx-auto">
              <ObsidianExporter 
                convertedNotes={convertedNotes.filter(n => !excludedNoteIds.includes(n.id))} 
                onComplete={() => {}} 
              />

              <div className="flex justify-between pt-4">
                <button
                  id="btn-back-to-step2"
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 font-bold uppercase text-xs tracking-widest text-slate-300 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 text-violet-400" /> Back to Review Notes
                </button>
              </div>
            </div>
          )}

        </main>

        {/* Workspace info & Obsidian integration details */}
        <footer id="app-footer" className="border-t border-white/5 pt-8 mt-12 text-center space-y-4 max-w-lg mx-auto">
          <p className="text-xs text-slate-500 leading-relaxed">
            NoteShuttle structures and formats your files client-side inside secure sandbox processes. Original content parses in browser processes, while metadata & tagging are handled by server-side Gemini intelligence models.
          </p>
          <div className="flex items-center justify-center gap-2.5 text-[10px] text-slate-600 font-mono uppercase tracking-widest">
            <span>Google Takeout</span>
            <span className="text-slate-800">•</span>
            <span>Samsung Cloud</span>
            <span className="text-slate-800">•</span>
            <span>Obsidian Vault</span>
          </div>
          <div className="text-[10px] text-slate-700 tracking-widest uppercase">NoteShuttle Engine v4.2.0-Alpha</div>
        </footer>

      </div>
    </div>
  );
}
