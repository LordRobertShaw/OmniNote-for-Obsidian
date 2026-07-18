/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, Sliders, Folder, HelpCircle, FileCheck, Database } from 'lucide-react';
import { MigrationConfig } from '../types.js';

interface SyncSettingsProps {
  config: MigrationConfig;
  onChange: (config: MigrationConfig) => void;
  geminiConfigured: boolean;
}

export default function SyncSettings({ config, onChange, geminiConfigured }: SyncSettingsProps) {
  const toggleSetting = (key: keyof Omit<MigrationConfig, 'defaultFolder' | 'targetSystem'>) => {
    onChange({
      ...config,
      [key]: !config[key],
    });
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...config,
      defaultFolder: e.target.value,
    });
  };

  const handleSystemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...config,
      targetSystem: e.target.value as any,
    });
  };

  return (
    <div id="sync-settings" className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 space-y-6 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-violet-400" />
          <h3 className="font-bold text-white uppercase text-xs tracking-wider">Migration Preferences</h3>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-violet-500/10 text-violet-400 border border-violet-500/20">
          <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
          <span>AI Pipeline Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Toggle List */}
        <div className="space-y-4">
          {/* AI Formatting */}
          <div className="flex items-start gap-3">
            <input
              id="setting-ai-formatting"
              type="checkbox"
              checked={config.aiFormatting}
              onChange={() => toggleSetting('aiFormatting')}
              disabled={!geminiConfigured}
              className="mt-1 w-4.5 h-4.5 rounded border-white/10 bg-black/40 text-violet-600 focus:ring-violet-500/20 focus:ring-offset-[#050507]"
            />
            <div>
              <label htmlFor="setting-ai-formatting" className="block text-sm font-bold text-slate-200 cursor-pointer">
                Smart AI Formatting
              </label>
              <span className="block text-xs text-slate-400 mt-1 leading-relaxed">
                Gemini structures chaotic notes into elegant markdown headings, bullet trees, and cleans typos.
              </span>
            </div>
          </div>

          {/* AI Categorization */}
          <div className="flex items-start gap-3">
            <input
              id="setting-ai-categorization"
              type="checkbox"
              checked={config.aiCategorization}
              onChange={() => toggleSetting('aiCategorization')}
              disabled={!geminiConfigured}
              className="mt-1 w-4.5 h-4.5 rounded border-white/10 bg-black/40 text-violet-600 focus:ring-violet-500/20 focus:ring-offset-[#050507]"
            />
            <div>
              <label htmlFor="setting-ai-categorization" className="block text-sm font-bold text-slate-200 cursor-pointer">
                Automatic AI Folders
              </label>
              <span className="block text-xs text-slate-400 mt-1 leading-relaxed">
                Dynamically groups notes into clean subfolders (e.g. <code className="text-violet-400 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-[10px] font-mono">Work/Projects</code>, <code className="text-violet-400 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-[10px] font-mono">Recipes</code>) based on content.
              </span>
            </div>
          </div>

          {/* AI Tagging */}
          <div className="flex items-start gap-3">
            <input
              id="setting-ai-tagging"
              type="checkbox"
              checked={config.aiTagging}
              onChange={() => toggleSetting('aiTagging')}
              disabled={!geminiConfigured}
              className="mt-1 w-4.5 h-4.5 rounded border-white/10 bg-black/40 text-violet-600 focus:ring-violet-500/20 focus:ring-offset-[#050507]"
            />
            <div>
              <label htmlFor="setting-ai-tagging" className="block text-sm font-bold text-slate-200 cursor-pointer">
                Enriched Tags Generation
              </label>
              <span className="block text-xs text-slate-400 mt-1 leading-relaxed">
                Extracts and adds semantic Obsidian labels directly to YAML headers.
              </span>
            </div>
          </div>

          {/* Automatic Wikilinks */}
          <div className="flex items-start gap-3">
            <input
              id="setting-auto-wikilinks"
              type="checkbox"
              checked={config.autoWikilinks}
              onChange={() => toggleSetting('autoWikilinks')}
              className="mt-1 w-4.5 h-4.5 rounded border-white/10 bg-black/40 text-violet-600 focus:ring-violet-500/20 focus:ring-offset-[#050507]"
            />
            <div>
              <label htmlFor="setting-auto-wikilinks" className="block text-sm font-bold text-slate-200 cursor-pointer">
                Automatic Frontmatter Linking
              </label>
              <span className="block text-xs text-slate-400 mt-1 leading-relaxed">
                Analyzes your notes concurrently to detect mutual concepts and insert Obsidian <code className="text-violet-400 bg-white/5 border border-white/5 px-1 py-0.5 rounded text-[10px] font-mono">[[Wikilinks]]</code> automatically.
              </span>
            </div>
          </div>
        </div>

        {/* Configurations inputs */}
        <div className="space-y-4 bg-black/40 border border-white/5 p-5 rounded-2xl">
          {/* Target Note-Taking System */}
          <div className="space-y-1.5 pb-4 border-b border-white/5">
            <label htmlFor="target-system-select" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Target Note-Taking System
            </label>
            <div className="relative">
              <Database className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
              <select
                id="target-system-select"
                value={config.targetSystem || 'obsidian'}
                onChange={handleSystemChange}
                className="w-full bg-[#050507] border border-white/10 hover:border-violet-500/30 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 rounded-xl pl-9 pr-3 py-3 text-sm text-white focus:outline-none transition-all font-medium appearance-none cursor-pointer"
              >
                <option value="obsidian">Obsidian Vault (Markdown + Frontmatter)</option>
                <option value="logseq">Logseq Outline (Markdown + Bullet Blocks)</option>
                <option value="roam">Roam Research (Nested Bullet Graph)</option>
                <option value="bear">Bear Notes (In-line Body Tags)</option>
                <option value="notion">Notion Workspace (Structured Properties)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
            <span className="block text-[11px] text-slate-500">
              Adapts Markdown headings, block-nesting, tag syntax, and link format for your selected platform.
            </span>
          </div>

          {/* Default Folder input */}
          <div className="space-y-1.5">
            <label htmlFor="default-folder-input" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Default Sync Folder
            </label>
            <div className="relative">
              <Folder className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
              <input
                id="default-folder-input"
                type="text"
                value={config.defaultFolder}
                onChange={handleFolderChange}
                placeholder="e.g., Inbox"
                className="w-full bg-[#050507] border border-white/10 hover:border-violet-500/30 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 rounded-xl pl-9 pr-3 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-all font-medium"
              />
            </div>
            <span className="block text-[11px] text-slate-500">
              The fallback directory path if AI sorting is disabled or not applicable.
            </span>
          </div>

          {/* Append Meta Footer toggle */}
          <div className="flex items-start gap-3 pt-4 border-t border-white/5">
            <input
              id="setting-append-meta"
              type="checkbox"
              checked={config.appendImportMeta}
              onChange={() => toggleSetting('appendImportMeta')}
              className="mt-1 w-4.5 h-4.5 rounded border-white/10 bg-black/40 text-violet-600 focus:ring-violet-500/20 focus:ring-offset-[#050507]"
            />
            <div>
              <label htmlFor="setting-append-meta" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer">
                Attach Import Footer
              </label>
              <span className="block text-[11px] text-slate-400 mt-1 leading-relaxed">
                Adds a subtle italicized metadata line at the very bottom of files containing migration timestamps.
              </span>
            </div>
          </div>
        </div>
      </div>

      {!geminiConfigured && (
        <div id="secrets-warning" className="p-4 bg-red-950/25 border border-red-900/30 rounded-2xl text-xs text-red-400 flex items-start gap-3">
          <HelpCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
          <span className="leading-relaxed">
            <strong className="uppercase font-bold tracking-wider text-[10px] block mb-1">Gemini Secrets Unset</strong> Your <code className="bg-red-950/40 px-1.5 py-0.5 rounded text-red-300 font-mono">GEMINI_API_KEY</code> has not been set yet. Please register your key in <strong>Settings &gt; Secrets</strong> to unlock AI formatting, tags generation, and automated folders.
          </span>
        </div>
      )}
    </div>
  );
}
