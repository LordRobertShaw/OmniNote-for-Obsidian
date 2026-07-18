import React, { useState, useMemo } from 'react';
import { Copy, Check, Trash2, ShieldAlert, Sparkles, Sliders, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, FileText, Shuffle } from 'lucide-react';
import { RawNote, ConvertedNote } from '../types.js';

interface DuplicateDetectorProps {
  rawNotes: RawNote[];
  convertedNotes: ConvertedNote[];
  excludedNoteIds: string[];
  onToggleExclude: (id: string) => void;
  onBulkExclude: (ids: string[]) => void;
}

interface DuplicatePair {
  noteA: RawNote | ConvertedNote;
  noteB: RawNote | ConvertedNote;
  titleSimilarity: number;
  contentSimilarity: number;
  overallScore: number;
}

// Tokenize and clean text for Jaccard content similarity
function cleanAndTokenize(text: string): Set<string> {
  if (!text) return new Set();
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2); // filter short words to increase relevance
  return new Set(words);
}

// Calculate similarity based on Jaccard Index
function calculateJaccardSimilarity(text1: string, text2: string): number {
  const set1 = cleanAndTokenize(text1);
  const set2 = cleanAndTokenize(text2);
  
  if (set1.size === 0 && set2.size === 0) return 1.0;
  if (set1.size === 0 || set2.size === 0) return 0.0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

// Calculate title-specific similarity
function calculateTitleSimilarity(title1: string, title2: string): number {
  const t1 = (title1 || '').toLowerCase().trim();
  const t2 = (title2 || '').toLowerCase().trim();
  
  if (!t1 && !t2) return 1.0;
  if (!t1 || !t2) return 0.0;
  if (t1 === t2) return 1.0;
  
  // If one title is a complete substring of another
  if (t1.includes(t2) || t2.includes(t1)) {
    return Math.min(t1.length, t2.length) / Math.max(t1.length, t2.length);
  }
  
  return calculateJaccardSimilarity(t1, t2);
}

export default function DuplicateDetector({
  rawNotes,
  convertedNotes,
  excludedNoteIds,
  onToggleExclude,
  onBulkExclude
}: DuplicateDetectorProps) {
  const [threshold, setThreshold] = useState<number>(65); // Default 65% similarity threshold
  const [expandedPairIndex, setExpandedPairIndex] = useState<number | null>(null);
  const [showConfig, setShowConfig] = useState<boolean>(true);

  // Scan for duplicate pairs based on current state of notes
  const duplicatePairs = useMemo(() => {
    const pairs: DuplicatePair[] = [];
    const notesToCompare = rawNotes.map(raw => {
      const converted = convertedNotes.find(c => c.id === raw.id);
      return {
        id: raw.id,
        title: converted?.title || raw.title || "Untitled Note",
        content: raw.content || "",
        source: raw.source,
        raw
      };
    });

    for (let i = 0; i < notesToCompare.length; i++) {
      for (let j = i + 1; j < notesToCompare.length; j++) {
        const noteA = notesToCompare[i];
        const noteB = notesToCompare[j];

        const titleSim = calculateTitleSimilarity(noteA.title, noteB.title);
        const contentSim = calculateJaccardSimilarity(noteA.content, noteB.content);
        
        // Weighted similarity: 35% Title + 65% Content
        const overallScore = (titleSim * 0.35) + (contentSim * 0.65);

        // Map score to 0 - 100 percentage
        const overallPct = Math.round(overallScore * 100);

        if (overallPct >= threshold) {
          pairs.push({
            noteA: noteA.raw,
            noteB: noteB.raw,
            titleSimilarity: Math.round(titleSim * 100),
            contentSimilarity: Math.round(contentSim * 100),
            overallScore: overallPct
          });
        }
      }
    }

    // Sort by highest similarity score first
    return pairs.sort((a, b) => b.overallScore - a.overallScore);
  }, [rawNotes, convertedNotes, threshold]);

  // Bulk operation helpers
  const handleExcludeAllDuplicates = () => {
    // For each pair, we keep the first note (A) and exclude the second note (B) to resolve redundant copies.
    const idsToExclude = new Set<string>();
    duplicatePairs.forEach(pair => {
      // Exclude noteB if neither is already excluded
      if (!excludedNoteIds.includes(pair.noteA.id) && !excludedNoteIds.includes(pair.noteB.id)) {
        idsToExclude.add(pair.noteB.id);
      }
    });
    
    if (idsToExclude.size > 0) {
      onBulkExclude(Array.from(idsToExclude));
    }
  };

  const handleClearExclusions = () => {
    onBulkExclude([]);
  };

  return (
    <div id="duplicate-detection-utility" className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 backdrop-blur-md relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.4)]">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white uppercase text-xs tracking-wider">Duplicate Detection Utility</h3>
            <p className="text-xs text-slate-400 mt-0.5">Scan files using advanced title matching and Content Jaccard algorithms</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:border-white/15 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-violet-400" />
            {showConfig ? "Hide Tuner" : "Tune Threshold"}
          </button>

          {duplicatePairs.length > 0 && (
            <button
              onClick={handleExcludeAllDuplicates}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer shadow-[0_0_10px_rgba(124,58,237,0.3)]"
            >
              <Trash2 className="w-3.5 h-3.5 text-white" />
              Resolve Redundancy
            </button>
          )}

          {excludedNoteIds.length > 0 && (
            <button
              onClick={handleClearExclusions}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer"
            >
              Reset Excluded ({excludedNoteIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Configuration Sliders Panel */}
      {showConfig && (
        <div className="bg-[#050507]/40 border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Scan Sensitivity Threshold</span>
              <p className="text-xs text-slate-400">Lower matches capture loose content overlap; higher matches focus on precise duplicates.</p>
            </div>
            <span className="text-sm font-bold font-mono text-violet-400 bg-violet-500/10 border border-violet-500/20 px-3 py-1 rounded-xl self-start">
              {threshold}% Match Rate
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold font-mono text-slate-600">10% (Wide)</span>
            <input
              type="range"
              min="10"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="flex-1 h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-violet-600"
            />
            <span className="text-[10px] font-bold font-mono text-slate-600">100% (Exact)</span>
          </div>
        </div>
      )}

      {/* Duplicate Pairs List */}
      {duplicatePairs.length === 0 ? (
        <div className="bg-[#050507]/20 border border-dashed border-white/5 rounded-2xl py-8 px-4 text-center space-y-2">
          <div className="inline-flex w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center text-emerald-400 mb-1">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">No duplicate items flagged</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Your note directory is perfectly clean at the current {threshold}% similarity threshold level.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold text-slate-500">
            <span>Flagged Redundancy Pairs ({duplicatePairs.length})</span>
            <span>Click card to inspect comparison</span>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {duplicatePairs.map((pair, index) => {
              const isAExcluded = excludedNoteIds.includes(pair.noteA.id);
              const isBExcluded = excludedNoteIds.includes(pair.noteB.id);
              const isExpanded = expandedPairIndex === index;

              return (
                <div 
                  key={index}
                  className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
                    isExpanded 
                      ? "border-violet-500 bg-violet-600/5 shadow-lg" 
                      : "border-white/5 bg-[#050507]/30 hover:border-white/10"
                  }`}
                >
                  {/* Collapsed Header Bar */}
                  <div 
                    onClick={() => setExpandedPairIndex(isExpanded ? null : index)}
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-2 h-2 rounded-full ${isAExcluded ? 'bg-rose-500/50' : 'bg-emerald-500 animate-pulse'}`} />
                        <span className={`text-xs font-bold font-mono truncate text-white ${isAExcluded ? 'line-through text-slate-600' : ''}`}>
                          {pair.noteA.title || "Untitled Note"}
                        </span>
                        <span className="text-[9px] uppercase font-bold text-slate-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                          {pair.noteA.source === 'keep' ? 'Keep' : 'Samsung'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-2 h-2 rounded-full ${isBExcluded ? 'bg-rose-500/50' : 'bg-emerald-500 animate-pulse'}`} />
                        <span className={`text-xs font-bold font-mono truncate text-white ${isBExcluded ? 'line-through text-slate-600' : ''}`}>
                          {pair.noteB.title || "Untitled Note"}
                        </span>
                        <span className="text-[9px] uppercase font-bold text-slate-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                          {pair.noteB.source === 'keep' ? 'Keep' : 'Samsung'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 font-mono text-[10px] font-bold text-violet-400">
                        <Sparkles className="w-3 h-3 text-violet-400" />
                        <span>{pair.overallScore}% match</span>
                      </div>
                      
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </div>

                  {/* Expanded Detailed Comparison Area */}
                  {isExpanded && (
                    <div className="border-t border-white/5 p-5 bg-black/40 space-y-4">
                      {/* Comparison Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                        <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                          <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest">Title Similarity</span>
                          <span className="text-sm font-bold font-mono text-white mt-1 block">{pair.titleSimilarity}%</span>
                        </div>
                        <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                          <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest">Content Similarity</span>
                          <span className="text-sm font-bold font-mono text-white mt-1 block">{pair.contentSimilarity}%</span>
                        </div>
                        <div className="col-span-2 md:col-span-1 bg-violet-500/10 border border-violet-500/20 rounded-xl p-3">
                          <span className="block text-[9px] font-bold text-violet-400 uppercase tracking-widest">Composite Score</span>
                          <span className="text-sm font-bold font-mono text-violet-400 mt-1 block">{pair.overallScore}% match</span>
                        </div>
                      </div>

                      {/* Side by side contents */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Note A Card */}
                        <div className={`p-4 rounded-xl border space-y-3 transition-all ${isAExcluded ? 'border-red-500/20 bg-red-950/5' : 'border-white/5 bg-black/40'}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Note File A</span>
                            <button
                              onClick={() => onToggleExclude(pair.noteA.id)}
                              className={`px-2 py-1 rounded text-[9px] uppercase font-bold tracking-widest transition-all ${
                                isAExcluded 
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                                  : "bg-white/5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/5"
                              }`}
                            >
                              {isAExcluded ? "Excluded" : "Exclude note"}
                            </button>
                          </div>
                          <div>
                            <h5 className="font-bold text-xs text-white truncate">{pair.noteA.title || "Untitled"}</h5>
                            <span className="text-[10px] font-mono text-slate-500">Length: {pair.noteA.content?.length || 0} chars</span>
                          </div>
                          <div className="bg-black/60 p-3 rounded-lg border border-white/5 max-h-32 overflow-y-auto text-[11px] font-mono text-slate-400 leading-relaxed whitespace-pre-wrap">
                            {pair.noteA.content}
                          </div>
                        </div>

                        {/* Note B Card */}
                        <div className={`p-4 rounded-xl border space-y-3 transition-all ${isBExcluded ? 'border-red-500/20 bg-red-950/5' : 'border-white/5 bg-black/40'}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Note File B</span>
                            <button
                              onClick={() => onToggleExclude(pair.noteB.id)}
                              className={`px-2 py-1 rounded text-[9px] uppercase font-bold tracking-widest transition-all ${
                                isBExcluded 
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                                  : "bg-white/5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/5"
                              }`}
                            >
                              {isBExcluded ? "Excluded" : "Exclude note"}
                            </button>
                          </div>
                          <div>
                            <h5 className="font-bold text-xs text-white truncate">{pair.noteB.title || "Untitled"}</h5>
                            <span className="text-[10px] font-mono text-slate-500">Length: {pair.noteB.content?.length || 0} chars</span>
                          </div>
                          <div className="bg-black/60 p-3 rounded-lg border border-white/5 max-h-32 overflow-y-auto text-[11px] font-mono text-slate-400 leading-relaxed whitespace-pre-wrap">
                            {pair.noteB.content}
                          </div>
                        </div>
                      </div>

                      {/* Quick action helper footer */}
                      <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl text-[11px] font-mono text-slate-400">
                        <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /> Choose which copy to export to Obsidian. Excluded notes will be safely omitted.</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
