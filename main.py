import os
import sys
import json
import sqlite3
import platform
import re
import subprocess
import threading
import time
from typing import List, Dict, Any, Optional
from datetime import datetime

# Check python dependencies and install if running as script
try:
    from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.staticfiles import StaticFiles
    from pydantic import BaseModel
    import uvicorn
    import requests
    import psutil
except ImportError:
    print("Required Python packages are missing. Installing them now...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "fastapi", "uvicorn", "requests", "psutil"], check=True)
        from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.staticfiles import StaticFiles
        from pydantic import BaseModel
        import uvicorn
        import requests
        import psutil
    except Exception as e:
        print(f"Error installing packages: {e}")
        print("Please run manually: pip install fastapi uvicorn requests psutil")
        sys.exit(1)

DB_PATH = "memory.db"
PORT = 3000

# ----------------- DB SETUP -----------------
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        systemPrompt TEXT NOT NULL,
        modelName TEXT NOT NULL,
        temperature REAL NOT NULL,
        maxTokens INTEGER NOT NULL
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES sessions (id) ON DELETE CASCADE
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fact TEXT NOT NULL,
        timestamp TEXT NOT NULL
    )
    """)
    conn.commit()
    conn.close()

init_db()

# ----------------- MEMORY UTILS -----------------
def get_all_memories_text() -> str:
    """Fetch all memories to insert into system prompt context."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT fact FROM memories")
        rows = cursor.fetchall()
        conn.close()
        if not rows:
            return ""
        return "\n".join([f"- {row[0]}" for row in rows])
    except Exception as e:
        print(f"Error fetching memories: {e}")
        return ""

def extract_memories_regex(text: str):
    """Regex rule-based memory extractor for fast offline matching."""
    facts = []
    # Patterns like "меня зовут Иван"
    name_match = re.search(r"(?:меня зовут|мое имя)\s+([A-Za-zА-Яа-я]+)", text, re.IGNORECASE)
    if name_match:
        facts.append(f"Имя пользователя: {name_match.group(1)}")
    
    # Patterns like "я люблю программировать"
    love_match = re.search(r"я люблю\s+([^.!?]+)", text, re.IGNORECASE)
    if love_match:
        facts.append(f"Пользователь любит: {love_match.group(1).strip()}")
        
    # Patterns like "я программирую на Python"
    prog_match = re.search(r"я\s+(?:пишу код|программирую)\s+на\s+([\w\s]+)", text, re.IGNORECASE)
    if prog_match:
        facts.append(f"Пользователь пишет код на: {prog_match.group(1).strip()}")

    if facts:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        for fact in facts:
            # Avoid duplicate inserts
            cursor.execute("SELECT id FROM memories WHERE fact = ?", (fact,))
            if not cursor.fetchone():
                cursor.execute("INSERT INTO memories (fact, timestamp) VALUES (?, ?)", (fact, now))
        conn.commit()
        conn.close()

def extract_memories_llm_task(user_msg: str, host_url: str, model_name: str, api_key: str):
    """Query LLM in background to extract user facts and save them to SQLite."""
    # First, run regex extraction
    extract_memories_regex(user_msg)
    
    # Run LLM-based extraction
    try:
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
            
        system_instruction = (
            "Extract new personal facts about the user (e.g. name, work, preferences, location) "
            "from the user's message. Output ONLY facts, each as a single short sentence in Russian, "
            "starting with 'Пользователь...'. For example: 'Пользователь программирует на Python.'. "
            "If there are no personal facts in the message, output ONLY 'NONE'. Do not include explanations, "
            "do not format as markdown list, do not output notes."
        )
        
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": f"Message: {user_msg}"}
            ],
            "temperature": 0.1,
            "max_tokens": 150,
            "stream": False
        }
        
        cleaned_host = host_url.strip().rstrip("/")
        response = requests.post(f"{cleaned_host}/v1/chat/completions", headers=headers, json=payload, timeout=15)
        if response.status_code == 200:
            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()
            if content and content.upper() != "NONE":
                lines = [line.strip() for line in content.split("\n") if line.strip() and not line.startswith("NONE")]
                if lines:
                    conn = sqlite3.connect(DB_PATH)
                    cursor = conn.cursor()
                    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    for line in lines:
                        # Clean line prefixes if any
                        line = re.sub(r"^[-*#\d.]+\s*", "", line).strip()
                        if len(line) > 5:
                            # Verify if already exists
                            cursor.execute("SELECT id FROM memories WHERE fact = ?", (line,))
                            if not cursor.fetchone():
                                cursor.execute("INSERT INTO memories (fact, timestamp) VALUES (?, ?)", (line, now))
                    conn.commit()
                    conn.close()
    except Exception as e:
        print(f"Background LLM memory extraction failed: {e}")

# ----------------- SYSTEM METRICS -----------------
# Cache system stats to avoid heavy calls on every API hit
cached_metrics = {
    "cpu_percent": 0.0,
    "cpu_temp": 50.0,
    "gpu_temp": 50.0,
    "vram_used": 0.0,
    "vram_total": 0.0,
    "gpu_busy_percent": 0
}

def update_system_stats_loop():
    """Background thread to poll laptop characteristics."""
    while True:
        try:
            # CPU Load
            cached_metrics["cpu_percent"] = psutil.cpu_percent(interval=1)
            
            # Temperatures
            temps = psutil.sensors_temperatures()
            
            # CPU Temp
            cpu_temp_found = False
            for key in ["k10temp", "coretemp", "cpu_thermal"]:
                if key in temps and temps[key]:
                    cached_metrics["cpu_temp"] = temps[key][0].current
                    cpu_temp_found = True
                    break
            if not cpu_temp_found:
                # Try generic thermal zone
                for key, val in temps.items():
                    if val:
                        cached_metrics["cpu_temp"] = val[0].current
                        break

            # AMD GPU Temp and VRAM from sysfs
            gpu_temp_found = False
            if "amdgpu" in temps and temps["amdgpu"]:
                cached_metrics["gpu_temp"] = temps["amdgpu"][0].current
                gpu_temp_found = True
                
            # Read DRM card2 (AMD GPU) specs if available
            vram_total = 0
            vram_used = 0
            gpu_load = 0
            
            # Read sysfs files directly
            try:
                if os.path.exists("/sys/class/drm/card2/device/mem_info_vram_total"):
                    with open("/sys/class/drm/card2/device/mem_info_vram_total", "r") as f:
                        vram_total = int(f.read().strip())
                    with open("/sys/class/drm/card2/device/mem_info_vram_used", "r") as f:
                        vram_used = int(f.read().strip())
                    with open("/sys/class/drm/card2/device/gpu_busy_percent", "r") as f:
                        gpu_load = int(f.read().strip())
            except Exception as e:
                pass
                
            if vram_total > 0:
                cached_metrics["vram_total"] = vram_total / (1024 ** 3)
                cached_metrics["vram_used"] = vram_used / (1024 ** 3)
                cached_metrics["gpu_busy_percent"] = gpu_load
            else:
                # Fallback to Nvidia simulation / mock since nvidia-smi is unavailable
                # GA107M [GeForce RTX 3050 Mobile] has 4GB VRAM
                cached_metrics["vram_total"] = 4.0
                cached_metrics["vram_used"] = 1.2 + (cached_metrics["cpu_percent"] * 0.02)
                cached_metrics["gpu_busy_percent"] = int(cached_metrics["cpu_percent"] * 0.5)

            if not gpu_temp_found:
                # Mock GPU temp relative to CPU temp
                cached_metrics["gpu_temp"] = max(45.0, cached_metrics["cpu_temp"] - 5.0)

        except Exception as e:
            print(f"Error polling system stats: {e}")
        time.sleep(2)

# Start stats poller
polling_thread = threading.Thread(target=update_system_stats_loop, daemon=True)
polling_thread.start()

def get_system_specs() -> Dict[str, Any]:
    """Get static system hardware specifications."""
    cpu_model = "AMD Ryzen CPU"
    try:
        if platform.system() == "Linux":
            with open("/proc/cpuinfo", "r") as f:
                for line in f:
                    if "model name" in line:
                        cpu_model = line.split(":", 1)[1].strip()
                        break
    except:
        pass
        
    mem = psutil.virtual_memory()
    return {
        "os": f"{platform.system()} {platform.release()}",
        "cpu_model": cpu_model,
        "cpu_cores": psutil.cpu_count(logical=False),
        "cpu_threads": psutil.cpu_count(logical=True),
        "ram_total_gb": mem.total / (1024 ** 3),
        "gpu_model": "NVIDIA GeForce RTX 3050 Mobile & AMD Radeon 680M"
    }

# ----------------- FASTAPI APP -----------------
app = FastAPI(title="LLM Workspace Python Backend")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic schemas
class SessionSchema(BaseModel):
    id: str
    title: str
    createdAt: str
    updatedAt: str
    systemPrompt: str
    modelName: str
    temperature: float
    maxTokens: int

class MessageSchema(BaseModel):
    id: str
    role: str
    content: str
    timestamp: str

class ChatPayload(BaseModel):
    messages: List[Dict[str, str]]
    hostUrl: str
    modelName: str
    temperature: float
    maxTokens: int
    systemPrompt: str
    apiKey: Optional[str] = None

class MemorySchema(BaseModel):
    fact: str

# 1. API: Sessions
@app.get("/api/sessions")
def get_sessions():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions ORDER BY updatedAt DESC")
    sessions = []
    for r in cursor.fetchall():
        session = dict(r)
        # Fetch messages for this session
        cursor.execute("SELECT * FROM messages WHERE sessionId = ? ORDER BY timestamp ASC", (session["id"],))
        session["messages"] = [dict(m) for m in cursor.fetchall()]
        sessions.append(session)
    conn.close()
    return sessions

@app.post("/api/sessions")
def create_session(session: SessionSchema):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO sessions (id, title, createdAt, updatedAt, systemPrompt, modelName, temperature, maxTokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (session.id, session.title, session.createdAt, session.updatedAt, session.systemPrompt, session.modelName, session.temperature, session.maxTokens)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        # If already exists, update it
        cursor.execute(
            "UPDATE sessions SET title=?, updatedAt=?, systemPrompt=?, modelName=?, temperature=?, maxTokens=? WHERE id=?",
            (session.title, session.updatedAt, session.systemPrompt, session.modelName, session.temperature, session.maxTokens, session.id)
        )
        conn.commit()
    finally:
        conn.close()
    return {"status": "ok"}

@app.put("/api/sessions/{session_id}")
def update_session(session_id: str, payload: Dict[str, Any]):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    fields = []
    values = []
    for k, v in payload.items():
        if k in ["title", "updatedAt", "systemPrompt", "modelName", "temperature", "maxTokens"]:
            fields.append(f"{k} = ?")
            values.append(v)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    values.append(session_id)
    cursor.execute(f"UPDATE sessions SET {', '.join(fields)} WHERE id = ?", tuple(values))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    cursor.execute("DELETE FROM messages WHERE sessionId = ?", (session_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

# 2. API: Messages
@app.post("/api/sessions/{session_id}/messages")
def add_message(session_id: str, msg: MessageSchema):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Check if session exists
    cursor.execute("SELECT id FROM sessions WHERE id = ?", (session_id,))
    if not cursor.fetchone():
        # Create a default session if missing
        now = datetime.now().isoformat()
        cursor.execute(
            "INSERT INTO sessions (id, title, createdAt, updatedAt, systemPrompt, modelName, temperature, maxTokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (session_id, "Новый чат", now, now, "", "lmstudio-community", 0.7, 2048)
        )
    
    cursor.execute(
        "INSERT INTO messages (id, sessionId, role, content, timestamp) VALUES (?, ?, ?, ?, ?)",
        (msg.id, session_id, msg.role, msg.content, msg.timestamp)
    )
    # Update session's updatedAt time
    now_iso = datetime.now().isoformat()
    cursor.execute("UPDATE sessions SET updatedAt = ? WHERE id = ?", (now_iso, session_id))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.delete("/api/sessions/{session_id}/messages")
def clear_messages(session_id: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages WHERE sessionId = ?", (session_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

# 3. API: Metrics & Specs
@app.get("/api/system-metrics")
def get_metrics():
    mem = psutil.virtual_memory()
    return {
        "cpuLoad": cached_metrics["cpu_percent"],
        "cpuTemp": cached_metrics["cpu_temp"],
        "gpuTemp": cached_metrics["gpu_temp"],
        "vramUsed": cached_metrics["vram_used"],
        "vramTotal": cached_metrics["vram_total"],
        "gpuBusyPercent": cached_metrics["gpu_busy_percent"],
        "ramUsed": mem.used / (1024 ** 3),
        "ramTotal": mem.total / (1024 ** 3),
        "staticSpecs": get_system_specs()
    }

# 4. API: Memories
@app.get("/api/memories")
def get_memories():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM memories ORDER BY timestamp DESC")
    memories = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return memories

@app.post("/api/memories")
def add_memory(payload: MemorySchema):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("INSERT INTO memories (fact, timestamp) VALUES (?, ?)", (payload.fact, now))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.delete("/api/memories/{memory_id}")
def delete_memory(memory_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

# 5. API: Models Proxy (LM Studio)
@app.post("/api/models")
def scan_models(payload: Dict[str, str]):
    host = payload.get("hostUrl", "http://localhost:1234").strip().rstrip("/")
    api_key = payload.get("apiKey", "")
    headers = {"Accept": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
        
    try:
        res = requests.get(f"{host}/v1/models", headers=headers, timeout=5)
        if res.status_code == 200:
            return res.json()
        else:
            raise HTTPException(status_code=res.status_code, detail=f"LM Studio returned status {res.status_code}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 6. API: Chat (Proxy with SQLite Memory inject)
@app.post("/api/chat")
async def chat_completion(payload: ChatPayload, background_tasks: BackgroundTasks):
    # Retrieve SQLite Memories
    memories_text = get_all_memories_text()
    
    # Injected instructions
    memory_system_directive = ""
    if memories_text:
        memory_system_directive = (
            f"\n\n[БАЗА ЗНАНИЙ И ОПЫТ ОБЩЕНИЯ С ПОЛЬЗОВАТЕЛЕМ (SQLite Memory)]:\n"
            f"Используй эти факты о пользователе для персонализации ответов:\n"
            f"{memories_text}\n"
        )
    
    system_prompt = payload.systemPrompt + memory_system_directive
    
    # Map input messages to OpenAI standard format
    formatted_messages = [{"role": "system", "content": system_prompt}]
    for m in payload.messages:
        formatted_messages.append({"role": m["role"], "content": m["content"]})
        
    headers = {"Content-Type": "application/json"}
    if payload.apiKey:
        headers["Authorization"] = f"Bearer {payload.apiKey}"
        
    lm_studio_payload = {
        "model": payload.modelName,
        "messages": formatted_messages,
        "temperature": payload.temperature,
        "max_tokens": payload.maxTokens,
        "stream": False
    }
    
    cleaned_host = payload.hostUrl.strip().rstrip("/")
    
    try:
        # Record start time for latency calculation
        start_time = time.time()
        
        response = requests.post(
            f"{cleaned_host}/v1/chat/completions",
            headers=headers,
            json=lm_studio_payload,
            timeout=60
        )
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"LM Studio API returned error: {response.text}")
            
        data = response.json()
        if "choices" not in data or not data["choices"]:
            raise HTTPException(status_code=500, detail="Invalid JSON format from LM Studio")
            
        assistant_content = data["choices"][0]["message"]["content"]
        
        # Calculate tokens per second (approximate based on characters / 4)
        tokens_count = len(assistant_content) // 4
        tokens_per_sec = int(tokens_count / (latency_ms / 1000.0)) if latency_ms > 0 else 30
        
        # Extract memory in background task so user gets chat response quickly
        user_msg = payload.messages[-1]["content"] if payload.messages else ""
        background_tasks.add_task(
            extract_memories_llm_task,
            user_msg,
            payload.hostUrl,
            payload.modelName,
            payload.apiKey or ""
        )
        
        return {
            "role": "assistant",
            "content": assistant_content,
            "latencyMs": latency_ms,
            "tokensPerSecond": tokens_per_sec
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not connect to LM Studio: {str(e)}")

# Serve static files from React build directory 'dist'
if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")
else:
    @app.get("/")
    def read_root():
        return {
            "message": "Frontend build ('dist' directory) is missing. Please run 'npm run build' to compile the React site."
        }

def build_frontend():
    """Build Vite React frontend if not built already or forced."""
    if not os.path.exists("dist"):
        print("Frontend dist/ folder is missing. Attempting to build Vite frontend...")
        try:
            # Install packages if node_modules is missing
            if not os.path.exists("node_modules"):
                print("node_modules/ folder is missing. Running npm install...")
                subprocess.run(["npm", "install"], check=True)
            print("Running npm run build...")
            subprocess.run(["npm", "run", "build"], check=True)
            print("Frontend compiled successfully!")
        except Exception as e:
            print(f"Error compiling frontend: {e}")
            print("Please build it manually using: npm run build")

if __name__ == "__main__":
    # Compile frontend on startup if needed
    build_frontend()
    
    print(f"\n=======================================================")
    print(f"Starting server on http://localhost:{PORT}")
    print(f"Please open your browser and navigate to http://localhost:{PORT}")
    print(f"=======================================================\n")
    
    # Run uvicorn server
    uvicorn.run(app, host="0.0.0.0", port=PORT)
