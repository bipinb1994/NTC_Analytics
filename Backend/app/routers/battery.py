from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta

from app.database import get_db
from app.models import BatteryEvent, Worker, Group

router = APIRouter()


@router.get("/current")
def get_current_battery(db: Session = Depends(get_db)):
    sub = (
        db.query(
            BatteryEvent.device_id,
            func.max(BatteryEvent.timestamp).label("max_ts"),
        )
        .group_by(BatteryEvent.device_id)
        .subquery()
    )

    rows = (
        db.query(
            BatteryEvent.device_id,
            BatteryEvent.battery_level,
            Worker.name.label("worker_name"),
            Group.name.label("group_name"),
        )
        .join(
            sub,
            and_(
                BatteryEvent.device_id == sub.c.device_id,
                BatteryEvent.timestamp == sub.c.max_ts,
            ),
        )
        .join(Worker, Worker.id == BatteryEvent.worker_id)
        .join(Group, Group.id == Worker.group_id)
        .all()
    )

    result = []
    for r in rows:
        status = (
            "critical"
            if r.battery_level < 20
            else "low"
            if r.battery_level < 40
            else "normal"
        )
        result.append(
            {
                "worker_name": r.worker_name,
                "device_id": r.device_id,
                "battery_level": round(r.battery_level, 1),
                "status": status,
                "group": r.group_name,
            }
        )

    return sorted(result, key=lambda x: x["battery_level"])


@router.get("/trend")
def get_battery_trend(days: int = 7, db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=days)

    date_expr = func.strftime("%Y-%m-%d", BatteryEvent.timestamp)

    rows = (
        db.query(date_expr.label("date"), func.avg(BatteryEvent.battery_level).label("avg_battery"))
        .filter(BatteryEvent.timestamp >= since)
        .group_by(date_expr)
        .order_by(date_expr)
        .all()
    )

    return [{"date": r.date, "avg_battery": round(r.avg_battery, 1)} for r in rows]
