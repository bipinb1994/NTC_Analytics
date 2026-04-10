from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from collections import defaultdict

from app.database import get_db
from app.models_extended import LocationEvent, Zone
from app.models import Worker

router = APIRouter()


@router.get("/current-occupancy")
def get_current_occupancy(db: Session = Depends(get_db)):
    # Step 1: latest timestamp per worker — pure LocationEvent, no joins
    sub = (
        db.query(
            LocationEvent.worker_id,
            func.max(LocationEvent.timestamp).label("max_ts"),
        )
        .group_by(LocationEvent.worker_id)
        .subquery()
    )

    # Step 2: get zone_id for each worker's latest event
    latest = (
        db.query(
            LocationEvent.worker_id,
            LocationEvent.zone_id,
        )
        .join(sub, and_(
            LocationEvent.worker_id == sub.c.worker_id,
            LocationEvent.timestamp == sub.c.max_ts,
        ))
        .all()
    )

    if not latest:
        return []

    # Step 3: look up names in Python — avoid chained join errors entirely
    worker_map = {w.id: w for w in db.query(Worker).all()}
    zone_map   = {z.id: z for z in db.query(Zone).all()}

    zones_result: dict = {}
    for row in latest:
        worker = worker_map.get(row.worker_id)
        zone   = zone_map.get(row.zone_id)
        if not worker or not zone:
            continue
        if zone.id not in zones_result:
            zones_result[zone.id] = {
                "zone_name": zone.name,
                "zone_type": zone.zone_type,
                "workers":   [],
            }
        zones_result[zone.id]["workers"].append({
            "name":      worker.name,
            "device_id": worker.device_id,
        })

    return [
        {
            "zone_name":    v["zone_name"],
            "zone_type":    v["zone_type"],
            "worker_count": len(v["workers"]),
            "workers":      v["workers"],
        }
        for v in zones_result.values()
    ]


@router.get("/occupancy-trend")
def get_occupancy_trend(db: Session = Depends(get_db)):
    since_7d  = datetime.utcnow() - timedelta(days=7)
    hour_expr = func.strftime("%H:00", LocationEvent.timestamp)

    rows = (
        db.query(
            hour_expr.label("hour"),
            LocationEvent.zone_id,
            func.count(func.distinct(LocationEvent.worker_id)).label("worker_count"),
        )
        .filter(LocationEvent.timestamp >= since_7d)
        .group_by(hour_expr, LocationEvent.zone_id)
        .order_by(hour_expr)
        .all()
    )

    zone_map = {z.id: z for z in db.query(Zone).all()}
    result = []
    for r in rows:
        zone = zone_map.get(r.zone_id)
        if not zone or zone.zone_type != "operational":
            continue
        result.append({
            "hour":         r.hour,
            "zone_name":    zone.name,
            "worker_count": r.worker_count,
        })
    return result


@router.get("/dwell-time")
def get_dwell_time(db: Session = Depends(get_db)):
    since_7d = datetime.utcnow() - timedelta(days=7)

    rows = (
        db.query(
            LocationEvent.worker_id,
            LocationEvent.zone_id,
            LocationEvent.timestamp,
        )
        .filter(LocationEvent.timestamp >= since_7d)
        .order_by(LocationEvent.worker_id, LocationEvent.timestamp)
        .all()
    )

    zone_map          = {z.id: z.name for z in db.query(Zone).all()}
    runs: defaultdict = defaultdict(list)
    prev_worker, prev_zone, run_len = None, None, 0

    for r in rows:
        if r.worker_id == prev_worker and r.zone_id == prev_zone:
            run_len += 1
        else:
            if prev_zone is not None and run_len > 0:
                runs[prev_zone].append(run_len)
            run_len     = 1
            prev_worker = r.worker_id
            prev_zone   = r.zone_id

    if prev_zone is not None and run_len > 0:
        runs[prev_zone].append(run_len)

    return sorted(
        [
            {
                "zone_name":         zone_map.get(zid, str(zid)),
                "avg_dwell_minutes": round((sum(lst) / len(lst)) * 60, 0),
                "total_visits":      len(lst),
            }
            for zid, lst in runs.items()
        ],
        key=lambda x: x["avg_dwell_minutes"],
        reverse=True,
    )


@router.get("/transitions")
def get_zone_transitions(db: Session = Depends(get_db)):
    since_7d = datetime.utcnow() - timedelta(days=7)

    rows = (
        db.query(
            LocationEvent.worker_id,
            LocationEvent.zone_id,
            LocationEvent.timestamp,
        )
        .filter(LocationEvent.timestamp >= since_7d)
        .order_by(LocationEvent.worker_id, LocationEvent.timestamp)
        .all()
    )

    zone_map                  = {z.id: z.name for z in db.query(Zone).all()}
    transitions: defaultdict  = defaultdict(int)
    prev_worker, prev_zone_id = None, None

    for r in rows:
        if r.worker_id == prev_worker and r.zone_id != prev_zone_id and prev_zone_id is not None:
            transitions[(prev_zone_id, r.zone_id)] += 1
        prev_worker  = r.worker_id
        prev_zone_id = r.zone_id

    return sorted(
        [
            {
                "from_zone": zone_map.get(k[0], str(k[0])),
                "to_zone":   zone_map.get(k[1], str(k[1])),
                "count":     v,
            }
            for k, v in transitions.items()
        ],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]


@router.get("/workers-list")
def get_workers_list(db: Session = Depends(get_db)):
    """All workers with their group for the worker selector."""
    from app.models import Group
    rows = (
        db.query(Worker.id, Worker.name, Worker.device_id, Group.name.label("group_name"))
        .join(Group, Group.id == Worker.group_id)
        .order_by(Group.name, Worker.name)
        .all()
    )
    return [{"id": r.id, "name": r.name, "device_id": r.device_id, "group_name": r.group_name} for r in rows]


@router.get("/movement-trail/{worker_id}")
def get_movement_trail(worker_id: int, hours: int = 12, db: Session = Depends(get_db)):
    """Last N hourly zone events for a worker — used to draw trail on map."""
    rows = (
        db.query(LocationEvent.zone_id, LocationEvent.timestamp)
        .filter(LocationEvent.worker_id == worker_id)
        .order_by(LocationEvent.timestamp.desc())
        .limit(hours)
        .all()
    )
    zone_map = {z.id: z.name for z in db.query(Zone).all()}
    # Reverse so oldest → newest
    trail = list(reversed([
        {"zone_name": zone_map.get(r.zone_id, ""), "timestamp": r.timestamp.strftime("%b %d %H:%M")}
        for r in rows
    ]))
    return trail


@router.get("/dwell-anomalies")
def get_dwell_anomalies(threshold_hours: float = 3.0, db: Session = Depends(get_db)):
    """
    Workers with consecutive run of same-zone events >= threshold_hours.
    Returns the top anomalies sorted by dwell length descending.
    """
    since_7d = datetime.utcnow() - timedelta(days=7)
    rows = (
        db.query(LocationEvent.worker_id, LocationEvent.zone_id, LocationEvent.timestamp)
        .filter(LocationEvent.timestamp >= since_7d)
        .order_by(LocationEvent.worker_id, LocationEvent.timestamp)
        .all()
    )

    worker_map = {w.id: w.name for w in db.query(Worker).all()}
    zone_map   = {z.id: (z.name, z.zone_type) for z in db.query(Zone).all()}

    anomalies = []
    prev_worker, prev_zone, run_len, run_start = None, None, 0, None

    def flush(worker_id, zone_id, run_len, run_start):
        if run_len >= threshold_hours:
            zname, ztype = zone_map.get(zone_id, ("?", "operational"))
            anomalies.append({
                "worker_name":   worker_map.get(worker_id, "?"),
                "zone_name":     zname,
                "zone_type":     ztype,
                "dwell_hours":   round(run_len, 1),
                "since":         run_start.strftime("%b %d %H:%M") if run_start else "",
                "is_restricted": ztype == "restricted",
            })

    for r in rows:
        if r.worker_id == prev_worker and r.zone_id == prev_zone:
            run_len += 1
        else:
            if prev_zone is not None:
                flush(prev_worker, prev_zone, run_len, run_start)
            run_len    = 1
            run_start  = r.timestamp
            prev_worker = r.worker_id
            prev_zone   = r.zone_id

    if prev_zone is not None:
        flush(prev_worker, prev_zone, run_len, run_start)

    return sorted(anomalies, key=lambda x: x["dwell_hours"], reverse=True)[:12]


@router.get("/worker-journey/{worker_id}")
def get_worker_journey(worker_id: int, db: Session = Depends(get_db)):
    """
    Full journey card for a worker:
    current zone, recent 24h path, zone dwell summary, breach count, compliance %.
    """
    from app.models import Group
    from app.models_extended import GeoFenceEvent

    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        return {"error": "Worker not found"}

    group = db.query(Group).filter(Group.id == worker.group_id).first()
    zone_map = {z.id: z for z in db.query(Zone).all()}

    # Current zone (latest event)
    latest_loc = (
        db.query(LocationEvent)
        .filter(LocationEvent.worker_id == worker_id)
        .order_by(LocationEvent.timestamp.desc())
        .first()
    )
    current_zone = zone_map.get(latest_loc.zone_id).name if latest_loc else "Unknown"
    current_zone_type = zone_map.get(latest_loc.zone_id).zone_type if latest_loc else "operational"

    # Recent 24h path (last 24 hourly events, deduplicate consecutive same zone)
    path_rows = (
        db.query(LocationEvent.zone_id, LocationEvent.timestamp)
        .filter(LocationEvent.worker_id == worker_id)
        .order_by(LocationEvent.timestamp.desc())
        .limit(24)
        .all()
    )
    raw_path = list(reversed(path_rows))
    path = []
    for r in raw_path:
        z = zone_map.get(r.zone_id)
        entry = {"zone_name": z.name if z else "?", "zone_type": z.zone_type if z else "operational",
                 "timestamp": r.timestamp.strftime("%H:%M")}
        if not path or path[-1]["zone_name"] != entry["zone_name"]:
            path.append(entry)

    # Dwell per zone in last 7 days
    since_7d = datetime.utcnow() - timedelta(days=7)
    all_locs = (
        db.query(LocationEvent.zone_id, LocationEvent.timestamp)
        .filter(LocationEvent.worker_id == worker_id, LocationEvent.timestamp >= since_7d)
        .order_by(LocationEvent.timestamp)
        .all()
    )
    zone_counts: defaultdict = defaultdict(int)
    for r in all_locs:
        zone_counts[r.zone_id] += 1
    dwell_summary = sorted(
        [{"zone_name": zone_map[zid].name, "hours": cnt} for zid, cnt in zone_counts.items() if zid in zone_map],
        key=lambda x: x["hours"], reverse=True
    )

    # Breaches
    breach_count = db.query(func.count(GeoFenceEvent.id)).filter(GeoFenceEvent.worker_id == worker_id).scalar() or 0
    open_breaches = db.query(func.count(GeoFenceEvent.id)).filter(
        GeoFenceEvent.worker_id == worker_id, GeoFenceEvent.resolved == False  # noqa
    ).scalar() or 0

    # Compliance
    total_locs = db.query(func.count(LocationEvent.id)).filter(LocationEvent.worker_id == worker_id).scalar() or 1
    restricted_ids = [z.id for z in zone_map.values() if z.zone_type == "restricted"]
    bad_locs = db.query(func.count(LocationEvent.id)).filter(
        LocationEvent.worker_id == worker_id,
        LocationEvent.zone_id.in_(restricted_ids)
    ).scalar() or 0 if restricted_ids else 0
    compliance_pct = round(((total_locs - bad_locs) / total_locs) * 100, 1)

    return {
        "worker_id":        worker.id,
        "worker_name":      worker.name,
        "device_id":        worker.device_id,
        "role":             worker.role,
        "group_name":       group.name if group else "",
        "current_zone":     current_zone,
        "current_zone_type": current_zone_type,
        "recent_path":      path,
        "dwell_summary":    dwell_summary,
        "breach_count":     breach_count,
        "open_breaches":    open_breaches,
        "compliance_pct":   compliance_pct,
    }
