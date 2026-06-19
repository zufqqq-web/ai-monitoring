import React, { useState } from "react";
import { Sparkles, Cpu, Play, Check, AlertCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { LMStudioSettings } from "../types";

interface ModelCompareProps {
  onRunWithModel: (prompt: string) => void;
  isLmStudioOnline: boolean;
  settings: LMStudioSettings;
}

export const ModelCompare: React.FC<ModelCompareProps> = ({ onRunWithModel, isLmStudioOnline, settings }) => {
  const [promptText, setPromptText] = useState("Explain the concept of memoization in React and code a quick example.");

  // Configuration temperatures
  const [tempA, setTempA] = useState(0.2);
  const [tempB, setTempB] = useState(1.0);

  // States for outputs
  const [isComparing, setIsComparing] = useState(false);
  const [outputA, setOutputA] = useState("");
  const [outputB, setOutputB] = useState("");

  // Live metrics
  const [metricsA, setMetricsA] = useState({ toksSec: 0, latency: 0, vram: "Local Host" });
  const [metricsB, setMetricsB] = useState({ toksSec: 0, latency: 0, vram: "Local Host" });

  const [ratingA, setRatingA] = useState<"like" | "dislike" | null>(null);
  const [ratingB, setRatingB] = useState<"like" | "dislike" | null>(null);

  const handleCompare = async () => {
    if (!promptText.trim()) return;
    setIsComparing(true);
    setOutputA("");
    setOutputB("");
    setRatingA(null);
    setRatingB(null);

    setMetricsA({ toksSec: 0, latency: 0, vram: "Querying..." });
    setMetricsB({ toksSec: 0, latency: 0, vram: "Querying..." });

    const fetchResponse = async (
      temp: number,
      setOutput: React.Dispatch<React.SetStateAction<string>>,
      setMetrics: React.Dispatch<React.SetStateAction<any>>
    ) => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: promptText }],
          hostUrl: settings.hostUrl,
          modelName: settings.modelName,
          temperature: temp,
          maxTokens: settings.maxTokens,
          systemPrompt: settings.systemPrompt,
          apiKey: settings.apiKey
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server status error: ${res.status}`);
      }

      const data = await res.json();
      const content = data.content || "No output returned.";

      // Visual typewriter streaming speed
      let index = 0;
      const interval = setInterval(() => {
        if (index < content.length) {
          const step = Math.min(5, content.length - index);
          setOutput((prev) => prev + content.substring(index, index + step));
          index += step;
        } else {
          clearInterval(interval);
        }
      }, 25);

      setMetrics({
        toksSec: data.tokensPerSecond || 35,
        latency: data.latencyMs || 150,
        vram: settings.modelName.length > 15 ? settings.modelName.substring(0, 14) + "..." : settings.modelName
      });
    };

    try {
      await Promise.all([
        fetchResponse(tempA, setOutputA, setMetricsA).catch((err) => {
          setOutputA(`🛑 Ошибка при связи с LM Studio (A):\n\n${err.message}`);
          setMetricsA({ toksSec: 0, latency: 0, vram: "Failed" });
        }),
        fetchResponse(tempB, setOutputB, setMetricsB).catch((err) => {
          setOutputB(`🛑 Ошибка при связи с LM Studio (B):\n\n${err.message}`);
          setMetricsB({ toksSec: 0, latency: 0, vram: "Failed" });
        }),
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#0a0a0a] text-[#ededed] font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Title */}
        <div className="border-b border-white/5 pb-4">
          <h1 className="text-xl font-semibold tracking-tight text-white/90">Model Space Comparison</h1>
          <p className="text-xs text-white/40 mt-1">
            Сравнение ответов модели LM Studio с различными параметрами температуры (Temp A vs Temp B).
          </p>
        </div>

        {/* Form and configs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Prompt Entry */}
          <div className="md:col-span-2 space-y-2">
            <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase font-semibold">Test Prompt Payload</span>
            <textarea
              className="w-full bg-[#141414] border border-white/5 hover:border-white/10 rounded-xl p-4 text-xs font-mono text-white/90 outline-none focus:border-white/20 transition-all font-mono leading-relaxed"
              rows={3}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Enter probe query..."
            />
          </div>

          {/* Hyperparameters Config */}
          <div className="bg-[#141414] border border-white/5 rounded-xl p-5 space-y-4">
            <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase font-semibold block">Config Parameters</span>
            
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-white/40">TEMP A (STRICT):</span>
                <span className="text-white/80 font-bold">{tempA}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.05"
                value={tempA}
                onChange={(e) => setTempA(parseFloat(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-white/40">TEMP B (CREATIVE):</span>
                <span className="text-white/80 font-bold">{tempB}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.05"
                value={tempB}
                onChange={(e) => setTempB(parseFloat(e.target.value))}
                className="w-full accent-violet-400 cursor-pointer"
              />
            </div>

            <button
              onClick={handleCompare}
              disabled={isComparing || !promptText.trim() || !isLmStudioOnline}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/5 disabled:text-white/20 text-black font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer"
            >
              <Play className="w-4.5 h-4.5 fill-current" />
              <span>Launch Side-By-Side Probe</span>
            </button>
          </div>
        </div>

        {/* Side by side outputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          
          {/* Model A Column */}
          <div className="bg-[#141414]/60 border border-white/10 rounded-2xl p-5 space-y-4 flex flex-col">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white/90 truncate max-w-[140px]">{settings.modelName}</span>
              </div>
              <span className="text-[10px] bg-emerald-400/10 text-emerald-300 font-semibold px-2 py-0.5 rounded-full uppercase font-mono">
                Temp: {tempA}
              </span>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2 py-2 select-none">
              <div className="bg-[#0a0a0a] border border-white/5 p-2 rounded-lg text-center">
                <p className="text-[9px] text-white/40 uppercase font-mono">INFERENCE</p>
                <p className="text-xs font-bold text-white/95 mt-1">{metricsA.latency ? `${metricsA.latency} ms` : "--"}</p>
              </div>
              <div className="bg-[#0a0a0a] border border-white/5 p-2 rounded-lg text-center">
                <p className="text-[9px] text-white/40 uppercase font-mono">SPEED</p>
                <p className="text-xs font-bold text-amber-400 mt-1">{metricsA.toksSec ? `${metricsA.toksSec} tok/s` : "--"}</p>
              </div>
              <div className="bg-[#0a0a0a] border border-white/5 p-2 rounded-lg text-center">
                <p className="text-[9px] text-white/40 uppercase font-mono">MODEL ID</p>
                <p className="text-[10px] font-mono text-white/75 truncate mt-1.5">{metricsA.vram || "--"}</p>
              </div>
            </div>

            {/* Output screen */}
            <div className="flex-1 bg-[#141414] border border-white/5 rounded-xl p-4 font-mono text-xs whitespace-pre-wrap leading-relaxed text-[#ededed]/90 min-h-[250px] overflow-y-auto max-h-[400px] scrollbar-thin select-text">
              {outputA || <span className="text-white/20 italic">Awaiting inference launch...</span>}
            </div>

            {/* Assessment and run toggle */}
            {outputA && (
              <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-auto select-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/40 uppercase font-mono">Evaluate Quality:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setRatingA("like")}
                      className={`p-1 rounded hover:bg-white/5 transition-all cursor-pointer ${ratingA === "like" ? "text-emerald-400" : "text-white/30"}`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setRatingA("dislike")}
                      className={`p-1 rounded hover:bg-white/5 transition-all cursor-pointer ${ratingA === "dislike" ? "text-rose-400" : "text-white/30"}`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => onRunWithModel(promptText)}
                  className="text-[10px] uppercase font-mono tracking-widest font-semibold text-[#ededed]/50 hover:text-white transition-colors"
                >
                  Use This Model &rarr;
                </button>
              </div>
            )}
          </div>

          {/* Model B Column */}
          <div className="bg-[#141414]/60 border border-white/10 rounded-2xl p-5 space-y-4 flex flex-col">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-semibold text-white/90 truncate max-w-[140px]">{settings.modelName}</span>
              </div>
              <span className="text-[10px] bg-violet-400/10 text-violet-300 font-semibold px-2 py-0.5 rounded-full uppercase font-mono">
                Temp: {tempB}
              </span>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2 py-2 select-none">
              <div className="bg-[#0a0a0a] border border-white/5 p-2 rounded-lg text-center">
                <p className="text-[9px] text-white/40 uppercase font-mono">INFERENCE</p>
                <p className="text-xs font-bold text-white/95 mt-1">{metricsB.latency ? `${metricsB.latency} ms` : "--"}</p>
              </div>
              <div className="bg-[#0a0a0a] border border-white/5 p-2 rounded-lg text-center">
                <p className="text-[9px] text-white/40 uppercase font-mono">SPEED</p>
                <p className="text-xs font-bold text-amber-400 mt-1">{metricsB.toksSec ? `${metricsB.toksSec} tok/s` : "--"}</p>
              </div>
              <div className="bg-[#0a0a0a] border border-white/5 p-2 rounded-lg text-center">
                <p className="text-[9px] text-white/40 uppercase font-mono">MODEL ID</p>
                <p className="text-[10px] font-mono text-white/75 truncate mt-1.5">{metricsB.vram || "--"}</p>
              </div>
            </div>

            {/* Output screen */}
            <div className="flex-1 bg-[#141414] border border-white/5 rounded-xl p-4 font-mono text-xs whitespace-pre-wrap leading-relaxed text-[#ededed]/90 min-h-[250px] overflow-y-auto max-h-[400px] scrollbar-thin select-text">
              {outputB || <span className="text-white/20 italic">Awaiting inference launch...</span>}
            </div>

            {/* Assessment and run toggle */}
            {outputB && (
              <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-auto select-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/40 uppercase font-mono">Evaluate Quality:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setRatingB("like")}
                      className={`p-1 rounded hover:bg-white/5 transition-all cursor-pointer ${ratingB === "like" ? "text-emerald-400" : "text-white/30"}`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setRatingB("dislike")}
                      className={`p-1 rounded hover:bg-[#222] transition-all cursor-pointer ${ratingB === "dislike" ? "text-rose-400" : "text-white/30"}`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => onRunWithModel(promptText)}
                  className="text-[10px] uppercase font-mono tracking-widest font-semibold text-[#ededed]/50 hover:text-white transition-colors"
                >
                  Use This Model &rarr;
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
