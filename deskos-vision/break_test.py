import pickle
import numpy as np

bad = {
    "name": "unnorm",
    "embedding": np.ones(512) * 2,  # length ~45, not 1.0
    "num_samples": 10,
    "enrolled_at": "2026-01-01T00:00:00+00:00",
}
with open("enrolled/unnorm.pkl", "wb") as f:
    pickle.dump(bad, f)
print("wrote enrolled/unnorm.pkl (bad norm)")