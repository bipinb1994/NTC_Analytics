# NTC Analytics — Backend

> Operations Intelligence API for Nokia Team Comms (NTC)  
> Built on FastAPI · SQLite (POC) → PostgreSQL (Production) · Nokia MXIE Edge

---

## What This Is

This is the backend service for the NTC Analytics dashboard — an analytics intelligence layer that sits on top of Nokia Team Comms and surfaces PTT call performance, device health, location intelligence, geo-fence compliance, and dynamic QoS data to operations managers.

It runs fully on-premise on Nokia MXIE edge hardware. No data leaves the customer's site.

---

## Prerequisites
- Python 3.9 or higher

No Docker, no database server, no external services required for the POC. SQLite is bundled with Python.

---

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Seed the database with synthetic data (run once)
python seed_data.py

# 3. Start the API server
python -m uvicorn main:app --reload --port 8000
```

- API is live at: **http://localhost:8000**
- Interactive API docs (Swagger UI): **http://localhost:8000/docs**
---

## Resetting the Database

```bash
# Windows
del ntc_analytics.db

# Mac / Linux
rm ntc_analytics.db

# Re-seed
python seed_data.py
```

---
