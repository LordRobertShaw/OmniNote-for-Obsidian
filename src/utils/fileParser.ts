/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';
import { RawNote } from '../types.js';

/**
 * Format microseconds timestamp to standard ISO or local date
 */
export function formatUsec(usec: number | undefined): string | undefined {
  if (!usec) return undefined;
  try {
    const ms = Math.floor(usec / 1000);
    return new Date(ms).toISOString();
  } catch {
    return undefined;
  }
}

/**
 * Sanitize a filename to be compatible with Obsidian & OS constraints
 */
export function sanitizeFilename(title: string): string {
  if (!title || !title.trim()) return "Untitled Note";
  return title
    .trim()
    .replace(/[\\/:*?"<>|]/g, "") // Remove forbidden chars
    .substring(0, 100); // Prevent overflow
}

/**
 * Parse a raw uploaded file or a ZIP of files
 */
export async function parseUploadedFiles(files: FileList): Promise<RawNote[]> {
  const parsedNotes: RawNote[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (file.name.endsWith('.zip')) {
      try {
        const zipNotes = await parseZipFile(file);
        parsedNotes.push(...zipNotes);
      } catch (err) {
        console.error(`Error parsing zip file ${file.name}:`, err);
      }
    } else if (file.name.endsWith('.json')) {
      try {
        const text = await file.text();
        const keepNote = parseKeepJson(JSON.parse(text), file.name);
        if (keepNote) parsedNotes.push(keepNote);
      } catch (err) {
        console.error(`Error parsing json file ${file.name}:`, err);
      }
    } else if (file.name.endsWith('.txt') || file.name.endsWith('.html')) {
      try {
        const text = await file.text();
        const samsungNote = parseRawTextFile(text, file.name);
        parsedNotes.push(samsungNote);
      } catch (err) {
        console.error(`Error parsing text file ${file.name}:`, err);
      }
    }
  }

  return parsedNotes;
}

/**
 * Parse a standard Google Keep JSON note object
 */
function parseKeepJson(json: any, fileName: string): RawNote | null {
  // Check if it looks like a Keep note
  const isKeep = 'isTrashed' in json || 'textContent' in json || 'listContent' in json;
  if (!isKeep) return null;

  // Filter trashed files
  if (json.isTrashed) return null;

  const id = json.id || `keep-${Math.random().toString(36).substr(2, 9)}`;
  const title = json.title || fileName.replace('.json', '');
  
  // Format content
  let content = json.textContent || '';
  const isChecklist = Array.isArray(json.listContent);
  const checklistItems: { text: string; checked: boolean }[] = [];

  if (isChecklist) {
    checklistItems.push(...json.listContent.map((item: any) => ({
      text: item.text || '',
      checked: !!item.isChecked,
    })));

    // Create a textual backup representation of the checklist
    const listText = checklistItems
      .map(item => `[${item.checked ? 'x' : ' '}] ${item.text}`)
      .join('\n');
    content = content ? `${content}\n\n${listText}` : listText;
  }

  // Parse tags/labels
  const labels: string[] = [];
  if (Array.isArray(json.labels)) {
    json.labels.forEach((lbl: any) => {
      if (lbl.name) labels.push(lbl.name);
    });
  }

  return {
    id,
    title,
    content,
    source: 'keep',
    originalFileName: fileName,
    createdAt: formatUsec(json.createdTimestampUsec),
    updatedAt: formatUsec(json.userEditedTimestampUsec),
    labels,
    isArchived: !!json.isArchived,
    isPinned: !!json.isPinned,
    isChecklist,
    checklistItems,
  };
}

/**
 * Parse a raw text or HTML note exported from Samsung Notes or other sources
 */
function parseRawTextFile(text: string, fileName: string): RawNote {
  const id = `samsung-${Math.random().toString(36).substr(2, 9)}`;
  
  // Extract a readable title: clean file extension, or pull from first non-empty line
  let title = fileName.replace(/\.(txt|html)$/i, '');
  
  // Clean text from basic HTML if it is an HTML export
  let cleanContent = text;
  if (fileName.endsWith('.html')) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    cleanContent = doc.body.textContent || doc.body.innerText || text;
    
    // Attempt to pull a title from HTML header if available
    const h1 = doc.querySelector('h1, h2, title');
    if (h1 && h1.textContent?.trim()) {
      title = h1.textContent.trim();
    }
  }

  return {
    id,
    title,
    content: cleanContent,
    source: 'samsung',
    originalFileName: fileName,
    labels: [],
    isChecklist: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Extract and parse all notes contained in a uploaded Takeout/Samsung export ZIP archive
 */
async function parseZipFile(file: File): Promise<RawNote[]> {
  const zip = await JSZip.loadAsync(file);
  const notes: RawNote[] = [];

  const promises: Promise<void>[] = [];

  zip.forEach((relativePath, zipEntry) => {
    // Only process files, skip folders
    if (zipEntry.dir) return;

    // Google Keep Note
    if (relativePath.endsWith('.json')) {
      const p = zipEntry.async('string').then((content) => {
        try {
          const json = JSON.parse(content);
          const keepNote = parseKeepJson(json, relativePath.split('/').pop() || relativePath);
          if (keepNote) notes.push(keepNote);
        } catch {
          // Ignore parse errors on secondary non-note JSONs
        }
      });
      promises.push(p);
    } 
    // Samsung/General exported text files
    else if (relativePath.endsWith('.txt') || relativePath.endsWith('.html')) {
      const p = zipEntry.async('string').then((content) => {
        try {
          const fileName = relativePath.split('/').pop() || relativePath;
          const samsungNote = parseRawTextFile(content, fileName);
          notes.push(samsungNote);
        } catch (err) {
          console.error('Error parsing text within ZIP:', err);
        }
      });
      promises.push(p);
    }
  });

  await Promise.all(promises);
  return notes;
}
