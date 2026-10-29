from src.recognition.recognizer import Recognizer

try:
    r = Recognizer()
    # Fake a query: use kostas's own stored embedding as a sanity check
    query = r.embeddings[1]  # row 1 = kostas
    name, score = r.identify(query)
    print(f"\nquery = kostas's own embedding")
    print(f"  identified as: {name} (score={score:.4f})")

    # Try a random vector (should score low = unknown)
    import numpy as np
    random_query = np.random.randn(512)
    random_query = random_query / np.linalg.norm(random_query)  # normalize
    name, score = r.identify(random_query)
    print(f"\nquery = random unit vector")
    print(f"  identified as: {name} (score={score:.4f})")
except FileNotFoundError:
    print("set up the folder first")
except RuntimeError:
    print("folder exists but no enrollments")
