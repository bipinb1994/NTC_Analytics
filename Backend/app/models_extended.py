"""
Extended models for QoS, Location, and GeoFence analytics.
Uses the same Base as models.py — tables auto-created alongside existing ones.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from .database import Base


class Zone(Base):
    __tablename__ = "zones"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, unique=True, nullable=False)
    zone_type    = Column(String, nullable=False)   # "operational" | "restricted"
    center_lat   = Column(Float, nullable=False)
    center_lng   = Column(Float, nullable=False)
    radius_meters = Column(Float, nullable=False)


class LocationEvent(Base):
    __tablename__ = "location_events"

    id        = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False)
    zone_id   = Column(Integer, ForeignKey("zones.id"), nullable=False)
    lat       = Column(Float, nullable=False)
    lng       = Column(Float, nullable=False)
    timestamp = Column(DateTime, nullable=False)


class QoSEvent(Base):
    __tablename__ = "qos_events"

    id               = Column(Integer, primary_key=True, index=True)
    worker_id        = Column(Integer, ForeignKey("workers.id"), nullable=False)
    device_id        = Column(String, nullable=False)
    zone_id          = Column(Integer, ForeignKey("zones.id"), nullable=True)
    timestamp        = Column(DateTime, nullable=False)
    priority_level   = Column(Integer, nullable=False)   # 1=emergency 2=high 3=normal 4=background
    latency_ms       = Column(Float, nullable=False)
    packet_loss_pct  = Column(Float, nullable=False)
    bandwidth_kbps   = Column(Float, nullable=False)
    qos_score        = Column(Float, nullable=False)     # 0–100 composite


class GeoFenceRule(Base):
    __tablename__ = "geofence_rules"

    id                 = Column(Integer, primary_key=True, index=True)
    zone_id            = Column(Integer, ForeignKey("zones.id"), nullable=False)
    rule_type          = Column(String, nullable=False)   # "no_entry" | "time_limit"
    max_dwell_minutes  = Column(Integer, nullable=True)
    alert_level        = Column(String, nullable=False)   # "warning" | "critical"


class GeoFenceEvent(Base):
    __tablename__ = "geofence_events"

    id               = Column(Integer, primary_key=True, index=True)
    worker_id        = Column(Integer, ForeignKey("workers.id"), nullable=False)
    zone_id          = Column(Integer, ForeignKey("zones.id"), nullable=False)
    rule_id          = Column(Integer, ForeignKey("geofence_rules.id"), nullable=False)
    event_type       = Column(String, nullable=False)   # "unauthorized_entry" | "dwell_exceeded"
    timestamp        = Column(DateTime, nullable=False)
    duration_seconds = Column(Integer, nullable=True)
    resolved         = Column(Boolean, default=False, nullable=False)
