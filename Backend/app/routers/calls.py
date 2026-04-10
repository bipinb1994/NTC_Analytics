from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta

from app.database import get_db
from app.models import Call, Group, Worker

router = APIRouter()


@router.get("/daily-volume")
def get_daily_volume(days: int = 30, db: Session = Depends(get_db)):
    result = []
    for i in range(days - 1, -1, -1):
        day_start = (datetime.utcnow() - timedelta(days=i)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        day_end = day_start + timedelta(days=1)

        day_calls = (
            db.query(func.count(Call.id))
            .filter(
                Call.start_time >= day_start,
                Call.start_time < day_end,
                Call.shift == "day",
            )
            .scalar()
            or 0
        )
        night_calls = (
            db.query(func.count(Call.id))
            .filter(
                Call.start_time >= day_start,
                Call.start_time < day_end,
                Call.shift == "night",
            )
            .scalar()
            or 0
        )

        result.append(
            {
                "date": day_start.strftime("%b %d"),
                "day_calls": day_calls,
                "night_calls": night_calls,
            }
        )
    return result


@router.get("/by-group")
def get_calls_by_group(db: Session = Depends(get_db)):
    rows = (
        db.query(Group.name, Group.zone, func.count(Call.id).label("call_count"))
        .join(Call, Call.group_id == Group.id)
        .group_by(Group.id)
        .all()
    )
    return [
        {"group_name": r.name, "zone": r.zone, "call_count": r.call_count}
        for r in rows
    ]


@router.get("/by-type")
def get_calls_by_type(db: Session = Depends(get_db)):
    rows = (
        db.query(Call.call_type, func.count(Call.id).label("count"))
        .group_by(Call.call_type)
        .all()
    )
    labels = {"ptt": "Push-to-Talk", "one_to_one": "One-to-One", "group": "Group Call"}
    return [{"call_type": labels.get(r.call_type, r.call_type), "count": r.count} for r in rows]


@router.get("/top-communicators")
def get_top_communicators(db: Session = Depends(get_db)):
    rows = (
        db.query(
            Worker.name,
            Group.name.label("group_name"),
            func.count(Call.id).label("call_count"),
            func.sum(Call.duration_seconds).label("total_duration"),
        )
        .join(Call, Call.caller_id == Worker.id)
        .join(Group, Group.id == Worker.group_id)
        .group_by(Worker.id)
        .order_by(func.count(Call.id).desc())
        .limit(10)
        .all()
    )
    return [
        {
            "worker_name": r.name,
            "group_name": r.group_name,
            "call_count": r.call_count,
            "total_duration": r.total_duration or 0,
        }
        for r in rows
    ]
