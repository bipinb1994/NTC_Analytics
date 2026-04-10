from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta

from app.database import get_db
from app.models import Call, Group

router = APIRouter()


@router.get("/trend")
def get_response_time_trend(days: int = 14, db: Session = Depends(get_db)):
    result = []
    for i in range(days - 1, -1, -1):
        day_start = (datetime.utcnow() - timedelta(days=i)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        day_end = day_start + timedelta(days=1)

        avg_rt = (
            db.query(func.avg(Call.response_time_seconds))
            .filter(
                Call.start_time >= day_start,
                Call.start_time < day_end,
                Call.response_time_seconds.isnot(None),
            )
            .scalar()
            or 0
        )

        result.append(
            {
                "date": day_start.strftime("%b %d"),
                "avg_response_time": round(float(avg_rt), 1),
            }
        )
    return result


@router.get("/by-group")
def get_response_time_by_group(db: Session = Depends(get_db)):
    rows = (
        db.query(
            Group.name,
            func.avg(Call.response_time_seconds).label("avg_rt"),
            func.min(Call.response_time_seconds).label("min_rt"),
            func.max(Call.response_time_seconds).label("max_rt"),
        )
        .join(Call, Call.group_id == Group.id)
        .filter(Call.response_time_seconds.isnot(None))
        .group_by(Group.id)
        .all()
    )

    return [
        {
            "group_name": r.name,
            "avg_response_time": round(float(r.avg_rt), 1),
            "min_response_time": round(float(r.min_rt), 1),
            "max_response_time": round(float(r.max_rt), 1),
        }
        for r in rows
    ]
