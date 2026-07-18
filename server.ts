/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { RawNote, ConvertedNote, MigrationConfig } from "./src/types.js";

// Lazy-initialized Gemini client to prevent crash on startup if key is missing.
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware supporting large notes payloads
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // API Health Endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Check if Gemini is configured
  app.get("/api/config-status", (req, res) => {
    res.json({
      geminiConfigured: !!process.env.GEMINI_API_KEY,
    });
  });

  // Process Batch of Notes with Gemini
  app.post("/api/process-notes", async (req, res) => {
    try {
      const { notes, config } = req.body as { notes: RawNote[]; config: MigrationConfig };

      if (!notes || !Array.isArray(notes) || notes.length === 0) {
        return res.status(400).json({ error: "No notes provided in request body." });
      }

      // Check if API key exists
      if (!process.env.GEMINI_API_KEY) {
        return res.status(400).json({
          error: "GEMINI_API_KEY is missing. Please configure it in Settings > Secrets."
        });
      }

      const ai = getGeminiClient();

      // Format current timestamp for Obsidian metadata context
      const currentLocalTime = new Date().toLocaleDateString();

      const targetSystem = config.targetSystem || "obsidian";
      let targetSystemInstructions = "";

      if (targetSystem === "logseq") {
        targetSystemInstructions = `
- Logseq Target Formatting: Logseq is an outline-first system. Every major paragraph or structural segment of the body markdown MUST be styled as an outline node (i.e., starting with a bullet '- ' or nested indented bullets '  - '). Avoid flat paragraphs. Ensure YAML frontmatter is kept but the rest of the body is styled as an elegant outline tree.`;
      } else if (targetSystem === "roam") {
        targetSystemInstructions = `
- Roam Research Target Formatting: Roam is an outline-first bullet graph. Do NOT generate standard YAML frontmatter. Instead, format all content and metadata as bullet outlines, like:
  - Title:: [Clean Title]
  - Source:: [google_keep / samsung_notes]
  - Tags:: [Tags in page link format like [[tag1]] [[tag2]]]
  - Content and details nested as child bullets below. Avoid flat paragraphs.`;
      } else if (targetSystem === "bear") {
        targetSystemInstructions = `
- Bear Notes Target Formatting: Bear does NOT support standard YAML frontmatter. Do NOT generate standard YAML blocks. Instead, place the title as a Level 1 heading at the very top: "# [Clean Title]".
- Bear uses in-line hashtags for categorization. Append the tags at the very bottom of the note body in Bear-compatible hash syntax: "#tag1 #tag2" (no spaces in tag names).`;
      } else if (targetSystem === "notion") {
        targetSystemInstructions = `
- Notion Workspace Target Formatting: Notion prefers standard, clean, flat markdown (no outline wrapping unless they are list items). Focus on clean headings (#, ##, ###) and clear task checkboxes (- [ ]). Place properties neatly in a key-value list at the top.`;
      } else {
        targetSystemInstructions = `
- Obsidian Target Formatting: Include standard valid YAML frontmatter at the top of the file, followed by flat markdown content, heading hierarchies, and standard checklist checkboxes.`;
      }

      // Instructions prompt tailored to config preferences
      const systemInstruction = `You are a specialist in personal knowledge management (PKM) and an expert in digital note-taking structures (Obsidian, Logseq, Roam Research, Bear, and Notion).
Your job is to convert a batch of raw notes from Google Keep or Samsung Notes into highly-optimized, beautiful, and standard formatted notes for the user's selected note system: "${targetSystem.toUpperCase()}".

Follow these strict instructions for each note:
1. "title": Provide a clean, elegant, and safe file title. Sanitize it so it does not contain forbidden filename characters like \\, /, :, *, ?, ", <, >, |. Keep it short and human-readable. If a note lacks a title, generate a perfect, descriptive, non-generic title based on its content (NEVER use "Untitled").
2. "categoryPath": Determine an organized subfolder path (category) inside the vault/workspace. Suggest clean paths like "Work", "Personal/Recipes", "Finance", "Reference/Books", "Meeting Notes", "Brainstorms". Categorize intelligently based on the note's subject. If the user disabled AI categorization or if it is generic, return "${config.defaultFolder || 'Inbox'}".
3. "tags": Extract and suggest highly relevant, clean, lowercase tags. Clean up any existing labels into clean tag formatting (alphanumeric only, e.g. "recipes", "project-alpha"). Avoid duplicate tags or generic tags like "note".
4. "markdown": Construct a complete, compatible markdown string optimized for "${targetSystem.toUpperCase()}".
   - ${targetSystemInstructions}
   - At the very beginning of the note's main content body (immediately after any frontmatter / properties block and before the first heading/paragraph), you MUST always insert a beautifully formatted block containing the 1-sentence executive summary.
     - For Obsidian, Bear, and Notion, format it as a clean blockquote / callout like:
       > **AI Executive Summary:** *[Insert 1-sentence summary here]*
     - For outline-first systems like Logseq and Roam, format it as a top-level outline bullet like:
       - **AI Executive Summary:** *[Insert 1-sentence summary here]*
     Follow this executive summary block with an empty line before starting the rest of the note's content body.
   - Checklists should be formatted using compatible task lists: \`- [ ]\` or \`- [x]\`. Preserve checked states from the raw checklists.
   - Detect lists, code blocks, bold headings, and URLs, formatting them as clean markdown.
   - Clean up raw carriage returns, trailing whitespace, or unformatted text blocks.
   - ${config.aiFormatting ? "Enable active structural enhancements: rewrite chaotic scribbles into clear headings, add brief contextual summaries if helpful, and group items logically." : "Keep the original content structure intact, only standardizing the formatting syntax."}
   - ${config.appendImportMeta ? "Append an italicized metadata line at the very bottom: *Imported via OmniNote on " + currentLocalTime + "*" : ""}
5. "summary": Provide a concise 1-sentence description of the note's essence for preview lists. This must exactly match the sentence used in the "AI Executive Summary" block in step 4.
6. "codeSegments": Detect if the note contains programming code blocks, terminal/shell commands, scripts, or operational algorithms (Python, Bash/Shell, JavaScript, CSS, HTML, C++, etc.).
   - IMPORTANT: Ensure any code is NEVER corrupted, modified, or truncated during ingestion and transfer. Keep code intact and operationally perfect.
   - Extract every usable code block or command script. For each segment, extract the raw intact code, specify the language, write a description of its intended function, and design a logical file path (directory + filename) like "scripts/clean_data.py" or "bin/deploy.sh" where it belongs.
   - If no code segments are found, return an empty array [].

You must return a single JSON object containing a "results" array. Maintain the exact "id" mapping for each note so the frontend can identify them.`;

      // Structure notes payload to minimize token size while retaining metadata
      const notesPayload = notes.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        source: n.source,
        createdAt: n.createdAt,
        labels: n.labels,
        isChecklist: n.isChecklist,
        checklistItems: n.checklistItems,
      }));

      const prompt = `Convert the following notes according to your specifications:\n\n${JSON.stringify(notesPayload, null, 2)}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              results: {
                type: Type.ARRAY,
                description: "Array of converted notes corresponding to the inputs.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "The original note ID." },
                    title: { type: Type.STRING, description: "Sanitized Obsidian-safe title." },
                    markdown: { type: Type.STRING, description: "The complete markdown file contents including the frontmatter block." },
                    tags: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "List of lowercase, clean tag strings."
                    },
                    categoryPath: { type: Type.STRING, description: "Target directory path in Obsidian." },
                    summary: { type: Type.STRING, description: "A one-sentence summary of the note." },
                    codeSegments: {
                      type: Type.ARRAY,
                      description: "List of executable code blocks or shell commands extracted. Return empty list if none.",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          code: { type: Type.STRING, description: "Exact, intact, usable code or script content." },
                          language: { type: Type.STRING, description: "Programming language or shell identifier (e.g., python, javascript, bash, css)." },
                          intendedFunction: { type: Type.STRING, description: "A description of the code segment's purpose." },
                          fileName: { type: Type.STRING, description: "Logical directory path + filename (e.g., scripts/setup.sh)." }
                        },
                        required: ["code", "language", "intendedFunction", "fileName"]
                      }
                    }
                  },
                  required: ["id", "title", "markdown", "tags", "categoryPath", "summary", "codeSegments"]
                }
              }
            },
            required: ["results"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response text received from Gemini.");
      }

      // Parse and return results
      const parsed = JSON.parse(responseText.trim());
      res.json(parsed);

    } catch (error: any) {
      console.error("Gemini Note Conversion Error:", error);
      res.status(500).json({
        error: error.message || "An unexpected error occurred during note processing."
      });
    }
  });

  // Integrate Vite Dev Server in Non-Production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve Static Files from dist/ in Production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
