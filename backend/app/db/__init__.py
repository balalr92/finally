"""Database layer for FinAlly: schema, initialization, and repository access."""

from app.db.init_db import get_default_db_path, init_db

__all__ = ["init_db", "get_default_db_path"]
