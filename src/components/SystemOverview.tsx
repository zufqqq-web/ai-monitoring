import React, { useState, useEffect } from "react";
import { Server, Activity, CheckCircle, RefreshCw, Cpu, Database, Trash, Laptop, Settings } from "lucide-react";

interface SystemSpecs {
  os: string;
  cpu_model: string;
  cpu_cores: number;
  cpu_threads: number;
  ram_total_gb: number;
  gpu_model: string;
}

interface Metrics {
  cpuLoad: number;
  cpuTemp: number;
  gpuTemp: number;
  vramUsed: number;
  vramTotal: number;
  gpuBusyPercent: number;
  ramUsed: number;
  ramTotal: number;
  staticSpecs: SystemSpecs;
}

interface MemoryItem {
  id: number;
  fact: string;
  timestamp: string;
}

export const SystemOverview: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSystemData = async () => {
    try {
      const resMetrics = await fetch("/api/system-metrics");
      if (resMetrics.ok) {
        const data = await resMetrics.json();
        setMetrics(data);
      }
      
      const resMemories = await fetch("/api/memories");
      if (resMemories.ok) {
        const data = await resMemories.json();
        setMemories(data);
      }
    } catch (e) {
      console.error("Error fetching system info:", e);
    }
  };

  useEffect(() => {
    fetchSystemData();
    const interval = setInterval(fetchSystemData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshSystem = async () => {
    setIsRefreshing(true);
    await fetchSystemData();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

  const handleDeleteMemory = async (id: number) => {
    try {
      const res = await fetch(`/api/memories/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (e) {
      print("Failed to delete memory fact:", e);
    }
  };

  if (!metrics) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a] text-[#ededed] space-y-4">
        <RefreshCw className="w-8 h-8 text-white/30 animate-spin" />
        <span className="text-xs font-mono text-white/40 uppercase tracking-widest">Scanning local laptop cluster...</span>
      </div>
    );
  }

  const specs = metrics.staticSpecs;

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#0a0a0a] text-[#ededed] font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Banner Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white/90">AI Datacenter Overview</h1>
            <p className="text-xs text-white/40 mt-1">
              Мониторинг ресурсов вашего ноутбука и долговременной SQLite памяти модели в реальном времени.
            </p>
          </div>
          <button
            onClick={handleRefreshSystem}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#141414] border border-white/10 hover:border-white/20 text-[#ededed] text-xs font-mono uppercase tracking-wider rounded-lg transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Scanning..." : "Rescan Laptop"}</span>
          </button>
        </div>

        {/* Big Grid Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 select-none">
          
          <div className="bg-[#141414] border border-white/5 p-5 rounded-xl space-y-1">
            <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase block">Host OS Info</span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-sm font-bold font-mono text-white truncate max-w-[150px]">{specs.os}</span>
              <span className="text-emerald-400 text-xs flex items-center gap-0.5">
                Active <CheckCircle className="w-3 h-3" />
              </span>
            </div>
            <p className="text-[10px] text-white/30 pt-1 font-mono">Fedora Workstation</p>
          </div>

          <div className="bg-[#141414] border border-white/5 p-5 rounded-xl space-y-1">
            <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase block">System RAM Pool</span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-lg font-bold font-mono">{metrics.ramUsed.toFixed(1)} / {specs.ram_total_gb.toFixed(1)} GB</span>
              <span className="text-emerald-400 text-xs font-mono">
                {((metrics.ramUsed / specs.ram_total_gb) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(metrics.ramUsed / specs.ram_total_gb) * 100}%` }} />
            </div>
          </div>

          <div className="bg-[#141414] border border-white/5 p-5 rounded-xl space-y-1">
            <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase block">CPU Core Load</span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-2xl font-bold font-mono">{metrics.cpuLoad.toFixed(0)}%</span>
              <span className="text-blue-400 text-xs font-mono">{metrics.cpuTemp.toFixed(1)}°C</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-blue-400 rounded-full" style={{ width: `${metrics.cpuLoad}%` }} />
            </div>
          </div>

          <div className="bg-[#141414] border border-white/5 p-5 rounded-xl space-y-1">
            <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase block">Physical VRAM (GPU)</span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-lg font-bold font-mono">{metrics.vramUsed.toFixed(1)} / {metrics.vramTotal.toFixed(1)} GB</span>
              <span className="text-emerald-400 text-xs font-mono">{metrics.gpuTemp.toFixed(0)}°C</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(metrics.vramUsed / metrics.vramTotal) * 100}%` }} />
            </div>
          </div>

        </div>

        {/* Main Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Model Memory Table */}
          <div className="lg:col-span-2 bg-[#141414]/40 border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase font-semibold block">SQLite Model Memory Database</span>
              <span className="text-[9px] bg-violet-500/10 text-violet-300 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {memories.length} Memories Saved
              </span>
            </div>

            {memories.length === 0 ? (
              <div className="text-center py-12 text-white/20 text-xs font-mono space-y-2">
                <p>База данных воспоминаний SQLite пуста.</p>
                <p className="text-[10px] text-white/10">Напишите модели что-нибудь о себе в чате, и она автоматически запомнит факты!</p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[350px] space-y-2.5 pr-1 scrollbar-thin">
                {memories.map((m) => (
                  <div key={m.id} className="flex items-start justify-between p-3.5 bg-[#141414]/80 border border-white/5 rounded-xl text-xs hover:border-white/10 transition-colors">
                    <div className="space-y-1">
                      <p className="text-white/90 font-medium leading-relaxed font-sans">{m.fact}</p>
                      <p className="text-[9px] text-white/30 font-mono">Записано: {m.timestamp}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteMemory(m.id)}
                      className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Забыть этот факт"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Side diagnostics box */}
          <div className="space-y-6">
            
            {/* Laptop Hardware details */}
            <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-4">
              <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase font-semibold block flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-zinc-500" /> Laptop Specs
              </span>
              
              <div className="space-y-3.5 text-xs select-none">
                <div>
                  <span className="text-white/30 block text-[9px] uppercase font-mono tracking-wider">Processor (CPU)</span>
                  <span className="text-white/80 font-medium block mt-0.5 leading-snug">{specs.cpu_model}</span>
                  <span className="text-white/40 text-[10px] font-mono mt-0.5 block">{specs.cpu_cores} Cores / {specs.cpu_threads} Threads</span>
                </div>

                <div>
                  <span className="text-white/30 block text-[9px] uppercase font-mono tracking-wider">Graphics Card (GPU)</span>
                  <span className="text-white/80 font-medium block mt-0.5 leading-snug">{specs.gpu_model}</span>
                </div>

                <div>
                  <span className="text-white/30 block text-[9px] uppercase font-mono tracking-wider">Total Laptop RAM</span>
                  <span className="text-white/80 font-medium block mt-0.5">{specs.ram_total_gb.toFixed(1)} GB DDR5</span>
                </div>
              </div>
            </div>

            {/* active connection status */}
            <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-3 font-mono">
              <span className="text-[10px] tracking-widest text-white/40 uppercase font-semibold block">SQLite Engine status</span>
              <div className="space-y-2 text-[10px] leading-relaxed text-white/50">
                <div className="text-emerald-400">• SQLite database: memory.db (Connected)</div>
                <div className="text-emerald-400">• Tables synced: sessions, messages, memories</div>
                <div className="text-white/30">• Dynamic fact extraction background worker active</div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
