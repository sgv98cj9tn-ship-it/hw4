"""Shared paths and SQLite connections for the Campus Customs backend."""

import re
import sqlite3
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
DB_PATH = DATA_DIR / "campus_customs.db"

SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]


def get_connection(write: bool = False) -> sqlite3.Connection:
    mode = "rw" if write else "ro"
    conn = sqlite3.connect(f"file:{DB_PATH}?mode={mode}", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def image_url(image_file_path: str) -> str:
    """Browser URL for a catalogue image (served by main.py under /media)."""
    return f"/media/{Path(image_file_path).name}"


_QUARTER_ZIP = re.compile(r"\b1[\s/-]?4[\s-]?zip\b|¼[\s-]?zip\b", re.IGNORECASE)


def display_name(text: str) -> str:
    """Catalogue names say "1 4 Zip" (from "1/4 Zip"); shoppers see "Quarter-Zip". The database is unchanged."""
    return _QUARTER_ZIP.sub("Quarter-Zip", text)
