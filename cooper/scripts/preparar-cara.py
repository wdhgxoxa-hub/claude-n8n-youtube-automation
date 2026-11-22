#!/usr/bin/env python3
"""Recorta el fondo cuadriculado del recurso local aprobado, sin servicios externos.

Uso: python scripts/preparar-cara.py /ruta/Gemini_Generated_Gif_....gif.mp4
Requiere ffmpeg/libvpx-vp9, ffprobe, Pillow y numpy. No lee archivos de entorno.
El algoritmo se ajustó a la fuente 320×180; otra fuente requiere revisión humana.
"""

import argparse
from collections import deque
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def run(*args):
    return subprocess.run(args, check=True, capture_output=True).stdout


def recortar(im):
    """Flood-fill de fondo, trimap y descontaminación de bordes por fotograma."""
    pixels = np.asarray(im.convert("RGB")).astype(float)
    height, width, _ = pixels.shape
    possible_background = (pixels.min(2) > 175) & (
        pixels.max(2) - pixels.min(2) < 22
    )
    background = np.zeros((height, width), dtype=bool)
    queue = deque()
    borders = [(y, x) for x in range(width) for y in (0, height - 1)]
    borders += [(y, x) for y in range(height) for x in (0, width - 1)]
    for y, x in borders:
        if possible_background[y, x] and not background[y, x]:
            background[y, x] = True
            queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if (
                0 <= yy < height
                and 0 <= xx < width
                and possible_background[yy, xx]
                and not background[yy, xx]
            ):
                background[yy, xx] = True
                queue.append((yy, xx))

    # Los blancos internos (ojos/dientes) permanecen: no están conectados al fondo.
    mask = ~background
    # La fuente contiene una marca fuera de la cabeza, que no forma parte de Cooper.
    mask[:, :65] = False
    mask[:, 255:] = False
    mask_image = Image.fromarray((mask * 255).astype("uint8"))
    core = np.asarray(mask_image.filter(ImageFilter.MinFilter(5))) > 0
    extent = np.asarray(mask_image.filter(ImageFilter.MaxFilter(3))) > 0
    alpha = core.astype(float)
    rgb = pixels.copy()
    for y, x in zip(*np.where(extent & ~core)):
        neighbors = []
        background_samples = []
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                yy, xx = y + dy, x + dx
                if not (0 <= yy < height and 0 <= xx < width):
                    continue
                if core[yy, xx]:
                    neighbors.append((dx * dx + dy * dy, yy, xx))
                if background[yy, xx] and pixels[yy, xx].min() > 220:
                    background_samples.append(pixels[yy, xx])
        if not neighbors:
            continue
        _, foreground_y, foreground_x = min(neighbors)
        foreground = pixels[foreground_y, foreground_x]
        base = (
            np.median(background_samples, axis=0)
            if background_samples
            else np.array([240, 240, 240])
        )
        direction = base - foreground
        opacity = float(
            np.clip(
                np.dot(base - pixels[y, x], direction)
                / max(1, np.dot(direction, direction)),
                0,
                1,
            )
        )
        if opacity < 0.03:
            opacity = 0
        alpha[y, x] = opacity
        if opacity:
            rgb[y, x] = np.clip(
                (pixels[y, x] - (1 - opacity) * base) / opacity, 0, 255
            )
    rgba = np.dstack((rgb, alpha * 255)).astype("uint8")
    rgba[rgba[:, :, 3] == 0, :3] = 0
    # 180 px nativos, sin reescalado ni detalle inventado. Conserva orejas y mentón.
    return Image.fromarray(rgba).crop((70, 0, 250, 180))


def evidencia(images, output):
    """Muestras de ojos abiertos/parpadeo sobre lienzo, vidrio y fondo claro."""
    canvas = Image.new("RGB", (704, 736), (10, 10, 12))
    draw = ImageDraw.Draw(canvas)
    sizes = (56, 112)
    backgrounds = ((0, 0, 0), (17, 17, 20), (245, 245, 247))
    for row, frame_index in enumerate((0, 8, 16, 24)):
        for col, background in enumerate(backgrounds):
            x, y = 16 + col * 232, 12 + row * 180
            draw.text((x, y), f"Fotograma {frame_index + 1}", fill="white")
            for offset, size in zip((0, 88), sizes):
                panel = Image.new("RGBA", (size, size), (*background, 255))
                panel.alpha_composite(
                    images[frame_index].resize((size, size), Image.Resampling.LANCZOS)
                )
                canvas.paste(panel, (x + offset, y + 24))
                draw.text((x + offset, y + size + 28), f"{size} px", fill="white")
    canvas.save(output, optimize=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "public" / "cooper-cara",
    )
    args = parser.parse_args()
    probe = json.loads(
        run(
            "ffprobe", "-v", "error", "-show_streams", "-show_format",
            "-of", "json", str(args.source),
        )
    )
    stream = next(s for s in probe["streams"] if s["codec_type"] == "video")
    if (stream["width"], stream["height"]) != (320, 180):
        parser.error("Esta receta exige la fuente 320×180 inspeccionada; no recortar a ciegas.")
    args.output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="cooper-cara-") as directory:
        temporary = Path(directory)
        run(
            "ffmpeg", "-loglevel", "error", "-i", str(args.source),
            str(temporary / "source-%03d.png"),
        )
        images = []
        for index, source_frame in enumerate(sorted(temporary.glob("source-*.png")), 1):
            image = recortar(Image.open(source_frame))
            image.save(temporary / f"alpha-{index:03d}.png", optimize=True)
            images.append(image)
        if len(images) != 30:
            parser.error("La fuente esperada tiene 30 fotogramas; revisar antes de exportar.")
        images[0].save(args.output / "cooper.png", optimize=True)
        # Póster que se descarga en cada pantalla: WebP con alfa, ~9 KB frente a ~39 KB.
        images[0].save(args.output / "cooper.webp", quality=90, alpha_quality=100, method=6)
        run(
            "ffmpeg", "-y", "-loglevel", "error", "-framerate", stream["r_frame_rate"],
            "-i", str(temporary / "alpha-%03d.png"), "-an", "-c:v", "libvpx-vp9",
            "-lossless", "1", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0",
            "-row-mt", "1", str(args.output / "cooper.webm"),
        )
        # El decodificador VP9 nativo de ffmpeg omite alfa; libvpx-vp9 sí lo recupera.
        run(
            "ffmpeg", "-loglevel", "error", "-c:v", "libvpx-vp9", "-i",
            str(args.output / "cooper.webm"), str(temporary / "decoded-%03d.png"),
        )
        decoded = sorted(temporary.glob("decoded-*.png"))
        assert len(decoded) == len(images), "No se decodificó la secuencia completa"
        alpha_error = 0
        for original, encoded in zip(images, decoded):
            decoded_image = Image.open(encoded)
            assert decoded_image.mode == "RGBA", "WebM sin canal alfa"
            original_alpha = np.asarray(original.getchannel("A")).astype(int)
            decoded_alpha = np.asarray(decoded_image.getchannel("A")).astype(int)
            alpha_error = max(alpha_error, int(np.abs(original_alpha - decoded_alpha).max()))
            assert decoded_alpha.min() == 0 and decoded_alpha.max() == 255
            assert np.all(decoded_alpha[0] == 0) and np.all(decoded_alpha[-1] == 0)
            assert np.all(decoded_alpha[:, 0] == 0) and np.all(decoded_alpha[:, -1] == 0)
        assert alpha_error <= 1, f"La exportación alteró demasiado el canal alfa: {alpha_error}"
        evidencia(images, args.output / "calidad-56-112.png")
        metadata = {
            "fuente": args.source.name,
            "sha256Fuente": hashlib.sha256(args.source.read_bytes()).hexdigest(),
            "fuentePx": [320, 180], "salidaPx": [180, 180],
            "fotogramas": len(images), "fps": stream["r_frame_rate"],
            "duracionSegundos": float(probe["format"]["duration"]),
            "metodo": "fondo conectado + trimap + matting y descontaminación por fotograma",
            "encoder": "libvpx-vp9 lossless yuva420p", "errorMaximoAlfa": alpha_error,
            "bordesTransparentes": True, "sinReescalado": True,
            "sha256PNG": hashlib.sha256((args.output / "cooper.png").read_bytes()).hexdigest(),
            "sha256WebM": hashlib.sha256((args.output / "cooper.webm").read_bytes()).hexdigest(),
            "sha256WebP": hashlib.sha256((args.output / "cooper.webp").read_bytes()).hexdigest(),
            "limites": "Fuente comprimida a 10 fps; un solo gesto, no cinco estados. Usar hasta 112 CSS px.",
        }
        (args.output / "verificacion.json").write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2) + "\n"
        )
        print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
