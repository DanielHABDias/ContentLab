import os
import threading
import webbrowser

from PIL import Image, ImageDraw, ImageFont
import pystray

try:
    from . import app as flask_app
    from . import ffmpeg_helper
except ImportError:  # Suporte ao executável gerado pelo PyInstaller.
    import app as flask_app
    import ffmpeg_helper

PORT = 5000
URL = f"http://127.0.0.1:{PORT}"


def make_icon_image():
    size = 64
    img = Image.new("RGBA", (size, size), (14, 16, 21, 255))
    d = ImageDraw.Draw(img)
    d.ellipse([2, 2, size - 2, size - 2], outline=(47, 124, 255, 255), width=4)
    d.arc([2, 2, size - 2, size - 2], 300, 120, fill=(255, 61, 90, 255), width=4)
    try:
        font = ImageFont.truetype("arialbd.ttf", 22)
    except Exception:
        font = ImageFont.load_default()
    text = "CL"
    box = d.textbbox((0, 0), text, font=font)
    x = (size - (box[2] - box[0])) / 2
    y = (size - (box[3] - box[1])) / 2 - 2
    d.text((x, y), text, fill=(240, 242, 248, 255), font=font)
    return img


def run_flask():
    flask_app.app.run(host="127.0.0.1", port=PORT, debug=False, use_reloader=False)


def open_browser(icon=None, item=None):
    webbrowser.open(URL)


def quit_app(icon, item):
    icon.stop()
    os._exit(0)


def main():
    ffmpeg_helper.prewarm_async()
    t = threading.Thread(target=run_flask, daemon=True)
    t.start()
    open_browser()
    menu = pystray.Menu(
        pystray.MenuItem("Abrir Content Lab", open_browser, default=True),
        pystray.MenuItem("Sair", quit_app),
    )
    icon = pystray.Icon("contentlab", make_icon_image(), "Content Lab", menu)
    icon.run()


if __name__ == "__main__":
    main()
