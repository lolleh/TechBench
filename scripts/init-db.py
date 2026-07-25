#!/usr/bin/env python3
"""
TechBench - Database Initializer
Creates and seeds the SQLite database on Windows.
"""

import os
import sqlite3
from pathlib import Path

def get_db_path() -> Path:
    appdata = os.environ.get("LOCALAPPDATA", os.path.expanduser("~\\AppData\\Local"))
    db_dir = Path(appdata) / "TechBench" / "databases"
    db_dir.mkdir(parents=True, exist_ok=True)
    return db_dir / "techbench.db"

def get_project_root() -> Path:
    return Path(__file__).parent.parent.parent

def init_database():
    db_path = get_db_path()
    root = get_project_root()

    print(f"Initializing database at: {db_path}")

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # Run schema
    schema_file = root / "database" / "schema" / "001_initial.sql"
    if schema_file.exists():
        print(f"  Applying schema: {schema_file}")
        cursor.executescript(schema_file.read_text())
    else:
        print(f"  WARNING: Schema not found at {schema_file}")

    # Run seeds
    seeds_dir = root / "database" / "seeds"
    if seeds_dir.exists():
        for seed_file in sorted(seeds_dir.glob("*.sql")):
            print(f"  Seeding: {seed_file.name}")
            cursor.executescript(seed_file.read_text())

    conn.commit()
    conn.close()
    print(f"  Database initialized successfully!")

    # Verify
    conn = sqlite3.connect(str(db_path))
    tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    print(f"  Tables: {len(tables)}")
    for t in tables:
        print(f"    - {t[0]}")
    conn.close()

if __name__ == "__main__":
    init_database()
