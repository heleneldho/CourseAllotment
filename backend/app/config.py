import os
from functools import lru_cache
from pathlib import Path


@lru_cache
def read_env_file():
    env_path = Path(__file__).resolve().parents[1] / ".env"
    values = {}
    if not env_path.exists():
        return values

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

    return values


def get_env(name, default=None):
    return os.getenv(name, read_env_file().get(name, default))
