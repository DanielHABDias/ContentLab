"""Prepare the local video runtime before starting the app."""

from .contentlab.remotion_runtime import ensure_remotion


if __name__ == "__main__":
    ensure_remotion()
    print("Remotion preparado.")
