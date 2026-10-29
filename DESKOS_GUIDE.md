# DeskOS — Complete System Guide

A from-scratch, analytical walkthrough of every component in DeskOS: the Python vision worker, the Spring Boot hub, and the React control dashboard. Written so you never need to ask again.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How the Three Services Talk](#2-how-the-three-services-talk)
3. [deskos-vision (Python)](#3-deskos-vision-python)
   - 3.1 [What it does](#31-what-it-does)
   - 3.2 [File structure](#32-file-structure)
   - 3.3 [config.yaml — every field explained](#33-configyaml--every-field-explained)
   - 3.4 [recognizer.py — face matching from scratch](#34-recognizerpy--face-matching-from-scratch)
   - 3.5 [hello_recognize.py — the main loop](#35-hello_recognizepy--the-main-loop)
   - 3.6 [The PresenceTracker state machine](#36-the-presencetracker-state-machine)
   - 3.7 [HUD overlay — how the drawing works](#37-hud-overlay--how-the-drawing-works)
   - 3.8 [Voice announcements (TTS)](#38-voice-announcements-tts)
   - 3.9 [Sending events to the hub](#39-sending-events-to-the-hub)
   - 3.10 [Python concepts used](#310-python-concepts-used)
4. [deskos-hub (Spring Boot / Java)](#4-deskos-hub-spring-boot--java)
   - 4.1 [What it does](#41-what-it-does)
   - 4.2 [File structure](#42-file-structure)
   - 4.3 [application.yml — configuration](#43-applicationyml--configuration)
   - 4.4 [The event pipeline: DTO → Entity → DB → Scene](#44-the-event-pipeline-dto--entity--db--scene)
   - 4.5 [EventController — the REST endpoints](#45-eventcontroller--the-rest-endpoints)
   - 4.6 [VisionEventDto vs VisionEvent — why two classes](#46-visioneventdto-vs-visionevent--why-two-classes)
   - 4.7 [SceneService and the Strategy pattern](#47-sceneservice-and-the-strategy-pattern)
   - 4.8 [Each scene explained](#48-each-scene-explained)
   - 4.9 [Actuators — controlling real hardware](#49-actuators--controlling-real-hardware)
   - 4.10 [The Lights controller](#410-the-lights-controller)
   - 4.11 [Spring Boot concepts used](#411-spring-boot-concepts-used)
5. [deskos-ui (React + Vite)](#5-deskos-ui-react--vite)
   - 5.1 [What it does](#51-what-it-does)
   - 5.2 [File structure](#52-file-structure)
   - 5.3 [Vite config and the proxy trick](#53-vite-config-and-the-proxy-trick)
   - 5.4 [App.jsx — routing with state](#54-appjsx--routing-with-state)
   - 5.5 [Intro.jsx — the boot sequence](#55-introjsx--the-boot-sequence)
   - 5.6 [Nav.jsx — the top bar](#56-navjsx--the-top-bar)
   - 5.7 [LightsPage + DeviceCard + Toggle](#57-lightspage--devicecard--toggle)
   - 5.8 [ScenesPage](#58-scenespage)
   - 5.9 [EventsPage + AiCircle](#59-eventspage--aicircle)
   - 5.10 [The JARVIS design system](#510-the-jarvis-design-system)
   - 5.11 [React concepts used](#511-react-concepts-used)
6. [Running the Full System](#6-running-the-full-system)
7. [Common Errors and How to Fix Them](#7-common-errors-and-how-to-fix-them)
8. [How to Extend DeskOS](#8-how-to-extend-deskos)

---

## 1. Architecture Overview

DeskOS is three independent processes that communicate over HTTP:

```
┌─────────────────┐       POST /events/vision        ┌──────────────────┐
│  deskos-vision   │ ──────────────────────────────▶  │   deskos-hub     │
│  (Python)        │     JSON: eventType,             │  (Spring Boot)   │
│                  │     personName, confidence        │                  │
│  - webcam        │                                  │  - REST API      │
│  - face detect   │                                  │  - PostgreSQL    │
│  - recognition   │                                  │  - scene engine  │
│  - TTS voice     │                                  │  - actuators     │
└─────────────────┘                                   └────────┬─────────┘
                                                               │
                              GET /events/vision               │  HTTP to Shelly
                              POST /lights/{name}/toggle       │  smart plugs
                    ┌──────────────────────────────────────────┘
                    │
              ┌─────▼──────────┐
              │   deskos-ui    │
              │  (React+Vite)  │
              │                │
              │  - dashboard   │
              │  - light toggle│
              │  - event feed  │
              └────────────────┘
```

**Data flow:**
1. The camera sees a face → vision identifies it → fires `POST /events/vision` to the hub
2. The hub saves the event in PostgreSQL, then matches it against scene rules
3. A matched scene fires actuator commands (e.g. turn on a Shelly smart plug)
4. The UI polls the hub for events and shows them live, and can toggle lights manually

Each service runs independently. You can run the hub without vision, or the UI without either — they degrade gracefully.

---

## 2. How the Three Services Talk

All communication is **HTTP REST with JSON bodies**. There are no message queues, WebSockets, or shared databases between services.

| From | To | Endpoint | Method | Purpose |
|---|---|---|---|---|
| vision | hub | `/events/vision` | POST | Report arrival / departure |
| ui | hub | `/events/vision` | GET | Fetch event list for display |
| ui | hub | `/lights/{name}/toggle` | POST | Toggle a light on/off |
| hub | Shelly | `http://{host}/rpc/Switch.Set` | GET | Control smart plug |

The JSON contract for vision events:
```json
{
  "eventType": "arrived",
  "personName": "kostas",
  "confidence": 0.85
}
```

**Why this matters:** When something breaks, you know exactly which wire to check. If the UI shows "Hub unreachable", the problem is between the UI and the hub (proxy config, hub not running). If the hub logs nothing when you walk in front of the camera, the problem is between vision and the hub (wrong URL, hub down).

---

## 3. deskos-vision (Python)

### 3.1 What it does

Opens your webcam, detects faces every frame using InsightFace (a neural network), compares each face against enrolled embeddings (saved face vectors), and:
- Draws a professional HUD overlay on the camera feed
- Tracks who is present with a debounced state machine
- Announces arrivals/departures with voice (text-to-speech)
- Sends events to the Spring Boot hub via HTTP

### 3.2 File structure

```
deskos-vision/
├── config.yaml                      # all settings (camera, thresholds, hub URL)
├── enrolled/                        # saved face embeddings
│   ├── kostas.pkl                   # one .pkl file per person
│   └── kalfas.pkl
└── src/
    ├── hello_recognize.py           # main script — run this
    └── recognition/
        └── recognizer.py            # face matching logic
```

### 3.3 config.yaml — every field explained

```yaml
camera:
  type: webcam          # only "webcam" is implemented; "picamera" is for future Raspberry Pi
  index: 0              # which camera to use. 0 = default/built-in, 1 = second camera, etc.
  width: 640            # resolution width in pixels
  height: 480           # resolution height in pixels

detection:
  det_size: [640, 640]  # the resolution InsightFace internally resizes to before detecting
                        # bigger = more accurate but slower. [320, 320] is faster on weak CPUs
  providers:
    - CPUExecutionProvider   # what hardware to run the neural network on
                             # options: CPUExecutionProvider, CUDAExecutionProvider (NVIDIA GPU)

recognition:
  threshold: 0.5        # cosine similarity score needed for a match
                        # 0.0 = everything matches, 1.0 = only identical faces match
                        # 0.4-0.5 is a good range. Lower = more false positives
  enrolled_dir: enrolled  # folder containing .pkl files

state_machine:
  enter_frames: 3       # person must be seen 3 frames in a row to trigger "arrived"
  leave_frames: 10      # person must be missing 10 frames in a row to trigger "left"
                        # higher = more debounce, fewer false triggers

hub:
  url: http://localhost:8080   # where the Spring Boot hub is running
  endpoint: /events/vision     # the specific REST endpoint
  timeout: 2                   # HTTP timeout in seconds — don't wait forever

ui:
  show_preview: true    # show the OpenCV camera window
  quit_key: q           # press this key in the window to quit
```

**How to tune:** If you get too many false "arrived"/"left" events, increase `enter_frames` and `leave_frames`. If recognition is matching the wrong person, increase `threshold` (e.g. to 0.6).

### 3.4 recognizer.py — face matching from scratch

This file does one thing: given a face embedding (a 512-number vector that describes a face), find the closest enrolled person.

**Step-by-step breakdown:**

```python
class Recognizer:
    def __init__(self, enrolled_dir="enrolled", threshold=0.4):
```

The constructor loads every `.pkl` file from the enrolled directory. A `.pkl` file is a Python "pickle" — a way to save any Python object to disk as bytes and load it back later.

Each `.pkl` file contains a dictionary:
```python
{
    "name": "kostas",             # the person's name
    "embedding": np.array(...),   # 512 floats — the face vector
    "num_samples": 5,             # how many photos were used to create this
    "enrolled_at": "2024-..."     # when it was created
}
```

**Loading and validation:**
```python
pkl_files = sorted(self.enrolled_dir.glob("*.pkl"))
```
`glob("*.pkl")` finds all files ending in `.pkl` in the directory. `sorted()` makes the order deterministic (alphabetical).

For each file, it checks:
1. All required keys exist (`name`, `embedding`, `num_samples`, `enrolled_at`)
2. The embedding has shape `(512,)` — exactly 512 numbers
3. The embedding is normalized (length = 1.0) — required for cosine similarity to work

After loading all embeddings, it stacks them into a matrix:
```python
self.embeddings = np.stack(self.embeddings)   # shape: (N, 512) where N = number of people
```

**Why a matrix?** Because matching against all enrolled faces at once is a single matrix multiplication, not a loop. This is the core performance trick.

**The identify() method:**
```python
def identify(self, embedding: np.ndarray) -> tuple[str, float]:
    similarities = self.embeddings @ embedding      # matrix multiply
    best_idx = np.argmax(similarities)              # index of highest score
    best_score = float(similarities[best_idx])      # the score itself

    if best_score < self.threshold:
        return "unknown", best_score
    return self.names[best_idx], best_score
```

`self.embeddings @ embedding` is matrix-vector multiplication. If you have 2 enrolled people, `self.embeddings` is shape `(2, 512)` and `embedding` is shape `(512,)`. The `@` operator performs the dot product of each row with the embedding vector. The result is shape `(2,)` — one cosine similarity score per enrolled person.

**Cosine similarity explained:** Two normalized vectors multiplied (dot product) give a number between -1 and 1. The closer to 1, the more similar the faces are. For faces:
- Same person, different day: typically 0.5 to 0.9
- Different people: typically -0.1 to 0.3
- The `threshold` (0.5) is the dividing line we chose

### 3.5 hello_recognize.py — the main loop

The script follows this structure:

```
startup:
    1. load config.yaml
    2. initialize InsightFace neural network
    3. initialize Recognizer (load enrolled faces)
    4. open webcam
    5. create PresenceTracker
    6. start TTS worker thread

main loop (runs every frame, ~15-30 FPS):
    1. grab frame from webcam
    2. detect all faces in the frame (InsightFace)
    3. for each face:
       a. get bounding box (x1, y1, x2, y2)
       b. get detection confidence (how sure it's a face at all)
       c. if the face has an embedding, run recognizer.identify()
       d. collect into faces_info list and seen dict
    4. update PresenceTracker with who was seen
    5. for each event (arrived/left):
       a. print to console
       b. announce with voice
       c. POST to hub
    6. calculate FPS (exponential moving average)
    7. draw HUD overlay on frame
    8. show frame in window
    9. check for 'q' key → quit
```

**The `faces` variable:**
```python
faces = app.get(frame)
```
`app` is an InsightFace `FaceAnalysis` object. `app.get(frame)` runs the neural network on the frame and returns a list of detected face objects. Each face object has:
- `face.bbox` — bounding box as numpy array `[x1, y1, x2, y2]` (pixel coordinates)
- `face.det_score` — detection confidence (0 to 1, how sure it's a face)
- `face.normed_embedding` — the 512-float face vector (or `None` if face was too small/blurry)

**Two different data structures — why?**

The loop builds two things from the same face list:

```python
faces_info = []     # for HUD drawing — needs bounding boxes, names, all scores
seen = {}           # for PresenceTracker — only needs name → score pairs
```

`faces_info` is a list of tuples: `[(bbox, name, det_score, rec_score), ...]`
`seen` is a dict: `{"kostas": 0.82}` — only recognized (non-unknown) people

These serve different consumers: `draw_hud()` needs the full tuple for every face, while `tracker.update()` only cares about recognized names and their confidence.

**FPS calculation:**
```python
fps = 0.9 * fps + 0.1 / max(now - prev, 1e-6)
```
This is an **exponential moving average**. Instead of calculating FPS from just the last frame (which would be jittery), it blends 90% of the previous FPS with 10% of the current frame's FPS. This gives a smooth, stable number. The `max(..., 1e-6)` prevents division by zero if two frames happen to land at the exact same timestamp.

### 3.6 The PresenceTracker state machine

The problem this solves: Face detection is noisy. A face might be detected in frame 1, missed in frame 2 (a hand blocked it briefly), detected again in frame 3. Without debouncing, you'd get rapid-fire "arrived"/"left" events — and your lights would flicker on and off.

**The solution: streak counters.**

```python
class PresenceTracker:
    def __init__(self, enter_frames, leave_frames):
        self.enter_frames = enter_frames   # 3 — consecutive hits needed to arrive
        self.leave_frames = leave_frames   # 10 — consecutive misses needed to leave
        self.hit = {}       # {"kostas": 5}  — how many frames in a row we've SEEN them
        self.miss = {}      # {"kostas": 0}  — how many frames in a row we've MISSED them
        self.presence = set()  # {"kostas"} — who is currently "present" (inside the room)
```

**The update() method, explained line by line:**

```python
def update(self, seen):
    events = []

    # Part 1: process people we SAW in this frame
    for name, score in seen.items():
        self.hit[name] = self.hit.get(name, 0) + 1   # increment hit streak
        self.miss[name] = 0                            # reset miss streak (they're here!)

        # if not already "present" AND hit streak reached threshold → they ARRIVED
        if name not in self.presence and self.hit[name] >= self.enter_frames:
            self.presence.add(name)
            events.append(("arrived", name, score))

    # Part 2: process people who are "present" but were NOT seen this frame
    for name in list(self.presence):      # list() copy because we may modify presence
        if name not in seen:
            self.miss[name] = self.miss.get(name, 0) + 1   # increment miss streak
            self.hit[name] = 0                               # reset hit streak

            # if miss streak reached threshold → they LEFT
            if self.miss[name] >= self.leave_frames:
                self.presence.discard(name)
                events.append(("left", name, 0.0))

    return events
```

**Visual timeline example** (enter_frames=3, leave_frames=5):

```
Frame:   1    2    3    4    5    6    7    8    9    10   11   12
Seen:    ✓    ✓    ✓    ✓    ✗    ✗    ✓    ✗    ✗    ✗    ✗    ✗
Hit:     1    2    3    4    0    0    1    0    0    0    0    0
Miss:    0    0    0    0    1    2    0    1    2    3    4    5
Event:                  ARR                                    LEFT
Present: no   no   YES  yes  yes  yes  yes  yes  yes  yes  yes  NO
```

The person arrives on frame 3 (3 consecutive hits). They leave on frame 12 (5 consecutive misses). The brief disappearance on frames 5-6 didn't trigger "left" because the miss streak (2) never reached leave_frames (5). This is the debouncing at work.

**Why `list(self.presence)` in Part 2?**
We iterate over `self.presence` and potentially call `self.presence.discard(name)` inside the loop. You can't modify a set while iterating over it — Python raises `RuntimeError`. Wrapping it in `list()` creates a copy of the set's contents at that moment, so the loop iterates the copy while we safely modify the original.

### 3.7 HUD overlay — how the drawing works

The HUD uses a **single-blend overlay technique** for both performance and visual quality.

**Why not just draw rectangles on the frame?**
OpenCV's `cv2.rectangle()` with `-1` (filled) draws an opaque rectangle — it completely covers the camera feed beneath it. We want semi-transparent dark panels where you can still see the camera through them.

**The technique — two drawing passes with one blend:**

```python
overlay = frame.copy()                                    # 1. copy the frame

# ── Pass 1: draw dark panels on the COPY ──
cv2.rectangle(overlay, (10, 10), (210, 130), DARK, -1)   # info panel
cv2.rectangle(overlay, ...)                               # timestamp panel
cv2.rectangle(overlay, ...)                               # bottom bar
cv2.rectangle(overlay, ...)                               # name labels

cv2.addWeighted(overlay, 0.72, frame, 0.28, 0, frame)    # 2. blend: 72% overlay + 28% original

# ── Pass 2: draw crisp elements on the BLENDED result ──
cv2.putText(frame, "DESKOS", ...)                         # text
_corner_brackets(frame, ...)                              # face brackets
cv2.line(frame, ...)                                      # lines
cv2.circle(frame, ...)                                    # status dots
```

**Why one blend instead of per-panel?**
`addWeighted()` touches every pixel in the frame. Calling it once (for all panels combined) is much faster than calling it separately for each panel. This matters when you're doing it 30 times per second.

**The three layers explained:**
1. **Dark panels** (pass 1, drawn on the overlay copy) — these become semi-transparent after blending
2. **The blend** (the `addWeighted` call) — merges 72% of the panel overlay with 28% of the original camera, creating the glass-panel transparency
3. **Crisp elements** (pass 2, drawn on frame directly) — text, brackets, lines, dots. These are drawn AFTER the blend so they stay sharp and fully opaque

**The corner brackets function:**
```python
def _corner_brackets(frame, x1, y1, x2, y2, color, t=2, length=18):
    cl = min(length, (x2 - x1) // 3, (y2 - y1) // 3)
    for ax, ay, dx, dy in [
        (x1, y1, 1, 1), (x2, y1, -1, 1),
        (x1, y2, 1, -1), (x2, y2, -1, -1),
    ]:
        cv2.line(frame, (ax, ay), (ax + dx * cl, ay), color, t, cv2.LINE_AA)
        cv2.line(frame, (ax, ay), (ax, ay + dy * cl), color, t, cv2.LINE_AA)
```
Draws L-shaped brackets at the four corners of a face bounding box. The `length` is clamped to 1/3 of the box dimension so brackets don't overlap on small faces. The `dx, dy` signs control which direction each corner's arms extend.

**Status indicator logic:**
```python
has_match = any(n != "unknown" for _, n, _, _ in faces_info)
if has_match:
    st_text, st_color = "TRACKING", GREEN     # recognized someone
elif faces_info:
    st_text, st_color = "DETECTING", AMBER    # sees face(s) but no match
else:
    st_text, st_color = "SCANNING", TEAL      # no faces at all
```

**Bottom bar:**
- Green: `"IDENTIFIED:  KOSTAS"` — shows all recognized names, uppercased
- Amber: `"2 FACE(S) DETECTED"` — sees faces but none recognized
- Gray: `"SCANNING..."` — no faces in frame

**REC indicator:** A blinking red circle + "REC" text in the bottom-right, toggling visibility every 25 frames using `tick % 50 < 25`.

### 3.8 Voice announcements (TTS)

**The problem:** Python's `pyttsx3` library has a known bug on Windows where it only speaks once due to COM threading issues. We tried multiple workarounds (creating fresh engine instances, different thread patterns) — none worked reliably.

**The solution:** Bypass Python TTS entirely. Use Windows' built-in speech via PowerShell subprocess.

```python
subprocess.run(
    ["powershell", "-NoProfile", "-Command",
     "Add-Type -AssemblyName System.Speech; "
     "(New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('Hello Kostas')"],
    creationflags=_CREATE_NO_WINDOW,   # 0x08000000 — no PowerShell window pops up
    timeout=15,                        # kill if it hangs
)
```

This creates a fresh .NET `SpeechSynthesizer` object every time, speaks the text, and exits. No COM state to corrupt.

**Why not call this directly from the main loop?** Speech is blocking — the program would freeze for 1-2 seconds while the voice speaks. The camera would stop, frames would drop, the HUD would freeze.

**Solution: a background worker thread with a Queue.**

```python
_tts_queue = Queue()         # thread-safe FIFO queue

def _tts_worker():           # runs forever in a background thread
    while True:
        text = _tts_queue.get()    # blocks here until something is in the queue
        # ... run the PowerShell command ...

Thread(target=_tts_worker, daemon=True).start()   # start once when the module loads

def say(text):
    _tts_queue.put(text)     # instantly returns — just drops text into the queue
```

**How this works step by step:**
1. The main loop detects an "arrived" event
2. It calls `announce("arrived", "kostas")`
3. `announce()` picks a random greeting template: `"Welcome back, {name}."` → `"Welcome back, Kostas."`
4. It calls `say("Welcome back, Kostas.")`
5. `say()` puts the text into the queue and returns immediately — the main loop continues to the next frame
6. Meanwhile, in the background thread, `_tts_worker()` was blocking on `_tts_queue.get()`. It now unblocks, reads the text, and runs the PowerShell subprocess
7. While PowerShell is speaking, the camera continues capturing frames normally
8. If another event fires while speech is in progress, the text goes into the queue and waits its turn

**`daemon=True`** means the thread dies automatically when the main program exits. Without this, the program would hang waiting for the thread to finish.

**The greetings and farewells:**
```python
GREETINGS = [
    "Welcome back, {name}.",
    "Hey {name}, good to see you.",
    "{name} has entered the building.",
    ...
]

FAREWELLS = [
    "See you later, {name}.",
    "{name} has left.",
    "Goodbye {name}. Take care.",
    ...
]
```
`random.choice(GREETINGS)` picks a random template string. `.format(name=name)` replaces `{name}` with the actual person's name. `.title()` capitalizes the first letter of the name.

### 3.9 Sending events to the hub

```python
requests.post(
    cfg["hub"]["url"] + cfg["hub"]["endpoint"],   # "http://localhost:8080/events/vision"
    json={
        "eventType": etype,        # "arrived" or "left"
        "personName": person,      # "kostas" — or None for "left" events
        "confidence": conf,        # 0.82
    },
    timeout=cfg["hub"]["timeout"], # 2 seconds
)
```

**Key details:**
- `json=` automatically serializes the dict to JSON AND sets the `Content-Type: application/json` header. Without `json=`, you'd need to `import json`, call `json.dumps()`, and set the header manually.
- The field names (`eventType`, `personName`, `confidence`) are **camelCase** because the Java hub expects camelCase — this is the JSON contract between the two services. Using `event_type` or `person` would cause a 400 error.
- `timeout=2` prevents the vision loop from freezing if the hub is down — after 2 seconds it gives up.
- The whole call is wrapped in `try/except requests.RequestException: pass` — ALL network errors (connection refused, timeout, DNS failure) are silently swallowed. The camera keeps running regardless.

### 3.10 Python concepts used

| Concept | Where used | What it means |
|---|---|---|
| `class` | `Recognizer`, `PresenceTracker` | A blueprint for creating objects that bundle data + methods together |
| `self` | everywhere in classes | Reference to the current instance — Python passes it explicitly as the first method argument |
| `__init__` | constructor | Special method that runs when you create a new instance: `r = Recognizer(...)` |
| `dict` | `self.hit`, `seen` | Key-value store: `{"kostas": 3}`. Access with `d["key"]` or `d.get("key", default)` |
| `.get(key, default)` | `self.hit.get(name, 0)` | Get value for key, or return `default` if key doesn't exist (avoids `KeyError`) |
| `.items()` | `for name, score in seen.items()` | Iterate over a dict's key-value pairs as tuples |
| `set` | `self.presence` | Unordered collection of unique items: `{"kostas", "maria"}`. No duplicates allowed |
| `.add()` / `.discard()` | presence set operations | Add to / remove from set. `discard()` doesn't raise error if item missing (unlike `remove()`) |
| `tuple` | `("arrived", name, score)` | Immutable ordered group — like a list you can't change. Often used for returning multiple values |
| `list comprehension` | `[n for _, n, _, _ in faces_info]` | Build a list by filtering/transforming another iterable in one line |
| `_` (underscore) | `for _, n, _, _ in faces_info` | Convention meaning "I don't need this value" — throwaway variable |
| `f-string` | `f"{fps:.0f}"` | String formatting. The part after `:` is the format spec: `.0f` = float with 0 decimal places, `.0%` = percentage |
| `Path` | `Path(__file__).resolve().parent` | Object-oriented file paths — `.parent` gives the containing directory, `.glob()` finds files by pattern |
| `with open(...)` | config loading, pickle loading | Context manager — automatically closes the file when the `with` block ends, even if an error occurs |
| `pickle.load()` | loading `.pkl` files | Deserialize Python objects from binary files — reconstructs the exact dict that was saved |
| `numpy` / `np` | embeddings, matrix math | Numerical computing library — fast operations on arrays of numbers, much faster than Python lists |
| `@` operator | `self.embeddings @ embedding` | Matrix multiplication — `(N, 512) @ (512,)` produces `(N,)` |
| `np.argmax()` | finding best match | Returns the index of the largest value in an array |
| `np.stack()` | combining embeddings | Stacks a list of 1D arrays into a 2D matrix |
| `Queue` | `_tts_queue` | Thread-safe FIFO queue — safe to write from one thread and read from another simultaneously |
| `Thread` | TTS worker | Run a function in a parallel thread — the worker speaks while the main loop processes frames |
| `daemon=True` | thread creation | Thread dies automatically when the main program exits |
| `subprocess.run()` | PowerShell TTS | Run an external program (PowerShell) as a child process and wait for it to finish |
| `yaml.safe_load()` | config loading | Parse YAML text into Python dicts and lists |
| `sys.path.insert()` | import setup | Add a directory to Python's import search path so `from recognition.recognizer import Recognizer` works |

---

## 4. deskos-hub (Spring Boot / Java)

### 4.1 What it does

The hub is the central brain of DeskOS. It:
1. Receives vision events via REST API and validates them
2. Persists them in PostgreSQL
3. Evaluates scene rules (time-of-day + event type) to decide what to do
4. Executes actuator commands (controls smart plugs via HTTP)
5. Serves event data to the UI for display
6. Provides light toggle endpoints for manual control from the dashboard

### 4.2 File structure

```
deskos-hub/src/main/java/com/deskos/hub/
├── HubApplication.java              # Spring Boot entry point
├── config/
│   └── BeanConfiguration.java       # RestClient bean with timeout config
├── propertiesclass/
│   └── ShellyProperties.java        # @ConfigurationProperties for shelly.devices
├── events/
│   ├── EventController.java         # REST: POST + GET /events/vision
│   ├── VisionEventDto.java          # Incoming JSON shape (Java record)
│   ├── VisionEvent.java             # JPA entity → vision_events table
│   └── VisionEventRepository.java   # Spring Data JPA repository
├── scenes/
│   ├── SceneStrategy.java           # Interface: matches() + execute()
│   ├── SceneService.java            # Evaluates all strategies, first-match wins
│   ├── MorningArrivalScene.java     # Weekday 07:00–12:00 arrival
│   ├── EveningArrivalScene.java     # 18:00–23:00 arrival
│   ├── NightArrivalScene.java       # 00:00–07:00 arrival
│   └── LeftScene.java               # Any departure, any time
├── actuators/
│   ├── Actuator.java                # Interface: turnOn, turnOff, wakeOnLan
│   ├── ShellyActuator.java          # Real Shelly smart plug HTTP control
│   └── MockActuator.java            # Dev/test: logs actions instead of performing them
├── controllers/
│   └── Lights.java                  # REST: POST /lights/{name}/toggle
└── services/
    └── LightService.java            # Direct Shelly toggle logic
```

### 4.3 application.yml — configuration

```yaml
spring:
  application:
    name: deskos-hub
  datasource:
    url: jdbc:postgresql://localhost:5432/deskos   # PostgreSQL connection string
    username: postgres
    password: dev
  jpa:
    hibernate:
      ddl-auto: update    # auto-create/alter tables to match @Entity classes
    show-sql: true        # print every SQL query to console (helpful for learning)
    properties:
      hibernate:
        format_sql: true  # indent SQL for readability

server:
  port: 8080              # the hub listens on this port

management:
  endpoints:
    web:
      exposure:
        include: health,info   # expose Spring Actuator health endpoint

logging:
  level:
    com.deskos.hub: DEBUG      # verbose logging for our package

shelly:
  timeout-sec: 5               # HTTP timeout when calling Shelly devices
  devices:
    desk-light: "shellyplugsg3-d885ac1fcf2c.local"    # logical name → mDNS hostname
    room-lights: "shellyplugsg3-089272505a90.local"
```

**What `ddl-auto: update` does:** When the hub starts, Hibernate inspects your `@Entity` classes (like `VisionEvent`) and compares them to the actual PostgreSQL tables. If the table doesn't exist, it creates it. If you added a new field to the entity, it adds the column. This is convenient for development. In production, you'd use migration tools (Flyway or Liquibase) for safe, versioned schema changes.

**The Shelly device map:** Maps logical names (used in your code and scenes) to physical mDNS hostnames (used on the local network). When a scene calls `actuator.turnOn("desk-light")`, the ShellyActuator looks up `"shellyplugsg3-d885ac1fcf2c.local"` and sends an HTTP request to that device.

### 4.4 The event pipeline: DTO → Entity → DB → Scene

When vision sends `POST /events/vision`, here's the exact sequence:

```
1. Raw JSON arrives over HTTP
2. Spring deserializes it into VisionEventDto (a Java record)
3. @Valid triggers Jakarta validation:
   - eventType must not be blank
   - confidence must be between 0.0 and 1.0
   - If validation fails → 400 Bad Request with error details
4. Controller creates a VisionEvent entity:
   - id = null (database auto-generates it)
   - timestamp = Instant.now()
   - eventType, personName, confidence from the DTO
5. repo.save(event) → Hibernate generates an INSERT SQL statement
   → PostgreSQL inserts the row and returns the auto-generated id
6. scenes.handle(saved) → SceneService gets the saved entity (with its id)
   → Iterates scene strategies in @Order, first match wins
   → Matching scene calls actuator methods
7. Controller returns HTTP 202 Accepted
```

### 4.5 EventController — the REST endpoints

```java
@RestController                     // this class handles HTTP requests and returns JSON
@RequestMapping("/events")          // all paths in this class start with /events
@RequiredArgsConstructor            // Lombok generates constructor for all `final` fields
@Slf4j                              // Lombok generates `private static final Logger log = ...`
public class EventController {

    private final VisionEventRepository repo;   // Spring injects these via constructor
    private final SceneService scenes;
```

**POST /events/vision** — receive events from the vision worker:
```java
@PostMapping("/vision")
public ResponseEntity<Void> ingest(@RequestBody @Valid VisionEventDto dto) {
    var event = new VisionEvent(null, dto.eventType(), dto.personName(),
                                dto.confidence(), Instant.now());
    var saved = repo.save(event);
    log.info("Ingested event id={} ...", saved.getId(), ...);
    scenes.handle(saved);
    return ResponseEntity.accepted().build();     // HTTP 202
}
```
- `@RequestBody` tells Spring: parse the JSON request body into this object
- `@Valid` tells Spring: run all the validation annotations on the DTO before proceeding
- `ResponseEntity.accepted()` returns HTTP 202 (Accepted) — meaning "I received your event and will process it"

**GET /events/vision** — serve the event list to the UI:
```java
@GetMapping("/vision")
public List<VisionEvent> list() {
    return repo.findAll();
}
```
Spring auto-serializes the Java list to a JSON array. `repo.findAll()` is provided by Spring Data JPA — you didn't write any SQL.

### 4.6 VisionEventDto vs VisionEvent — why two classes

**VisionEventDto** — the external HTTP contract (what the JSON looks like):
```java
public record VisionEventDto(
    @NotBlank String eventType,
    String personName,
    @DecimalMin("0.0") @DecimalMax("1.0") Double confidence
) {}
```

**VisionEvent** — the internal JPA entity (what the database row looks like):
```java
@Entity
@Table(name = "vision_events")
public class VisionEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;              // auto-generated by the database
    private String eventType;
    private String personName;
    private Double confidence;
    private Instant timestamp;    // set by the controller, NOT by the external caller
}
```

**Why keep them separate?**
- The DTO is your API contract with external systems — it should be stable and minimal
- The entity is your database schema — it has extra fields (`id`, `timestamp`) that callers don't control
- They can evolve independently: you might add internal fields to the entity (like a `processedAt` timestamp) without changing the API, or add optional DTO fields without touching the database
- The DTO has validation annotations (`@NotBlank`); the entity has JPA annotations (`@Entity`, `@Table`)

**What is a `record`?**
A Java record (VisionEventDto) is a concise way to declare an immutable data class. This single line:
```java
public record VisionEventDto(@NotBlank String eventType, String personName, Double confidence) {}
```
...is equivalent to writing a full class with: a constructor, three private final fields, three getter methods (`eventType()`, `personName()`, `confidence()`), plus `equals()`, `hashCode()`, and `toString()`. The compiler generates all of it.

### 4.7 SceneService and the Strategy pattern

```java
@Service
public class SceneService {
    private final List<SceneStrategy> strategies;   // Spring injects ALL implementations!

    public void handle(VisionEvent event) {
        var now = LocalDateTime.now();
        var match = strategies.stream()
                .filter(s -> s.matches(event, now))    // keep only matching scenes
                .findFirst();                           // take the first match only

        if (match.isPresent()) {
            var scene = match.get();
            log.info("Scene matched: {}", scene.getClass().getSimpleName());
            scene.execute(event);
        } else {
            log.debug("No scene matched ...");
        }
    }
}
```

**The Strategy design pattern explained:**

Without the pattern, you'd have one giant if/else chain:
```java
// BAD — monolithic, hard to extend
if (event is arrived && time is morning && day is weekday) {
    turnOn("room-lights");
} else if (event is arrived && time is evening) {
    turnOn("desk-light");
} else if (event is left) {
    turnOff everything;
}
```

With the pattern, each rule is its own isolated class implementing a shared interface:
```java
public interface SceneStrategy {
    boolean matches(VisionEvent event, LocalDateTime now);  // "should I run?"
    void execute(VisionEvent event);                         // "what to do"
}
```

Benefits:
- **Adding a scene = adding a file.** No existing code is modified.
- **Each scene is testable in isolation.** You can unit test `MorningArrivalScene.matches()` with mock events and times.
- **Spring auto-discovers them.** Any `@Component` implementing `SceneStrategy` gets injected into `SceneService.strategies` automatically.

**Ordering with `@Order`:**

The `@Order(n)` annotation controls which scene gets evaluated first. Lower number = higher priority:
- `@Order(10)` — MorningArrivalScene (checked first)
- `@Order(20)` — EveningArrivalScene
- `@Order(50)` — NightArrivalScene
- `@Order(100)` — LeftScene (checked last)

Since `findFirst()` stops at the first match, ordering determines which scene "wins" when multiple could match.

### 4.8 Each scene explained

| Scene | Order | Event | Time condition | Actions |
|---|---|---|---|---|
| **MorningArrivalScene** | 10 | `arrived` | Mon–Fri, 07:00–11:59 | Turn on room-lights, WoL workstation |
| **EveningArrivalScene** | 20 | `arrived` | Any day, 18:00–22:59 | Turn on desk-light |
| **NightArrivalScene** | 50 | `arrived` | Any day, 00:00–06:59 | Turn on room-lights |
| **LeftScene** | 100 | `left` | Any time, any day | Turn off room-lights AND desk-light |

**MorningArrivalScene in detail:**
```java
public boolean matches(VisionEvent event, LocalDateTime now) {
    // Only trigger on "arrived" events
    if (!"arrived".equals(event.getEventType())) return false;

    // Only on weekdays (Monday=1 through Friday=5)
    var dow = now.getDayOfWeek();
    boolean weekday = dow.getValue() >= DayOfWeek.MONDAY.getValue()
                   && dow.getValue() <= DayOfWeek.FRIDAY.getValue();

    // Only between 7am and noon
    int hour = now.getHour();
    return weekday && hour >= 7 && hour < 12;
}

public void execute(VisionEvent event) {
    for (Actuator a : actuators) {
        a.turnOn("room-lights");     // turn on the room lights
        a.wakeOnLan("workstation");  // send wake-on-lan packet (not implemented yet)
    }
}
```

**Gap analysis:** There's a time gap between 12:00 and 18:00 where no arrival scene matches. If you arrive at 2pm, no scene fires. You'd need to add an `AfternoonArrivalScene` (Order 15, 12:00–17:59) if you want coverage. Similarly, 23:00–23:59 is uncovered.

### 4.9 Actuators — controlling real hardware

The `Actuator` interface defines what physical actions are possible:
```java
public interface Actuator {
    void turnOn(String deviceName);
    void turnOff(String deviceName);
    void wakeOnLan(String deviceName);   // not yet implemented in ShellyActuator
}
```

**ShellyActuator** — sends real HTTP requests to Shelly smart plugs:
```java
@Component
@Profile("!test")   // NOT created during test runs
public class ShellyActuator implements Actuator {

    private final RestClient restClient;
    private final ShellyProperties shellyProperties;

    public void turnOn(String deviceName) {
        String host = shellyProperties.getDevices().get(deviceName);
        // "shellyplugsg3-d885ac1fcf2c.local"
        restClient.get()
            .uri("http://" + host + "/rpc/Switch.Set?id=0&on=true")
            .retrieve()
            .toBodilessEntity();
    }
}
```

Shelly Gen3 devices run a local HTTP server. The RPC API:
- `Switch.Set?id=0&on=true` — turn relay 0 on
- `Switch.Set?id=0&on=false` — turn relay 0 off
- `Switch.Toggle?id=0` — flip current state

**MockActuator** — development/testing fallback:
```java
@Component   // no @Profile restriction — always active
public class MockActuator implements Actuator {
    public void turnOn(String deviceName) {
        log.info("[MOCK] would turn ON '{}'", deviceName);
    }
    // ...
}
```
Just logs what it would do. This means in development, you see both `[MOCK] would turn ON 'room-lights'` AND the actual Shelly HTTP call happening (if ShellyActuator is also active). Both actuators are in the `List<Actuator>` that scenes iterate over.

### 4.10 The Lights controller

A separate REST endpoint for **manual** light control from the UI dashboard:

```java
@RestController
@RequestMapping("/lights")
public class Lights {
    private final LightService lightService;

    @PostMapping("/{deviceName}/toggle")
    public void toggle(@PathVariable String deviceName) {
        lightService.toggleLight(deviceName);
    }
}
```

`@PathVariable` extracts the `{deviceName}` segment from the URL. So `POST /lights/desk-light/toggle` calls `toggleLight("desk-light")`.

`LightService.toggleLight()` sends `Switch.Toggle?id=0` to the Shelly device — this tells the plug to flip its current state (on→off or off→on), unlike `Switch.Set` which forces a specific state.

### 4.11 Spring Boot concepts used

| Concept | Where used | What it means |
|---|---|---|
| `@SpringBootApplication` | HubApplication | Combines component scanning, auto-configuration, and Spring Boot setup in one annotation |
| `@RestController` | EventController, Lights | Class whose methods handle HTTP requests and automatically serialize return values to JSON |
| `@RequestMapping` | `/events`, `/lights` | Sets the base URL path for all handler methods in the class |
| `@PostMapping` / `@GetMapping` | endpoint methods | Map specific HTTP methods + paths to Java methods |
| `@RequestBody` | `ingest()` | Deserialize the HTTP request body (JSON) into a Java object |
| `@PathVariable` | `toggle()` | Extract a URL segment (`{deviceName}`) into a method parameter |
| `@Valid` | `ingest()` | Trigger Jakarta Bean Validation on the annotated parameter |
| `@NotBlank` | VisionEventDto.eventType | Must not be null, empty, or whitespace |
| `@DecimalMin/Max` | VisionEventDto.confidence | Numeric range validation (0.0 to 1.0) |
| `@Entity` / `@Table` | VisionEvent | Marks a class as a JPA entity mapped to a specific database table |
| `@Id` / `@GeneratedValue` | VisionEvent.id | Primary key with auto-increment (database generates the value) |
| `JpaRepository<T, ID>` | VisionEventRepository | Extend this interface and Spring generates full CRUD implementations (save, findAll, findById, delete, etc.) |
| `@Service` | SceneService, LightService | A Spring-managed bean containing business logic |
| `@Component` | Scenes, Actuators | Generic Spring-managed bean — Spring creates one instance and injects it where needed |
| `@Order(n)` | Scene classes | Controls bean ordering when injected as a `List<>` |
| `@Profile("!test")` | ShellyActuator | Only create this bean when the "test" profile is NOT active |
| `@RequiredArgsConstructor` | Lombok annotation | Generates a constructor with one parameter per `final` field — Spring uses this for dependency injection |
| `@Slf4j` | Lombok annotation | Generates `private static final Logger log = LoggerFactory.getLogger(ClassName.class)` |
| `@ConfigurationProperties` | ShellyProperties | Bind a section of YAML (`shelly.*`) to Java fields automatically |
| `@EnableConfigurationProperties` | HubApplication | Activate the properties class so Spring processes it |
| `@Bean` | BeanConfiguration | Manually create and configure a Spring bean (vs. `@Component` which is auto-detected) |
| `record` | VisionEventDto | Immutable data carrier — compiler generates constructor, accessors, equals, hashCode, toString |
| `RestClient` | ShellyActuator, LightService | Spring 6's modern HTTP client (replaced the older RestTemplate) |
| `ResponseEntity` | EventController | Wraps a response with explicit HTTP status code control |
| Dependency Injection | everywhere | Spring automatically provides ("injects") objects that classes depend on via their constructor |

---

## 5. deskos-ui (React + Vite)

### 5.1 What it does

A single-page web dashboard that:
1. Shows a JARVIS-themed boot animation on first load
2. Provides three tabs: **Lights** (toggle switches), **Scenes** (view automations), **Events** (live vision feed)
3. Polls the hub every 3 seconds for new events, with an animated AI circle that reacts to arrivals/departures
4. Toggles lights by calling the hub API

### 5.2 File structure

```
deskos-ui/
├── package.json            # dependencies: react 19, react-dom, vite 8
├── vite.config.js          # dev server port (3000) + API proxy → hub
├── index.html              # HTML shell — mounts React
└── src/
    ├── main.jsx            # React entry point — renders <App /> into the DOM
    ├── index.css           # JARVIS global CSS variables + reset
    ├── App.jsx             # Root component: boot sequence → tab routing
    ├── App.css             # Grid background pattern overlay
    └── components/
        ├── Intro.jsx       # Boot sequence animation (arc reactor + terminal lines)
        ├── Intro.css
        ├── Nav.jsx         # Top navigation bar (tabs + clock + status)
        ├── Nav.css
        ├── LightsPage.jsx  # Light device grid
        ├── LightsPage.css
        ├── DeviceCard.jsx  # Individual light tile with toggle
        ├── DeviceCard.css
        ├── Toggle.jsx      # On/off toggle switch component
        ├── Toggle.css
        ├── ScenesPage.jsx  # Scene cards grid
        ├── ScenesPage.css
        ├── EventsPage.jsx  # Live event feed + polling logic
        ├── EventsPage.css
        ├── AiCircle.jsx    # Animated JARVIS holographic circle
        └── AiCircle.css
```

### 5.3 Vite config and the proxy trick

```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/lights': 'http://localhost:8080',
      '/events': 'http://localhost:8080',
    },
  },
})
```

**The problem:** The UI runs on `localhost:3000` (Vite dev server). The hub runs on `localhost:8080`. When the browser executes `fetch('/events/vision')`, it sends the request to `localhost:3000` — the same origin where the page was loaded. But `localhost:3000` is Vite, not the hub.

**The solution: Vite's dev server proxy.** When Vite sees a request starting with `/lights` or `/events`, it forwards it to `http://localhost:8080` behind the scenes. The browser never knows about port 8080.

**Why not just fetch `http://localhost:8080/events/vision` directly?**
CORS (Cross-Origin Resource Sharing). Browsers enforce a security policy: JavaScript on one origin (`localhost:3000`) cannot make HTTP requests to a different origin (`localhost:8080`) unless the server explicitly allows it with CORS headers. The proxy sidesteps this entirely — from the browser's perspective, all requests go to the same origin (`localhost:3000`).

**Important:** Proxy config changes require a Vite restart. Hot Module Replacement (HMR) does NOT pick up `vite.config.js` changes.

**In production:** You wouldn't use Vite's dev proxy. Instead, you'd either:
- Configure nginx to reverse-proxy `/lights` and `/events` to the hub, and serve the built React files for everything else
- Or add `@CrossOrigin` to the Spring controllers and fetch the hub directly

### 5.4 App.jsx — routing with state

```jsx
export default function App() {
  const [entered, setEntered] = useState(false)    // has the boot animation finished?
  const [page, setPage] = useState('lights')       // which tab is currently active

  if (!entered) {
    return <Intro onEnter={() => setEntered(true)} />
  }

  return (
    <div className="app">
      <Nav current={page} onChange={setPage} />
      <main className="app-main">
        {page === 'lights' && <LightsPage />}
        {page === 'scenes' && <ScenesPage />}
        {page === 'events' && <EventsPage />}
      </main>
    </div>
  )
}
```

No React Router needed — there are only three pages, so we use a simple `page` state string. The `&&` short-circuit pattern means "render this component only if the condition on the left is true". When `page` is `'lights'`, only `<LightsPage />` renders; the other two are not created at all.

`setPage` is passed to `<Nav />` as the `onChange` prop. When you click a tab, Nav calls `onChange('scenes')`, which calls `setPage('scenes')`, which re-renders App with the new page.

### 5.5 Intro.jsx — the boot sequence

Simulates a terminal boot sequence with an arc reactor animation:

```jsx
const BOOT_LINES = [
  'DESKOS CORE v2.1.0',
  'Initializing vision subsystem...',
  'Connecting to hub @ localhost:8080...',
  'Loading scene engine...',
  'System ready.',
]
```

Uses `setInterval` to reveal one line every 280ms. After the last line, waits 600ms, then calls `onEnter()` — which sets `entered=true` in App, unmounting the Intro and showing the main dashboard.

**The animation layers:**
- **Outer ring**: CSS `border` with `animation: ring-spin 3s linear infinite` — a thin arc of cyan rotating around a circle
- **Inner ring**: A second spinning arc going faster (1.5s period) — using a `::before` pseudo-element on the same div
- **Core**: A solid cyan dot with a `box-shadow` glow, pulsing with `animation: core-pulse 1.5s ease-in-out infinite`
- **Boot text**: Lines fade in one at a time, with a blinking cyan cursor (`animation: blink .6s step-end infinite`)
- **Exit**: The entire splash fades out with `animation: splash-out .5s ease 2.4s forwards` — the `2.4s` delay lets the boot sequence play before fading

### 5.6 Nav.jsx — the top bar

```jsx
const TABS = [
  { id: 'lights', label: 'Lights' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'events', label: 'Events' },
]
```

Renders:
- **Reactor icon** — a tiny circle with a glowing center dot (two nested divs with `border-radius: 50%`)
- **"DeskOS" wordmark** — "Desk" in white, "OS" in cyan (via a `<span>` with `color: var(--accent)`)
- **Tab buttons** — mapped from the `TABS` array. The active tab gets class `active` (cyan text + bottom border)
- **ONLINE indicator** — a pulsing green dot with "ONLINE" text
- **Live clock** — updates every second:

```jsx
const [time, setTime] = useState(new Date())
useEffect(() => {
  const id = setInterval(() => setTime(new Date()), 1000)
  return () => clearInterval(id)     // cleanup: stop the timer if Nav unmounts
}, [])
```

The `[]` dependency array means this effect runs once on mount and its cleanup runs on unmount. Every second, `setTime(new Date())` triggers a re-render with the new time.

### 5.7 LightsPage + DeviceCard + Toggle

**LightsPage** defines the static device list and renders a grid:
```jsx
const DEVICES = [
  { id: 'desk-light', name: 'Desk light' },
  { id: 'room-lights', name: 'Room lights' },
]
```
These `id` values must match the device names in the hub's `application.yml` — they become part of the URL: `POST /lights/desk-light/toggle`.

**DeviceCard** is where the real action happens — it manages four states:

```jsx
const [on, setOn] = useState(false)    // is the light on?
const [busy, setBusy] = useState(false) // is a request in flight?
const [err, setErr] = useState(false)   // did the last request fail?
```

The toggle function:
```jsx
async function toggle() {
  if (busy) return              // prevent double-click while a request is in flight
  setBusy(true)                 // show loading state
  setErr(false)                 // clear previous error
  try {
    const res = await fetch(`/lights/${device.id}/toggle`, { method: 'POST' })
    if (!res.ok) throw new Error(res.status)
    setOn(prev => !prev)        // flip the state: true→false or false→true
  } catch {
    setErr(true)                // show error state
    setTimeout(() => setErr(false), 2000)   // auto-clear error after 2 seconds
  } finally {
    setBusy(false)              // always clear loading state
  }
}
```

**CSS class composition:**
```jsx
const cls = ['tile', on && 'on', busy && 'busy', err && 'err'].filter(Boolean).join(' ')
// Results: "tile" or "tile on" or "tile busy" or "tile on err"
```
`on && 'on'` evaluates to `'on'` if true, or `false` if false. `filter(Boolean)` removes the `false` entries. `join(' ')` makes a space-separated class string.

**Toggle** is a purely visual (presentational) component:
```jsx
export default function Toggle({ on }) {
  return (
    <div className={`toggle ${on ? 'on' : ''}`}>
      <div className="toggle-knob" />
    </div>
  )
}
```
No state, no logic — it just renders differently based on the `on` prop. The knob slides via CSS `transform: translateX(16px)` when the `.on` class is present.

### 5.8 ScenesPage

Static display of the configured automation scenes:
```jsx
const SCENES = [
  { id: 'morning', name: 'Morning arrival', desc: 'Desk light on, room lights 60%' },
  { id: 'evening', name: 'Evening arrival', desc: 'Room lights warm, desk light off' },
  { id: 'leave',   name: 'Left the room',   desc: 'Everything off after 2 min' },
]
```

Currently read-only tiles with amber icons and glass-panel styling. To make them interactive (e.g. manually activate a scene), you'd:
1. Add a `POST /scenes/{id}/trigger` endpoint to the hub
2. Add the proxy rule to `vite.config.js`
3. Add an `onClick` handler to the tile that `fetch`es the new endpoint

### 5.9 EventsPage + AiCircle

**EventsPage** polls `GET /events/vision` every 3 seconds and detects new events:

```jsx
useEffect(() => {
  let active = true                            // guard for cleanup

  async function poll() {
    try {
      const res = await fetch('/events/vision')
      const data = await res.json()
      if (active) {
        // detect NEW events by comparing list length
        if (data.length > prevCount.current && prevCount.current > 0) {
          const latest = data[0]
          setPingType(latest?.eventType || 'arrived')
          setPing(p => p + 1)                  // increment → triggers AiCircle animation
        }
        prevCount.current = data.length        // remember count for next poll
        setEvents(data)
        setError(false)
      }
    } catch {
      if (active) setError(true)
    }
  }

  poll()                                       // first poll immediately
  timer.current = setInterval(poll, 3000)      // then every 3 seconds
  return () => {
    active = false                             // prevent setState on unmounted component
    clearInterval(timer.current)               // stop polling when leaving the Events tab
  }
}, [])
```

**Why `let active = true`?** React's useEffect cleanup runs when the component unmounts (e.g. user switches to the Lights tab). But a `fetch()` might still be in-flight. When the response arrives after unmounting, calling `setEvents()` on an unmounted component would be a React error. The `active` flag prevents this.

**Why `useRef` for `prevCount` and `timer`?** `useRef` holds a value that persists across re-renders but does NOT trigger a re-render when changed. Perfect for tracking "previous count" and "interval ID" — we need them to persist, but changing them shouldn't cause the component to re-render.

**AiCircle** — the animated JARVIS holographic circle with event reactions:

The circle has multiple animated layers:
- **Outer ring**: Slow counter-clockwise spin (12s), with two bright arc segments (cyan)
- **Mid ring**: Dashed border, clockwise spin (8s), with amber arc segments
- **Inner ring**: Very slow counter-clockwise spin (20s), subtle cyan arc
- **Tick marks**: 36 SVG lines (every 10°) around the perimeter, cardinal ticks brighter
- **Scanning beam**: A cyan gradient line rotating clockwise (3s) — like a radar sweep
- **Core**: Pulsing cyan dot with radial glow gradient, breathing animation

**Event reaction — when `ping` changes:**
```jsx
useEffect(() => {
  if (ping !== prevPing.current && ping > 0) {
    prevPing.current = ping
    setRipple(true)
    const id = setTimeout(() => setRipple(false), 900)
    return () => clearTimeout(id)
  }
}, [ping])
```

When ripple is true:
- A **ripple ring** expands outward from the circle's edge and fades (cyan for arrivals, amber for departures)
- The **core dot flashes** with an enlarged bright glow burst
- Both animations last ~800ms then settle back to idle

### 5.10 The JARVIS design system

All visual tokens are CSS custom properties in `index.css`:

```css
:root {
  --bg: #060b12;                          /* near-black blue background */
  --bg-deep: #030608;                     /* even darker — boot screen */
  --surface: rgba(0, 180, 255, .04);      /* card/panel background — barely visible cyan tint */
  --surface-hover: rgba(0, 180, 255, .08); /* hovered card — slightly more visible */
  --surface-active: rgba(0, 212, 255, .10); /* active/on state — most visible */
  --border: rgba(0, 180, 255, .10);       /* default borders — faint cyan */
  --border-bright: rgba(0, 212, 255, .25); /* hover/active borders — brighter cyan */
  --text: #c8e0f0;                        /* primary text — cool blue-gray */
  --text-secondary: rgba(160, 200, 230, .45); /* muted labels, descriptions */
  --accent: #00d4ff;                      /* PRIMARY CYAN — the JARVIS signature color */
  --accent-dim: rgba(0, 212, 255, .5);    /* semi-transparent accent */
  --accent-glow: rgba(0, 212, 255, .08);  /* glow shadow color */
  --amber: #e4a853;                       /* SECONDARY — warm accent for scenes, warnings, departures */
  --amber-dim: rgba(228, 168, 83, .5);
  --green: #22c55e;                       /* SUCCESS — online, arrived, toggle on */
  --alert: #e05a5a;                       /* ERROR — connection failed, toggle error */
  --toggle-off: rgba(0, 180, 255, .12);   /* toggle track when off */
  --toggle-on: var(--accent);             /* toggle track when on */
  --mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; /* data/code font */
}
```

**Design principles:**
1. **Dark background** with a subtle cyan grid overlay (App.css uses `background-image: linear-gradient(...)` to create a faint grid pattern)
2. **Glass morphism** panels — semi-transparent cyan-tinted backgrounds (`rgba(0, 180, 255, .04)`) with blurred backdrop
3. **Cyan borders** that brighten on hover (`.10` → `.25` opacity)
4. **Active/on states** get a cyan glow aura (`box-shadow: 0 0 20px var(--accent-glow)`)
5. **HUD corner brackets** on cards — `::before` and `::after` pseudo-elements draw L-shaped corners
6. **Monospace** for data (timestamps, status labels, badges) — sans-serif for headings and body
7. **Amber** for secondary information (scenes, room labels, departure events, warnings)
8. **Green** for positive states (online indicator, arrived events, toggle on)
9. **Global animations**: `glow-pulse` (2.5s breathing glow), `fade-in` (0.15s), `scan` (for future use)

### 5.11 React concepts used

| Concept | Where used | What it means |
|---|---|---|
| `useState(initialValue)` | everywhere | Creates a state variable + its setter. When the setter is called, React re-renders the component with the new value |
| `useEffect(fn, deps)` | clock, polling, ping | Runs the function after render. The dependency array controls when it re-runs. `[]` = only on mount. Returns a cleanup function for timers/subscriptions |
| `useRef(initialValue)` | timer, prevCount, prevPing | Holds a mutable value (`.current`) that persists across renders WITHOUT triggering re-render. Used for values you need to remember but that aren't part of the UI |
| `props` | `{ device }`, `{ on }`, `{ ping }` | Data passed from parent to child. Read-only in the child — to change parent state, the parent passes a callback function as a prop |
| `&&` conditional rendering | `{page === 'lights' && <LightsPage />}` | If the left side is true, render the right side. If false, render nothing |
| `? :` ternary rendering | `on ? 'on' : ''` | Inline if/else for choosing between two values |
| `.map()` | list rendering | Transform an array of data into an array of JSX elements: `events.map(ev => <div>...</div>)` |
| `key` prop | list items | React needs a unique key per list item to efficiently update only the items that changed (not recreate all of them) |
| `className` | every element | React uses `className` instead of HTML `class` (because `class` is a reserved word in JavaScript) |
| `async/await` | fetch calls | Write asynchronous code (network requests) in a synchronous-looking style. `await` pauses the function until the Promise resolves |
| `fetch(url, options)` | API calls | Browser's built-in HTTP client. Returns a Promise. Use `await res.json()` to parse the response body |
| `try/catch/finally` | toggle, polling | Error handling for async operations. `finally` always runs, even after an error — perfect for clearing loading states |
| CSS-per-component | `import './DeviceCard.css'` | Each component imports its own CSS file. Styles are NOT scoped (they're global), so class names must be unique |
| Functional components | every file | Components are plain JavaScript functions that return JSX. No class syntax needed |
| Lifting state | App.jsx `page` state | When multiple children need the same state (Nav needs to highlight, main needs to show), put the state in their shared parent |

---

## 6. Running the Full System

### Prerequisites

| Component | Requires |
|---|---|
| deskos-hub | Java 17+, Maven (or use `./mvnw`), PostgreSQL with database `deskos` created |
| deskos-vision | Python 3.10+, webcam, packages: `opencv-python`, `insightface`, `onnxruntime`, `numpy`, `pyyaml`, `requests` |
| deskos-ui | Node.js 18+ |

### Start order (matters!)

**1. PostgreSQL** must be running first:
```powershell
# Make sure PostgreSQL service is running
# Create the database if it doesn't exist:
createdb -U postgres deskos
```

**2. Start the hub** (depends on PostgreSQL):
```powershell
cd C:\Users\kalfa\Desktop\domo\deskos-hub
.\mvnw.cmd spring-boot:run
```
Wait for: `Started HubApplication in X.XXs`

**3. Start the UI** (depends on hub for API calls):
```powershell
cd C:\Users\kalfa\Desktop\domo\deskos-ui
npm install    # first time only
npm run dev
```
Opens at `http://localhost:3000`

**4. Start the vision worker** (depends on hub for posting events):
```powershell
cd C:\Users\kalfa\Desktop\domo\deskos-vision
python src/hello_recognize.py
```
A camera window opens with the HUD overlay.

### Verify everything works

1. Open `http://localhost:3000` — you should see the JARVIS boot sequence, then the dashboard
2. Click the "Events" tab — it should say "Live — polling hub" (NOT "Hub unreachable")
3. Walk in front of the camera — you should see:
   - Your name and confidence in the camera HUD
   - Console output: `>>>  ARRIVED  kostas`
   - A voice announcement: "Welcome back, Kostas."
   - The event appearing in the UI Events feed
   - The AI circle pulsing with a cyan ripple
4. Walk away — after ~10 frames of absence:
   - Console output: `<<<  LEFT  kostas`
   - Voice: "See you later, Kostas."
   - Departure event in the UI
   - AI circle ripples amber
5. Try toggling a light on the Lights tab — the tile should flip on/off (if hub + Shelly are connected) or show a brief "Error" (if no Shelly device is reachable)

---

## 7. Common Errors and How to Fix Them

### Vision errors

| Error | Cause | Fix |
|---|---|---|
| `ERROR: cannot open camera` | No webcam found, or it's in use by another app | Close Teams/Discord/browser using the camera. Try `index: 1` in config.yaml |
| `no enrolled faces in enrolled/` | The enrolled directory has no .pkl files | Run the enrollment script to create .pkl files |
| `embedding has wrong shape` | Corrupted .pkl file | Re-enroll that person |
| `embedding is not normalized` | Bad enrollment | Re-enroll — the script should normalize embeddings |
| Wrong person recognized | Threshold too low | Increase `recognition.threshold` to 0.55 or 0.6 |
| Rapid arrive/leave spam | Streak thresholds too short | Increase `enter_frames` to 5, `leave_frames` to 15 |
| `requests.exceptions.ConnectionError` | Hub not running | Start the hub first. Vision still works locally (HUD + voice) |

### Hub errors

| Error | Cause | Fix |
|---|---|---|
| `MethodArgumentNotValidException` with `eventType: rejected value [null]` | Vision sending wrong JSON field names | Must send `"eventType"` not `"event"`, `"personName"` not `"person"` |
| `Connection refused` on port 5432 | PostgreSQL not running | Start PostgreSQL service |
| `FATAL: database "deskos" does not exist` | Database not created | Run `createdb -U postgres deskos` |
| Shelly request timeout | Smart plug offline or wrong hostname | Verify plug is powered; test with `ping shellyplugsg3-xxx.local`; try IP address instead of mDNS |
| `[MOCK] would turn ON 'desk-light'` in logs | MockActuator is active alongside ShellyActuator | Normal in dev — both actuators run. Use Spring profiles to disable mock in production |

### UI errors

| Error | Cause | Fix |
|---|---|---|
| "Hub unreachable" on Events tab | Hub not running, or `/events` not in Vite proxy | Start hub. Check `vite.config.js` has `/events` proxy. **Restart Vite** after config changes |
| Light toggle shows brief "Error" | Hub unreachable, or Shelly plug offline | Check hub console for the error details |
| Blank page after boot animation | JavaScript runtime error | Open browser DevTools (F12) → Console tab for the error message |
| Styles look broken | Stale browser cache | Hard refresh: Ctrl+Shift+R |
| Events poll but never show data | Hub returns `[]` (no events yet) | Run the vision worker and walk in front of the camera to generate events |

---

## 8. How to Extend DeskOS

### Add a new person to vision

1. Take 3-5 photos of the person's face from different angles
2. Run the enrollment script to generate a `.pkl` file
3. Place it in `deskos-vision/enrolled/`
4. Restart `hello_recognize.py` — it loads all `.pkl` files on startup

### Add a new smart device

1. Add its Shelly hostname to `application.yml`:
   ```yaml
   shelly:
     devices:
       desk-light: "shellyplugsg3-xxx.local"
       room-lights: "shellyplugsg3-yyy.local"
       monitor: "shellyplugsg3-zzz.local"    # ← new
   ```
2. Add it to `DEVICES` in `LightsPage.jsx`:
   ```jsx
   const DEVICES = [
     { id: 'desk-light', name: 'Desk light' },
     { id: 'room-lights', name: 'Room lights' },
     { id: 'monitor', name: 'Monitor' },      // ← new — id must match YAML key
   ]
   ```
3. Restart the hub and the UI dev server

### Add a new scene

Create a new Java class in `com.deskos.hub.scenes`:

```java
@Component
@Order(30)                // pick a priority between existing scenes
@RequiredArgsConstructor
@Slf4j
public class WeekendArrivalScene implements SceneStrategy {

    private final List<Actuator> actuators;

    @Override
    public boolean matches(VisionEvent event, LocalDateTime now) {
        if (!"arrived".equals(event.getEventType())) return false;
        var dow = now.getDayOfWeek();
        return dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY;
    }

    @Override
    public void execute(VisionEvent event) {
        log.info("Weekend mode for {}", event.getPersonName());
        for (Actuator a : actuators) {
            a.turnOn("desk-light");
        }
    }
}
```

Spring auto-discovers it — no registration code needed. Just restart the hub.

### Add a new actuator type (GPIO, MQTT, etc.)

Implement the `Actuator` interface:

```java
@Component
public class MqttActuator implements Actuator {
    @Override
    public void turnOn(String deviceName) {
        // publish MQTT message
    }
    @Override
    public void turnOff(String deviceName) { ... }
    @Override
    public void wakeOnLan(String deviceName) { ... }
}
```

Spring injects it into all scene strategies automatically.

### Add a new tab to the UI

1. Create `NewPage.jsx` + `NewPage.css` in `src/components/`
2. Add the tab to `TABS` in `Nav.jsx`:
   ```jsx
   { id: 'settings', label: 'Settings' },
   ```
3. Import and render in `App.jsx`:
   ```jsx
   import SettingsPage from './components/SettingsPage'
   // ...inside the return:
   {page === 'settings' && <SettingsPage />}
   ```

### Add a new API endpoint to the hub

1. Create a new `@RestController` class (or add a method to an existing one)
2. Add the URL prefix to `vite.config.js` proxy:
   ```javascript
   '/new-path': 'http://localhost:8080',
   ```
3. Restart Vite

### Upgrade to real-time updates (WebSocket)

Currently the UI polls every 3 seconds. For instant updates:

1. Add `spring-boot-starter-websocket` to the hub's `pom.xml`
2. Create a WebSocket config and a STOMP topic endpoint (e.g. `/topic/events`)
3. In `EventController.ingest()`, broadcast to the topic after saving
4. In the UI, replace `setInterval(poll, 3000)` with a STOMP client subscription
5. Keep the poll as a fallback in case WebSocket disconnects

---

*This guide covers the complete DeskOS system as built. Every file, every pattern, every design decision is documented here. When in doubt, read the code — the guide tells you where to look and what to expect.*
