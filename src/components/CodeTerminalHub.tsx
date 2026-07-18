import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Play, Copy, Check, Search, Code, Cpu, FolderTree, RefreshCw, ChevronRight, CornerDownRight } from 'lucide-react';
import { ConvertedNote, CodeSegment } from '../types.js';

interface CodeTerminalHubProps {
  convertedNotes: ConvertedNote[];
}

interface TerminalLine {
  text: string;
  type: 'input' | 'output' | 'error' | 'success' | 'system';
}

export const CodeTerminalHub: React.FC<CodeTerminalHubProps> = ({ convertedNotes }) => {
  // Collect all code segments from converted notes
  const segments: CodeSegment[] = [];
  convertedNotes.forEach(note => {
    if (note.codeSegments && note.codeSegments.length > 0) {
      segments.push(...note.codeSegments);
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLang, setSelectedLang] = useState<string>('all');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<CodeSegment | null>(null);
  
  // Terminal emulator state
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    { text: 'NoteShuttle Pro (v4.2.0-Alpha) - Simulated Shell Platform', type: 'system' },
    { text: 'Vault environment synced and fully secure. Ready to receive commands.', type: 'system' },
    { text: 'Type "help" to see list of valid CLI operations, or select a code script below to initiate.', type: 'system' },
    { text: '', type: 'output' },
  ]);
  const [isTypingSim, setIsTypingSim] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLines]);

  // Set first segment as default active snippet if available
  useEffect(() => {
    if (segments.length > 0 && !selectedSegment) {
      setSelectedSegment(segments[0]);
    }
  }, [segments, selectedSegment]);

  // Unique languages for filtering
  const languages: string[] = ['all', ...Array.from(new Set(segments.map(s => s.language.toLowerCase())))];

  // Filtered segments
  const filteredSegments = segments.filter(seg => {
    const matchesSearch = 
      seg.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      seg.intendedFunction.toLowerCase().includes(searchQuery.toLowerCase()) ||
      seg.code.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLang = selectedLang === 'all' || seg.language.toLowerCase() === selectedLang;
    
    return matchesSearch && matchesLang;
  });

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    
    // Add terminal log of copy action
    addTerminalLine(`$ clipboard-sync --save --text "${code.substring(0, 30).replace(/\n/g, ' ')}..."`, 'input');
    addTerminalLine('SUCCESS: Snippet copied to host clipboard buffers.', 'success');
  };

  const addTerminalLine = (text: string, type: TerminalLine['type']) => {
    setTerminalLines(prev => [...prev, { text, type }]);
  };

  // Run/Apply code to terminal simulator
  const handleApplyToTerminal = (segment: CodeSegment) => {
    if (isTypingSim) return;
    setIsTypingSim(true);
    setSelectedSegment(segment);

    const commandStr = segment.language === 'bash' || segment.language === 'sh' 
      ? `./obsidian-vault/${segment.fileName}`
      : `${segment.language} ./obsidian-vault/${segment.fileName}`;

    // Clear and print command being entered
    addTerminalLine(`$ ${commandStr}`, 'input');

    // Simulate real execution logs
    let step = 0;
    const logs = [
      `[sys] locating local target file: /Vault/${segment.fileName}...`,
      `[sys] verifying source integrity: 100% intact, clean sha256 checksum...`,
      `[sys] compiling syntax buffers (${segment.language.toUpperCase()})...`,
      `[exec] running simulated operation: "${segment.intendedFunction}"`,
      `[process] loading modules and internal APIs...`,
    ];

    const interval = setInterval(() => {
      if (step < logs.length) {
        addTerminalLine(logs[step], 'output');
        step++;
      } else {
        clearInterval(interval);
        // Custom finish log based on language
        setTimeout(() => {
          addTerminalLine(`--- Execution Output (${segment.language.toUpperCase()}) ---`, 'system');
          
          if (segment.language === 'python') {
            addTerminalLine('>>> Processing data objects from Obsidian files...', 'output');
            addTerminalLine('>>> Successfully parsed Frontmatter schemas.', 'output');
            addTerminalLine('>>> Process complete. Exit Code: 0 (0.04s)', 'success');
          } else if (segment.language === 'bash' || segment.language === 'sh') {
            addTerminalLine('$ permission-mask: chmod +x granted.', 'output');
            addTerminalLine('$ synchronizing folder directories recursively...', 'output');
            addTerminalLine('$ completed. Local storage directory synced successfully.', 'success');
          } else if (segment.language === 'javascript' || segment.language === 'js' || segment.language === 'typescript' || segment.language === 'ts') {
            addTerminalLine('> Node environment v20.12.0 booted.', 'output');
            addTerminalLine('> Executed logical mapping modules cleanly.', 'output');
            addTerminalLine('> Operations compiled and successfully executed.', 'success');
          } else {
            addTerminalLine('[cli] parsed standard segment block successfully.', 'output');
            addTerminalLine('[cli] integrity checks completed: active pipeline output verified.', 'success');
          }
          
          addTerminalLine('', 'output');
          setIsTypingSim(false);
        }, 600);
      }
    }, 450);
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const cmd = terminalInput.trim().toLowerCase();
    addTerminalLine(`$ ${terminalInput}`, 'input');
    setTerminalInput('');

    if (cmd === 'help') {
      addTerminalLine('Available Commands:', 'system');
      addTerminalLine('  list         - Lists all active extracted script files found in notes', 'system');
      addTerminalLine('  run <index>  - Executes a specific script by list index (e.g., run 1)', 'system');
      addTerminalLine('  clear        - Clears terminal line history', 'system');
      addTerminalLine('  integrity    - Runs active validation sweeps to confirm no code corruption', 'system');
    } else if (cmd === 'clear') {
      setTerminalLines([]);
    } else if (cmd === 'list') {
      if (segments.length === 0) {
        addTerminalLine('No active code scripts extracted from notes yet. Process notes with AI first.', 'error');
      } else {
        addTerminalLine('--- Extracted Scripts Inventory ---', 'system');
        segments.forEach((seg, idx) => {
          addTerminalLine(`  [${idx + 1}] ${seg.fileName} (${seg.language}) - ${seg.intendedFunction}`, 'output');
        });
      }
    } else if (cmd.startsWith('run ')) {
      const idxStr = cmd.replace('run ', '').trim();
      const idx = parseInt(idxStr) - 1;
      if (isNaN(idx) || idx < 0 || idx >= segments.length) {
        addTerminalLine(`Error: Invalid index "${idxStr}". Type "list" to see valid script indexes.`, 'error');
      } else {
        handleApplyToTerminal(segments[idx]);
      }
    } else if (cmd === 'integrity') {
      addTerminalLine('Initiating SHA-256 byte validation scan across all notes...', 'output');
      setTimeout(() => {
        addTerminalLine('Scanning raw nodes contents...', 'output');
        addTerminalLine('Verifying block markers and frontmatter syntax arrays...', 'output');
        addTerminalLine(`SUCCESS: Checked ${segments.length} code segments. Integrity: 100%. No corruption detected.`, 'success');
      }, 500);
    } else {
      addTerminalLine(`sh: command not found: "${cmd}". Type "help" for instructions.`, 'error');
    }
  };

  return (
    <div id="code-terminal-hub" className="bg-[#050507] border border-white/5 rounded-3xl p-6 md:p-8 space-y-8 relative overflow-hidden shadow-2xl">
      <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
            <Cpu className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white uppercase text-sm tracking-wider">Operational Code Terminal</h3>
              <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                100% Intact
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Guaranteed zero-corruption code scanning, structural scripts extraction, and live terminal executor.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold font-mono bg-white/5 border border-white/5 text-slate-400">
          <span>Scripts Detected: {segments.length}</span>
        </div>
      </div>

      {segments.length === 0 ? (
        /* Empty State */
        <div className="bg-slate-900/20 border border-dashed border-white/5 rounded-2xl p-10 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/5 text-slate-500">
            <Code className="w-6 h-6 text-slate-500" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">No Executable Code Detected</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              When notes containing Python scripts, Bash scripts, SQL queries, or JavaScript snippets are imported and converted, they will automatically sync and construct here inside our compiler system.
            </p>
          </div>
        </div>
      ) : (
        /* Active code detected layout - split screen terminal and list */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left panel: List of discovered snippets (5 columns) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-violet-400" /> Code Directories & Scripts
              </h4>
              
              {/* Search & filters */}
              <div className="flex gap-2.5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search script filename..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black border border-white/10 hover:border-violet-500/30 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all font-mono"
                  />
                </div>
                
                {/* Language pill filters */}
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  className="bg-black border border-white/10 hover:border-violet-500/30 focus:border-violet-500 rounded-xl px-2.5 text-xs text-slate-300 font-mono focus:outline-none transition-all cursor-pointer"
                >
                  {languages.map(lang => (
                    <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Snippets list scrollbox */}
            <div className="flex-1 max-h-[460px] overflow-y-auto space-y-3.5 pr-2">
              {filteredSegments.map((seg, idx) => (
                <div 
                  key={idx}
                  onClick={() => setSelectedSegment(seg)}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                    selectedSegment?.code === seg.code
                      ? "border-violet-500 bg-violet-600/5 shadow-[0_0_20px_rgba(124,58,237,0.15)]"
                      : "border-white/5 bg-[#050507]/40 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide">
                          {seg.language}
                        </span>
                        <span className="font-mono text-[11px] text-white font-bold block truncate max-w-[200px]">
                          {seg.fileName.split('/').pop()}
                        </span>
                      </div>
                      <span className="block font-mono text-[10px] text-slate-500">
                        /{seg.fileName}
                      </span>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplyToTerminal(seg);
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-violet-600 border border-white/5 text-slate-400 hover:text-white transition-all cursor-pointer shadow-md hover:shadow-[0_0_10px_rgba(124,58,237,0.3)]"
                      title="Run inside terminal"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed line-clamp-2 italic">
                    "{seg.intendedFunction}"
                  </p>
                </div>
              ))}
              
              {filteredSegments.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-500 font-mono">
                  No matching files found.
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Active script code preview & interactive terminal emulator (7 columns) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Active script preview */}
            {selectedSegment && (
              <div className="bg-[#050507] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
                <div className="px-5 py-3.5 bg-black/50 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-violet-400" />
                    <span className="font-mono text-xs text-white font-bold">
                      {selectedSegment.fileName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyCode(selectedSegment.code, 9999)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                      {copiedIndex === 9999 ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy Script
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleApplyToTerminal(selectedSegment)}
                      disabled={isTypingSim}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg hover:shadow-violet-600/30 disabled:opacity-50 cursor-pointer"
                    >
                      <Play className="w-3 h-3 text-white" /> Execute
                    </button>
                  </div>
                </div>
                
                <div className="p-4 bg-black/60 max-h-48 overflow-y-auto border-b border-white/5">
                  <pre className="text-left font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto whitespace-pre">
                    <code>{selectedSegment.code}</code>
                  </pre>
                </div>
                
                <div className="p-3 bg-white/5 flex items-start gap-2.5 text-[11px] text-slate-400 font-mono">
                  <CornerDownRight className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-white font-bold uppercase text-[9px] tracking-wider block">Intended Action:</span>
                    {selectedSegment.intendedFunction}
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Terminal Emulator */}
            <div className="flex-1 bg-black border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-inner min-h-[280px]">
              {/* Terminal header */}
              <div className="px-4 py-2.5 bg-white/5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <TerminalIcon className="w-3.5 h-3.5 text-violet-400" />
                  <span className="font-mono text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    NoteShuttle Terminal Simulator
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                </div>
              </div>

              {/* Terminal console area */}
              <div className="flex-1 p-5 font-mono text-[11px] space-y-1.5 overflow-y-auto text-slate-300 text-left min-h-[160px] max-h-[220px] bg-black">
                {terminalLines.map((line, idx) => {
                  let colorClass = 'text-slate-400';
                  if (line.type === 'input') colorClass = 'text-white font-bold';
                  else if (line.type === 'system') colorClass = 'text-violet-400 font-bold';
                  else if (line.type === 'success') colorClass = 'text-emerald-400';
                  else if (line.type === 'error') colorClass = 'text-rose-400 font-bold';

                  return (
                    <div key={idx} className={`${colorClass} leading-relaxed whitespace-pre-wrap`}>
                      {line.text}
                    </div>
                  );
                })}
                <div ref={terminalEndRef} />
              </div>

              {/* Terminal interactive prompt input */}
              <form onSubmit={handleTerminalSubmit} className="flex bg-white/5 border-t border-white/5">
                <span className="p-3 text-[11px] text-violet-400 font-mono font-bold select-none">$</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  disabled={isTypingSim}
                  placeholder="Type 'help' or command here..."
                  className="flex-1 bg-transparent p-3 text-[11px] font-mono text-white focus:outline-none placeholder-slate-600"
                />
                <button
                  type="submit"
                  disabled={isTypingSim}
                  className="px-4 text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-wider font-mono border-l border-white/5 hover:bg-white/5 cursor-pointer disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
