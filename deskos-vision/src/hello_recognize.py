"""DeskOS Vision — face recognition with HUD overlay."""

import sys
import cv2
import time
import yaml
import random
import subprocess
from pathlib import Path
from datetime import datetime
from threading import Thread
import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from recognition.recognizer import Recognizer  # noqa: E402

# ── Colors (BGR) ─────────────────────────────────────────

TEAL  = (210, 210, 0)
GREEN = (120, 220, 80)
AMBER = (0, 180, 255)
WHITE = (230, 230, 230)
GRAY  = (100, 100, 100)
DARK  = (18, 18, 18)
RED   = (60, 60, 220)

# ── Voice announcements ──────────────────────────────────

GREETINGS = [
    "Welcome back, {name}.",
    "Hey {name}, good to see you.",
    "{name} has entered the building.",
    "What's up {name}.",
    "{name} detected. Hello.",
    "Good to have you here, {name}.",
    "Ah, {name}. Welcome.",
]

FAREWELLS = [
    "See you later, {name}.",
    "{name} has left.",
    "Goodbye {name}. Take care.",
    "Catch you later, {name}.",
    "{name} is no longer detected.",
    "Until next time, {name}.",
]

from queue import Queue

_tts_queue = Queue()
_CREATE_NO_WINDOW = 0x08000000


def _tts_worker():
    while True:
        text = _tts_queue.get()
        safe = text.replace("'", "''")
        try:
            subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 "Add-Type -AssemblyName System.Speech; "
                 f"(New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('{safe}')"],
                creationflags=_CREATE_NO_WINDOW,
                timeout=15,
            )
        except Exception:
            pass


Thread(target=_tts_worker, daemon=True).start()


def say(text):
    _tts_queue.put(text)


def announce(etype, person):
    name = person.title()
    if etype == "arrived":
        say(random.choice(GREETINGS).format(name=name))
    else:
        say(random.choice(FAREWELLS).format(name=name))


class PresenceTracker:
    def __init__(self, enter_frames, leave_frames):
        self.enter_frames = enter_frames
        self.leave_frames = leave_frames
        self.hit = {}
        self.miss = {}
        self.presence = set()

    def update(self, seen):

        events= []
        for name, score in seen.items():
            self.hit[name]= self.hit.get(name, 0) + 1
            self.miss[name] = 0

            if name not in self.presence and self.hit[name] >= self.enter_frames:
                self.presence.add(name)
                events.append(("arrived", name, score))
        for name in list(self.presence):
            if name not in seen:
                self.miss[name] = self.miss.get(name, 0) + 1
                self.hit[name] = 0
                if self.miss[name] >= self.leave_frames:
                    self.presence.discard(name)
                    events.append(("left", name, 0.0))
        return events


    
# ── Config ───────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent


def load_config():
    with open(ROOT / "config.yaml") as f:
        return yaml.safe_load(f)


# ── HUD drawing ──────────────────────────────────────────

def _corner_brackets(frame, x1, y1, x2, y2, color, t=2, length=18):
    cl = min(length, (x2 - x1) // 3, (y2 - y1) // 3)
    for ax, ay, dx, dy in [
        (x1, y1, 1, 1), (x2, y1, -1, 1),
        (x1, y2, 1, -1), (x2, y2, -1, -1),
    ]:
        cv2.line(frame, (ax, ay), (ax + dx * cl, ay), color, t, cv2.LINE_AA)
        cv2.line(frame, (ax, ay), (ax, ay + dy * cl), color, t, cv2.LINE_AA)


def _viewfinder(frame, h, w):
    m = 25
    for cx, cy, dx, dy in [
        (4, 4, 1, 1), (w - 5, 4, -1, 1),
        (4, h - 5, 1, -1), (w - 5, h - 5, -1, -1),
    ]:
        cv2.line(frame, (cx, cy), (cx + dx * m, cy), GRAY, 1)
        cv2.line(frame, (cx, cy), (cx, cy + dy * m), GRAY, 1)


def draw_hud(frame, fps, faces_info, enrolled_count, tick):
    h, w = frame.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX
    overlay = frame.copy()

    # ── Pass 1: dark panels on overlay, single blend ─────

    cv2.rectangle(overlay, (10, 10), (210, 130), DARK, -1)

    ts_w = 120
    cv2.rectangle(overlay, (w - ts_w - 10, 10), (w - 10, 62), DARK, -1)

    bar_h = 34
    cv2.rectangle(overlay, (0, h - bar_h), (w, h), DARK, -1)

    label_meta = []
    for bbox, name, det_score, rec_score in faces_info:
        text = (f"{name.upper()}  {rec_score:.0%}"
                if name != "unknown"
                else f"UNKNOWN  {det_score:.0%}")
        color = GREEN if name != "unknown" else AMBER
        (tw, th), _ = cv2.getTextSize(text, font, 0.42, 1)
        lx = bbox[0]
        ly = max(bbox[1] - 14, th + 12)
        pad = 6
        cv2.rectangle(overlay,
                      (lx - pad, ly - th - pad),
                      (lx + tw + pad, ly + pad), DARK, -1)
        label_meta.append((bbox, text, color, lx, ly, tw, th, pad))

    cv2.addWeighted(overlay, 0.72, frame, 0.28, 0, frame)

    # ── Pass 2: crisp elements on top ────────────────────

    _viewfinder(frame, h, w)

    x0 = 20
    cv2.putText(frame, "DESKOS", (x0, 34), font, 0.50, TEAL, 1, cv2.LINE_AA)
    cv2.putText(frame, "VISION", (x0 + 74, 34), font, 0.50, WHITE, 1, cv2.LINE_AA)
    cv2.line(frame, (x0, 42), (x0 + 125, 42), TEAL, 1)

    row = 64
    for label, value in [
        ("FPS", f"{fps:.0f}"),
        ("FACES", f"{len(faces_info)}"),
        ("ENROLLED", f"{enrolled_count}"),
    ]:
        cv2.putText(frame, label, (x0, row), font, 0.32, GRAY, 1, cv2.LINE_AA)
        cv2.putText(frame, value, (x0 + 82, row), font, 0.38, WHITE, 1, cv2.LINE_AA)
        row += 20

    has_match = any(n != "unknown" for _, n, _, _ in faces_info)
    if has_match:
        st_text, st_color = "TRACKING", GREEN
    elif faces_info:
        st_text, st_color = "DETECTING", AMBER
    else:
        st_text, st_color = "SCANNING", TEAL
    cv2.circle(frame, (x0 + 5, row + 4), 3, st_color, -1)
    cv2.putText(frame, st_text, (x0 + 14, row + 8), font, 0.32, st_color, 1, cv2.LINE_AA)

    now = datetime.now()
    cv2.putText(frame, now.strftime("%H:%M:%S"),
                (w - ts_w - 2, 34), font, 0.45, WHITE, 1, cv2.LINE_AA)
    cv2.putText(frame, now.strftime("%Y-%m-%d"),
                (w - ts_w - 2, 52), font, 0.32, GRAY, 1, cv2.LINE_AA)

    for bbox, text, color, lx, ly, tw, th, pad in label_meta:
        _corner_brackets(frame, bbox[0], bbox[1], bbox[2], bbox[3], color)
        cv2.rectangle(frame,
                      (lx - pad, ly - th - pad),
                      (lx + tw + pad, ly + pad), color, 1)
        cv2.putText(frame, text, (lx, ly), font, 0.42, color, 1, cv2.LINE_AA)

    if has_match:
        names = ", ".join(
            n.upper() for _, n, _, _ in faces_info if n != "unknown")
        bar_text, bar_color = f"IDENTIFIED:  {names}", GREEN
    elif faces_info:
        bar_text, bar_color = f"{len(faces_info)} FACE(S) DETECTED", AMBER
    else:
        bar_text, bar_color = "SCANNING...", GRAY
    cv2.putText(frame, bar_text, (14, h - 11), font, 0.40, bar_color, 1, cv2.LINE_AA)

    blink = tick % 50 < 25
    cv2.circle(frame, (w - 58, h - bar_h + 17), 4, RED if blink else DARK, -1)
    cv2.putText(frame, "REC", (w - 48, h - bar_h + 21),
                font, 0.30, RED if blink else GRAY, 1, cv2.LINE_AA)


# ── Main ─────────────────────────────────────────────────

def main():
    from insightface.app import FaceAnalysis

    cfg = load_config()

    print("Loading model...")
    app = FaceAnalysis(providers=cfg["detection"]["providers"])
    app.prepare(ctx_id=0, det_size=tuple(cfg["detection"]["det_size"]))

    recognizer = Recognizer(
        enrolled_dir=str(ROOT / cfg["recognition"]["enrolled_dir"]),
        threshold=cfg["recognition"]["threshold"],
    )

    cap = cv2.VideoCapture(cfg["camera"]["index"])
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, cfg["camera"]["width"])
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, cfg["camera"]["height"])

    if not cap.isOpened():
        print("ERROR: cannot open camera")
        return

    enrolled_count = len(recognizer.names)
    print(f"Ready  |  {enrolled_count} enrolled face(s)  |  press 'q' to quit\n")


    tracker = PresenceTracker(
        enter_frames=cfg["state_machine"]["enter_frames"],
        leave_frames=cfg["state_machine"]["leave_frames"],
    )

    prev = time.time()
    fps = 0.0
    tick = 0

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            faces = app.get(frame)

            faces_info = []
            seen = {}
            for face in faces:
                bbox = face.bbox.astype(int).tolist()
                det_score = float(face.det_score)
                if face.normed_embedding is not None:
                    name, score = recognizer.identify(face.normed_embedding)
                else:
                    name, score = "unknown", 0.0
                faces_info.append((bbox, name, det_score, score))
                if name != "unknown":
                    seen[name] = score

            events = tracker.update(seen)
            for etype, person, conf in events:
                print(f"  {'>>>' if etype == 'arrived' else '<<<'}  {etype.upper()}  {person}")
                announce(etype, person)
                try:
                    requests.post(
                        cfg["hub"]["url"] + cfg["hub"]["endpoint"],
                        json={
                            "eventType": etype,
                            "personName": person if etype == "arrived" else None,
                            "confidence": conf,
                        },
                        timeout=cfg["hub"]["timeout"],
                    )
                except requests.RequestException:
                    pass  # ignore network errors

            now = time.time()
            fps = 0.9 * fps + 0.1 / max(now - prev, 1e-6)
            prev = now

            draw_hud(frame, fps, faces_info, enrolled_count, tick)
            cv2.imshow("DeskOS Vision", frame)

            tick += 1
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
