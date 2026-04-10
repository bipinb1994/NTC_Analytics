"""
Single seed file — run once to populate ALL tables.
Usage: python seed_data.py

Populates:
  - Groups, Workers, Calls, BatteryEvents  (original)
  - Zones, LocationEvents, QoSEvents, GeoFenceRules, GeoFenceEvents  (extended)
"""
import random
import math
from datetime import datetime, timedelta
from faker import Faker

from app.database import engine, SessionLocal
from app.models import Base, Group, Worker, Call, BatteryEvent
from app.models_extended import Zone, LocationEvent, QoSEvent, GeoFenceRule, GeoFenceEvent

fake = Faker()
random.seed(42)

# ── Campus zone definitions ────────────────────────────────────────────────────
ZONE_DEFS = [
    {"name": "Loading Bay Alpha",      "zone_type": "operational", "center_lat": 13.0830, "center_lng": 80.2710, "radius_meters": 150},
    {"name": "Processing Plant Beta",  "zone_type": "operational", "center_lat": 13.0820, "center_lng": 80.2725, "radius_meters": 200},
    {"name": "Control Room Gamma",     "zone_type": "operational", "center_lat": 13.0845, "center_lng": 80.2700, "radius_meters": 100},
    {"name": "Maintenance Shaft Delta","zone_type": "restricted",  "center_lat": 13.0815, "center_lng": 80.2715, "radius_meters": 50},
]

ZONE_QOS = {
    "Loading Bay Alpha":       {"base_latency": 38,  "base_loss": 1.0, "base_bw": 1200},
    "Processing Plant Beta":   {"base_latency": 58,  "base_loss": 2.5, "base_bw": 900},
    "Control Room Gamma":      {"base_latency": 22,  "base_loss": 0.4, "base_bw": 1800},
    "Maintenance Shaft Delta": {"base_latency": 95,  "base_loss": 8.0, "base_bw": 400},
}

WORKER_HOME_ZONE = {
    "Loading Bay Alpha":     "Loading Bay Alpha",
    "Processing Plant Beta": "Processing Plant Beta",
    "Control Room Gamma":    "Control Room Gamma",
}


def rand_coord_near(center_lat, center_lng, radius_m):
    r     = radius_m * math.sqrt(random.random())
    theta = random.uniform(0, 2 * math.pi)
    dlat  = (r * math.cos(theta)) / 111_320
    dlng  = (r * math.sin(theta)) / (111_320 * math.cos(math.radians(center_lat)))
    return round(center_lat + dlat, 6), round(center_lng + dlng, 6)


def calc_qos_score(latency_ms, packet_loss_pct):
    return max(0.0, min(100.0, 100 - (latency_ms / 2.5) - (packet_loss_pct * 5)))


def seed():
    # Create ALL tables — both models.py and models_extended.py share the same Base
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(Group).count() > 0:
        print("Database already seeded.")
        print("Delete ntc_analytics.db and re-run to reset.")
        db.close()
        return

    print("Seeding database — takes about 15 seconds...")

    # ── 1. GROUPS ──────────────────────────────────────────────────────────────
    groups_data = [
        {"name": "Loading Bay Alpha",     "zone": "Zone A"},
        {"name": "Processing Plant Beta", "zone": "Zone B"},
        {"name": "Control Room Gamma",    "zone": "Zone C"},
    ]
    groups = []
    for gd in groups_data:
        g = Group(**gd)
        db.add(g)
        groups.append(g)
    db.commit()
    for g in groups:
        db.refresh(g)
    print(f"  groups: {len(groups)}")

    # ── 2. WORKERS ─────────────────────────────────────────────────────────────
    INDIAN_NAMES = [
        "Arjun Sharma", "Priya Nair", "Rahul Verma", "Divya Menon",
        "Vikram Iyer", "Ananya Pillai", "Suresh Patel", "Kavitha Reddy",
        "Rohan Mehta", "Deepa Krishnan", "Aditya Singh", "Meera Bose",
    ]
    roles = ["Field Operator", "Safety Officer", "Supervisor", "Maintenance Tech", "Logistics Coordinator"]
    workers = []
    dev_counter = 1
    name_idx = 0
    for group in groups:
        for _ in range(4):
            w = Worker(
                name=INDIAN_NAMES[name_idx % len(INDIAN_NAMES)],
                role=random.choice(roles),
                device_id=f"DEV-{dev_counter:03d}",
                group_id=group.id,
            )
            db.add(w)
            workers.append(w)
            dev_counter += 1
            name_idx += 1
    db.commit()
    for w in workers:
        db.refresh(w)
    print(f"  workers: {len(workers)}")

    # ── 3. CALLS (30 days) ─────────────────────────────────────────────────────
    call_types = ["ptt", "one_to_one", "group"]
    now = datetime.utcnow()
    total_calls = 0
    for day_offset in range(30):
        base_day = now - timedelta(days=day_offset)
        for _ in range(random.randint(25, 40)):
            h = random.randint(6, 17)
            t = base_day.replace(hour=h, minute=random.randint(0,59), second=random.randint(0,59), microsecond=0)
            db.add(Call(
                caller_id=random.choice(workers).id,
                group_id=random.choice(groups).id,
                start_time=t,
                duration_seconds=random.randint(5, 180),
                call_type=random.choice(call_types),
                shift="day",
                response_time_seconds=round(random.uniform(2, 85), 1),
            ))
            total_calls += 1
        night_hours = list(range(18, 24)) + list(range(0, 6))
        for _ in range(random.randint(10, 20)):
            h = random.choice(night_hours)
            t = base_day.replace(hour=h, minute=random.randint(0,59), second=random.randint(0,59), microsecond=0)
            db.add(Call(
                caller_id=random.choice(workers).id,
                group_id=random.choice(groups).id,
                start_time=t,
                duration_seconds=random.randint(5, 120),
                call_type=random.choice(call_types),
                shift="night",
                response_time_seconds=round(random.uniform(5, 120), 1),
            ))
            total_calls += 1
    db.commit()
    print(f"  calls: {total_calls}")

    # ── 4. BATTERY EVENTS (7 days, every 30 min per device) ───────────────────
    bat_start = now - timedelta(days=7)
    bat_steps = 7 * 24 * 2
    total_battery = 0
    for worker in workers:
        level = random.uniform(75, 100)
        for step in range(bat_steps):
            ts   = bat_start + timedelta(minutes=30 * step)
            hour = ts.hour
            if 6 <= hour <= 18:
                level -= random.uniform(0.3, 1.8)
            else:
                if level < 20:
                    level = random.uniform(80, 100)
                else:
                    level -= random.uniform(0, 0.4)
            level = max(5.0, min(100.0, level))
            db.add(BatteryEvent(
                worker_id=worker.id,
                device_id=worker.device_id,
                battery_level=round(level, 1),
                timestamp=ts,
            ))
            total_battery += 1
        db.commit()
    print(f"  battery events: {total_battery}")

    # ── 5. ZONES ───────────────────────────────────────────────────────────────
    zone_objs = {}
    for zd in ZONE_DEFS:
        z = Zone(**zd)
        db.add(z)
        zone_objs[zd["name"]] = z
    db.commit()
    for z in zone_objs.values():
        db.refresh(z)
    print(f"  zones: {len(zone_objs)}")

    # ── 6. GEOFENCE RULES ──────────────────────────────────────────────────────
    rule_no_entry = GeoFenceRule(
        zone_id=zone_objs["Maintenance Shaft Delta"].id,
        rule_type="no_entry",
        max_dwell_minutes=None,
        alert_level="critical",
    )
    rule_time_limit = GeoFenceRule(
        zone_id=zone_objs["Processing Plant Beta"].id,
        rule_type="time_limit",
        max_dwell_minutes=30,
        alert_level="warning",
    )
    db.add(rule_no_entry)
    db.add(rule_time_limit)
    db.commit()
    db.refresh(rule_no_entry)
    db.refresh(rule_time_limit)
    print("  geofence rules: 2")

    # ── 7. LOCATION + QOS + GEOFENCE EVENTS (7 days, hourly) ──────────────────
    restricted_zone = zone_objs["Maintenance Shaft Delta"]
    op_zone_names   = [n for n in zone_objs if zone_objs[n].zone_type == "operational"]
    group_map       = {g.id: g.name for g in groups}

    worker_home = {}
    for w in workers:
        home_name = WORKER_HOME_ZONE.get(group_map[w.group_id], "Control Room Gamma")
        worker_home[w.id] = zone_objs[home_name]

    random.seed(99)
    ext_start    = now - timedelta(days=7)
    ext_steps    = 7 * 24
    plant_dwell: dict = {}
    loc_buf, qos_buf, fence_buf = [], [], []
    total_loc = total_qos = 0

    for step in range(ext_steps):
        ts       = ext_start + timedelta(hours=step)
        hour     = ts.hour
        is_shift = 6 <= hour <= 17

        for w in workers:
            home_zone = worker_home[w.id]
            roll      = random.random()

            if is_shift:
                if roll < 0.72:
                    chosen_zone = home_zone
                elif roll < 0.90:
                    others = [zone_objs[n] for n in op_zone_names if zone_objs[n].id != home_zone.id]
                    chosen_zone = random.choice(others)
                else:
                    chosen_zone = restricted_zone
            else:
                if roll < 0.88:
                    chosen_zone = home_zone
                elif roll < 0.97:
                    others = [zone_objs[n] for n in op_zone_names if zone_objs[n].id != home_zone.id]
                    chosen_zone = random.choice(others)
                else:
                    chosen_zone = restricted_zone

            # Location event
            lat, lng = rand_coord_near(chosen_zone.center_lat, chosen_zone.center_lng, chosen_zone.radius_meters)
            loc_buf.append(LocationEvent(
                worker_id=w.id, zone_id=chosen_zone.id,
                lat=lat, lng=lng, timestamp=ts,
            ))
            total_loc += 1

            # GeoFence events
            if chosen_zone.id == restricted_zone.id:
                fence_buf.append(GeoFenceEvent(
                    worker_id=w.id, zone_id=restricted_zone.id, rule_id=rule_no_entry.id,
                    event_type="unauthorized_entry", timestamp=ts,
                    duration_seconds=random.randint(120, 1800),
                    resolved=random.random() < 0.6,
                ))
                plant_dwell[w.id] = 0
            else:
                plant_id = zone_objs["Processing Plant Beta"].id
                if chosen_zone.id == plant_id:
                    plant_dwell[w.id] = plant_dwell.get(w.id, 0) + 1
                    if plant_dwell[w.id] == 2:
                        fence_buf.append(GeoFenceEvent(
                            worker_id=w.id, zone_id=plant_id, rule_id=rule_time_limit.id,
                            event_type="dwell_exceeded", timestamp=ts,
                            duration_seconds=plant_dwell[w.id] * 3600,
                            resolved=random.random() < 0.7,
                        ))
                else:
                    plant_dwell[w.id] = 0

            # QoS event
            qos_cfg   = ZONE_QOS[chosen_zone.name]
            night_pen = 12 if not is_shift else 0
            peak_pen  = 8  if hour in (8, 9, 14, 15, 16) else 0
            latency   = max(10, qos_cfg["base_latency"] + night_pen + peak_pen + random.uniform(-15, 20))
            pkt_loss  = max(0,  qos_cfg["base_loss"] + random.uniform(-0.5, 2.0))
            bandwidth = max(100, qos_cfg["base_bw"] + random.uniform(-200, 300))
            priority  = (1 if random.random() < 0.02
                         else 2 if random.random() < 0.08
                         else 4 if not is_shift else 3)
            if priority == 1:
                latency  = min(latency, 45)
                pkt_loss = min(pkt_loss, 0.5)
            score = calc_qos_score(latency, pkt_loss)

            qos_buf.append(QoSEvent(
                worker_id=w.id, device_id=w.device_id, zone_id=chosen_zone.id, timestamp=ts,
                priority_level=priority,
                latency_ms=round(latency, 1),
                packet_loss_pct=round(pkt_loss, 2),
                bandwidth_kbps=round(bandwidth, 0),
                qos_score=round(score, 1),
            ))
            total_qos += 1

        # Commit every 24 hours worth to keep memory low
        if (step + 1) % 24 == 0:
            db.bulk_save_objects(loc_buf)
            db.bulk_save_objects(qos_buf)
            db.bulk_save_objects(fence_buf)
            db.commit()
            loc_buf.clear()
            qos_buf.clear()
            fence_buf.clear()

    # Final flush
    if loc_buf:   db.bulk_save_objects(loc_buf);   db.commit()
    if qos_buf:   db.bulk_save_objects(qos_buf);   db.commit()
    if fence_buf: db.bulk_save_objects(fence_buf); db.commit()

    # Guarantee 2 workers visible in restricted zone at the very latest timestamp
    # so the campus live view always shows a breach when the dashboard loads
    latest_ts = now
    breach_workers = workers[:2]
    for bw in breach_workers:
        db.add(LocationEvent(
            worker_id=bw.id, zone_id=restricted_zone.id,
            lat=restricted_zone.center_lat + 0.00005,
            lng=restricted_zone.center_lng + 0.00005,
            timestamp=latest_ts,
        ))
        db.add(GeoFenceEvent(
            worker_id=bw.id, zone_id=restricted_zone.id, rule_id=rule_no_entry.id,
            event_type="unauthorized_entry", timestamp=latest_ts,
            duration_seconds=600, resolved=False,
        ))
    db.commit()

    fence_total = db.query(GeoFenceEvent).count()
    print(f"  location events: {total_loc:,}")
    print(f"  QoS events: {total_qos:,}")
    print(f"  geofence breach events: {fence_total}")

    db.close()
    print("\nDone. Now run:")
    print("  python -m uvicorn main:app --reload --port 8000")


if __name__ == "__main__":
    seed()
