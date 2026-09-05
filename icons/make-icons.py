"""Draw the app icon at each size iOS and the manifest ask for.

    python icons/make-icons.py

Stdlib only — zlib and struct are enough to write a PNG, and the project's
whole point is that nothing needs installing. Re-run after editing SHAPES.

The design is defined in 0..1 space and rasterised per size rather than being
scaled from one bitmap, so every edge lands on a whole pixel at 180, 192 and
512 alike. A temple front: steps, four columns, architrave, pediment.
"""

import struct
import zlib
from pathlib import Path

GROUND = (0xC8, 0x87, 0x3A)   # terracotta, --accent
INK = (0xF5, 0xF0, 0xE6)      # cream, a touch lighter than --fg
SHADE = (0xD9, 0xCB, 0xB2)    # the shadowed side of a column, still cream

SIZES = (180, 192, 512)       # 180 is the apple-touch-icon

# (x0, y0, x1, y1, colour)
COLUMN_X = (0.235, 0.375, 0.515, 0.655)
COLUMN_W = 0.095

SHAPES = [
    (0.130, 0.775, 0.870, 0.855, INK),    # bottom step
    (0.165, 0.700, 0.835, 0.775, INK),    # top step
    *[(x, 0.395, x + COLUMN_W, 0.700, INK) for x in COLUMN_X],
    *[(x + COLUMN_W * 0.70, 0.395, x + COLUMN_W, 0.700, SHADE) for x in COLUMN_X],
    (0.150, 0.330, 0.850, 0.395, INK),    # architrave
]

PEDIMENT = ((0.120, 0.330), (0.880, 0.330), (0.500, 0.115))


def in_triangle(px, py, tri):
    """Half-plane test; the winding is fixed, so all three signs must agree."""
    (ax, ay), (bx, by), (cx, cy) = tri
    d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
    d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
    d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def render(size):
    rows = bytearray()
    for y in range(size):
        py = (y + 0.5) / size
        for x in range(size):
            px = (x + 0.5) / size
            colour = GROUND
            if in_triangle(px, py, PEDIMENT):
                colour = INK
            for x0, y0, x1, y1, shape_colour in SHAPES:
                if x0 <= px < x1 and y0 <= py < y1:
                    colour = shape_colour
            rows.extend(colour)
    return bytes(rows)


def write_png(path, size, pixels):
    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

    header = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)  # 8-bit truecolour
    raw = b''.join(
        b'\x00' + pixels[y * size * 3:(y + 1) * size * 3] for y in range(size)
    )
    path.write_bytes(
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', header)
        + chunk(b'IDAT', zlib.compress(raw, 9))
        + chunk(b'IEND', b'')
    )


if __name__ == '__main__':
    here = Path(__file__).parent
    for size in SIZES:
        target = here / f'icon-{size}.png'
        write_png(target, size, render(size))
        print(f'{target.name}  {target.stat().st_size:,} bytes')
