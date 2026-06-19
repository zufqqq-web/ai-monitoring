import React, { useState, useEffect } from "react";
import {
  X,
  Sliders,
  Database,
  RefreshCw,
  Check,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  Cpu,
  Key
} from "lucide-react";
import { LMStudioSettings } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: LMStudioSettings;
  onSave: (newSettings: LMStudioSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [hostUrl, setHostUrl] = useState(settings.hostUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey || "");
  const [modelName, setModelName] = useState(settings.modelName);
  const [temperature, setTemperature] = useState(settings.temperature);
  const [maxTokens, setMaxTokens] = useState(settings.maxTokens);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);

  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "success" | "failed">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      setHostUrl(settings.hostUrl);
      setApiKey(settings.apiKey || "");
      setModelName(settings.modelName);
      setTemperature(settings.temperature);
      setMaxTokens(settings.maxTokens);
      setSystemPrompt(settings.systemPrompt);
      setScanStatus("idle");
      setErrorMessage("");
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  // Poll LM Studio via the python backend to bypass CORS issues
  const scanLocalModels = async () => {
    setScanStatus("scanning");
    setErrorMessage("");
    setDiscoveredModels([]);

    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostUrl, apiKey }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP status error: ${res.status}`);
      }

      const data = await res.json();
      
      if (data && Array.isArray(data.data)) {
        const models = data.data.map((m: any) => m.id);
        setDiscoveredModels(models);
        setScanStatus("success");
        if (models.length > 0 && !models.includes(modelName)) {
          setModelName(models[0]); // Select first model by default
        }
      } else {
        throw new Error("Invalid response format received from models API.");
      }
    } catch (err: any) {
      console.error(err);
      setScanStatus("failed");
      setErrorMessage(
        err.message ||
        "Could not connect. Ensure LM Studio server is running, and there are no network blockers."
      );
    }
  };

  const handleSave = () => {
    onSave({
      hostUrl: hostUrl.trim(),
      apiKey: apiKey.trim(),
      modelName: modelName.trim(),
      temperature,
      maxTokens,
      systemPrompt: systemPrompt.trim(),
    });
    onClose();
  };

  const loadPresetPrompt = (prompt: string) => {
    setSystemPrompt(prompt);
  };

  const presets = [
    {
      name: "Sleek Assistant",
      prompt: "You are Claude, a helpful, extremely capable AI assistant answering in beautiful, structured editorial prose. Keep replies precise, thoughtful, and highly authentic.",
    },
    {
      name: "Master Programmer",
      prompt: "You are an elite software architect who produces clean, robust, and production-ready code with step-by-step reasoning in clear Markdown. Prioritize performance and modularity.",
    },
    {
      name: "Poetic & Literary",
      prompt: "You are a creative writer who responds using rich prose, metaphors, and sophisticated linguistic pairings, optimal for literary composition.",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000bb] backdrop-blur-xs p-4 animate-fade-in font-sans">
      <div className="w-full max-w-lg bg-[#141416] border border-[#232326] rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header wrapper block */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232326] bg-[#1a1a1c]">
          <div className="flex items-center gap-2">
            <Sliders className="w-4.5 h-4.5 text-zinc-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white font-mono">
              Workspace Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#2b2b2f] text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Content panel */}
        <div className="p-5 overflow-y-auto space-y-5">
          
          {/* Section 1: Connection endpoint */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-zinc-500" />
                LM Studio Host URL
              </label>
              <button
                href="https://lmstudio.ai"
                onClick={() => window.open("https://lmstudio.ai", "_blank")}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5"
              >
                LM Studio docs
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={hostUrl}
                onChange={(e) => setHostUrl(e.target.value)}
                placeholder="e.g. http://localhost:1234"
                className="flex-1 text-sm bg-[#1b1b1d] border border-[#2d2d31] hover:border-[#38383e] focus:border-zinc-500 px-3 py-2 rounded-lg text-white font-mono outline-none"
              />
              <button
                type="button"
                onClick={scanLocalModels}
                disabled={scanStatus === "scanning"}
                className={`py-2 px-3 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1 cursor-pointer transition-all duration-200 ${
                  scanStatus === "scanning"
                    ? "bg-[#252528] text-zinc-500"
                    : "bg-[#1f1e24] border border-[#3b3260] hover:bg-[#292733] text-violet-300"
                }`}
              >
                {scanStatus === "scanning" ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Scan Models</span>
              </button>
            </div>
          </div>

          {/* Section 1.5: Connection API Key */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-zinc-500" />
              LM Studio API Key (optional)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="e.g. lm-studio-api-key-if-required"
              className="w-full text-sm bg-[#1b1b1d] border border-[#2d2d31] hover:border-[#38383e] focus:border-zinc-500 px-3 py-2 rounded-lg text-white font-mono outline-none"
            />
          </div>

          {/* Model Status Warning / Result Feedbacks */}
          {scanStatus === "scanning" && (
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 animate-pulse">
              Pinging local LM Studio server at {hostUrl}...
            </div>
          )}

          {scanStatus === "success" && (
            <div className="p-3 rounded-lg bg-[#0e1713] border border-[#1b3d2b] text-xs text-emerald-400 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Check className="w-4 h-4 text-emerald-400" />
                Connected successfully! Discovered {discoveredModels.length} models.
              </div>
              <p className="text-[10px] text-zinc-500">
                You can now choose a model in the dropdown below or manually type or change configuration.
              </p>
            </div>
          )}

          {scanStatus === "failed" && (
            <div className="p-3 rounded-lg bg-[#1a1112] border border-[#52252a] text-xs text-rose-400 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                Could not connect to LM Studio Server
              </div>
              <p className="text-[10px] leading-relaxed text-zinc-400">
                {errorMessage}
              </p>
              <div className="text-[10px] text-zinc-500 pl-4 list-decimal space-y-0.5">
                <div>• Enable CORS in LM Studio Settings</div>
                <div>• Verify server status in bottom LM Studio panel</div>
                <div>• Make sure server is running on the correct port (usually 1234 or 11434 for Ollama)</div>
              </div>
            </div>
          )}

          {/* Section 2: Model Name Config setter */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono block">
              Active LLM Model ID
            </label>
            {discoveredModels.length > 0 ? (
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full text-sm bg-[#1b1b1d] border border-[#2d2d31] hover:border-[#38383e] focus:border-zinc-500 px-3 py-2 rounded-lg text-white font-mono outline-none"
              >
                {discoveredModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. lmstudio-community/Meta-Llama-3-8B-Instruct"
                className="w-full text-sm bg-[#1b1b1d] border border-[#2d2d31] hover:border-[#38383e] focus:border-zinc-500 px-3 py-2 rounded-lg text-white font-mono outline-none"
              />
            )}
          </div>

          {/* Section 3: Sliders for temperature and tokens */}
          <div className="grid grid-cols-2 gap-4">
            {/* Temp slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
                  Temperature
                </label>
                <span className="text-xs text-zinc-500 font-mono">{temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#1b1b1d] hover:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-400"
              />
            </div>

            {/* Tokens slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
                  Max Tokens
                </label>
                <span className="text-xs text-zinc-500 font-mono">{maxTokens}</span>
              </div>
              <input
                type="range"
                min="128"
                max="4096"
                step="64"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full h-1.5 bg-[#1b1b1d] hover:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-400"
              />
            </div>
          </div>

          {/* Section 4: System Prompt and Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
                System Persona & Prompts
              </label>
              <div className="flex gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => loadPresetPrompt(preset.prompt)}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              placeholder="Provide guidelines for how the LLM should think, behave, and converse..."
              className="w-full text-xs bg-[#1b1b1d] border border-[#2d2d31] hover:border-[#38383e] focus:border-zinc-500 p-2.5 rounded-lg text-zinc-300 outline-none leading-relaxed resize-none"
            />
          </div>

        </div>

        {/* Action Panel Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[#232326] bg-[#1a1a1c]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg transition-all duration-150 shadow-md cursor-pointer active:scale-98"
          >
            Save Configurations
          </button>
        </div>

      </div>
    </div>
  );
};
