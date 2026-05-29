import os
import httpx
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
import models
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="Qewr Monitoring API")

# Mount static files
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# Ensure DB tables are created
models.init_db()

# Dependency for DB session
def get_db():
    db = models.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic models for request validation
class PingRequest(BaseModel):
    hardware_id: str
    server_name: str
    ip_address: str
    cpu_usage: float
    mem_usage: float
    disk_usage: float
    uptime: str
    specs: str = "{}"

# Telegram Alert Function
async def send_telegram_alert(message: str):
    token = os.getenv("TELEGRAM_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        return
    
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": message}
    async with httpx.AsyncClient() as client:
        try:
            await client.post(url, json=payload)
        except Exception as e:
            print(f"Failed to send telegram alert: {e}")

@app.post("/api/ping")
async def receive_ping(data: PingRequest, db: Session = Depends(get_db)):
    # 1. Check or register server by hardware_id (MAC Address)
    server = db.query(models.Server).filter(models.Server.hardware_id == data.hardware_id).first()
    if not server:
        server = models.Server(hardware_id=data.hardware_id, name=data.server_name)
        db.add(server)
        db.commit()
        db.refresh(server)
    
    # 2. Update server status and current metrics
    server.name = data.server_name # Allow updating nickname
    server.last_ping = datetime.now()
    server.ip_address = data.ip_address
    server.cpu_usage = data.cpu_usage
    server.mem_usage = data.mem_usage
    server.disk_usage = data.disk_usage
    server.uptime = data.uptime
    server.specs = data.specs
    
    # 3. Save historical metric
    metric = models.Metric(
        server_id=server.id,
        cpu_usage=data.cpu_usage,
        mem_usage=data.mem_usage,
        disk_usage=data.disk_usage,
        uptime=data.uptime
    )
    db.add(metric)
    
    # 4. Threshold Alert Logic
    alert_triggered = False
    alert_msg = f"⚠️ [ALARM] {data.server_name}\n"
    
    if data.cpu_usage > 90.0:
        alert_msg += f"- CPU: {data.cpu_usage}%\n"
        alert_triggered = True
    if data.mem_usage > 90.0:
        alert_msg += f"- MEM: {data.mem_usage}%\n"
        alert_triggered = True
    
    if alert_triggered:
        await send_telegram_alert(alert_msg)
        server.status = "warning"
    else:
        server.status = "online"

    db.commit()
    return {"status": "ok"}

@app.get("/api/servers")
def list_servers(response: Response, db: Session = Depends(get_db)):
    # Prevent caching for live data
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return db.query(models.Server).all()

class MemoRequest(BaseModel):
    memo: str

@app.post("/api/servers/{server_id}/memo")
def update_memo(server_id: int, data: MemoRequest, db: Session = Depends(get_db)):
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    server.memo = data.memo
    db.commit()
    return {"status": "ok"}

@app.delete("/api/servers/{server_id}")
def delete_server(server_id: int, db: Session = Depends(get_db)):
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    # Delete related metrics first (cascade)
    db.query(models.Metric).filter(models.Metric.server_id == server_id).delete()
    db.delete(server)
    db.commit()
    return {"status": "ok"}

@app.get("/api/servers/{server_id}/metrics")
def get_server_metrics(server_id: int, db: Session = Depends(get_db)):
    # Return last 100 metrics for the chart/list
    metrics = db.query(models.Metric).filter(models.Metric.server_id == server_id).order_by(models.Metric.timestamp.desc()).limit(100).all()
    return metrics

@app.get("/")
def read_index(response: Response):
    # Prevent caching for live data
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return FileResponse(os.path.join(BASE_DIR, 'templates/index.html'))
