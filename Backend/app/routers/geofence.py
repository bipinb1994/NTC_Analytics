from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.database import get_db
from app.models_extended import GeoFenceEvent, GeoFenceRule, Zone, LocationEvent
from app.models import Worker

router = APIRouter()


@router.get("/overview")
def get_geofence_overview(db: Session = Depends(get_db)):
    since_7d = datetime.utcnow() - timedelta(days=7)

    total_7d = (
        db.query(func.count(GeoFenceEvent.id))
        .filter(GeoFenceEvent.timestamp >= since_7d)
        .scalar() or 0
    )
    active_violations = (
        db.query(func.count(GeoFenceEvent.id))
        .filter(GeoFenceEvent.resolved == False)  # noqa
        .scalar() or 0
    )

    # Use most recent day that has data for "today" count
    max_ts = db.query(func.max(GeoFenceEvent.timestamp)).scalar()
    if max_ts:
        day_start = max_ts.replace(hour=0, minute=0, second=0, microsecond=0)
        alerts_today = (
            db.query(func.count(GeoFenceEvent.id))
            .filter(GeoFenceEvent.timestamp >= day_start)
            .scalar() or 0
        )
    else:
        alerts_today = 0

    # Compliance rate
    total_loc = db.query(func.count(LocationEvent.id)).scalar() or 1
    restricted_ids = [
        r[0] for r in db.query(Zone.id).filter(Zone.zone_type == "restricted").all()
    ]
    restricted_loc = (
        db.query(func.count(LocationEvent.id))
        .filter(LocationEvent.zone_id.in_(restricted_ids))
        .scalar() or 0
    ) if restricted_ids else 0

    compliance_rate = round(((total_loc - restricted_loc) / total_loc) * 100, 1)

    return {
        "alerts_today":       alerts_today,
        "active_violations":  active_violations,
        "total_events_7days": total_7d,
        "compliance_rate":    compliance_rate,
    }


@router.get("/events")
def get_geofence_events(db: Session = Depends(get_db)):
    rows = (
        db.query(
            Worker.name.label("worker_name"),
            Zone.name.label("zone_name"),
            GeoFenceRule.rule_type,
            GeoFenceRule.alert_level,
            GeoFenceEvent.event_type,
            GeoFenceEvent.timestamp,
            GeoFenceEvent.duration_seconds,
            GeoFenceEvent.resolved,
        )
        .join(Worker,       Worker.id       == GeoFenceEvent.worker_id)
        .join(Zone,         Zone.id         == GeoFenceEvent.zone_id)
        .join(GeoFenceRule, GeoFenceRule.id == GeoFenceEvent.rule_id)
        .order_by(GeoFenceEvent.timestamp.desc())
        .limit(25)
        .all()
    )

    return [
        {
            "worker_name":      r.worker_name,
            "zone_name":        r.zone_name,
            "rule_type":        r.rule_type,
            "alert_level":      r.alert_level,
            "event_type":       r.event_type,
            "timestamp":        r.timestamp.strftime("%b %d %H:%M"),
            "duration_seconds": r.duration_seconds,
            "resolved":         r.resolved,
        }
        for r in rows
    ]


@router.get("/by-zone")
def get_events_by_zone(db: Session = Depends(get_db)):
    since_7d = datetime.utcnow() - timedelta(days=7)

    rows = (
        db.query(
            Zone.name.label("zone_name"),
            GeoFenceRule.rule_type,
            GeoFenceRule.alert_level,
            func.count(GeoFenceEvent.id).label("alert_count"),
        )
        .join(Zone,         Zone.id         == GeoFenceEvent.zone_id)
        .join(GeoFenceRule, GeoFenceRule.id == GeoFenceEvent.rule_id)
        .filter(GeoFenceEvent.timestamp >= since_7d)
        .group_by(GeoFenceEvent.zone_id)
        .all()
    )

    return [
        {
            "zone_name":   r.zone_name,
            "rule_type":   r.rule_type,
            "alert_level": r.alert_level,
            "alert_count": r.alert_count,
        }
        for r in rows
    ]


@router.get("/compliance")
def get_worker_compliance(db: Session = Depends(get_db)):
    since_7d = datetime.utcnow() - timedelta(days=7)

    total_rows = (
        db.query(
            LocationEvent.worker_id,
            func.count(LocationEvent.id).label("total"),
        )
        .filter(LocationEvent.timestamp >= since_7d)
        .group_by(LocationEvent.worker_id)
        .all()
    )
    total_map = {r.worker_id: r.total for r in total_rows}

    restricted_zone_ids = [
        r[0] for r in db.query(Zone.id).filter(Zone.zone_type == "restricted").all()
    ]
    bad_map = {}
    if restricted_zone_ids:
        bad_rows = (
            db.query(
                LocationEvent.worker_id,
                func.count(LocationEvent.id).label("bad"),
            )
            .filter(
                LocationEvent.zone_id.in_(restricted_zone_ids),
                LocationEvent.timestamp >= since_7d,
            )
            .group_by(LocationEvent.worker_id)
            .all()
        )
        bad_map = {r.worker_id: r.bad for r in bad_rows}

    viol_rows = (
        db.query(
            GeoFenceEvent.worker_id,
            func.count(GeoFenceEvent.id).label("violations"),
        )
        .filter(GeoFenceEvent.timestamp >= since_7d)
        .group_by(GeoFenceEvent.worker_id)
        .all()
    )
    viol_map = {r.worker_id: r.violations for r in viol_rows}

    from app.models import Group
    workers = (
        db.query(Worker.id, Worker.name, Group.name.label("group_name"))
        .join(Group, Group.id == Worker.group_id)
        .all()
    )

    result = []
    for w in workers:
        total = total_map.get(w.id, 0)
        bad   = bad_map.get(w.id, 0)
        comp  = round(((total - bad) / total) * 100, 1) if total > 0 else 100.0
        result.append({
            "worker_name":     w.name,
            "group_name":      w.group_name,
            "compliance_pct":  comp,
            "violation_count": viol_map.get(w.id, 0),
        })

    return sorted(result, key=lambda x: x["compliance_pct"])
