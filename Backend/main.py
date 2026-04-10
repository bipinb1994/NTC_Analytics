from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app import models
from app import models_extended  # noqa — registers Zone/QoS/Location/GeoFence tables on shared Base
from app.routers import calls, battery, response_time, stats
from app.routers import qos, location, geofence

# Create all tables on startup
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="NTC Analytics API",
    description="Nokia Team Comms — Operations Intelligence Backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(calls.router, prefix="/api/calls", tags=["Calls"])
app.include_router(battery.router, prefix="/api/battery", tags=["Battery"])
app.include_router(response_time.router, prefix="/api/response-time", tags=["Response Time"])
app.include_router(stats.router, prefix="/api/stats", tags=["Stats"])
app.include_router(qos.router, prefix="/api/qos", tags=["QoS"])
app.include_router(location.router, prefix="/api/location", tags=["Location"])
app.include_router(geofence.router, prefix="/api/geofence", tags=["GeoFence"])


@app.get("/")
def root():
    return {"status": "ok", "message": "NTC Analytics API is running. Visit /docs for API reference."}
