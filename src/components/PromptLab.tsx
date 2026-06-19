import React, { useState } from "react";
import { Search, Plus, Trash, Play, GitBranch, Terminal, RefreshCw, Layers } from "lucide-react";
import { PromptTemplate, PromptVersion } from "../types";

interface PromptLabProps {
  onRunWithModel: (prompt: string) => void;
}

export const PromptLab: React.FC<PromptLabProps> = ({ onRunWithModel }) => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([
    {
      id: "1",
      title: "TypeScript API Error Boundary Wrapper",
      tags: ["coding", "debug"],
      activeVersion: "v2",
      versions: [
        {
          id: "1a",
          version: "v1",
          content: "Write a high quality TypeScript error boundary for class components in React with proper logging to error monitoring services.",
          timestamp: "2026-06-18 10:24",
        },
        {
          id: "1b",
          version: "v2",
          content: "Design a production-grade TypeScript error boundary utility for functional components and fetch APIs. Wrap response checks cleanly and supply customizable fallback UI.",
          timestamp: "2026-06-19 09:12",
        },
      ],
    },
    {
      id: "2",
      title: "System Architectural Prompt",
      tags: ["system", "roleplay"],
      activeVersion: "v1",
      versions: [
        {
          id: "2a",
          version: "v1",
          content: "You are a senior system architect designed in the Swiss Modern style. Be laconic, provide strict design paradigms first, avoid filler words, and structure responses with monospace ASCII guides.",
          timestamp: "2026-06-18 15:45",
        },
      ],
    },
    {
      id: "3",
      title: "React hook for Local Storage Synchronization",
      tags: ["coding"],
      activeVersion: "v3",
      versions: [
        {
          id: "3a",
          version: "v1",
          content: "Write a React hook for local storage.",
          timestamp: "2026-06-15 11:32",
        },
        {
          id: "3b",
          version: "v2",
          content: "Write a React hook for local storage. Handle SSR hydration mismatch cleanly, parse stored JSON, and synchronize changes via window message channels.",
          timestamp: "2026-06-16 14:02",
        },
        {
          id: "3c",
          version: "v3",
          content: "Certainly. Here is a clean implementation of a useLocalStorage hook. This handles initial state hydration and synchronizes state updates back to the browser's storage.",
          timestamp: "2026-06-19 05:24",
        },
      ],
    },
  ]);

  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string>("1");
  const [activeVersionName, setActiveVersionName] = useState<string>("v2");

  // New prompt UI inputs
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Filter logic
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.versions.some((v) => v.content.toLowerCase().includes(search.toLowerCase()));
    const matchesTag = selectedTag ? t.tags.includes(selectedTag) : true;
    return matchesSearch && matchesTag;
  });

  const selectedTemplate = templates.find((t) => t.id === activeTemplateId) || templates[0];

  // Pick active version's text
  const currentVersionText =
    selectedTemplate?.versions.find((v) => v.version === activeVersionName)?.content ||
    selectedTemplate?.versions[selectedTemplate.versions.length - 1]?.content ||
    "";

  // Create prompt version
  const handleAddNewVersion = () => {
    if (!selectedTemplate) return;
    const currentVersions = selectedTemplate.versions;
    const nextVerIndex = currentVersions.length + 1;
    const newVerName = `v${nextVerIndex}`;
    const newVer: PromptVersion = {
      id: Math.random().toString(),
      version: newVerName,
      content: currentVersionText, // Copy current content as baseline for revision edit
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
    };

    setTemplates((prev) =>
      prev.map((t) => {
        if (t.id === selectedTemplate.id) {
          return {
            ...t,
            versions: [...t.versions, newVer],
            activeVersion: newVerName,
          };
        }
        return t;
      })
    );
    setActiveVersionName(newVerName);
  };

  // Modify currently displayed version content
  const handleUpdateVersionContent = (newText: string) => {
    setTemplates((prev) =>
      prev.map((t) => {
        if (t.id === selectedTemplate.id) {
          return {
            ...t,
            versions: t.versions.map((v) => {
              if (v.version === activeVersionName) {
                return { ...v, content: newText };
              }
              return v;
            }),
          };
        }
        return t;
      })
    );
  };

  // Create template
  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const tagsArray = newTags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag !== "");

    const newTp: PromptTemplate = {
      id: Date.now().toString(),
      title: newTitle,
      tags: tagsArray.length > 0 ? tagsArray : ["system"],
      activeVersion: "v1",
      versions: [
        {
          id: Math.random().toString(),
          version: "v1",
          content: newContent,
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
        },
      ],
    };

    setTemplates((prev) => [newTp, ...prev]);
    setActiveTemplateId(newTp.id);
    setActiveVersionName("v1");
    setNewTitle("");
    setNewContent("");
    setNewTags("");
    setIsCreating(false);
  };

  // Delete Prompt template
  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = templates.filter((t) => t.id !== id);
    setTemplates(remaining);
    if (remaining.length > 0) {
      setActiveTemplateId(remaining[0].id);
      setActiveVersionName(remaining[0].versions[remaining[0].versions.length - 1].version);
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full bg-[#0a0a0a] text-[#ededed] font-sans">
      
      {/* Header bar */}
      <div className="p-8 border-b border-white/5 bg-[#0a0a0a] flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white/90">Prompt Laboratory</h1>
            <p className="text-xs text-white/40 mt-1">
              Develop, version control, and debug system and conversational prompts in a Git-like environment
            </p>
          </div>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-black hover:bg-white/90 font-medium text-xs rounded-lg transition-all transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Prompt</span>
          </button>
        </div>

        {/* Search and Tag filter panel */}
        {!isCreating && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search prompt titles or versions history..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#141414] border border-white/5 hover:border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-xs text-white/80 placeholder:text-white/30 outline-none focus:outline-none transition-colors"
              />
            </div>
            
            {/* Built-in tags filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {["all", "coding", "roleplay", "system", "debug"].map((tag) => {
                const isSelected = selectedTag === tag || (tag === "all" && selectedTag === null);
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag === "all" ? null : tag)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-widest transition-all cursor-pointer ${
                      isSelected
                        ? "bg-white/10 border border-white/20 text-white"
                        : "bg-transparent border border-transparent text-white/40 hover:text-white/70"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {isCreating ? (
          /* Creating flow screen */
          <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full">
            <form onSubmit={handleCreateTemplate} className="space-y-5">
              <h2 className="text-base font-semibold text-white/95 border-b border-white/5 pb-2">New Prompt Blueprint</h2>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-white/40">Prompt Name</label>
                <input
                  type="text"
                  placeholder="e.g. Code Refactor Assistant"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#141414] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white/90 outline-none focus:border-white/20 transition-all font-sans"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-white/40">Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="coding, roleplay, debug"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full bg-[#141414] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white/90 outline-none focus:border-white/20 transition-all font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-white/40">Prompt Base Content (v1)</label>
                <textarea
                  rows={6}
                  placeholder="Write the initial version of your prompt template..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-[#141414] border border-white/5 rounded-xl px-4 py-3 text-sm text-[#ededed] outline-none focus:border-white/20 transition-all font-mono leading-relaxed"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Save Prompt to Lab
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-5 py-2.5 bg-[#141414] hover:bg-[#1a1a1a] text-white/60 text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Split layout view */
          <>
            {/* List column */}
            <div className="w-full md:w-96 border-r border-white/5 overflow-y-auto flex-col p-4 space-y-2 select-none shrink-0 bg-[#0a0a0a]">
              <span className="text-[10px] uppercase font-mono tracking-widest text-white/30 px-2 font-semibold">Available Lab Templates</span>
              
              {filteredTemplates.length === 0 ? (
                <p className="text-xs text-white/20 italic p-4 text-center">No lab templates match filters.</p>
              ) : (
                filteredTemplates.map((t) => {
                  const isActive = t.id === activeTemplateId;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setActiveTemplateId(t.id);
                        setActiveVersionName(t.versions[t.versions.length - 1].version);
                      }}
                      className={`p-4 rounded-xl cursor-pointer transition-all border ${
                        isActive
                          ? "bg-white/5 border-white/10"
                          : "bg-transparent border-transparent hover:bg-white/5 hover:border-white/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-xs font-semibold font-sans leading-tight ${isActive ? "text-white" : "text-white/60"}`}>
                          {t.title}
                        </span>
                        <button
                          onClick={(e) => handleDeleteTemplate(t.id, e)}
                          className="hover:text-rose-400 text-white/20 transition-colors p-0.5 rounded cursor-pointer"
                          title="Delete lab template"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Display versions and tags */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-3 select-none">
                        <span className="bg-white/5 text-white/50 text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-white/5">
                          <Layers className="w-2.5 h-2.5" /> {t.versions.length} {t.versions.length === 1 ? "v" : "ver"}
                        </span>
                        {t.tags.map((tag) => (
                          <span key={tag} className="text-[8px] uppercase tracking-widest font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Editor Workspace Column */}
            <div className="flex-1 overflow-y-auto p-8 flex flex-col bg-[#0a0a0a]">
              {selectedTemplate ? (
                <div className="space-y-6 max-w-3xl flex-1 flex flex-col">
                  {/* Title and version picker */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 shrink-0">
                    <div>
                      <h2 className="text-lg font-semibold text-white/95">{selectedTemplate.title}</h2>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[10px] font-mono tracking-wider text-white/40">ACTIVE COMPILER REVISION:</span>
                        <div className="flex gap-1">
                          {selectedTemplate.versions.map((v) => {
                            const isVerActive = v.version === activeVersionName;
                            return (
                              <button
                                key={v.id}
                                onClick={() => setActiveVersionName(v.version)}
                                className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all cursor-pointer ${
                                  isVerActive
                                    ? "bg-white text-black font-semibold"
                                    : "bg-white/5 hover:bg-white/10 text-white/50"
                                }`}
                              >
                                {v.version}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddNewVersion}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-mono uppercase tracking-widest text-white/80 transition-colors cursor-pointer"
                        title="Fork another revision from selected baseline"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>Fork (Git Tag)</span>
                      </button>
                    </div>
                  </div>

                  {/* Version detailed metadata and running tool action */}
                  <div className="bg-[#141414] border border-white/10 rounded-xl overflow-hidden flex-1 flex flex-col">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/5 text-[10px] uppercase font-mono tracking-widest text-white/40 select-none shrink-0">
                      <div className="flex items-center gap-2 font-medium">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Payload Editor ({activeVersionName})</span>
                      </div>
                      <span>
                        Saved: {selectedTemplate.versions.find((v) => v.version === activeVersionName)?.timestamp}
                      </span>
                    </div>

                    <textarea
                      className="flex-1 min-h-[300px] w-full bg-transparent p-5 text-sm font-mono leading-relaxed text-[#ededed] outline-none border-0 focus:ring-0 resize-none"
                      value={currentVersionText}
                      onChange={(e) => handleUpdateVersionContent(e.target.value)}
                      placeholder="Prompt text payload goes here..."
                    />

                    {/* Quick launcher action within the library */}
                    <div className="p-4 bg-white/5 border-t border-white/5 flex items-center justify-between font-sans shrink-0">
                      <span className="text-[11px] text-white/30 italic">
                        Updates are auto-saved. Click "Run with current model" to load automatically into your workspace.
                      </span>
                      <button
                        onClick={() => onRunWithModel(currentVersionText)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-lg transition-all transform active:scale-95 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Run with current model</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <Layers className="w-12 h-12 text-white/10 mb-4" />
                  <p className="text-white/40 text-sm">Create a prompt template to start laboratory experimentation</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
