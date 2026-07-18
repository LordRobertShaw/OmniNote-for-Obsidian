/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FolderHeart, Download, HelpCircle, CheckCircle2, RefreshCw, Terminal, Sparkles, FolderOpen } from 'lucide-react';
import JSZip from 'jszip';
import { ConvertedNote } from '../types.js';

interface ObsidianExporterProps {
  convertedNotes: ConvertedNote[];
  onComplete: () => void;
}

export default function ObsidianExporter({ convertedNotes, onComplete }: ObsidianExporterProps) {
  const [syncMode, setSyncMode] = useState<'direct' | 'zip' | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'completed' | 'failed'>('idle');
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const addLog = (msg: string) => {
    setSyncLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Direct sync into the Obsidian Vault using File System Access API (showDirectoryPicker)
  const handleDirectSync = async () => {
    setSyncMode('direct');
    setSyncStatus('syncing');
    setSyncLog([]);
    setErrorMsg(null);
    addLog("Initializing local Obsidian Vault Directory Picker...");

    try {
      // Check if feature is supported in browser
      if (!('showDirectoryPicker' in window)) {
        throw new Error("Your current browser does not fully support direct directory write access. Please use the 'Download Vault ZIP' option instead (compatible with all browsers).");
      }

      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });

      addLog(`Selected directory: ${dirHandle.name}. Requesting permission write...`);

      let successCount = 0;
      let folderMap = new Map<string, any>();

      for (const note of convertedNotes) {
        if (note.status !== 'completed') continue;

        try {
          addLog(`Syncing note: "${note.title}.md"`);
          
          // Resolve/Create Category Subdirectories recursively
          let currentDirHandle = dirHandle;
          if (note.categoryPath && note.categoryPath.trim() !== "") {
            const pathParts = note.categoryPath.split('/').map(p => p.trim()).filter(p => p.length > 0);
            
            for (const part of pathParts) {
              const cacheKey = `${currentDirHandle.name}/${part}`;
              if (folderMap.has(cacheKey)) {
                currentDirHandle = folderMap.get(cacheKey);
              } else {
                addLog(`Creating subfolder structure: "${part}"`);
                currentDirHandle = await currentDirHandle.getDirectoryHandle(part, { create: true });
                folderMap.set(cacheKey, currentDirHandle);
              }
            }
          }

          // Create & Write the .md file
          const fileName = `${note.title}.md`;
          const fileHandle = await currentDirHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(note.markdown);
          await writable.close();

          successCount++;
        } catch (noteErr: any) {
          addLog(`⚠️ Warning: Failed to write note "${note.title}": ${noteErr.message || 'unknown'}`);
        }
      }

      addLog(`✨ Migration successful! ${successCount} notes synced directly to your local Obsidian Vault.`);
      setSyncStatus('completed');
      onComplete();

    } catch (err: any) {
      console.error(err);
      if (err.name === 'AbortError') {
        addLog("Sync aborted: Directory picker was canceled.");
        setSyncStatus('idle');
      } else {
        addLog(`❌ Error: ${err.message || 'failed directory write access.'}`);
        setErrorMsg(err.message || "Failed to access local file structure.");
        setSyncStatus('failed');
      }
    }
  };

  // Generate and Download an organized ZIP file containing matching folder hierarchies
  const handleZipExport = async () => {
    setSyncMode('zip');
    setSyncStatus('syncing');
    setSyncLog([]);
    setErrorMsg(null);
    addLog("Compressing Obsidian Vault assets...");

    try {
      const zip = new JSZip();
      let successCount = 0;

      for (const note of convertedNotes) {
        if (note.status !== 'completed') continue;

        addLog(`Bundling note: "${note.title}.md"`);
        
        // Resolve target folder hierarchy in zip structure
        let targetFolder = zip;
        if (note.categoryPath && note.categoryPath.trim() !== "") {
          targetFolder = zip.folder(note.categoryPath) || zip;
        }

        // Add file
        targetFolder.file(`${note.title}.md`, note.markdown);
        successCount++;
      }

      addLog("Generating file download blob...");
      const content = await zip.generateAsync({ type: "blob" });
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = "obsidian_imported_notes.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addLog("✨ Archive downloaded successfully! Extract this ZIP directly inside your Obsidian Vault folder.");
      setSyncStatus('completed');
      onComplete();

    } catch (err: any) {
      console.error(err);
      addLog(`❌ ZIP compression error: ${err.message}`);
      setErrorMsg(err.message || "Failed to compress note archives.");
      setSyncStatus('failed');
    }
  };

  const isFSAAvailable = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  return (
    <div id="obsidian-exporter" className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 backdrop-blur-md">
      <div className="flex items-center gap-3 border-b border-white/5 pb-5">
        <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.4)]">
          <FolderHeart className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div>
          <h3 className="font-bold text-white uppercase text-xs tracking-wider">Export Structured Vault</h3>
          <p className="text-xs text-slate-400 mt-0.5">Transfer converted notes into your Obsidian workspace</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Method 1: Local Vault Direct Sync (File System Access API) */}
        <div id="export-direct-method" className={`border rounded-2xl p-6 space-y-4 flex flex-col justify-between transition-all ${
          isFSAAvailable 
            ? "border-white/5 bg-[#050507]/40 hover:border-violet-500/20" 
            : "border-white/5 bg-white/5 opacity-50"
        }`}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-[10px] font-bold font-mono text-violet-400">01</span>
              <h4 className="font-bold text-white uppercase text-xs tracking-wider">Sync directly into Obsidian</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Open your local Obsidian Vault folder using the directory picker. The app will write and organize converted folders and files directly in-place.
            </p>
            <div className="pt-1">
              <span className="inline-block text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-widest">
                Highly Recommended & Seamless
              </span>
            </div>
          </div>

          <button
            id="btn-direct-sync"
            onClick={handleDirectSync}
            disabled={syncStatus === 'syncing' || !isFSAAvailable}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              isFSAAvailable
                ? "bg-violet-600 hover:bg-violet-700 text-white shadow-[0_0_20px_rgba(124,58,237,0.35)] cursor-pointer"
                : "bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed"
            }`}
          >
            {syncStatus === 'syncing' && syncMode === 'direct' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                Writing to Obsidian...
              </>
            ) : (
              <>
                <FolderOpen className="w-4 h-4 text-white" />
                Select Obsidian Vault Folder
              </>
            )}
          </button>
        </div>

        {/* Method 2: Fallback ZIP Download */}
        <div id="export-zip-method" className="border border-white/5 bg-[#050507]/40 hover:border-violet-500/20 rounded-2xl p-6 space-y-4 flex flex-col justify-between transition-all">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-[10px] font-bold font-mono text-violet-400">02</span>
              <h4 className="font-bold text-white uppercase text-xs tracking-wider">Download formatted ZIP</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Export all converted notes inside a single zipped folder that mirrors your new structured folder tree. Simply download, unzip, and extract into Obsidian.
            </p>
            <div className="pt-1">
              <span className="inline-block text-[9px] bg-white/5 border border-white/5 text-slate-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-widest">
                Universal Fallback & Compatible
              </span>
            </div>
          </div>

          <button
            id="btn-zip-sync"
            onClick={handleZipExport}
            disabled={syncStatus === 'syncing'}
            className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 text-slate-300 hover:text-white px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
          >
            {syncStatus === 'syncing' && syncMode === 'zip' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                Creating Zip...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-slate-300" />
                Download organized Vault ZIP
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sync Logging Console */}
      {syncLog.length > 0 && (
        <div id="sync-console-logs" className="space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-slate-500">
            <span className="flex items-center gap-1.5 font-mono">
              <Terminal className="w-3.5 h-3.5 text-violet-400" /> Migration Console Logs
            </span>
            {syncStatus === 'syncing' && (
              <span className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-lg animate-pulse">Running task...</span>
            )}
          </div>
          
          <div className="bg-black p-5 rounded-2xl border border-white/5 font-mono text-[11px] text-slate-400 space-y-1.5 max-h-52 overflow-y-auto leading-relaxed shadow-inner">
            {syncLog.map((log, idx) => (
              <div key={idx} className={log.includes('❌') ? 'text-rose-400' : log.includes('✨') ? 'text-emerald-400 font-bold' : log.includes('⚠️') ? 'text-yellow-400' : ''}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success Celebration state */}
      {syncStatus === 'completed' && (
        <div id="sync-success-celebration" className="p-5 bg-emerald-950/20 border border-emerald-900/30 rounded-2xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h5 className="text-sm font-bold text-emerald-400 uppercase tracking-widest text-xs">Sync Successful</h5>
            <p className="text-xs text-slate-300 leading-relaxed">
              {syncMode === 'direct' 
                ? "Your notes are now fully integrated inside your local Obsidian vault. Simply open Obsidian to explore your beautifully structured and indexed notes!" 
                : "Your ZIP archive is ready! Simply move the unzipped folders directly into your local Obsidian Vault directory."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
