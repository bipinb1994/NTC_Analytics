from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta

from app.database import get_db
from app.models import Call, BatteryEvent, Worker

router = APIRouter()


@router.get("/overview")
def get_overview(db: Session = Depends(get_db)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    since_30 = datetime.utcnow() - timedelta(days=30)
    since_7 = datetime.utcnow() - timedelta(days=7)

    total_calls_today = (
        db.query(func.count(Call.id))
        .filter(Call.start_time >= today_start, Call.start_time < today_end)
        .scalar()
        or 0
    )

    total_calls_30days = (
        db.query(func.count(Call.id))
        .filter(Call.start_time >= since_30)
        .scalar()
        or 0
    )

    avg_response_time = (
        db.query(func.avg(Call.response_time_seconds))
        .filter(Call.start_time >= since_7, Call.response_time_seconds.isnot(None))
        .scalar()
        or 0
    )

    # Latest battery per device using subquery
    sub = (
        db.query(
            BatteryEvent.device_id,
            func.max(BatteryEvent.timestamp).label("max_ts"),
        )
        .group_by(BatteryEvent.device_id)
        .subquery()
    )
    latest_levels = (
        db.query(BatteryEvent.battery_level)
        .join(
            sub,
            and_(
                BatteryEvent.device_id == sub.c.device_id,
                BatteryEvent.timestamp == sub.c.max_ts,
            ),
        )
        .all()
    )
    critical_battery_count = sum(1 for (lvl,) in latest_levels if lvl < 20)
    active_workers = db.query(func.count(Worker.id)).scalar() or 0

    return {
        "total_calls_today": total_calls_today,
        "total_calls_30days": total_calls_30days,
        "avg_response_time": round(float(avg_response_time), 1),
        "critical_battery_count": critical_battery_count,
        "active_workers": active_workers,
    }
