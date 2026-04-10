from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    zone = Column(String, nullable=False)

    workers = relationship("Worker", back_populates="group")
    calls = relationship("Call", back_populates="group")


class Worker(Base):
    __tablename__ = "workers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    device_id = Column(String, unique=True, nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"))

    group = relationship("Group", back_populates="workers")
    calls = relationship("Call", back_populates="caller")
    battery_events = relationship("BatteryEvent", back_populates="worker")


class Call(Base):
    __tablename__ = "calls"

    id = Column(Integer, primary_key=True, index=True)
    caller_id = Column(Integer, ForeignKey("workers.id"))
    group_id = Column(Integer, ForeignKey("groups.id"))
    start_time = Column(DateTime, nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    call_type = Column(String, nullable=False)   # "ptt" | "one_to_one" | "group"
    shift = Column(String, nullable=False)        # "day" | "night"
    response_time_seconds = Column(Float, nullable=True)

    caller = relationship("Worker", back_populates="calls")
    group = relationship("Group", back_populates="calls")


class BatteryEvent(Base):
    __tablename__ = "battery_events"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"))
    device_id = Column(String, nullable=False)
    battery_level = Column(Float, nullable=False)  # 0-100
    timestamp = Column(DateTime, nullable=False)

    worker = relationship("Worker", back_populates="battery_events")
