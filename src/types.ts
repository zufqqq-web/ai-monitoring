export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  tokensPerSecond?: number;
  latencyMs?: number;
  promptVersion?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  systemPrompt: string;
  modelProvider: "gemini" | "lmstudio";
  modelName: string;
  temperature: number;
  maxTokens: number;
}

export interface LMStudioSettings {
  hostUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface PromptVersion {
  id: string;
  version: string;
  content: string;
  timestamp: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  tags: string[];
  activeVersion: string;
  versions: PromptVersion[];
}

export interface SystemMetrics {
  gpuTemp: number;
  vramUsed: number;
  vramTotal: number;
  cpuLoad: number;
  toksSec: number;
  latency: number;
}

export interface AIRunnerTool {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: string;
}
