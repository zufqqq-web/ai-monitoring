# 🧠 AI Local Dashboard

A self-hosted chat UI for local LLMs (via **LM Studio**), built as an alternative to existing local AI web UIs — with a sharper focus on **real-time hardware monitoring** and a cleaner interface.

Most local LLM frontends treat your machine as a black box: you chat, you wait, and you have no idea whether you're about to run out of VRAM or whether your GPU is actually being used. This dashboard puts CPU/GPU/RAM stats right next to the chat, updated live while the model is generating.

---

## 🚀 Features

- 💬 **Chat interface** for local LLMs served through LM Studio's OpenAI-compatible API
- 📊 **Live hardware monitoring** — CPU load & temperature, GPU temperature, VRAM usage, GPU busy %, RAM usage, polled in the background every 2 seconds
- 🖥️ **Static system specs** — CPU model, core/thread count, total RAM, GPU model, detected automatically on startup
- ⚡ **Generation speed tracking** — latency and approximate tokens/second per response
- 🧠 **Persistent user memory** — the assistant remembers facts about you (name, preferences, what you code in, etc.) across sessions, combining instant regex pattern-matching with a background LLM-based fact extractor, and injects them into future system prompts
- 🗂 **Chat history** — sessions and messages saved locally in SQLite, nothing leaves your machine
- 🎛 **Model selection** — pulls the list of currently loaded models directly from your LM Studio instance
- 🔥 **Generation presets** — temperature, max tokens, and system prompt, adjustable per session
- 🌙 **Dark theme UI**

---

## 🧱 Tech Stack

**Frontend:** React 19, Tailwind CSS, Vite

**Backend:** Python (FastAPI, Uvicorn), SQLite, `psutil`

**AI Integration:** LM Studio's local OpenAI-compatible API (`/v1/chat/completions`, `/v1/models`)

> The repo also contains `server.ts`, an Express/Vite server that proxies chat requests to Google Gemini instead of LM Studio. It's a leftover from an earlier prototyping pass and **is not used** in the current version — the Python backend (`main.py`) is the one actually serving the app. It's kept here for reference but may be removed in a future cleanup.

---

## 🔍 How hardware monitoring works

A background thread polls system stats every 2 seconds and caches them, so the API never blocks waiting on a slow read:

- **CPU load & temperature** — via `psutil`, with thermal zone fallbacks across different sensor naming schemes
- **GPU temperature / VRAM / utilization** — read directly from `/sys/class/drm/cardN/device/...` on Linux systems with AMD GPUs exposing those sysfs entries
- **NVIDIA fallback** — if no AMD sysfs data is found, the dashboard currently estimates VRAM/GPU load from CPU usage as a placeholder rather than querying `nvidia-smi` directly. This is a known limitation — see below.

### Known limitations

- GPU monitoring was built and tested primarily against an AMD iGPU (Radeon 680M) and an NVIDIA RTX 3050 Mobile. The NVIDIA path currently simulates rather than reads real `nvidia-smi` values — accurate NVIDIA support is the next thing to fix.
- Sysfs paths like `/sys/class/drm/card2/...` assume a specific card index, which can differ across machines and isn't auto-detected yet.
- Monitoring code is Linux-only; no Windows/macOS sensor support.

---

## 🧠 How the memory feature works

When you send a message, two things happen:

1. A fast regex pass checks for a few common patterns (e.g. "меня зовут...", "я люблю...") and stores any matches instantly.
2. In the background (after you already have your reply), the same message is sent to the LLM with a small instruction prompt asking it to extract any new personal facts. Anything it finds gets stored in SQLite.

On your next message, all stored facts are quietly injected into the system prompt, so the model has continuity across sessions without you having to repeat yourself. This runs entirely through your local model — no facts are sent anywhere outside your own LM Studio instance.

---

## 📸 Preview

![Preview](images/preview.png)

---

## ⚙️ Installation

```bash
git clone https://github.com/zufqqq-web/ai-monitoring.git
cd ai-monitoring
```

You'll need [LM Studio](https://lmstudio.ai/) running locally with its server started (Local Server tab → Start Server), and Node.js + Python 3 installed.

```bash
# install frontend dependencies
npm install

# run the app (builds the frontend if needed, then starts the backend)
python main.py
```

`main.py` will automatically install any missing Python dependencies (`fastapi`, `uvicorn`, `requests`, `psutil`) on first run, and will build the React frontend (`npm run build`) if a `dist/` folder isn't found yet.

Once running, open:

```
http://localhost:3000
```

In the app's settings, point the **server URL** field at your LM Studio instance (e.g. `http://localhost:1234`) and pick a loaded model — no `.env` file or extra config needed for the LM Studio flow.

---

## 🗺️ Roadmap / ideas

- [ ] Real `nvidia-smi`-based GPU stats instead of the current estimate fallback
- [ ] Auto-detect the correct `/sys/class/drm/cardN` index instead of assuming `card2`
- [ ] Windows/macOS hardware monitoring support
- [ ] Remove or properly finish the Gemini (`server.ts`) integration path

---

## 📄 License

No license specified yet.
