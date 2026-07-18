/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NoteSource = 'keep' | 'samsung' | 'raw';

export interface RawNote {
  id: string;
  title: string;
  content: string;
  source: NoteSource;
  originalFileName?: string;
  createdAt?: string;
  updatedAt?: string;
  labels: string[];
  isArchived?: boolean;
  isPinned?: boolean;
  isChecklist?: boolean;
  checklistItems?: { text: string; checked: boolean }[];
}

export interface CodeSegment {
  code: string;
  language: string;
  intendedFunction: string;
  fileName: string;
}

export interface ConvertedNote {
  id: string; // matches RawNote.id
  title: string; // sanitized Obsidian note title (filename)
  markdown: string; // standard Obsidian-compatible Markdown
  tags: string[]; // processed list of tags (no spaces, pure names)
  categoryPath: string; // folder path inside Obsidian vault, e.g. "Work" or "Recipes"
  summary?: string; // AI generated summary
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  codeSegments?: CodeSegment[];
}

export interface MigrationConfig {
  aiFormatting: boolean;
  aiCategorization: boolean;
  aiTagging: boolean;
  defaultFolder: string;
  appendImportMeta: boolean;
  autoWikilinks: boolean;
  targetSystem: 'obsidian' | 'logseq' | 'roam' | 'bear' | 'notion';
}

export interface ProcessNotesRequest {
  notes: RawNote[];
  config: MigrationConfig;
}

export interface ProcessNotesResponse {
  results: ConvertedNote[];
}
