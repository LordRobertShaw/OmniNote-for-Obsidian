/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Upload, FileDown, HelpCircle, FileText, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { RawNote } from '../types.js';
import { parseUploadedFiles } from '../utils/fileParser.js';

interface UploadZoneProps {
  onNotesLoaded: (notes: RawNote[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function UploadZone({ onNotesLoaded, isLoading, setIsLoading }: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [showHelp, setShowHelp] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFiles = async (files: FileList) => {
    if (files.length === 0) return;
    setIsLoading(true);
    try {
      const parsed = await parseUploadedFiles(files);
      onNotesLoaded(parsed);
    } catch (err) {
      console.error(err);
      alert("Error parsing notes. Please make sure they are in Google Keep JSON or Samsung Note TXT format.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const toggleHelp = (source: string) => {
    setShowHelp(showHelp === source ? null : source);
  };

  return (
    <div id="upload-zone-container" className="space-y-6">
      {/* Main Drag & Drop Zone */}
      <div
        id="drag-drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-300 ${
          isDragActive
            ? "border-violet-500 bg-violet-600/5 shadow-[0_0_25px_rgba(124,58,237,0.25)]"
            : "border-white/10 hover:border-violet-500/40 bg-white/5 hover:bg-white/10"
        } ${isLoading ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          id="file-input-raw"
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".zip,.json,.txt,.html"
          onChange={handleFileInput}
        />

        <div className="max-w-md mx-auto space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 text-slate-400 group-hover:text-white transition-colors border border-white/5">
            <Upload className={`w-8 h-8 ${isDragActive ? "text-violet-400 animate-bounce" : "text-slate-400"}`} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight text-white uppercase">
              {isDragActive ? "Drop your files here!" : "Upload your exported notes"}
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Drag & drop your Google Takeout <span className="text-violet-400 font-bold font-mono">ZIP</span>, Keep JSONs, or Samsung Notes <span className="text-violet-400 font-bold font-mono">TXT</span> exports directly here.
            </p>
          </div>

          <div className="inline-block px-8 py-3.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold uppercase text-xs tracking-widest transition-all shadow-[0_0_20px_rgba(124,58,237,0.35)]">
            {isLoading ? "Reading archive..." : "Select Files or Folders"}
          </div>

          <div className="flex justify-center items-center gap-6 pt-4 text-xs text-slate-500 font-mono">
            <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <FileText className="w-3.5 h-3.5 text-violet-400" /> Keep Takeout (.zip/.json)
            </span>
            <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <FileText className="w-3.5 h-3.5 text-violet-400" /> Samsung Export (.txt/.html)
            </span>
          </div>
        </div>
      </div>

      {/* Guide Cards */}
      <div id="export-instructions" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Google Keep Guide */}
        <div id="google-keep-guide" className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 hover:border-violet-500/20 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 font-bold text-lg font-mono">
                G
              </div>
              <div>
                <h4 className="font-bold text-white uppercase text-xs tracking-wider">Google Keep Notes</h4>
                <p className="text-xs text-slate-400 mt-0.5">Export via Google Takeout</p>
              </div>
            </div>
            <button
              id="toggle-keep-help"
              onClick={() => toggleHelp('keep')}
              className="text-slate-500 hover:text-white transition-colors p-1"
              aria-label="How to export"
            >
              {showHelp === 'keep' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>

          {showHelp === 'keep' && (
            <div className="mt-4 pt-4 border-t border-white/5 space-y-2 text-xs text-slate-300">
              <p className="font-bold text-violet-400 uppercase tracking-widest text-[10px]">Step-by-step Export guide:</p>
              <ol className="list-decimal pl-4 space-y-1.5 text-slate-400">
                <li>Go to <a href="https://takeout.google.com" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">takeout.google.com</a> in a new tab.</li>
                <li>Click <span className="text-white font-medium">"Deselect all"</span> to avoid downloading your entire account.</li>
                <li>Scroll down, find <span className="text-white font-medium">Keep</span>, and check its box.</li>
                <li>Click <span className="text-white font-medium">"Next step"</span> at the bottom.</li>
                <li>Select <span className="text-white font-medium">"Export once"</span> and click <span className="text-white font-medium">"Create export"</span>.</li>
                <li>Google will email a link. Download the <span className="text-violet-400 font-mono">ZIP</span> file and upload it above.</li>
              </ol>
            </div>
          )}
        </div>

        {/* Samsung Notes Guide */}
        <div id="samsung-notes-guide" className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 hover:border-violet-500/20 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-lg font-mono">
                S
              </div>
              <div>
                <h4 className="font-bold text-white uppercase text-xs tracking-wider">Samsung Notes</h4>
                <p className="text-xs text-slate-400 mt-0.5">Export as TXT / HTML files</p>
              </div>
            </div>
            <button
              id="toggle-samsung-help"
              onClick={() => toggleHelp('samsung')}
              className="text-slate-500 hover:text-white transition-colors p-1"
              aria-label="How to export"
            >
              {showHelp === 'samsung' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>

          {showHelp === 'samsung' && (
            <div className="mt-4 pt-4 border-t border-white/5 space-y-2 text-xs text-slate-300">
              <p className="font-bold text-violet-400 uppercase tracking-widest text-[10px]">Step-by-step Export guide:</p>
              <ol className="list-decimal pl-4 space-y-1.5 text-slate-400">
                <li>Open the <span className="text-white font-medium">Samsung Notes</span> app on your phone.</li>
                <li>Tap and hold on a note, then select all notes you want to transfer.</li>
                <li>Tap the <span className="text-violet-400 font-bold">Share</span> or <span className="text-white font-medium">Save as file</span> button.</li>
                <li>Select <span className="text-white font-medium">"Text file (.txt)"</span> or <span className="text-white font-medium">"HTML file"</span>.</li>
                <li>Save them to a folder on your device.</li>
                <li>Zip them up or upload the loose <span className="text-violet-400 font-mono">TXT</span> files directly above.</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
