import { ConvertedNote } from '../types.js';

/**
 * Escapes a string to be safely used inside a Regular Expression.
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Automatically link related notes using Obsidian [[Wikilinks]].
 * Concurrently scans titles of all notes, looks for mentions in other notes,
 * and updates them with inline links, frontmatter references, and backlinks.
 */
export function autoLinkNotes(notes: ConvertedNote[]): ConvertedNote[] {
  if (notes.length <= 1) return notes;

  // Filter out invalid/empty titles, sort by length desc to prioritize matching longer concepts first
  const candidates = notes
    .filter(n => n.title && n.title.trim().length >= 3)
    .map(n => ({
      id: n.id,
      title: n.title.trim(),
      escapedTitle: escapeRegExp(n.title.trim()),
    }))
    .sort((a, b) => b.title.length - a.title.length);

  return notes.map(currentNote => {
    let updatedMarkdown = currentNote.markdown || '';
    const linkedTitles = new Set<string>();

    // Scan for candidates (other notes) referenced in this note
    candidates.forEach(candidate => {
      // Don't self-link
      if (candidate.id === currentNote.id) return;

      // Word-boundary-aware regex, case insensitive
      // We look for the candidate title where it's not already preceded by [[ or followed by ]]
      // A simple regex looks for: (?<!\[\[)\b(Candidate Title)\b(?!\]\])
      // Since Safari does not support lookbehind in some old engines, we can do a safe match and replacement,
      // or check if it's already linked.
      const isAlreadyLinkedRegex = new RegExp(`\\[\\[${candidate.escapedTitle}\\]\\]`, 'i');
      if (isAlreadyLinkedRegex.test(updatedMarkdown)) {
        linkedTitles.add(candidate.title);
        return;
      }

      // Safe replace using standard boundaries
      const mentionRegex = new RegExp(`\\b(${candidate.escapedTitle})\\b`, 'gi');
      
      let matched = false;
      // We replace occurrences with [[Title]], keeping the exact match's casing if possible,
      // but Obsidian works best with the exact note title. Let's replace with [[CandidateTitle]].
      // To avoid breaking existing Markdown links [text](url) or HTML tags, we do a simple check.
      updatedMarkdown = updatedMarkdown.replace(mentionRegex, (match, p1, offset) => {
        // Simple safety checks: check if inside a link [like this](url) or [[like this]]
        const before = updatedMarkdown.slice(Math.max(0, offset - 10), offset);
        const after = updatedMarkdown.slice(offset + match.length, offset + match.length + 10);
        
        const isInsideWikilink = before.includes('[[') && after.includes(']]');
        const isInsideNormalLink = before.includes('[') && after.includes(']');
        const isInsideUrl = before.includes('http') || before.includes('/') || after.includes('.com') || after.includes('/') || before.includes('(') && after.includes(')');
        
        if (isInsideWikilink || isInsideNormalLink || isInsideUrl) {
          return match; // return unmodified
        }
        
        matched = true;
        return `[[${candidate.title}]]`;
      });

      if (matched) {
        linkedTitles.add(candidate.title);
      }
    });

    // If we detected linked titles, we will inject them into the Frontmatter AND add a related concepts block at the bottom
    if (linkedTitles.size > 0) {
      const linkedArray = Array.from(linkedTitles);
      
      // 1. Inject into Frontmatter
      const yamlMatch = updatedMarkdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (yamlMatch) {
        const fullYamlBlock = yamlMatch[0];
        const innerYaml = yamlMatch[1];
        
        // Build frontmatter related link strings
        const linksYamlStr = `related_links:\n${linkedArray.map(t => `  - "[[${t}]]"`).join('\n')}`;
        
        // Check if related_links already exists in frontmatter
        let newYaml = innerYaml;
        if (innerYaml.includes('related_links:')) {
          // Replace or append to existing related_links block
          // For simplicity and safety, we can append new items
          newYaml = innerYaml.replace(/related_links:[\s\S]*?(?=\n\w+:|$)/, linksYamlStr);
        } else {
          newYaml = innerYaml.trim() + '\n' + linksYamlStr;
        }
        
        updatedMarkdown = updatedMarkdown.replace(fullYamlBlock, `---\n${newYaml}\n---`);
      } else {
        // If there's no frontmatter, prepend a basic one
        const linksYamlStr = `related_links:\n${linkedArray.map(t => `  - "[[${t}]]"`).join('\n')}`;
        updatedMarkdown = `---\n${linksYamlStr}\n---\n\n` + updatedMarkdown;
      }

      // 2. Append an elegant Backlinks section at the bottom of the file
      // Check if backlinks block is already appended
      if (!updatedMarkdown.includes('### Auto-Linked Concepts')) {
        const backlinksBlock = `\n\n### Auto-Linked Concepts\n${linkedArray.map(t => `- [[${t}]]`).join('\n')}`;
        updatedMarkdown += backlinksBlock;
      }
    }

    return {
      ...currentNote,
      markdown: updatedMarkdown,
    };
  });
}
