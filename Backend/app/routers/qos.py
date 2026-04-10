from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.database import get_db
from app.models_extended import QoSEvent, Zone

router = APIRouter()


@router.get("/overview")
def get_qos_overview(db: Session = Depends(get_db)):
    since_7d = datetime.utcnow() - timedelta(days=7)

    fleet_score = (
        db.query(func.avg(QoSEvent.qos_score))
        .filter(QoSEvent.timestamp >= since_7d)
        .scalar() or 0
    )
    avg_latency = (
        db.query(func.avg(QoSEvent.latency_ms))
        .filter(QoSEvent.timestamp >= since_7d)
        .scalar() or 0
    )
    avg_packet_loss = (
        db.query(func.avg(QoSEvent.packet_loss_pct))
        .filter(QoSEvent.timestamp >= since_7d)
        .scalar() or 0
    )
    devices_below = (
        db.query(func.count(QoSEvent.id))
        .filter(QoSEvent.timestamp >= since_7d, QoSEvent.qos_score < 50)
        .scalar() or 0
    )

    priority_rows = (
        db.query(QoSEvent.priority_level, func.count(QoSEvent.id).label("cnt"))
        .filter(QoSEvent.timestamp >= since_7d)
        .group_by(QoSEvent.priority_level)
        .all()
    )
    labels = {1: "Emergency", 2: "High", 3: "Normal", 4: "Background"}
    priority_dist = [
        {
            "priority_level": r.priority_level,
            "label": labels.get(r.priority_level, str(r.priority_level)),
            "count": r.cnt,
        }
        for r in sorted(priority_rows, key=lambda x: x.priority_level)
    ]

    return {
        "fleet_qos_score":         round(float(fleet_score), 1),
        "avg_latency_ms":          round(float(avg_latency), 1),
        "avg_packet_loss_pct":     round(float(avg_packet_loss), 2),
        "devices_below_threshold": devices_below,
        "priority_distribution":   priority_dist,
    }


@router.get("/latency-trend")
def get_latency_trend(db: Session = Depends(get_db)):
    """
    Hourly avg latency per zone over the full 7-day seed window.
    Groups by hour-of-day (0–23) so data always exists.
    """
    since_7d  = datetime.utcnow() - timedelta(days=7)
    hour_expr = func.strftime("%H:00", QoSEvent.timestamp)

    rows = (
        db.query(
            hour_expr.label("hour"),
            Zone.name.label("zone_name"),
            func.avg(QoSEvent.latency_ms).label("avg_latency"),
        )
        .join(Zone, Zone.id == QoSEvent.zone_id)
        .filter(QoSEvent.timestamp >= since_7d)
        .group_by(hour_expr, QoSEvent.zone_id)
        .order_by(hour_expr)
        .all()
    )

    return [
        {
            "hour":        r.hour,
            "zone_name":   r.zone_name,
            "avg_latency": round(float(r.avg_latency), 1),
        }
        for r in rows
    ]


@router.get("/by-zone")
def get_qos_by_zone(db: Session = Depends(get_db)):
    since_7d = datetime.utcnow() - timedelta(days=7)

    rows = (
        db.query(
            Zone.name.label("zone_name"),
            Zone.zone_type,
            func.avg(QoSEvent.latency_ms).label("avg_latency"),
            func.avg(QoSEvent.packet_loss_pct).label("avg_packet_loss"),
            func.avg(QoSEvent.qos_score).label("avg_qos_score"),
            func.avg(QoSEvent.bandwidth_kbps).label("avg_bandwidth"),
        )
        .join(Zone, Zone.id == QoSEvent.zone_id)
        .filter(QoSEvent.timestamp >= since_7d)
        .group_by(QoSEvent.zone_id)
        .all()
    )

    return [
        {
            "zone_name":       r.zone_name,
            "zone_type":       r.zone_type,
            "avg_latency":     round(float(r.avg_latency), 1),
            "avg_packet_loss": round(float(r.avg_packet_loss), 2),
            "avg_qos_score":   round(float(r.avg_qos_score), 1),
            "avg_bandwidth":   round(float(r.avg_bandwidth), 0),
        }
        for r in rows
    ]


@router.get("/degradation-events")
def get_degradation_events(db: Session = Depends(get_db)):
    from app.models import Worker
    since_7d = datetime.utcnow() - timedelta(days=7)

    rows = (
        db.query(
            Worker.name.label("worker_name"),
            QoSEvent.device_id,
            Zone.name.label("zone_name"),
            QoSEvent.timestamp,
            QoSEvent.qos_score,
            QoSEvent.latency_ms,
            QoSEvent.packet_loss_pct,
        )
        .join(Worker, Worker.id == QoSEvent.worker_id)
        .join(Zone, Zone.id == QoSEvent.zone_id)
        .filter(QoSEvent.timestamp >= since_7d, QoSEvent.qos_score < 45)
        .order_by(QoSEvent.qos_score.asc())
        .limit(15)
        .all()
    )

    return [
        {
            "worker_name":     r.worker_name,
            "device_id":       r.device_id,
            "zone_name":       r.zone_name,
            "timestamp":       r.timestamp.strftime("%b %d %H:%M"),
            "qos_score":       round(float(r.qos_score), 1),
            "latency_ms":      round(float(r.latency_ms), 1),
            "packet_loss_pct": round(float(r.packet_loss_pct), 1),
        }
        for r in rows
    ]
