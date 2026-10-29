import cv2;
import time;
from insightface.app import FaceAnalysis

print("Creating FaceAnalysis object...")
app = FaceAnalysis(providers=["CPUExecutionProvider"])
print("Preparing FaceAnalysis object...")
app.prepare(ctx_id=0, det_size=(640, 640))
print("FaceAnalysis object prepared.")

t = time.time()
n= 0
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Cannot open camera")
    exit()

    
ok, frame = cap.read()
if not ok:
    print("Cannot read frame")
    exit()

print("Detecting faces...")
faces = app.get(frame)
print(f"Detected {len(faces)} face(s)")

for i, face in enumerate(faces):
    print(f"  face {i}: bbox={face.bbox}, score={face.det_score}")
cap.release()
cv2.destroyAllWindows()