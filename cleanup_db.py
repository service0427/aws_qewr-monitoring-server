import os
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import SessionLocal, Metric

# Retention policy: Keep metrics for 7 days
RETENTION_DAYS = 7

def cleanup():
    db = SessionLocal()
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=RETENTION_DAYS)
        print(f"Cleaning up metrics older than {cutoff_date}...")
        
        # Delete old metrics
        deleted_count = db.query(Metric).filter(Metric.timestamp < cutoff_date).delete()
        db.commit()
        
        print(f"Cleanup complete. Deleted {deleted_count} rows.")
    except Exception as e:
        print(f"Error during cleanup: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
