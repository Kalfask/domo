from pathlib import Path
import pickle
import numpy as np

class Recognizer:
    def __init__(self, enrolled_dir="enrolled", threshold=0.4):
        self.enrolled_dir = Path(enrolled_dir)
        self.threshold = threshold

        if not self.enrolled_dir.is_dir():
            raise FileNotFoundError(
                f"enrolled directory not found: {self.enrolled_dir}"
            )

        pkl_files = sorted(self.enrolled_dir.glob("*.pkl"))

        if not pkl_files:
              raise RuntimeError(
                f"no enrolled faces in {self.enrolled_dir} — run enroll.py first"
            )


        print(f"found {len(pkl_files)} enrolled faces from {self.enrolled_dir}...")

        for path in pkl_files:
            print(f"  {path.name}")

        self.names = []
        self.embeddings = []

        required_keys = {"name", "embedding", "num_samples", "enrolled_at"}

    
        for path in pkl_files:
            with open(path, "rb") as f:
                record = pickle.load(f)

            missing_keys = required_keys - record.keys()
            if missing_keys:
              raise ValueError(f"{path.name}: missing keys {missing_keys}")

            emb = record["embedding"]

            if emb.shape != (512,):
                raise ValueError(f"{path.name}: embedding has wrong shape {emb.shape}")

            
            norm = np.linalg.norm(emb)
            if not np.isclose(norm, 1.0):
                raise ValueError(f"{path.name}: embedding is not normalized (norm={norm})")
            
            self.names.append(record["name"])
            self.embeddings.append(emb)

        self.embeddings = np.stack(self.embeddings)


        print(f"\nloaded {len(self.names)} embeddings")
        print(f"names: {self.names}")
        print(f"embeddings matrix shape: {self.embeddings.shape}")



    def identify(self, embedding: np.ndarray) -> tuple[str, float]:
        similarities = self.embeddings @ embedding
        best_idx = np.argmax(similarities)
        best_score = float(similarities[best_idx])

        if best_score < self.threshold:
            return "unknown", best_score
        return self.names[best_idx], best_score