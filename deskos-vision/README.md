# DeskOS Vision Worker

Python service that detects and recognizes faces via webcam, debounces presence events, and POSTs them to the DeskOS Spring Boot hub.

## Prerequisites

- Python 3.11 or 3.12
- DeskOS Hub running on `localhost:8080`

## Setup

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
copy config.example.yaml config.yaml
```

## Run

```powershell
python main.py
```
