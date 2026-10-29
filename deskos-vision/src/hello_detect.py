import cv2
import time
from insightface.app import FaceAnalysis


print("loading model...")
app = FaceAnalysis(providers=["CPUExecutionProvider"])
app.prepare(ctx_id=0, det_size=(640, 640))
print("ready!")

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("ERROR: could not open camera")
    exit()

prev_time = time.time()

try:
    while True:
        ok, frame = cap.read()
        if not ok:
            print("ERROR: could not read frame")
            break

        faces = app.get(frame)

        for face in faces:
            x1, y1, x2, y2 = face.bbox.astype(int)
            score = face.det_score
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(frame, f"{score:.2f}", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        now = time.time()
        fps = 1.0 / (now - prev_time)
        prev_time = now
        cv2.putText(frame, f"FPS: {fps:.1f}  Faces: {len(faces)}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

        cv2.imshow("Face Detection", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
finally:
    cap.release()
    cv2.destroyAllWindows()