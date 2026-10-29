"""
enroll.py — Face enrollment for the DeskOS vision worker.

Captures multiple face samples from the webcam, averages them into one
reference embedding, and saves it to enrolled/<name>.pkl for the
recognizer to use at runtime.

Usage:
    python enroll.py <name>

Example:
    python enroll.py kostas
"""

import sys
import pickle
import time
from pathlib import Path
from datetime import datetime, timezone

import cv2
import numpy as np
from insightface.app import FaceAnalysis


NUM_SAMPLES = 10
WINDOW_NAME = "DESKOS // FACE ENROLLMENT"

# ── cyberpunk palette (BGR) ──────────────────────────────────────────
CYAN      = (255, 255, 0)
MAGENTA   = (255, 0, 255)
NEON_GREEN = (0, 255, 100)
HOT_PINK  = (180, 50, 255)
DARK_CYAN = (128, 128, 0)
AMBER     = (0, 191, 255)
WHITE     = (255, 255, 255)
DIM_WHITE = (160, 160, 160)
BG_DARK   = (15, 12, 10)

# ── ANSI terminal colors ────────────────────────────────────────────
C = "\033[36m"   # cyan
M = "\033[35m"   # magenta
G = "\033[32m"   # green
Y = "\033[33m"   # yellow
R = "\033[31m"   # red
W = "\033[97m"   # bright white
D = "\033[90m"   # dim
B = "\033[1m"    # bold
RST = "\033[0m"  # reset


def banner():
    print(f"""
{M}╔══════════════════════════════════════════════════════════════════╗{RST}
{M}║{RST}                                                                  {M}║{RST}
{M}║{RST}   {C}{B}██████╗ ███████╗███████╗██╗  ██╗ ██████╗ ███████╗{RST}              {M}║{RST}
{M}║{RST}   {C}██╔══██╗██╔════╝██╔════╝██║ ██╔╝██╔═══██╗██╔════╝{RST}              {M}║{RST}
{M}║{RST}   {C}██║  ██║█████╗  ███████╗█████╔╝ ██║   ██║███████╗{RST}              {M}║{RST}
{M}║{RST}   {C}██║  ██║██╔══╝  ╚════██║██╔═██╗ ██║   ██║╚════██║{RST}              {M}║{RST}
{M}║{RST}   {C}██████╔╝███████╗███████║██║  ██╗╚██████╔╝███████║{RST}              {M}║{RST}
{M}║{RST}   {C}╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝{RST}              {M}║{RST}
{M}║{RST}                                                                  {M}║{RST}
{M}║{RST}   {M}▸ {W}FACE ENROLLMENT MODULE{RST}             {D}v1.0 // deskos-vision{RST}     {M}║{RST}
{M}║{RST}                                                                  {M}║{RST}
{M}╚══════════════════════════════════════════════════════════════════╝{RST}
""")

def hud_line(label, value, color=C):
    print(f"  {D}▸{RST} {D}{label:<20}{RST} {color}{B}{value}{RST}")


def progress_bar(current, total, width=30):
    filled = int(width * current / total)
    bar = "█" * filled + "░" * (width - filled)
    pct = current / total * 100
    return f"{C}[{NEON_GREEN_ANSI}{bar}{C}]{RST} {W}{pct:5.1f}%{RST}"


NEON_GREEN_ANSI = "\033[92m"


def draw_corner_brackets(img, x1, y1, x2, y2, color, thickness=2, length=20):
    """Draw cyberpunk-style corner brackets instead of a full rectangle."""
    l = min(length, (x2 - x1) // 3, (y2 - y1) // 3)
    # top-left
    cv2.line(img, (x1, y1), (x1 + l, y1), color, thickness)
    cv2.line(img, (x1, y1), (x1, y1 + l), color, thickness)
    # top-right
    cv2.line(img, (x2, y1), (x2 - l, y1), color, thickness)
    cv2.line(img, (x2, y1), (x2, y1 + l), color, thickness)
    # bottom-left
    cv2.line(img, (x1, y2), (x1 + l, y2), color, thickness)
    cv2.line(img, (x1, y2), (x1, y2 - l), color, thickness)
    # bottom-right
    cv2.line(img, (x2, y2), (x2 - l, y2), color, thickness)
    cv2.line(img, (x2, y2), (x2, y2 - l), color, thickness)


def draw_scan_line(img, frame_count):
    """Animated horizontal scan line sweeping down the frame."""
    h, w = img.shape[:2]
    y = (frame_count * 3) % h
    overlay = img.copy()
    cv2.line(overlay, (0, y), (w, y), CYAN, 1)
    cv2.line(overlay, (0, y + 1), (w, y + 1), DARK_CYAN, 1)
    cv2.addWeighted(overlay, 0.4, img, 0.6, 0, img)


def draw_vignette(img):
    """Subtle dark vignette around edges for that cyberpunk CRT feel."""
    h, w = img.shape[:2]
    X = cv2.getGaussianKernel(w, w * 0.4)
    Y = cv2.getGaussianKernel(h, h * 0.4)
    M = Y * X.T
    M = M / M.max()
    mask = np.stack([M, M, M], axis=2).astype(np.float32)
    img[:] = (img.astype(np.float32) * mask).clip(0, 255).astype(np.uint8)


def draw_hud(img, num_captured, num_total, faces_count, fps, name, frame_count):
    """Draw the full heads-up display overlay."""
    h, w = img.shape[:2]

    # ── top bar ──
    cv2.rectangle(img, (0, 0), (w, 45), BG_DARK, -1)
    cv2.line(img, (0, 45), (w, 45), CYAN, 1)
    cv2.putText(img, "DESKOS", (12, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, CYAN, 2)
    cv2.putText(img, "// FACE ENROLLMENT", (120, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, DIM_WHITE, 1)

    ts = time.strftime("%H:%M:%S")
    cv2.putText(img, ts, (w - 100, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, DARK_CYAN, 1)

    # ── subject tag (top-right area) ──
    tag = f"SUBJECT: {name.upper()}"
    cv2.putText(img, tag, (w - 250, 72),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, MAGENTA, 1)

    # ── bottom bar ──
    cv2.rectangle(img, (0, h - 55), (w, h), BG_DARK, -1)
    cv2.line(img, (0, h - 55), (w, h - 55), CYAN, 1)

    # progress bar
    bar_x, bar_y = 12, h - 40
    bar_w = 200
    bar_h = 16
    cv2.rectangle(img, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), DARK_CYAN, 1)
    fill_w = int(bar_w * num_captured / num_total)
    if fill_w > 0:
        cv2.rectangle(img, (bar_x + 1, bar_y + 1),
                      (bar_x + fill_w, bar_y + bar_h - 1), NEON_GREEN, -1)
    pct_text = f"{num_captured}/{num_total}"
    cv2.putText(img, pct_text, (bar_x + bar_w + 10, bar_y + 13),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, WHITE, 1)

    # status indicators
    face_color = NEON_GREEN if faces_count == 1 else HOT_PINK
    cv2.putText(img, f"FACES: {faces_count}", (bar_x + bar_w + 70, bar_y + 13),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, face_color, 1)
    cv2.putText(img, f"FPS: {fps:.0f}", (w - 90, bar_y + 13),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, DARK_CYAN, 1)

    # keybinds
    cv2.putText(img, "[SPACE] CAPTURE", (12, h - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, DIM_WHITE, 1)
    cv2.putText(img, "[Q] ABORT", (160, h - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, DIM_WHITE, 1)

    # face-count warning
    if faces_count == 0:
        pulse = int(abs(np.sin(frame_count * 0.1)) * 255)
        warn_color = (0, 0, pulse)
        cv2.putText(img, "NO FACE DETECTED", (w // 2 - 110, h // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, warn_color, 2)
    elif faces_count > 1:
        cv2.putText(img, "MULTIPLE FACES — ISOLATE SUBJECT",
                    (w // 2 - 180, h // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, HOT_PINK, 2)


def draw_capture_flash(img, countdown):
    """Green overlay flash that fades over several frames."""
    if countdown <= 0:
        return
    alpha = 0.25 * (countdown / 8)
    overlay = img.copy()
    cv2.rectangle(overlay, (0, 0), (img.shape[1], img.shape[0]), NEON_GREEN, -1)
    cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)
    h, w = img.shape[:2]
    cv2.putText(img, ">> SAMPLE ACQUIRED <<", (w // 2 - 150, h // 2 + 40),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, NEON_GREEN, 2)


def draw_face_label(img, x1, y1, score):
    """Label above the face bracket with confidence score."""
    label = f"CONF {score:.2f}"
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
    cv2.rectangle(img, (x1, y1 - th - 10), (x1 + tw + 8, y1 - 2), BG_DARK, -1)
    cv2.putText(img, label, (x1 + 4, y1 - 6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, CYAN, 1)


# ═══════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════

banner()

# ---------- CLI args ----------

if len(sys.argv) != 2:
    print(f"  {R}✘ usage:{RST} python enroll.py <name>")
    print(f"  {D}  example: python enroll.py kostas{RST}")
    exit(1)

name = sys.argv[1].lower().strip()
if not name.isalnum():
    print(f"  {R}✘ name must be alphanumeric, got: {name!r}{RST}")
    exit(1)

enrolled_dir = Path("enrolled")
enrolled_dir.mkdir(exist_ok=True)
output_path = enrolled_dir / f"{name}.pkl"

print(f"  {D}───────────────────────────────────────────{RST}")
hud_line("SUBJECT", name.upper(), M)
hud_line("OUTPUT", str(output_path), C)
hud_line("SAMPLES NEEDED", str(NUM_SAMPLES), C)
print(f"  {D}───────────────────────────────────────────{RST}")
print()

if output_path.exists():
    print(f"  {Y}⚠  {output_path} already exists{RST}")
    response = input(f"  {Y}   overwrite? [y/N] {RST}").strip().lower()
    if response != "y":
        print(f"  {R}✘ aborted{RST}")
        exit(0)
    print()


# ---------- load model ----------

print(f"  {D}▸ loading InsightFace model...{RST}", end="", flush=True)
t0 = time.time()
app = FaceAnalysis(providers=["CPUExecutionProvider"])
app.prepare(ctx_id=0, det_size=(640, 640))
elapsed = time.time() - t0
print(f"\r  {G}✔ model loaded{RST}  {D}({elapsed:.1f}s){RST}")


# ---------- open camera ----------

print(f"  {D}▸ opening camera...{RST}", end="", flush=True)
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print(f"\r  {R}✘ could not open camera{RST}")
    exit(1)
print(f"\r  {G}✔ camera online{RST}     ")

cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_AUTOSIZE)
cv2.setWindowProperty(WINDOW_NAME, cv2.WND_PROP_TOPMOST, 1)
cv2.waitKey(1)
cv2.setWindowProperty(WINDOW_NAME, cv2.WND_PROP_TOPMOST, 0)

print()
print(f"  {C}╔══════════════════════════════════════════╗{RST}")
print(f"  {C}║{RST}  {W}{B}ENROLLMENT ACTIVE{RST}                       {C}║{RST}")
print(f"  {C}║{RST}  {D}click the video window for key input{RST}     {C}║{RST}")
print(f"  {C}║{RST}  {D}vary pose between captures{RST}               {C}║{RST}")
print(f"  {C}╚══════════════════════════════════════════╝{RST}")
print()


# ---------- capture loop ----------

embeddings = []
capture_flash = 0
frame_count = 0
prev_time = time.time()
fps = 0.0

try:
    while len(embeddings) < NUM_SAMPLES:
        ok, frame = cap.read()
        if not ok:
            print(f"  {R}✘ could not read frame{RST}")
            break

        frame_count += 1
        now = time.time()
        if now - prev_time > 0:
            fps = 0.9 * fps + 0.1 * (1.0 / (now - prev_time))
        prev_time = now

        faces = app.get(frame)

        # draw vignette + scan line
        draw_vignette(frame)
        draw_scan_line(frame, frame_count)

        # draw face overlays
        for face in faces:
            x1, y1, x2, y2 = face.bbox.astype(int)
            draw_corner_brackets(frame, x1, y1, x2, y2, CYAN, 2, 25)
            draw_face_label(frame, x1, y1, face.det_score)

        # capture flash
        draw_capture_flash(frame, capture_flash)
        if capture_flash > 0:
            capture_flash -= 1

        # HUD
        draw_hud(frame, len(embeddings), NUM_SAMPLES, len(faces), fps,
                 name, frame_count)

        cv2.imshow(WINDOW_NAME, frame)

        key = cv2.waitKey(30) & 0xFF
        if key == ord('q'):
            print(f"  {R}✘ aborted by user{RST}")
            break
        elif key == ord(' '):
            if len(faces) != 1:
                print(f"  {Y}⚠  skip: need 1 face, detected {len(faces)}{RST}")
                continue
            embeddings.append(faces[0].normed_embedding)
            capture_flash = 8
            n = len(embeddings)
            bar = progress_bar(n, NUM_SAMPLES)
            print(f"  {G}✔ sample {n:>2}/{NUM_SAMPLES}{RST}  {bar}")
finally:
    cap.release()
    cv2.destroyAllWindows()


# ---------- guard: only save if full enrollment ----------

print()
if len(embeddings) < NUM_SAMPLES:
    print(f"  {R}✘ only {len(embeddings)}/{NUM_SAMPLES} samples — not saving{RST}")
    print(f"  {D}  run again to complete enrollment{RST}")
    exit(1)


# ---------- average + renormalize ----------

print(f"  {D}───────────────────────────────────────────{RST}")
print(f"  {D}▸ processing embeddings...{RST}")

embeddings_arr = np.array(embeddings)
hud_line("STACK SHAPE", str(embeddings_arr.shape))

mean_embedding = embeddings_arr.mean(axis=0)
norm_before = np.linalg.norm(mean_embedding)
hud_line("NORM (pre)", f"{norm_before:.6f}")

mean_embedding = mean_embedding / norm_before
hud_line("NORM (post)", f"{np.linalg.norm(mean_embedding):.6f}", G)

print(f"  {D}───────────────────────────────────────────{RST}")


# ---------- save ----------

enrolled_at = datetime.now(timezone.utc).isoformat()
record = {
    "name": name,
    "embedding": mean_embedding,
    "num_samples": NUM_SAMPLES,
    "enrolled_at": enrolled_at,
}

with open(output_path, "wb") as f:
    pickle.dump(record, f)

print()
print(f"  {G}{B}╔══════════════════════════════════════════╗{RST}")
print(f"  {G}{B}║  ✔  ENROLLMENT COMPLETE                  ║{RST}")
print(f"  {G}{B}╚══════════════════════════════════════════╝{RST}")
print()
hud_line("SUBJECT", name.upper(), M)
hud_line("SAMPLES", str(record["num_samples"]), C)
hud_line("SAVED TO", str(output_path), C)
hud_line("ENROLLED AT", enrolled_at, D)
print()
