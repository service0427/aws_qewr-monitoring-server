import os
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# DB Connection Details
DB_USER = os.getenv("DB_USER", "qewr")
DB_PASS = os.getenv("DB_PASS", "Tech1324")
DB_NAME = os.getenv("DB_NAME", "qewr")
DB_HOST = "localhost"

DATABASE_URL = f"mysql://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}?charset=utf8mb4"

from sqlalchemy import create_engine
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Server(Base):
    __tablename__ = "servers"
    id = Column(Integer, primary_key=True, index=True)
    hardware_id = Column(String(50), unique=True, index=True) # MAC Address
    name = Column(String(100), index=True) # Nickname
    ip_address = Column(String(45))
    last_ping = Column(DateTime, default=datetime.now)
    status = Column(String(20), default="online")
    
    # Stats & Specs
    cpu_usage = Column(Float, default=0.0)
    mem_usage = Column(Float, default=0.0)
    disk_usage = Column(Float, default=0.0)
    uptime = Column(String(100), default="unknown")
    specs = Column(Text, nullable=True) # Detailed specs in JSON string
    memo = Column(String(255), nullable=True) # Manual note (e.g., location)
    
    # Alert Settings
    cpu_threshold = Column(Float, default=90.0)
    mem_threshold = Column(Float, default=90.0)
    disk_threshold = Column(Float, default=90.0)
    cpu_alert_enabled = Column(Integer, default=1) # 1 for True, 0 for False
    mem_alert_enabled = Column(Integer, default=1)
    disk_alert_enabled = Column(Integer, default=1)

    metrics = relationship("Metric", back_populates="server")

class Metric(Base):
    __tablename__ = "metrics"
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"))
    cpu_usage = Column(Float)
    mem_usage = Column(Float)
    disk_usage = Column(Float)
    uptime = Column(String(100))
    timestamp = Column(DateTime, default=datetime.now, index=True)

    server = relationship("Server", back_populates="metrics")

def init_db():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init_db()
    print("Database tables created successfully.")
