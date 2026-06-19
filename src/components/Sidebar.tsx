import React, { useState } from "react";
import {
  Plus,
  Trash,
  Settings,
  Sparkles,
  Cpu,
  MessageSquare,
  Check,
  X,
  Download,
  Upload,
  Edit3
} from "lucide-react";
import { ChatSession } from "../types";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  activeProvider: "gemini" | "lmstudio";
  onChangeProvider: (p: "gemini" | "lmstudio") => void;
  onOpenSettings: () => void;
  onExportChats: () => void;
  onImportChats: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  activeProvider,
  onChangeProvider,
  onOpenSettings,
  onExportChats,
  onImportChats,
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const startEditing = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const saveRename = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingSessionId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      saveRename(id);
    } else if (e.key === "Escape") {
      setEditingSessionId(null);
    }
  };

  return (
    <div className="w-80 h-full bg-[#0f0f0f] border-r border-white/5 flex flex-col justify-between text-white/70 font-sans shrink-0 z-10 transition-all duration-300">
      {/* Upper Space Header */}
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse"></span>
            <h1 className="text-xs font-semibold tracking-widest text-white/80 font-mono uppercase">
              LLM Workspace
            </h1>
          </div>
          <span className="text-[9px] font-mono font-medium px-2 py-0.5 rounded bg-white/5 text-white/40">
            v1.0.0
          </span>
        </div>

        {/* Create Chat Session Button */}
        <button
          onClick={onCreateSession}
          className="w-full flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-sm font-medium hover:bg-[#222222] text-white/90 transition-colors cursor-pointer active:scale-98"
        >
          <span>New Chat</span>
          <Plus className="w-4 h-4 text-white/60" />
        </button>
      </div>



      {/* Dynamic scrollable historic lists */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin">
        <div className="px-2 text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2 select-none">
          Recent Activity
        </div>
        {sessions.length === 0 ? (
          <div className="text-xs text-white/20 italic p-3 text-center">
            No active conversations.
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isEditing = editingSessionId === session.id;

            return (
              <div
                key={session.id}
                onClick={() => !isEditing && onSelectSession(session.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-white/5 text-white"
                    : "text-white/50 hover:bg-white/5 hover:text-white/90"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <MessageSquare
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? "text-white/80" : "text-white/30 group-hover:text-white/50"
                    }`}
                  />
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, session.id)}
                      onBlur={() => saveRename(session.id)}
                      autoFocus
                      className="bg-[#1a1a1a] text-white text-xs px-2 py-0.5 rounded outline-none border border-white/10 w-full font-sans"
                    />
                  ) : (
                    <span className="truncate pr-1 font-medium select-none">
                      {session.title}
                    </span>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startEditing(session, e)}
                      title="Rename"
                      className="p-1 rounded hover:bg-[#222222] text-white/40 hover:text-white/80 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      title="Delete"
                      className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {isEditing && (
                  <button
                    onClick={() => saveRename(session.id)}
                    className="p-1 rounded hover:bg-[#222222] text-emerald-400 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Lower Menu Bar with Sync Actions & Settings */}
      <div className="p-3 border-t border-white/5 flex flex-col gap-2 bg-[#0a0a0a]">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-white/30 px-1 font-semibold">
          <span>Backup</span>
          <div className="flex items-center gap-2">
            {/* Export */}
            <button
              onClick={onExportChats}
              title="Export conversations"
              className="flex items-center gap-1 text-white/40 hover:text-white transition-colors cursor-pointer font-mono"
            >
              <Download className="w-2.5 h-2.5" />
              <span>Export</span>
            </button>
            <span>|</span>
            {/* Import */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import conversations"
              className="flex items-center gap-1 text-white/40 hover:text-white transition-colors cursor-pointer font-mono"
            >
              <Upload className="w-2.5 h-2.5" />
              <span>Import</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImportChats}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

        {/* Global Settings Trigger */}
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 text-white/70 hover:text-white text-sm transition-all duration-150 cursor-pointer border border-transparent hover:border-white/5"
        >
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4 text-white/40" />
            <span className="font-medium text-xs">System Settings</span>
          </div>
          <span className="text-[9px] text-white/30 font-mono">Options</span>
        </button>
      </div>
    </div>
  );
};
