import React, { useState, useEffect, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { SettingsModal } from "./components/SettingsModal";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { HUDOverlay } from "./components/HUDOverlay";
import { PromptLab } from "./components/PromptLab";
import { ModelCompare } from "./components/ModelCompare";
import { SystemOverview } from "./components/SystemOverview";
import { Message, ChatSession, LMStudioSettings, SystemMetrics } from "./types";
import {
  Send,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  RefreshCw,
  Sparkles,
  Cpu,
  Info,
  Layers,
  Terminal,
  Play,
  Check,
  Bug,
  HelpCircle,
  Pause,
  Download,
  Flame,
  Globe,
  Settings,
  ChevronDown
} from "lucide-react";

const DEFAULT_SETTINGS: LMStudioSettings = {
  hostUrl: "http://localhost:1234",
  apiKey: "",
  modelName: "lmstudio-community",
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: "You are Claude, a helpful, extremely capable AI assistant answering in beautiful, structured editorial prose. Keep replies precise, thoughtful, and highly authentic.",
};

const promptSuggestions = [
  {
    title: "Написать код",
    desc: "TypeScript-функция фильтрации дубликатов",
    text: "Напиши чистую функцию на TypeScript для группировки массива объектов по заданному свойству, с подробными типами и примером использования.",
  },
  {
    title: "Простой язык",
    desc: "Как работает квантовая запутанность",
    text: "Объясни явление квантовой запутанности простыми метафорическими словами для 10-летнего ребенка, используя наглядные ассоциации.",
  },
  {
    title: "Перенос дедлайна",
    desc: "Вежливое письмо руководителю",
    text: "Помоги составить дипломатичное и профессиональное письмо клиенту с аргументированной просьбой перенести дедлайн проекта на 3 дня.",
  },
  {
    title: "Базы данных",
    desc: "Схема реляционных таблиц блога",
    text: "Разработай структуру SQL-таблиц для простого блога: таблица пользователей, статей с тегами, комментариев со вложенностью. Напиши DDL скрипты.",
  },
];

export default function App() {
  const [activeTab, setActiveTab ] = useState<"chat" | "lab" | "compare" | "overview">("chat");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<"gemini" | "lmstudio">("lmstudio");
  const [settings, setSettings] = useState<LMStudioSettings>(DEFAULT_SETTINGS);
  const [isLocalOnline, setIsLocalOnline] = useState<boolean | null>(null);
  const [isLocalChecking, setIsLocalChecking] = useState(false);

  // Streaming stats
  const [tokensPerSecond, setTokensPerSecond] = useState(0);
  const [isGeneratingPaused, setIsGeneratingPaused] = useState(false);
  const streamTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fullTextToStreamRef = useRef<string>("");
  const currentStreamIndexRef = useRef<number>(0);
  const currentAssistantMsgIdRef = useRef<string>("");
  const pausedRef = useRef(false);

  // Tools Configuration (MVP Plugin System toggles)
  const [tools, setTools] = useState([
    { id: "search", name: "Web search", description: "Fetch real-time web references", enabled: true, icon: Globe },
    { id: "python", name: "Python runner", description: "Evaluate formulas inside clean environment", enabled: false, icon: Terminal },
    { id: "formatter", name: "JSON Formatter", description: "Auto-indent text arrays on incoming replies", enabled: true, icon: Check },
  ]);

  // Model switch weights load progress simulation
  const [isModelSwitching, setIsModelSwitching] = useState(false);
  const [modelSwitchProgress, setModelSwitchProgress] = useState(0);

  // Debug Panel Toggle
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugPayload, setDebugPayload] = useState({
    activeEndpoint: "/api/chat",
    requestPayload: "N/A",
    responsePayload: "N/A",
    chunkLogs: [] as string[]
  });

  // Hotkey Toast notifier
  const [hotkeyToast, setHotkeyToast] = useState<string | null>(null);

  // Live Metrics state inside the workspace HUD
  const [metrics, setMetrics] = useState<SystemMetrics>({
    gpuTemp: 58,
    vramUsed: 4.8,
    vramTotal: 16.0,
    cpuLoad: 18,
    toksSec: 0,
    latency: 140,
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Initialize and load sessions / settings from SQLite backend and local storage settings
  useEffect(() => {
    const savedSettings = localStorage.getItem("workspace_llm_settings");
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to parse settings:", e);
      }
    }

    const loadBackendSessions = async () => {
      try {
        const res = await fetch("/api/sessions");
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setSessions(data);
            setActiveSessionId(data[0].id);
          } else {
            // Initial guiding session if DB is empty
            const welcomeId = `session-${Date.now()}`;
            const welcomeSession: ChatSession = {
              id: welcomeId,
              title: "Начальное руководство 🚀",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              systemPrompt: DEFAULT_SETTINGS.systemPrompt,
              modelProvider: "lmstudio",
              modelName: DEFAULT_SETTINGS.modelName,
              temperature: DEFAULT_SETTINGS.temperature,
              maxTokens: DEFAULT_SETTINGS.maxTokens,
              messages: [
                {
                  id: "welcome-1",
                  role: "assistant",
                  content: `Привет! Добро пожаловать в минималистичный чат-клиент **LLM Workspace**.

Мы добавили реальный Python-бэкенд и SQLite:
1. **💾 База данных SQLite**: Вся переписка и сессии чата сохраняются в базе данных.
2. **🧠 Долговременная память**: Модель автоматически извлекает факты о вас во время диалога и сохраняет их. Вы можете просмотреть и настроить эти факты во вкладке **AI Datacenter Overview**.
3. **📊 Реальные характеристики**: Телеметрия и системные метрики процессора, памяти и температуры считываются прямо с вашего ноутбука.
4. **🔌 LM Studio Integration**: Все запросы проксируются через Python на LM Studio. Введите API-ключ в настройках, если он требуется.
`,
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                },
              ],
            };
            
            // Persist welcome session to SQLite
            await fetch("/api/sessions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(welcomeSession),
            });
            for (const m of welcomeSession.messages) {
              await fetch(`/api/sessions/${welcomeId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(m),
              });
            }

            setSessions([welcomeSession]);
            setActiveSessionId(welcomeId);
          }
        }
      } catch (e) {
        console.error("Failed to fetch sessions from SQLite backend:", e);
      }
    };

    loadBackendSessions();
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages?.length, isGenerating]);

  // Adjust input textarea autoheight
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Keyboard Hotkeys support
  useEffect(() => {
    const handleGlobalHotkeys = (e: KeyboardEvent) => {
      // Ctrl + K -> toggling active server model provider
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const nextProv = activeProvider === "gemini" ? "lmstudio" : "gemini";
        setActiveProvider(nextProv);
        triggerModelSwitchProgress(nextProv);
        showToast(`Model Provider toggled to ${nextProv.toUpperCase()}`);
      }
      // Ctrl + / -> prompt lab tab
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault();
        setActiveTab("lab");
        showToast("Opened Prompt Laboratory");
      }
      // Ctrl + L -> clear context messages
      if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        if (activeSession) {
          setSessions((prev) =>
            prev.map((s) => (s.id === activeSessionId ? { ...s, messages: [] } : s))
          );
          showToast("Chat context cleared");
        }
      }
      // Alt + ArrowUp -> previous session
      if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        const idx = sessions.findIndex((s) => s.id === activeSessionId);
        if (idx > 0) {
          setActiveSessionId(sessions[idx - 1].id);
          showToast(`Active Session &rarr; ${sessions[idx - 1].title}`);
        }
      }
      // Alt + ArrowDown -> next session
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        const idx = sessions.findIndex((s) => s.id === activeSessionId);
        if (idx < sessions.length - 1) {
          setActiveSessionId(sessions[idx + 1].id);
          showToast(`Active Session &rarr; ${sessions[idx + 1].title}`);
        }
      }
    };

    window.addEventListener("keydown", handleGlobalHotkeys);
    return () => window.removeEventListener("keydown", handleGlobalHotkeys);
  }, [activeProvider, activeSessionId, sessions, activeSession]);

  const showToast = (message: string) => {
    setHotkeyToast(message);
    setTimeout(() => {
      setHotkeyToast(null);
    }, 2500);
  };

  // Triggering visual weights loading progress animation
  const triggerModelSwitchProgress = (providerName: string) => {
    setIsModelSwitching(true);
    setModelSwitchProgress(5);
    const interval = setInterval(() => {
      setModelSwitchProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsModelSwitching(false), 300);
          return 100;
        }
        return p + Math.round(Math.random() * 15 + 10);
      });
    }, 120);
  };

  // Scan host connection online via backend proxy to bypass CORS
  const checkLocalConnection = async (silent = false) => {
    if (!silent) setIsLocalChecking(true);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostUrl: settings.hostUrl, apiKey: settings.apiKey }),
      });

      if (res.ok) {
        setIsLocalOnline(true);
      } else {
        setIsLocalOnline(false);
      }
    } catch (e) {
      setIsLocalOnline(false);
    } finally {
      if (!silent) setIsLocalChecking(false);
    }
  };

  useEffect(() => {
    checkLocalConnection(true);
  }, [settings.hostUrl]);

  // Create new chat
  const handleCreateSession = async () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: "Новый чат",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      systemPrompt: settings.systemPrompt,
      modelProvider: "lmstudio",
      modelName: settings.modelName,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      messages: [],
    };

    try {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSession),
      });
    } catch (e) {
      console.error("Failed to save session:", e);
    }

    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setActiveTab("chat");
    setTimeout(() => textareaRef.current?.focus(), 150);
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    } catch (e) {
      console.error("Failed to delete session:", e);
    }

    const filtered = sessions.filter((s) => s.id !== id);
    setSessions(filtered);
    if (activeSessionId === id && filtered.length > 0) {
      setActiveSessionId(filtered[0].id);
    } else if (filtered.length === 0) {
      handleCreateSession();
    }
  };

  const handleRenameSession = async (id: string, title: string) => {
    try {
      await fetch(`/api/sessions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, updatedAt: new Date().toISOString() }),
      });
    } catch (e) {
      console.error("Failed to rename session:", e);
    }
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title, updatedAt: new Date().toISOString() } : s))
    );
  };

  // Character-by-character live streaming engine
  const startStreamingTextProgressively = (assistantMsgId: string, fullReply: string) => {
    if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    
    currentStreamIndexRef.current = 0;
    fullTextToStreamRef.current = fullReply;
    currentAssistantMsgIdRef.current = assistantMsgId;
    setIsGeneratingPaused(false);
    setTokensPerSecond(42);

    // Progressive interval printer
    streamTimerRef.current = setInterval(() => {
      // Handle pause state
      if (pausedRef.current) return;

      if (currentStreamIndexRef.current < fullTextToStreamRef.current.length) {
        // Increase character chunk step sequentially for realistic rate
        const step = Math.min(3, fullTextToStreamRef.current.length - currentStreamIndexRef.current);
        const chunk = fullTextToStreamRef.current.substring(0, currentStreamIndexRef.current + step);
        currentStreamIndexRef.current += step;

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === activeSessionId) {
              return {
                ...s,
                messages: s.messages.map((m) => {
                  if (m.id === assistantMsgId) {
                    return { ...m, content: chunk };
                  }
                  return m;
                }),
              };
            }
            return s;
          })
        );
      } else {
        // Finished typing everything
        finishTokenStream();
      }
    }, 45);
  };

  const finishTokenStream = () => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setIsGenerating(false);
    setTokensPerSecond(0);
    setIsGeneratingPaused(false);
    pausedRef.current = false;
  };

  // Pause / Resume generation logic hook
  const handleTogglePauseResume = () => {
    const nextPaused = !isGeneratingPaused;
    setIsGeneratingPaused(nextPaused);
    pausedRef.current = nextPaused;
    if (nextPaused) {
      setTokensPerSecond(0);
      setDebugPayload((prev) => ({
        ...prev,
        chunkLogs: [...prev.chunkLogs, `[${new Date().toLocaleTimeString()}] Generation paused by diagnostic user.`]
      }));
    } else {
      setTokensPerSecond(42);
      setDebugPayload((prev) => ({
        ...prev,
        chunkLogs: [...prev.chunkLogs, `[${new Date().toLocaleTimeString()}] Generation resumed.`]
      }));
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    
    const messageContent = customPrompt || inputText.trim();
    if (!messageContent || isGenerating || !activeSession) return;

    if (!customPrompt) {
      setInputText("");
    }

    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...activeSession.messages, userMsg];

    // 1. Save user message locally
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: updatedMessages,
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      })
    );

    // 2. Persist user message to SQLite backend
    try {
      await fetch(`/api/sessions/${activeSessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userMsg),
      });
    } catch (err) {
      console.error("Failed to save user message to SQLite:", err);
    }

    setIsGenerating(true);

    const assistantMsgId = `msg-${Date.now()}-assistant`;
    const placeholderMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...updatedMessages, placeholderMsg],
          };
        }
        return s;
      })
    );

    // Record diagnostics
    const requestPayloadObj = {
      messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      provider: "lmstudio"
    };

    setDebugPayload({
      activeEndpoint: "/api/chat",
      requestPayload: JSON.stringify(requestPayloadObj, null, 2),
      responsePayload: "Receiving progressive chunks...",
      chunkLogs: [`[${new Date().toLocaleTimeString()}] Outgoing request transmitted. Initializing stream...`]
    });

    try {
      let replyText = "";
      const latencyStart = Date.now();

      // 3. Make chat request to backend API (which injects memories & proxies to LM Studio)
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          hostUrl: settings.hostUrl,
          modelName: settings.modelName,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          systemPrompt: activeSession.systemPrompt || settings.systemPrompt,
          apiKey: settings.apiKey
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      replyText = data.content || "No response generated by the model.";

      const deltaLatency = Date.now() - latencyStart;
      
      // Update real metrics
      setMetrics((prev) => ({
        ...prev,
        latency: data.latencyMs || deltaLatency,
        toksSec: data.tokensPerSecond || 40,
      }));

      setDebugPayload(prev => ({
        ...prev,
        responsePayload: JSON.stringify(data, null, 2),
        chunkLogs: [...prev.chunkLogs, `[${new Date().toLocaleTimeString()}] SQLite memory synced. Latency: ${data.latencyMs}ms. Speed: ${data.tokensPerSecond} tok/s`]
      }));

      // 4. Save assistant message to SQLite backend
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        content: replyText,
        timestamp: placeholderMsg.timestamp,
        latencyMs: data.latencyMs,
        tokensPerSecond: data.tokensPerSecond
      };
      
      try {
        await fetch(`/api/sessions/${activeSessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(assistantMsg),
        });
      } catch (err) {
        console.error("Failed to save assistant message to SQLite:", err);
      }

      // Launch gorgeous local character typing stream
      startStreamingTextProgressively(assistantMsgId, replyText);

      // Auto Rename Chat Title
      if (activeSession.title === "Новый чат") {
        const finalTitle = messageContent.length > 22 ? messageContent.substring(0, 21).trim() + "..." : messageContent;
        handleRenameSession(activeSessionId, finalTitle);
      }

    } catch (err: any) {
      console.error(err);
      finishTokenStream();

      const errMsg = `### 🛑 Ошибка при связи с нейросетью\n\n\`${err.message || "Request failed"}\`\n\n---\nПожалуйста, убедитесь, что сервер LM Studio запущен и в настройках указан верный адрес.`;
      
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: s.messages.map((m) => {
                if (m.id === assistantMsgId) {
                  return { ...m, content: errMsg };
                }
                return m;
              }),
            };
          }
          return s;
        })
      );
    }
  };

  // Timeline jump restorer action
  const jumpToTimelineState = (msgIndex: number) => {
    if (!activeSession) return;
    const croppedMessages = activeSession.messages.slice(0, msgIndex + 1);
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, messages: croppedMessages } : s))
    );
    showToast(`Restored chat state to item #${msgIndex + 1}`);
  };

  // High fidelity report exporter
  const triggerExportReport = () => {
    if (!activeSession) return;
    
    let md = `# AI WORKSPACE INFERENCE REPORT\n`;
    md += `**Timestamp:** ${new Date().toLocaleString()}\n`;
    md += `**Model Provider Mode:** ${activeProvider.toUpperCase()}\n`;
    md += `**Hyperparameters:** Temp: ${settings.temperature} | MaxTokens: ${settings.maxTokens}\n\n`;
    md += `## DIALOGUE TIMELINE\n\n`;

    activeSession.messages.forEach((m, idx) => {
      md += `### [${idx + 1}] ROLE: ${m.role.toUpperCase()} (${m.timestamp})\n\n`;
      md += `${m.content}\n\n`;
      md += `* * *\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AI_Inference_Report_${activeSession.title.replace(/[^\wа-яА-Я]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Report exported successfully!");
  };

  const selectSuggestion = (phrase: string) => {
    setInputText(phrase);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleSaveSettings = (newSettings: LMStudioSettings) => {
    setSettings(newSettings);
    localStorage.setItem("workspace_llm_settings", JSON.stringify(newSettings));
    checkLocalConnection(true);
    showToast("System configurations committed");
  };

  const handleExportChats = () => {
    const dataStr = JSON.stringify(sessions, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `llm_workspace_saved_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Chats exported successfully");
  };

  const handleImportChats = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions((prev) => {
            const merged = [...parsed, ...prev];
            const unique = merged.filter(
              (session, idx, self) => self.findIndex((s) => s.id === session.id) === idx
            );
            return unique;
          });
          setActiveSessionId(parsed[0].id);
          showToast("Workspace history imported!");
        } else {
          alert("Invalid file format list.");
        }
      } catch (err) {
        alert("JSON parsing error: " + err);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Compute context usage variables
  const countContextBlocks = () => {
    if (!activeSession) return { count: 0, percent: 0 };
    const count = activeSession.messages.length;
    const percent = Math.min(100, Math.round((count / 30) * 100)); // target sandbox max context is 30 blocks
    return { count, percent };
  };

  const ctxStats = countContextBlocks();

  return (
    <div className="flex h-screen w-screen bg-[#0a0a0a] text-[#ededed] overflow-hidden select-none font-sans antialiased relative">
      
      {/* Dynamic Hotkey Notification Toast */}
      {hotkeyToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-500 text-black px-4 py-2 rounded-lg text-xs font-mono font-semibold uppercase tracking-wider shadow-2xl animate-bounce">
          {hotkeyToast}
        </div>
      )}

      {/* Model switching progress screen overlay */}
      {isModelSwitching && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md flex flex-col items-center justify-center space-y-4 select-none">
          <Sparkles className="w-10 h-10 text-emerald-400 animate-pulse" />
          <div className="text-center space-y-1">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-white">Loading Weights...</p>
            <p className="text-[10px] text-white/40 font-mono">Initializing parameters & caching layer</p>
          </div>
          <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-300"
              style={{ width: `${modelSwitchProgress}%` }}
            />
          </div>
          <span className="text-xs font-mono text-emerald-400">{modelSwitchProgress}%</span>
        </div>
      )}

      {/* Primary Side Drawer Navigation */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          setActiveSessionId(id);
          setActiveTab("chat");
        }}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        activeProvider={activeProvider}
        onChangeProvider={(p) => {
          setActiveProvider(p);
          triggerModelSwitchProgress(p);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExportChats={handleExportChats}
        onImportChats={handleImportChats}
      />

      {/* Main Container workspace */}
      <div className="flex-1 flex flex-col justify-between h-full bg-[#0a0a0a] relative overflow-hidden">
        
        {/* Modern tabs bar array */}
        <div className="h-12 border-b border-white/5 bg-[#0a0a0a] shrink-0 flex items-center justify-between px-8 select-none z-20">
          <div className="flex items-center gap-1">
            {[
              { id: "chat", label: "Чат / Playground" },
              { id: "lab", label: "Prompt Lab" },
              { id: "compare", label: "Model Compare" },
              { id: "overview", label: "System Monitor" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`text-[10px] font-mono font-semibold uppercase tracking-widest px-3.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                    isActive
                      ? "bg-white/5 text-white border border-white/10"
                      : "text-white/40 hover:text-white/80 border border-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            {/* Quick telemetry indicators */}
            <div className="text-[9px] font-mono uppercase text-white/30 tracking-widest hidden sm:flex items-center gap-4">
              <span>Host URL: {settings.hostUrl}</span>
              <span>•</span>
              <span>Model ID: {settings.modelName}</span>
            </div>
          </div>
        </div>

        {/* Dynamic tab contents switch rendering */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === "lab" ? (
            <PromptLab
              onRunWithModel={(promptText) => {
                setInputText(promptText);
                setActiveTab("chat");
                showToast("Prompt loaded into field!");
              }}
            />
          ) : activeTab === "compare" ? (
            <ModelCompare
              isLmStudioOnline={isLocalOnline === true}
              onRunWithModel={(promptText) => {
                setInputText(promptText);
                setActiveTab("chat");
                showToast("Prompt loaded into active chat!");
              }}
            />
          ) : activeTab === "overview" ? (
            <SystemOverview />
          ) : (
            
            /* Core Chat view layout content */
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
              
              {/* Primary central dialogue screen */}
              <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
                
                {/* Header info */}
                <header className="flex h-12 items-center justify-between px-8 border-b border-white/5 bg-[#0a0a0a] shrink-0 select-none">
                  <div className="flex items-center gap-3">
                    {activeSession && (
                      <span className="text-white/95 text-xs font-semibold max-w-xs truncate">
                        {activeSession.title}
                      </span>
                    )}

                    {/* Compact context usage indicator inline */}
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded px-2.5 py-0.5 text-[9px] text-white/50 font-mono font-medium">
                      <span>CONTEXT LIMIT:</span>
                      <span className={ctxStats.percent > 70 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                        {ctxStats.percent}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5">
                    {/* Exporter Report button */}
                    <button
                      onClick={triggerExportReport}
                      className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-mono text-white/60 hover:text-white tracking-widest uppercase transition-colors cursor-pointer"
                      title="Download Inference Markdown Report"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export Report</span>
                    </button>

                    <button
                      onClick={() => setIsSettingsOpen(true)}
                      className="p-1.5 rounded hover:bg-white/5 text-white/50 hover:text-white transition-colors cursor-pointer"
                      title="Configurations Hyperparameters"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </header>

                {/* Message display container scroll log */}
                <div
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto px-8 py-10 space-y-10 scrollbar-thin select-text"
                >
                  {activeSession && activeSession.messages.length === 0 ? (
                    <div className="max-w-3xl mx-auto py-12 space-y-8 select-none">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-semibold text-white/95 tracking-tight leading-snug">
                          Умная Лаборатория ИИ
                        </h2>
                        <p className="text-xs text-white/40 leading-relaxed max-w-sm mx-auto">
                          Выберите тему для генерации или начните писать запрос ниже. Ваша сессия на 100% застрахована.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        {promptSuggestions.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectSuggestion(s.text)}
                            className="flex flex-col text-left p-5 rounded-xl border border-white/5 bg-[#141414] hover:bg-[#1a1a1a] hover:border-white/10 transition-all duration-250 cursor-pointer shadow-xs active:scale-99"
                          >
                            <span className="text-white/30 text-[10px] uppercase tracking-widest font-mono mb-2 font-semibold">
                              {s.title}
                            </span>
                            <span className="text-white/60 text-[13px] leading-relaxed">
                              {s.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-3xl mx-auto space-y-10 pb-10">
                      
                      {/* Active system guidelines preset panel */}
                      <div className="bg-[#141414]/40 border border-white/5 rounded-xl p-4 text-[11px] font-mono text-white/40 leading-relaxed select-none">
                        <span className="text-white/60 font-semibold uppercase tracking-wider block mb-1">Active compiler instructions persona</span>
                        {activeSession?.systemPrompt || settings.systemPrompt}
                      </div>

                      {activeSession?.messages.map((message) => {
                        const isUser = message.role === "user";
                        return (
                          <div
                            key={message.id}
                            className={`max-w-3xl mx-auto w-full flex ${
                              isUser ? "justify-end" : "justify-start gap-4"
                            } animate-msg-fade`}
                          >
                            {!isUser && (
                              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center shrink-0 mt-1">
                                <div className="w-3 h-3 bg-white/40 rounded-full"></div>
                              </div>
                            )}

                            <div
                              className={`${
                                isUser
                                  ? "bg-[#1a1a1a] px-5 py-3 rounded-2xl rounded-tr-sm text-[15px] leading-relaxed text-[#ededed] select-text font-sans"
                                  : "space-y-4 font-serif text-[17px] text-white/90 leading-relaxed w-full"
                              }`}
                            >
                              {!isUser && (
                                <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-[#ededed]/30 uppercase mb-2 select-none font-semibold">
                                  <span>{activeProvider === "gemini" ? "Gemini 3.5 Core" : "LM Studio Local"}</span>
                                  <span>{message.timestamp}</span>
                                </div>
                              )}

                              {message.content === "" && isGenerating ? (
                                <div className="flex items-center gap-2 py-2 select-none">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce delay-100"></span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce delay-250"></span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce delay-400"></span>
                                </div>
                              ) : (
                                <MarkdownRenderer content={message.content} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Lower dialog controls HUD block including streaming control, plugins and dev menu */}
                <div className="p-8 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent shrink-0 relative z-10 select-none">
                  
                  {/* Web plugin tools settings widget list */}
                  <div className="max-w-3xl mx-auto flex flex-wrap gap-2 mb-3.5 items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-white/40 font-bold block">Developer Utilities:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {tools.map((t) => {
                          const Icon = t.icon;
                          return (
                            <button
                              key={t.id}
                              onClick={() => {
                                setTools((prev) =>
                                  prev.map((item) => (item.id === t.id ? { ...item, enabled: !item.enabled } : item))
                                );
                                showToast(`${t.name} toggled`);
                              }}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                                t.enabled
                                  ? "bg-white/10 border-white/20 text-[#ededed]"
                                  : "bg-transparent border-transparent text-[#ededed]/20 hover:text-white/40"
                              }`}
                            >
                              <Icon className="w-3 h-3" />
                              <span>{t.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Debug panels switcher */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsDebugMode(!isDebugMode)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                          isDebugMode
                            ? "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                            : "bg-transparent border border-transparent text-[#ededed]/30 hover:text-white/60"
                        }`}
                      >
                        <Bug className="w-3 h-3" />
                        <span>Debug Console</span>
                      </button>
                    </div>
                  </div>

                  {/* Form input submit */}
                  <form
                    onSubmit={handleSendMessage}
                    className="max-w-3xl mx-auto relative group"
                  >
                    <textarea
                      ref={textareaRef}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      rows={1}
                      placeholder={
                        isGenerating 
                          ? "Smart assistant is typing output character stream..." 
                          : activeProvider === "gemini"
                            ? "Message Gemini... (Enter to send, Ctrl+L to empty context)"
                            : "Message Local LM Studio... (CORS must be verified)"
                      }
                      disabled={isGenerating && !isGeneratingPaused}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl px-5 py-4 pr-32 focus:outline-none focus:border-white/20 resize-none h-14 min-h-[56px] text-sm text-[#ededed] placeholder:text-[#ededed]/20 transition-all font-sans select-text scrollbar-none"
                    />

                    {/* Action trigger group button */}
                    <div className="absolute right-3.5 bottom-3 flex items-center gap-2">
                      
                      {/* Cinema pause/resume stream animation button */}
                      {isGenerating && (
                        <button
                          type="button"
                          onClick={handleTogglePauseResume}
                          className="p-1 px-2.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded text-[9px] font-mono uppercase text-white/80 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Pause className="w-2.5 h-2.5" />
                          <span>{isGeneratingPaused ? "Resume" : "Pause"}</span>
                        </button>
                      )}

                      <button
                        type="submit"
                        disabled={!inputText.trim() || isGenerating}
                        className={`p-1.5 rounded-lg text-black hover:bg-white/90 transition-all flex items-center justify-center cursor-pointer ${
                          inputText.trim() && !isGenerating
                            ? "bg-white text-black active:scale-95 animate-pulse"
                            : "bg-white/5 text-white/20 cursor-not-allowed"
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>

                  {/* Custom debug visual pane shown directly below */}
                  {isDebugMode && (
                    <div className="max-w-3xl mx-auto border border-white/10 bg-[#0f0f0f] rounded-xl p-4 mt-4 font-mono text-[10px] space-y-3 shadow-2xl animate-fade-in select-text">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-white/40 uppercase tracking-widest text-[9px] font-bold">API Raw Payload Inspector</span>
                        <span className="text-rose-400">ENDPOINT API: {debugPayload.activeEndpoint}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-white/40 mb-1">JSON REQUEST PAYLOAD:</p>
                          <pre className="p-3 bg-white/5 rounded max-h-[140px] overflow-y-auto whitespace-pre scrollbar-thin text-[#ededed]/80">
                            {debugPayload.requestPayload}
                          </pre>
                        </div>
                        <div>
                          <p className="text-white/40 mb-1">RAW API RESPONSE:</p>
                          <pre className="p-3 bg-white/5 rounded max-h-[140px] overflow-y-auto whitespace-pre scrollbar-thin text-[#ededed]/80">
                            {debugPayload.responsePayload}
                          </pre>
                        </div>
                      </div>

                      <div>
                        <p className="text-white/40 mb-1">CHUNK EMISSION LOGS:</p>
                        <div className="p-3 bg-[#0a0a0a] rounded max-h-[80px] overflow-y-auto space-y-1 text-emerald-400">
                          {debugPayload.chunkLogs.map((log, idx) => (
                            <div key={idx}>{log}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Prompt notice under text areas */}
                  <p className="text-center text-[10px] text-white/20 mt-3.5 uppercase tracking-[0.2em]">
                    LLM Workspace Playground • Minimalist Interface v3.0
                  </p>
                </div>

              </div>

              {/* Chat Timeline Generation temporal slider sidebar */}
              <div className="w-64 border-l border-white/5 overflow-y-auto select-none p-5 h-full space-y-5 hidden lg:block bg-[#0a0a0a] shrink-0">
                <span className="text-[10px] uppercase font-mono tracking-widest text-white/30 font-bold block">Telemetry Context Map</span>
                
                {/* Visual blocks representation for context usage */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-mono text-white/40">
                    <span>BLOCK MEMORY MAP</span>
                    <span>{ctxStats.count} / 30 items</span>
                  </div>
                  
                  {/* Context block color map */}
                  <div className="grid grid-cols-8 gap-1 p-2 bg-[#141414] border border-white/5 rounded-lg">
                    {Array.from({ length: 32 }).map((_, idx) => {
                      const msgItem = activeSession?.messages[idx];
                      let color = "bg-white/5"; // unused empty block
                      if (msgItem) {
                        if (msgItem.role === "system") color = "bg-violet-500/20 shadow-[0_0_8px_rgba(139,92,246,0.3)] border border-violet-500/30";
                        if (msgItem.role === "user") color = "bg-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.3)] border border-blue-500/30";
                        if (msgItem.role === "assistant") color = "bg-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.3)] border border-emerald-500/30";
                      }
                      return (
                        <div
                          key={idx}
                          className={`aspect-square rounded transition-all duration-300 ${color}`}
                          title={msgItem ? `Item #${idx + 1}: ${msgItem.role}` : "Empty chunk"}
                        />
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-white/30 font-mono leading-relaxed">
                    Color identifiers: 紫 (System) / 青 (User) / 翠 (Assistant).
                  </p>
                </div>

                {/* List of generation items with rollback timeline trigger */}
                <span className="text-[10px] uppercase font-mono tracking-widest text-white/30 font-bold block pt-2">Temporal States Log</span>
                {activeSession && activeSession.messages.length === 0 ? (
                  <p className="text-[10px] text-white/25 italic">No generation logs.</p>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin select-none pr-1">
                    {activeSession?.messages.map((m, idx) => (
                      <div
                        key={m.id}
                        onClick={() => jumpToTimelineState(idx)}
                        className="p-2 border border-white/5 hover:border-white/10 bg-[#141414]/40 hover:bg-[#141414] rounded-md cursor-pointer transition-all flex items-start gap-2 group text-left"
                        title="Click to rollback session state to here"
                      >
                        <span className="text-[9px] font-mono text-emerald-400 shrink-0 mt-0.5 font-bold">#{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium text-white/80 group-hover:text-white truncate">
                            {m.content.replace(/[#*`_]/g, "").substring(0, 32).trim()}...
                          </p>
                          <p className="text-[8px] text-white/30 uppercase tracking-widest font-mono mt-0.5">
                            {m.role} • {m.timestamp}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

      </div>

      {/* Embedded Settings modal panels popup */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {/* Floating Space Telemetry HUD Overlay panel */}
      <HUDOverlay
        metrics={metrics}
        onMetricsChange={setMetrics}
        tokensPerSec={tokensPerSecond}
      />
    </div>
  );
}
