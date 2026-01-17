import logging
from pathlib import Path

def setup_logger(log_path, level="INFO"):
    Path(log_path).parent.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("PyClips")
    logger.setLevel(level)

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(message)s"
    )

    fh = logging.FileHandler(log_path, encoding="utf-8")
    ch = logging.StreamHandler()

    fh.setFormatter(formatter)
    ch.setFormatter(formatter)

    logger.addHandler(fh)
    logger.addHandler(ch)

    return logger
