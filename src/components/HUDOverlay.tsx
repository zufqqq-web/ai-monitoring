import React, { useState, useEffect } from "react";
import { Activity, Cpu, Thermometer, Database, Zap, Gauge, Eye, EyeOff } from "lucide-react";
import { SystemMetrics } from "../types";

interface HUDOverlayProps {
  metrics: SystemMetrics;
  onMetricsChange?: (metrics: SystemMetrics) => void;
  tokensPerSec: number;
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({
  metrics,
  onMetricsChange,
  tokensPerSec,
}) => {
  const [showHUD, setShowHUD] = useState(true);
  const [internalMetrics, setInternalMetrics] = useState<SystemMetrics>({
    gpuTemp: 50,
    vramUsed: 1.2,
    vramTotal: 4.0,
    cpuLoad: 5,
    toksSec: 0,
    latency: 0,
  });

  // Keep metrics ticking with real data from Python backend
  useEffect(() => {
    const fetchRealMetrics = async () => {
      try {
        const res = await fetch("/api/system-metrics");
        if (res.ok) {
          const data = await res.json();
          
          const updated: SystemMetrics = {
            gpuTemp: parseFloat(data.gpuTemp.toFixed(1)),
            vramUsed: parseFloat(data.vramUsed.toFixed(2)),
            vramTotal: parseFloat(data.vramTotal.toFixed(1)),
            cpuLoad: Math.round(data.cpuLoad),
            toksSec: tokensPerSec > 0 ? tokensPerSec : 0,
            latency: tokensPerSec > 0 ? metrics?.latency || 120 : 0,
          };
          
          setInternalMetrics(updated);
          
          if (onMetricsChange) {
            onMetricsChange(updated);
          }
        }
      } catch (e) {
        console.error("Failed to fetch system metrics in HUD:", e);
      }
    };

    fetchRealMetrics();
    const interval = setInterval(fetchRealMetrics, 2000);
    return () => clearInterval(interval);
  }, [tokensPerSec, onMetricsChange, metrics?.latency]);

  const displayMetrics = metrics || internalMetrics;

  return (
    <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-2 text-[#ededed]">
      {/* HUD Show/Hide Toggle */}
      <button
        onClick={() => setShowHUD(!showHUD)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0f0f0f] border border-white/10 hover:border-white/25 rounded-md text-[10px] font-mono tracking-widest uppercase transition-all duration-150 cursor-pointer text-white/50 hover:text-white"
        title="Toggle Dev Telemetry HUD"
      >
        {showHUD ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        <span>{showHUD ? "Hide HUD" : "Telemetry HUD"}</span>
      </button>

      {showHUD && (
        <div className="bg-[#0f0f0f]/95 border border-white/10 p-4 rounded-xl shadow-2xl w-64 backdrop-blur-md font-mono select-none flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-[10px] text-white/40 tracking-widest uppercase flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-400 animate-pulse" /> Live Telemetry
            </span>
            <span className="text-[9px] text-white/30">HUD v2.4</span>
          </div>

          <div className="space-y-2.5">
            {/* GPU Speed temperature */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5" /> GPU Temp
              </span>
              <span className={`font-semibold ${displayMetrics.gpuTemp > 75 ? "text-orange-400" : "text-emerald-400"}`}>
                {displayMetrics.gpuTemp}°C
              </span>
            </div>

            {/* VRAM usage slider visual */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> VRAM Usage
                </span>
                <span className="text-white/90">
                  {displayMetrics.vramUsed.toFixed(1)} / {displayMetrics.vramTotal.toFixed(0)} GB
                </span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${(displayMetrics.vramUsed / displayMetrics.vramTotal) * 100}%` }}
                />
              </div>
            </div>

            {/* CPU Load */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> CPU Load
                </span>
                <span className="text-white/90">{displayMetrics.cpuLoad}%</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all duration-500"
                  style={{ width: `${displayMetrics.cpuLoad}%` }}
                />
              </div>
            </div>

            {/* Tokens per second */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Token Stream
              </span>
              <span className="text-amber-400 font-bold">
                {displayMetrics.toksSec} tok/s
              </span>
            </div>

            {/* Latency */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" /> Latency
              </span>
              <span className="text-white/90">{displayMetrics.latency} ms</span>
            </div>
          </div>

          {/* Interactive controls inside the HUD component for fun customization */}
          <div className="border-t border-white/5 pt-2.5 mt-1 flex flex-col gap-1.5">
            <span className="text-[9px] text-white/30 uppercase tracking-wider">Telemetry Controls</span>
            <div className="flex gap-2 text-[9px]">
              <button
                onClick={() => {
                  setInternalMetrics((prev) => ({
                    ...prev,
                    gpuTemp: 78,
                    vramUsed: 12.4,
                    cpuLoad: 88,
                  }));
                }}
                className="flex-1 py-1 bg-white/5 hover:bg-rose-950/30 border border-white/5 hover:border-rose-800/40 rounded text-center cursor-pointer transition-all"
              >
                Boost Load
              </button>
              <button
                onClick={() => {
                  setInternalMetrics((prev) => ({
                    ...prev,
                    gpuTemp: 52,
                    vramUsed: 4.1,
                    cpuLoad: 12,
                  }));
                }}
                className="flex-1 py-1 bg-white/5 hover:bg-emerald-950/30 border border-white/5 hover:border-emerald-800/40 rounded text-center cursor-pointer transition-all"
              >
                Cool Down
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
