"""Level 2 (Library) blockout builder.

Builds the library from docs/level-2-blender-asset-spec.md (step 1, blockout),
saves blender/level-2.blend and exports blender/export/level-2.glb and uv-lamp.glb.

Run:  /Applications/Blender.app/Contents/MacOS/Blender -b --python blender/scripts/build_level2.py

WARNING: this regenerates level-2.blend from scratch. Once the .blend has been
refined by hand, do not re-run it; use export_level2.py to re-export instead.

Conventions (same as Levels 0 and 1): 1 unit = 1 m, +Y is north, +Z is up. The
library interior is x -3..3, y -4..4, z 0..3.2 with the floor centre at the
world origin. Static meshes are built in their final orientation (identity
rotation and scale). Parts are given in world coordinates and moved to the
object origin by `finish_at`.

Shared helpers come from build_level0.py and build_level1.py, which are only
imported, never run.
"""

import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_level0 as L0  # noqa: E402
import build_level1 as L1  # noqa: E402
from build_level0 import WORLD, Mesh, collider, empty, export_glb, make_material, place  # noqa: E402
from build_level1 import battery, beam, finish_at, quad_facing  # noqa: E402

BLENDER_DIR = os.path.dirname(HERE)
BLEND_PATH = os.path.join(BLENDER_DIR, "level-2.blend")
EXPORT_DIR = os.path.join(BLENDER_DIR, "export")
GLB_PATH = os.path.join(EXPORT_DIR, "level-2.glb")

ROOM_COLLECTIONS = ["Room", "Furniture", "Interactables", "Pickups", "Props", "UVOnly", "Ghosts", "Colliders", "Spawns"]
COLLECTIONS = ROOM_COLLECTIONS + ["Held_Items"]

MATERIALS = dict(L0.MATERIALS)
MATERIALS.update({
    "Wallpaper_Teal": ("2f4a4f", 0.95, 0.0, 1.0),
    "Paper": ("efe4c6", 0.95, 0.0, 1.0),
    "Void": ("0d0c1f", 1.0, 0.0, 1.0),
    "Book_Plum": ("7a2f4e", 0.95, 0.0, 1.0),
    "Book_Teal": ("1f5f66", 0.95, 0.0, 1.0),
    "Book_Ochre": ("c9a24a", 0.95, 0.0, 1.0),
    "Book_Cream": ("e8dcc0", 0.95, 0.0, 1.0),
    "Book_Rust": ("8c3b2f", 0.95, 0.0, 1.0),
    "Book_Green": ("3f5a3a", 0.95, 0.0, 1.0),
    "Pages": ("d9cfb0", 0.95, 0.0, 1.0),
    "Metal_Iron": ("2e2e34", 0.6, 1.0, 1.0),
    "Placeholder_UV": ("b58cff", 0.9, 0.0, 1.0),  # replaced by the UV-reveal shader
    "Placeholder_Mimic": ("a6f0dc", 0.6, 0.0, 1.0),
    "Placeholder_InkGhost": ("a6f0dc", 0.6, 0.0, 1.0),
    "UV_Glass": ("8a5cff", 0.2, 0.0, 0.6),
})
BOOK_MATS = ["Book_Plum", "Book_Teal", "Book_Ochre", "Book_Cream", "Book_Rust", "Book_Green"]

# ---------------------------------------------------------------------------
# Dimensions
# ---------------------------------------------------------------------------

HX, HY, H = 3.0, 4.0, 3.2
T = 0.15
WAIN_H, WAIN_T = 0.9, 0.03
CAP = 0.05

DOOR_W, DOOR_H, DOOR_FRAME = 1.0, 2.2, 0.1
ENTRY_X = 0.0
SERVICE_X = 1.6

WIN_Y, WIN_HALF = 0.4, 0.7  # window on the east wall
WIN_Z0, WIN_SPRING, WIN_RISE = 0.5, 2.1, 0.7

SHELF_TOPS = [0.45, 1.10, 1.75, 2.40]  # bottom to top
STACK_LEN, STACK_DEPTH, STACK_H = 1.8, 0.45, 2.8
STACK_INNER = STACK_LEN / 2 - 0.04

# name: (wall side, centre y, shelf-top index, y offset of the marked book from the stack centre,
#        digit, white-light spine title, spine material)
STACKS = {
    "A": dict(side="W", cy=2.4, shelf=2, off=-0.30, digit=2, mat="Book_Teal"),
    "B": dict(side="W", cy=-1.6, shelf=0, off=0.40, digit=5, mat="Book_Cream"),
    "C": dict(side="E", cy=2.4, shelf=3, off=0.20, digit=7, mat="Book_Plum"),
    "D": dict(side="E", cy=-1.6, shelf=1, off=-0.50, digit=0, mat="Book_Ochre"),
}
BOOK_W, BOOK_D, BOOK_H = 0.14, 0.30, 0.38  # the marked folio: thickness (y), depth, height

TABLE = Vector((0, 0.4, 0))
TABLE_Z = 0.76
MIMIC_SPOTS = [Vector((-0.7, 0.4, TABLE_Z)), Vector((-0.25, 0.6, TABLE_Z)), Vector((0.3, 0.25, TABLE_Z)),
               Vector((0.75, 0.55, TABLE_Z)), Vector((1.2, -0.6, 0.45))]
DESK = Vector((-1.5, -3.6, 0))
FIRE_X = -0.8
BREAST_X0, BREAST_X1, BREAST_Y = FIRE_X - 1.1, FIRE_X + 1.1, HY - 0.3
PANEL_STACK = "A"
PANEL_SHELF_Z = SHELF_TOPS[1]
PANEL_Y = 2.5  # centre of the hidden panel along the west wall
INK_PATH = [(-2.0, -1.2), (-2.0, 0.4), (-2.0, 2.1), (-1.2, 3.0), (2.0, 2.6), (2.0, 0.4), (2.0, -2.1), (-1.0, -2.0)]
INK_Z = 1.3


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def stack_x(side, d):
    """World x of a point `d` metres out from the wall of a stack."""
    return -HX + d if side == "W" else HX - d


def sbox(m, side, cy, d0, d1, y0, y1, z0, z1, mat, bevel=0.0):
    """Box in stack coordinates: d from the wall, y absolute."""
    xa, xb = stack_x(side, d0), stack_x(side, d1)
    return m.box((min(xa, xb), y0, z0), (max(xa, xb), y1, z1), mat, bevel)


def normal_for(side):
    return "+X" if side == "W" else "-X"


# ---------------------------------------------------------------------------
# Room shell
# ---------------------------------------------------------------------------

def arch_top(y):
    u = (y - WIN_Y) / WIN_HALF
    return WIN_SPRING + WIN_RISE * math.sqrt(max(0.0, 1 - u * u))


def build_shell():
    o = (0, 0, 0)
    W = "Wallpaper_Teal"
    Mesh().box((-HX - T, -HY - T, -0.1), (HX + T, HY + T, 0), "Wood_Floor").finish("Floor", o, "Room")
    Mesh().box((-HX - T, -HY - T, H), (HX + T, HY + T, H + 0.1), "Card_Cream").finish("Ceiling", o, "Room")
    Mesh().box((-HX - T, -HY, 0), (-HX, HY, H), W).finish("Wall_W", o, "Room")

    d = DOOR_W / 2 + DOOR_FRAME
    top = DOOR_H + DOOR_FRAME
    (Mesh()
     .box((-HX - T, -HY - T, 0), (ENTRY_X - d, -HY, H), W)
     .box((ENTRY_X + d, -HY - T, 0), (HX + T, -HY, H), W)
     .box((ENTRY_X - d, -HY - T, top), (ENTRY_X + d, -HY, H), W)
     .finish("Wall_S", o, "Room"))
    (Mesh()
     .box((-HX - T, HY, 0), (SERVICE_X - d, HY + T, H), W)
     .box((SERVICE_X + d, HY, 0), (HX + T, HY + T, H), W)
     .box((SERVICE_X - d, HY, top), (SERVICE_X + d, HY + T, H), W)
     .finish("Wall_N", o, "Room"))

    # East wall: round-arched window opening, built from vertical strips over the arch.
    y0, y1 = WIN_Y - WIN_HALF, WIN_Y + WIN_HALF
    east = (Mesh()
            .box((HX, -HY, 0), (HX + T, y0, H), W)
            .box((HX, y1, 0), (HX + T, HY, H), W)
            .box((HX, y0, 0), (HX + T, y1, WIN_Z0), W))
    n = 16
    for i in range(n):
        a = y0 + (y1 - y0) * i / n
        b = y0 + (y1 - y0) * (i + 1) / n
        east.box((HX, a, arch_top((a + b) / 2)), (HX + T, b, H), W)
    east.finish("Wall_E", o, "Room")

    # Wainscot: dark walnut panelling with a cap rail, skipping doorways and the window.
    wood = "Wood_Walnut"
    wain = Mesh()
    segs = [
        ((-HX, HY - WAIN_T), (SERVICE_X - d, HY)),
        ((SERVICE_X + d, HY - WAIN_T), (HX, HY)),
        ((-HX, -HY + WAIN_T), (-HX + WAIN_T, HY - WAIN_T)),
        ((HX - WAIN_T, -HY + WAIN_T), (HX, y0)),
        ((HX - WAIN_T, y1), (HX, HY - WAIN_T)),
        ((-HX, -HY), (ENTRY_X - d, -HY + WAIN_T)),
        ((ENTRY_X + d, -HY), (HX, -HY + WAIN_T)),
    ]
    g = CAP - WAIN_T
    for (ax, ay), (bx, by) in segs:
        wain.box((ax, ay, 0), (bx, by, WAIN_H), wood)
        cax, cay, cbx, cby = ax, ay, bx, by
        if by == HY:
            cay -= g
        elif ay == -HY:
            cby += g
        elif ax == -HX:
            cbx += g
        elif bx == HX:
            cax -= g
        wain.box((cax, cay, WAIN_H), (cbx, cby, WAIN_H + 0.05), wood, 0.008)
    wain.box((HX - WAIN_T, y0, 0), (HX, y1, WIN_Z0), wood)  # under the window
    wain.finish("Wainscot", o, "Room")

    # Skirting along the foot of every wall, standing proud of the wainscot.
    sk = Mesh()
    sk.box((-HX, HY - 0.05, 0), (SERVICE_X - d, HY, 0.12), wood)
    sk.box((SERVICE_X + d, HY - 0.05, 0), (HX, HY, 0.12), wood)
    sk.box((-HX, -HY + 0.05, 0.0), (-HX + 0.05, HY - 0.05, 0.12), wood)
    sk.box((HX - 0.05, -HY + 0.05, 0), (HX, y0, 0.12), wood)
    sk.box((HX - 0.05, y1, 0), (HX, HY - 0.05, 0.12), wood)
    sk.box((-HX, -HY, 0), (ENTRY_X - d, -HY + 0.05, 0.12), wood)
    sk.box((ENTRY_X + d, -HY, 0), (HX, -HY + 0.05, 0.12), wood)
    sk.finish("Skirting", o, "Room")

    c, ch = 0.08, 0.15
    (Mesh()
     .box((-HX, HY - c, H - ch), (HX, HY, H), wood, 0.01)
     .box((-HX, -HY, H - ch), (HX, -HY + c, H), wood, 0.01)
     .box((-HX, -HY + c, H - ch), (-HX + c, HY - c, H), wood, 0.01)
     .box((HX - c, -HY + c, H - ch), (HX, HY - c, H), wood, 0.01)
     .finish("Cornice", o, "Room"))

    collider("Collider_Floor", (-HX - T, -HY - T, -0.1), (HX + T, HY + T, 0))
    collider("Collider_Ceiling", (-HX - T, -HY - T, H), (HX + T, HY + T, H + 0.1))
    collider("Collider_Wall_W", (-HX - T, -HY, 0), (-HX, HY, H))
    collider("Collider_Wall_E", (HX, -HY, 0), (HX + T, HY, H))
    collider("Collider_Wall_N", (-HX - T, HY, 0), (HX + T, HY + T, H))
    # South wall is split around the entry doorway; the hall stays reachable.
    collider("Collider_Wall_S_W", (-HX - T, -HY - T, 0), (ENTRY_X - d, -HY, H))
    collider("Collider_Wall_S_E", (ENTRY_X + d, -HY - T, 0), (HX + T, -HY, H))


def build_window():
    y0, y1 = WIN_Y - WIN_HALF, WIN_Y + WIN_HALF
    f = 0.08
    wd = "Wood_Teal"
    xa, xb = HX - 0.04, HX + 0.1
    m = (Mesh()
         .box((xa, y0, WIN_Z0), (xb, y0 + f, WIN_SPRING), wd, 0.012)
         .box((xa, y1 - f, WIN_Z0), (xb, y1, WIN_SPRING), wd, 0.012)
         .box((xa, y0 + f, WIN_Z0), (xb, y1 - f, WIN_Z0 + f), wd, 0.012)
         .box((xa, WIN_Y - 0.025, WIN_Z0 + f), (xb, WIN_Y + 0.025, WIN_SPRING + WIN_RISE - f), wd, 0.006)
         .box((xa, y0 + f, 1.5 - 0.02), (xb, y1 - f, 1.5 + 0.02), wd, 0.006)
         .box((HX - 0.1, y0 - 0.08, WIN_Z0 - 0.04), (HX + T, y1 + 0.08, WIN_Z0), wd, 0.012))  # sill
    pts = []
    n = 12
    for i in range(n + 1):
        ang = math.pi * i / n
        pts.append((WIN_Y + (WIN_HALF - f / 2) * math.cos(ang), WIN_SPRING + (WIN_RISE - f / 2) * math.sin(ang)))
    for (ya, za), (yb, zb) in zip(pts, pts[1:]):
        beam(m, (HX + 0.03, ya, za), (HX + 0.03, yb, zb), f, 0.12, wd)
    finish_at(m, "Window_Frame", (HX, WIN_Y, WIN_Z0), "Room")

    glass = Mesh()
    k = 14
    for i in range(k):
        a = y0 + f + (y1 - y0 - 2 * f) * i / k
        b = y0 + f + (y1 - y0 - 2 * f) * (i + 1) / k
        glass.box((HX + 0.045, a, WIN_Z0 + f), (HX + 0.055, b, arch_top((a + b) / 2) - 0.04), "Glass")
    finish_at(glass, "Window_Glass", (HX, WIN_Y, WIN_Z0), "Room")

    for name, a, b in (("Window_Curtain_L", y0 - 0.34, y0 - 0.04), ("Window_Curtain_R", y1 + 0.04, y1 + 0.34)):
        cm = Mesh().box((HX - 0.16, a, 0.25), (HX - 0.04, b, 2.95), "Felt_Plum", 0.02)
        cm.box((HX - 0.18, a - 0.02, 1.35), (HX - 0.02, b + 0.02, 1.45), "Metal_Brass", 0.01)
        finish_at(cm, name, (HX - 0.1, (a + b) / 2, 0), "Room")


# ---------------------------------------------------------------------------
# Doors and vestibules
# ---------------------------------------------------------------------------

def door_frame(name, cx, y_lo, y_hi, wall_south):
    d = DOOR_W / 2 + DOOR_FRAME
    ya, yb = y_lo - 0.03, y_hi + 0.03
    m = (Mesh()
         .box((cx - d, ya, 0), (cx - DOOR_W / 2, yb, DOOR_H), "Wood_Walnut", 0.012)
         .box((cx + DOOR_W / 2, ya, 0), (cx + d, yb, DOOR_H), "Wood_Walnut", 0.012)
         .box((cx - d - 0.04, ya, DOOR_H), (cx + d + 0.04, yb, DOOR_H + DOOR_FRAME + 0.03), "Wood_Walnut", 0.012))
    return finish_at(m, name, (cx, (y_lo + y_hi) / 2, 0), "Room")


def vestibule(name, cx, south):
    """Dark box behind a doorway so the player sees nothing beyond it."""
    y_in = HY + T if not south else -HY - T
    sgn = 1 if not south else -1
    y_out = y_in + sgn * 1.0
    ya, yb = min(y_in, y_out), max(y_in, y_out)
    x0, x1 = cx - 0.6, cx + 0.6
    m = (Mesh()
         .box((x0, ya, -0.05), (x1, yb, 0), "Void")
         .box((x0, ya, 2.4), (x1, yb, 2.45), "Void")
         .box((x0 - 0.05, ya, 0), (x0, yb, 2.4), "Void")
         .box((x1, ya, 0), (x1 + 0.05, yb, 2.4), "Void")
         .box((x0, y_out if sgn > 0 else ya - 0.05, 0), (x1, (y_out + 0.05) if sgn > 0 else ya, 2.4), "Void"))
    finish_at(m, name, (cx, (ya + yb) / 2, 0), "Room")
    star = name.split("_")[0]
    yc = y_in + sgn * 0.5
    collider(f"Collider_Vestibule_{star}_Back", (x0, y_out - 0.05 if sgn < 0 else y_out, 0), (x1, y_out + (0 if sgn < 0 else 0.05), 2.4))
    collider(f"Collider_Vestibule_{star}_L", (x0 - 0.05, ya, 0), (x0, yb, 2.4))
    collider(f"Collider_Vestibule_{star}_R", (x1, ya, 0), (x1 + 0.05, yb, 2.4))
    return yc


def build_doors():
    # Entry door to the hall (south wall): modelled open at 80 degrees, hinge on the west edge.
    door_frame("Entry_Door_Frame", ENTRY_X, -HY - T, -HY, True)
    hinge = Vector((ENTRY_X - DOOR_W / 2, -HY - T / 2, 0))
    leaf = Mesh().box((0, -0.03, 0), (DOOR_W, 0.03, DOOR_H), "Wood_Teal", 0.01)
    leaf.box((0.1, 0.03, 0.2), (DOOR_W - 0.1, 0.045, 0.95), "Wood_Teal", 0.006)
    leaf.box((0.1, 0.03, 1.15), (DOOR_W - 0.1, 0.045, 2.0), "Wood_Teal", 0.006)
    leaf.cyl((DOOR_W - 0.1, 0.07, 1.05), 0.03, 0.03, 0.02, "Y", "Metal_Brass", 12)
    bmesh.ops.rotate(leaf.bm, verts=leaf.bm.verts[:], cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(80), 3, "Z"))
    leaf.finish("Entry_Door", hinge, "Room")
    vestibule("Hall_Vestibule", ENTRY_X, True)

    # Service door (north wall): closed, hinge on the west edge, leaf along +X.
    door_frame("Service_Door_Frame", SERVICE_X, HY, HY + T, False)
    origin = Vector((SERVICE_X - DOOR_W / 2, HY + T / 2, 0))
    m = Mesh().box((0, -0.03, 0), (DOOR_W, 0.03, DOOR_H), "Wood_Walnut", 0.01)
    for z0, z1 in ((0.2, 0.95), (1.15, 2.0)):
        m.box((0.1, -0.045, z0), (DOOR_W - 0.1, -0.03, z1), "Wood_Walnut", 0.006)
    door = m.finish("Interact_Service_Door", origin, "Interactables")
    (Mesh()
     .cyl((0, 0, 0), 0.015, 0.015, 0.17, "Y", "Metal_Brass", 12)
     .sphere((0, -0.09, 0), 0.04, "Metal_Brass")
     .sphere((0, 0.09, 0), 0.04, "Metal_Brass")
     .cyl((0, -0.035, -0.08), 0.012, 0.012, 0.003, "Y", "Clay_Dark", 10)  # keyhole
     .finish("Service_Door_Handle", origin + Vector((DOOR_W - 0.12, 0, 1.05)), "Interactables", parent=door))
    (Mesh()
     .box((-0.12, -0.012, -0.04), (0.12, 0.0, 0.04), "Metal_Brass", 0.004)
     .finish("Service_Door_Sign", (SERVICE_X, HY - 0.01, DOOR_H + DOOR_FRAME + 0.13), "Room"))
    vestibule("Kitchen_Vestibule", SERVICE_X, False)
    collider("Collider_Service_Door", (SERVICE_X - DOOR_W / 2, HY - 0.05, 0), (SERVICE_X + DOOR_W / 2, HY + T, DOOR_H))


# ---------------------------------------------------------------------------
# Fireplace, ladder
# ---------------------------------------------------------------------------

def build_fireplace():
    W = "Wallpaper_Teal"
    (Mesh()
     .box((BREAST_X0, BREAST_Y, 0), (BREAST_X1, HY, H), W)
     .finish("Chimney_Breast", (FIRE_X, HY, 0), "Room"))
    st = "Card_Cream"
    m = (Mesh()
         .box((FIRE_X - 0.8, 3.55, 0), (FIRE_X - 0.55, BREAST_Y, 1.2), st, 0.01)
         .box((FIRE_X + 0.55, 3.55, 0), (FIRE_X + 0.8, BREAST_Y, 1.2), st, 0.01)
         .box((FIRE_X - 0.8, 3.55, 1.0), (FIRE_X + 0.8, BREAST_Y, 1.2), st, 0.01)
         .box((FIRE_X - 0.55, 3.62, 0), (FIRE_X + 0.55, HY, 1.0), "Void")  # firebox, deep and dark
         .box((FIRE_X - 0.5, 3.62, 0), (FIRE_X + 0.5, 3.95, 0.04), "Clay_Dark")  # cold ash
         .box((FIRE_X - 0.95, 3.1, 0), (FIRE_X + 0.95, 3.55, 0.06), st, 0.01))  # hearth
    finish_at(m, "Fireplace", (FIRE_X, HY, 0), "Furniture")
    mantel = Mesh().box((FIRE_X - 0.95, 3.45, 1.2), (FIRE_X + 0.95, BREAST_Y + 0.08, 1.27), "Wood_Walnut", 0.012)
    finish_at(mantel, "Fireplace_Mantel", (FIRE_X, HY, 1.2), "Furniture")
    collider("Collider_Fireplace", (BREAST_X0, 3.1, 0), (BREAST_X1, HY, 1.4))

    # A stopped mantel clock (hands at 3:17 is an open question; hands are left off for now).
    (Mesh()
     .box((-0.12, -0.05, 0), (0.12, 0.05, 0.28), "Wood_Walnut", 0.01)
     .cyl((0, -0.052, 0.17), 0.075, 0.075, 0.006, "Y", "Card_Cream", 16)
     .finish("Mantel_Clock", (FIRE_X + 0.4, 3.62, 1.27), "Furniture"))


def build_ladder():
    rail_y, rail_z = HY - 0.05, 2.5
    (Mesh()
     .cyl((1.65, rail_y, rail_z), 0.018, 0.018, 2.6, "X", "Metal_Brass", 12)
     .box((0.4, rail_y - 0.03, rail_z - 0.05), (2.95, HY, rail_z - 0.02), "Metal_Brass")
     .finish("Ladder_Rail", (1.65, HY, rail_z), "Room"))

    top = Vector((SERVICE_X, rail_y - 0.05, rail_z))
    foot_y = 3.45
    wd = "Wood_Walnut"
    m = Mesh()
    for dx in (-0.25, 0.25):
        beam(m, (SERVICE_X + dx, foot_y, 0.03), (SERVICE_X + dx, top.y, rail_z), 0.05, 0.05, wd)
        m.cyl((SERVICE_X + dx, top.y + 0.03, rail_z), 0.045, 0.045, 0.03, "Y", "Metal_Brass", 12)  # rail wheel
    for k in range(1, 9):
        t = k / 9
        y, z = foot_y + (top.y - foot_y) * t, 0.03 + (rail_z - 0.03) * t
        m.box((SERVICE_X - 0.25, y - 0.02, z - 0.02), (SERVICE_X + 0.25, y + 0.02, z + 0.02), wd, 0.005)
    ladder = finish_at(m, "Ladder", top, "Furniture")
    ladder["aside_offset_x"] = -0.9  # slides west by this much when the service door opens
    collider("Collider_Ladder", (SERVICE_X - 0.3, foot_y - 0.05, 0), (SERVICE_X + 0.3, HY, rail_z))


# ---------------------------------------------------------------------------
# Bookstacks
# ---------------------------------------------------------------------------

def build_stacks():
    rnd = random.Random(317)
    marked = {}
    for key, s in STACKS.items():
        side, cy = s["side"], s["cy"]
        y0, y1 = cy - STACK_INNER, cy + STACK_INNER
        wd = "Wood_Walnut"
        m = Mesh()
        sbox(m, side, cy, 0, 0.02, cy - STACK_LEN / 2, cy + STACK_LEN / 2, 0, STACK_H, wd)  # back
        for ya, yb in ((cy - STACK_LEN / 2, y0), (y1, cy + STACK_LEN / 2)):
            sbox(m, side, cy, 0, STACK_DEPTH, ya, yb, 0, STACK_H, wd, 0.006)  # end panels
        sbox(m, side, cy, 0, STACK_DEPTH, y0, y1, 0, SHELF_TOPS[0], wd)  # cupboard base
        for z in (0.12, 0.3):
            pass
        sbox(m, side, cy, STACK_DEPTH, STACK_DEPTH + 0.015, y0 + 0.05, cy - 0.02, 0.06, SHELF_TOPS[0] - 0.05, "Wood_Teal", 0.006)
        sbox(m, side, cy, STACK_DEPTH, STACK_DEPTH + 0.015, cy + 0.02, y1 - 0.05, 0.06, SHELF_TOPS[0] - 0.05, "Wood_Teal", 0.006)
        for z in SHELF_TOPS[1:]:
            sbox(m, side, cy, 0, STACK_DEPTH, y0, y1, z - 0.03, z, wd)
        sbox(m, side, cy, 0, STACK_DEPTH + 0.03, cy - STACK_LEN / 2, cy + STACK_LEN / 2, STACK_H - 0.03, STACK_H, wd, 0.008)
        if key == "A":  # crown moulding, so A reads as a different silhouette
            sbox(m, side, cy, 0, STACK_DEPTH + 0.06, cy - STACK_LEN / 2, cy + STACK_LEN / 2, STACK_H, STACK_H + 0.12, wd, 0.015)

        # Filler books: plain boxes, a gap kept where a marked/hero object sits.
        skips = {s["shelf"]: [(cy + s["off"] - 0.12, cy + s["off"] + 0.12)]}
        if key == "B":
            skips.setdefault(1, []).append((cy - 0.45 - 0.14, cy - 0.45 + 0.14))  # hollow dictionary
        if key == PANEL_STACK:
            skips.setdefault(1, []).append((PANEL_Y - 0.5, PANEL_Y + 0.5))  # panel bay
        for i, top in enumerate(SHELF_TOPS):
            clear = (SHELF_TOPS[i + 1] - 0.03 - top) if i + 1 < len(SHELF_TOPS) else (STACK_H - 0.03 - top)
            y = y0 + 0.01
            while y < y1 - 0.04:
                w = rnd.uniform(0.03, 0.07)
                if any(a < y + w and y < b for a, b in skips.get(i, [])):
                    y = max(b for a, b in skips[i] if a < y + w and y < b) + 0.005
                    continue
                if y + w > y1 - 0.01:
                    break
                if rnd.random() < 0.12:
                    y += rnd.uniform(0.04, 0.12)
                    continue
                h = min(rnd.uniform(0.20, 0.34), clear - 0.03)
                dd = rnd.uniform(0.2, 0.28)
                sbox(m, side, cy, 0.1, 0.1 + dd, y, y + w, top, top + h, rnd.choice(BOOK_MATS))
                y += w + 0.002
        finish_at(m, f"Stack_{key}", (stack_x(side, 0), cy, 0), "Furniture")

        # The marked folio: axis-aligned, base-centre origin, spine out. UV ink is parented to it.
        by = cy + s["off"]
        bz = SHELF_TOPS[s["shelf"]]
        front = stack_x(side, 0.1 + BOOK_D)
        base = Vector(((stack_x(side, 0.1) + front) / 2, by, bz))
        hx, hy = BOOK_D / 2, BOOK_W / 2
        bm = Mesh().box((-hx, -hy, 0), (hx, hy, BOOK_H), s["mat"], 0.006)
        bm.box((-hx - 0.0, -hy - 0.004, 0.02), (hx, hy + 0.004, BOOK_H - 0.02), "Pages")
        book = bm.finish(f"Prop_MarkedBook_{key}", base, "Props")
        book["stack"] = key
        book["shelf"] = s["shelf"] + 1  # 1 = bottom shelf
        book["digit"] = s["digit"]
        marked[key] = (book, base, front)

        sx = front + (0.003 if side == "W" else -0.003)
        sign = normal_for(side)
        spine_z = bz + BOOK_H / 2
        hp = Mesh()
        quad_facing(hp, (sx, by, spine_z), 0.06, 0.08, sign, "Placeholder_UV")
        hand = finish_at(hp, f"UVOnly_Handprint_{key}", (sx, by, spine_z), "UVOnly", parent=book)
        hand["uv_only"] = True
        hand["text"] = "handprint"
        sx2 = sx + (0.003 if side == "W" else -0.003)
        dp = Mesh()
        quad_facing(dp, (sx2, by, spine_z), 0.035, 0.06, sign, "Placeholder_UV")
        digit = finish_at(dp, f"UVOnly_Digit_{key}", (sx2, by, spine_z), "UVOnly", parent=book)
        digit["uv_only"] = True
        digit["text"] = str(s["digit"])

        collider(f"Collider_Stack_{key}", (stack_x(side, 0) - (0 if side == "W" else STACK_DEPTH),
                                           cy - STACK_LEN / 2, 0),
                 (stack_x(side, 0) + (STACK_DEPTH if side == "W" else 0), cy + STACK_LEN / 2, STACK_H))
    return marked


def build_hollow_dictionary():
    s = STACKS["B"]
    cy = s["cy"] - 0.45
    side = s["side"]
    x = (stack_x(side, 0.1) + stack_x(side, 0.1 + 0.3)) / 2
    m = (Mesh()
         .box((-0.15, -0.1, 0), (0.15, 0.1, 0.4), "Book_Rust", 0.008)
         .box((-0.15, -0.104, 0.02), (0.15, 0.104, 0.38), "Pages")
         .box((0.14, -0.1, 0.12), (0.152, 0.1, 0.28), "Metal_Brass"))  # label plate on the spine
    if side == "E":
        pass
    m.finish("Interact_Hollow_Dictionary", (x, cy, SHELF_TOPS[1]), "Interactables")
    battery(Mesh(), (0, 0, 0), along="Y").finish("Pickup_Battery_Dictionary", (x, cy, SHELF_TOPS[1] + 0.2), "Pickups")


def build_hidden_panel():
    s = STACKS[PANEL_STACK]
    side = s["side"]
    zc = PANEL_SHELF_Z + 0.06
    z0, z1 = zc, zc + 0.30
    pw = 0.4
    ya, yb = PANEL_Y - pw / 2, PANEL_Y + pw / 2
    f = 0.03
    x_wall = stack_x(side, 0.02)
    xf = stack_x(side, 0.17)  # front of the frame
    sgn = 1 if side == "W" else -1
    lo, hi = min(x_wall, xf), max(x_wall, xf)
    frame = (Mesh()
             .box((lo, ya, z0), (hi, ya + f, z1), "Wood_Walnut")
             .box((lo, yb - f, z0), (hi, yb, z1), "Wood_Walnut")
             .box((lo, ya + f, z0), (hi, yb - f, z0 + f), "Wood_Walnut")
             .box((lo, ya + f, z1 - f), (hi, yb - f, z1), "Wood_Walnut")
             .box((lo, ya + f, z0 + f), (lo + 0.01 if sgn > 0 else hi, yb - f, z1 - f), "Void")
             .box((hi - 0.01 if sgn > 0 else lo, ya + f, z0 + f), (hi if sgn > 0 else lo + 0.01, yb - f, z1 - f), "Void"))
    # Cavity is open at the front; the Void sheets above are just the back and the door shadow.
    finish_at(frame, "Hidden_Panel_Frame", (xf, PANEL_Y, z0), "Furniture")

    # Door: hinge on the south edge, flush with the front of the frame.
    xd0, xd1 = (xf - 0.012, xf) if sgn > 0 else (xf, xf + 0.012)
    hinge = Vector(((xd0 + xd1) / 2, ya + f, z0 + f))
    door = Mesh().box((xd0 - hinge.x, 0, 0), (xd1 - hinge.x, pw - 2 * f, z1 - z0 - 2 * f), "Wood_Walnut", 0.004)
    door_obj = door.finish("Interact_Hidden_Panel", hinge, "Interactables")

    lock = Mesh()
    fx = xd1 if sgn > 0 else xd0
    for k in range(4):
        lock.cyl((fx + 0.014 * sgn, PANEL_Y - 0.06 + k * 0.04, z0 + 0.06), 0.02, 0.02, 0.03, "Y", "Metal_Brass", 14)
    lock_obj = finish_at(lock, "Hidden_Panel_Lock", (fx + 0.014 * sgn, PANEL_Y, z0 + 0.06), "Interactables", parent=door_obj)
    lock_obj["solution"] = "7205"

    # Cavity contents, hidden by the game until the panel opens.
    inside_x = (x_wall + xf) / 2
    Mesh().box((-0.06, -0.012, 0), (0.06, 0.012, 0.012), "Metal_Iron")
    key = (Mesh()
           .cyl((-0.045, 0, 0.006), 0.022, 0.022, 0.012, "Z", "Metal_Iron", 12)
           .box((-0.02, -0.008, 0), (0.07, 0.008, 0.012), "Metal_Iron")
           .box((0.04, -0.03, 0), (0.055, -0.008, 0.012), "Metal_Iron")
           .box((0.06, -0.025, 0), (0.07, -0.008, 0.012), "Metal_Iron"))
    key.finish("Pickup_Kitchen_Key", (inside_x, PANEL_Y + 0.1, z0 + f + 0.006), "Pickups")
    (Mesh()
     .box((-0.075, -0.1, 0), (0.075, 0.1, 0.004), "Paper")
     .finish("Pickup_Diary_Page", (inside_x, PANEL_Y - 0.05, z0 + f + 0.002), "Pickups"))
    battery(Mesh(), (0, 0, 0), along="Y").finish("Pickup_Battery_Panel", (inside_x, PANEL_Y - 0.1, z0 + f + 0.1), "Pickups")

    # Loose books standing in front of the panel (grabbable, throwable). Axis-aligned, base-centre origin.
    rnd = random.Random(7)
    xp = stack_x(side, 0.28)
    for i in range(4):
        yy = PANEL_Y - 0.15 + i * 0.1
        h = rnd.uniform(0.42, 0.5)
        Mesh().box((-0.11, -0.05, 0), (0.11, 0.05, h), rnd.choice(BOOK_MATS), 0.005).finish(
            f"Prop_PanelBook_{i + 1}", (xp, yy, PANEL_SHELF_Z), "Props")


# ---------------------------------------------------------------------------
# Table, mimic spots, candle, desk, furniture
# ---------------------------------------------------------------------------

def book_mesh(w=0.2, d=0.28, h=0.05, mat="Book_Teal"):
    m = Mesh().box((-w / 2, -d / 2, 0), (w / 2, d / 2, h), mat, 0.004)
    m.box((-w / 2 + 0.006, -d / 2 - 0.003, 0.006), (w / 2 - 0.006, d / 2 + 0.003, h - 0.006), "Pages")
    return m


def stool_mesh():
    m = Mesh().cyl((0, 0, 0.42), 0.2, 0.2, 0.05, "Z", "Wood_Walnut", 16)
    for a in range(3):
        ang = a * 2 * math.pi / 3 + 0.5
        beam(m, (0.1 * math.cos(ang), 0.1 * math.sin(ang), 0.02), (0.15 * math.cos(ang), 0.15 * math.sin(ang), 0.42), 0.04, 0.04, "Wood_Walnut")
    return m


def build_table_and_mimic():
    wd = "Wood_Walnut"
    m = Mesh().box((-1.1, -0.45, TABLE_Z - 0.06), (1.1, 0.45, TABLE_Z), wd, 0.01)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box((sx * 1.0 - 0.05, sy * 0.35 - 0.05, 0), (sx * 1.0 + 0.05, sy * 0.35 + 0.05, TABLE_Z - 0.06), wd, 0.006)
    m.box((-1.0, -0.03, 0.2), (1.0, 0.03, 0.26), wd, 0.006)
    m.finish("Reading_Table", TABLE, "Furniture")
    collider("Collider_Reading_Table", TABLE + Vector((-1.1, -0.45, 0)), TABLE + Vector((1.1, 0.45, TABLE_Z)))

    book = book_mesh().finish("Decoy_Book_1", MIMIC_SPOTS[0], "Furniture")
    for i in (1, 2, 3):
        ob = bpy.data.objects.new(f"Decoy_Book_{i + 1}", book.data)
        place(ob, MIMIC_SPOTS[i], "Furniture")
    stool = stool_mesh().finish("Decoy_Stool", MIMIC_SPOTS[4], "Furniture")
    collider("Collider_Stool", MIMIC_SPOTS[4] + Vector((-0.2, -0.2, 0)), MIMIC_SPOTS[4] + Vector((0.2, 0.2, 0.47)))

    # The Mimic: disguises share the decoys' meshes exactly; the game moves it between spots.
    mb = bpy.data.objects.new("Mimic_Book", book.data)
    place(mb, MIMIC_SPOTS[2] + Vector((0, 0, 0.001)), "Ghosts")
    ms = bpy.data.objects.new("Mimic_Stool", stool.data)
    place(ms, MIMIC_SPOTS[4] + Vector((0, 0, 0.001)), "Ghosts")

    true = Mesh().box((-0.2, -0.14, 0.06), (0.2, 0.14, 0.1), "Placeholder_Mimic", 0.006)  # lower cover
    top = Mesh().box((-0.2, -0.14, 0), (0.2, 0.14, 0.04), "Placeholder_Mimic", 0.006)
    bmesh.ops.rotate(top.bm, verts=top.bm.verts[:], cent=(0, 0.14, 0), matrix=Matrix.Rotation(math.radians(-40), 3, "X"))
    bmesh.ops.translate(top.bm, verts=top.bm.verts[:], vec=(0, 0.0, 0.14))
    tmp = bpy.data.meshes.new("_t")
    top.bm.to_mesh(tmp)
    top.bm.free()
    true.bm.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)
    true.mats = list(dict.fromkeys(true.mats + ["Placeholder_Mimic"]))
    for i in range(7):  # page-teeth along the mouth
        x = -0.17 + i * 0.057
        true.box((x - 0.012, -0.13, 0.1), (x + 0.012, -0.11, 0.15), "Placeholder_Mimic")
    for sx in (-1, 1):
        for sy in (-1, 1):
            true.box((sx * 0.14 - 0.015, sy * 0.1 - 0.015, 0), (sx * 0.14 + 0.015, sy * 0.1 + 0.015, 0.06), "Placeholder_Mimic")
    true.finish("Mimic_True", MIMIC_SPOTS[2], "Ghosts")

    # Candle on a brass dish; the wick is the highest point.
    (Mesh()
     .cyl((0, 0, 0.008), 0.06, 0.06, 0.016, "Z", "Metal_Brass", 16)
     .cyl((0, 0, 0.09), 0.025, 0.025, 0.15, "Z", "Clay_Cream", 12)
     .cyl((0, 0, 0.175), 0.003, 0.003, 0.02, "Z", "Clay_Dark", 6)
     .finish("Prop_Candle", (0, 0.45, TABLE_Z), "Props"))

    for i, p in enumerate(MIMIC_SPOTS, 1):
        empty(f"Spawn_Mimic_{i}", p, "Spawns", display="CUBE", size=0.1)


def build_desk():
    wd = "Wood_Walnut"
    m = Mesh().box((-0.7, -0.35, 0.74), (0.7, 0.35, 0.8), wd, 0.008)
    m.box((-0.66, -0.31, 0), (-0.3, 0.31, 0.74), wd, 0.006)  # pedestal with drawers
    m.box((0.3, -0.31, 0), (0.66, 0.31, 0.74), wd, 0.006)
    m.box((-0.3, 0.28, 0.1), (0.3, 0.31, 0.7), wd)  # modesty panel
    m.finish("Librarian_Desk", DESK, "Furniture")
    # Decorative drawer fronts (no Interact_ prefix: not usable).
    for i, (x0, x1) in enumerate(((-0.62, -0.34), (0.34, 0.62))):
        d = Mesh().box((x0, 0, 0), (x1, 0.02, 0.2), "Wood_Teal", 0.006)
        d.cyl(((x0 + x1) / 2, 0.03, 0.1), 0.012, 0.012, 0.02, "Y", "Metal_Brass", 8)
        finish_at(d, f"Desk_Drawer_{i + 1}", (DESK.x + (x0 + x1) / 2, DESK.y - 0.35 - 0.0, DESK.z + 0.55), "Furniture")
    collider("Collider_Librarian_Desk", DESK + Vector((-0.7, -0.35, 0)), DESK + Vector((0.7, 0.35, 0.8)))

    # Lending ledger: an open book lying on the desk.
    (Mesh()
     .box((-0.25, -0.17, 0), (0.0, 0.17, 0.02), "Book_Plum", 0.004)
     .box((0.0, -0.17, 0), (0.25, 0.17, 0.02), "Book_Plum", 0.004)
     .box((-0.24, -0.16, 0.02), (-0.005, 0.16, 0.035), "Pages")
     .box((0.005, -0.16, 0.02), (0.24, 0.16, 0.035), "Pages")
     .finish("Interact_Ledger", DESK + Vector((-0.2, 0.0, 0.8)), "Interactables"))
    battery(Mesh(), (0, 0, 0)).finish("Pickup_Battery_Desk", DESK + Vector((0.35, -0.1, 0.8)), "Pickups")

    (Mesh()
     .cyl((0, 0, 0.012), 0.08, 0.08, 0.024, "Z", "Metal_Brass", 14)
     .cyl((0, 0, 0.17), 0.012, 0.012, 0.3, "Z", "Metal_Brass", 8)
     .box((-0.11, -0.09, 0.3), (0.11, 0.09, 0.4), "Book_Green", 0.012)
     .finish("Desk_Lamp", DESK + Vector((-0.55, 0.1, 0.8)), "Furniture"))
    (Mesh()
     .cyl((0, 0, 0.02), 0.035, 0.04, 0.04, "Z", "Clay_Dark", 12)
     .box((-0.004, -0.004, 0.04), (0.004, 0.004, 0.2), "Pages")
     .finish("Prop_Inkwell", DESK + Vector((0.55, 0.05, 0.8)), "Props"))
    (Mesh()
     .box((-0.1, -0.14, 0), (0.1, 0.14, 0.02), "Paper", 0.003)
     .finish("Prop_Papers", DESK + Vector((0.1, 0.12, 0.8)), "Props"))

    # Visitor chair on the north side of the desk.
    cp = Vector((DESK.x, -2.85, 0))
    c = Mesh().box((-0.22, -0.22, 0.42), (0.22, 0.22, 0.46), "Wood_Teal", 0.005)
    for sx in (-1, 1):
        for sy in (-1, 1):
            c.box((sx * 0.19 - 0.02, sy * 0.19 - 0.02, 0), (sx * 0.19 + 0.02, sy * 0.19 + 0.02, 0.42), "Wood_Teal", 0.003)
    c.box((-0.22, -0.22, 0.46), (0.22, -0.18, 0.95), "Wood_Teal", 0.005)
    c.finish("Desk_Chair", cp, "Furniture")
    collider("Collider_Desk_Chair", cp + Vector((-0.25, -0.25, 0)), cp + Vector((0.25, 0.25, 0.95)))


def build_furniture():
    ap = Vector((-1.4, 2.4, 0))
    c = (Mesh()
         .box((-0.4, -0.4, 0.15), (0.4, 0.4, 0.4), "Felt_Plum", 0.03)
         .box((-0.4, -0.4, 0.4), (0.4, -0.2, 1.0), "Felt_Plum", 0.03)
         .box((-0.4, -0.4, 0.15), (-0.28, 0.4, 0.62), "Felt_Plum", 0.03)
         .box((0.28, -0.4, 0.15), (0.4, 0.4, 0.62), "Felt_Plum", 0.03)
         .box((-0.38, 0.3, 0), (-0.32, 0.36, 0.15), "Wood_Walnut")
         .box((0.32, 0.3, 0), (0.38, 0.36, 0.15), "Wood_Walnut")
         .box((-0.38, -0.36, 0), (-0.32, -0.3, 0.15), "Wood_Walnut")
         .box((0.32, -0.36, 0), (0.38, -0.3, 0.15), "Wood_Walnut"))
    c.finish("Reading_Armchair", ap, "Furniture")
    collider("Collider_Armchair", ap + Vector((-0.4, -0.4, 0)), ap + Vector((0.4, 0.4, 1.0)))

    (Mesh()
     .box((-1.7, -1.2, 0), (1.7, 1.2, 0.012), "Felt_Plum", 0.004)
     .box((-1.55, -1.05, 0.012), (1.55, 1.05, 0.016), "Felt_Teal")
     .box((-1.45, -0.95, 0.016), (1.45, 0.95, 0.018), "Felt_Plum")
     .finish("Rug", (0, 0.4, 0), "Furniture"))

    gp = Vector((-2.2, 0.4, 0))
    g = (Mesh()
         .cyl((0, 0, 0.03), 0.17, 0.17, 0.06, "Z", "Wood_Walnut", 12)
         .cyl((0, 0, 0.3), 0.02, 0.02, 0.5, "Z", "Wood_Walnut", 8)
         .sphere((0, 0, 0.5), 0.2, "Book_Teal"))
    g.finish("Globe", gp, "Furniture")
    collider("Collider_Globe", gp + Vector((-0.2, -0.2, 0)), gp + Vector((0.2, 0.2, 0.7)))

    # Bust on top of stack C so it reads from the entrance.
    (Mesh()
     .box((-0.12, -0.12, 0), (0.12, 0.12, 0.08), "Card_Cream", 0.008)
     .cyl((0, 0, 0.2), 0.1, 0.07, 0.24, "Z", "Card_Cream", 10)
     .sphere((0, 0, 0.38), 0.09, "Card_Cream")
     .finish("Prop_Bust", (stack_x("E", 0.25), STACKS["C"]["cy"], STACK_H), "Props"))

    # A small pile of books on the floor, and a fallen book.
    pile = Mesh()
    for i, (w, d, mat) in enumerate(((0.3, 0.22, "Book_Rust"), (0.26, 0.2, "Book_Green"), (0.22, 0.18, "Book_Plum"))):
        pile.box((-w / 2, -d / 2, i * 0.05), (w / 2, d / 2, i * 0.05 + 0.05), mat, 0.004)
    pile.finish("Prop_Book_Pile", (1.9, -3.0, 0), "Props")
    book_mesh(0.22, 0.3, 0.05, "Book_Ochre").finish("Prop_Fallen_Book", (-1.7, -0.9, 0), "Props")


# ---------------------------------------------------------------------------
# Ghosts, spawns, UV message, UV lamp
# ---------------------------------------------------------------------------

def build_uv_message():
    pm = Mesh()
    quad_facing(pm, (FIRE_X, BREAST_Y - 0.003, 2.15), 0.8, 0.2, "-Y", "Placeholder_UV")
    msg = finish_at(pm, "UVOnly_Message", (FIRE_X, BREAST_Y - 0.003, 2.15), "UVOnly")
    msg["uv_only"] = True
    msg["text"] = "The hall remembers what the clock forgot."


def build_ghosts_and_spawns():
    head_r = 0.13
    profile = [(head_r * math.cos(a), head_r * math.sin(a)) for a in (i / 16 * math.pi / 2 for i in range(17))]
    profile += [(-0.5 * t, head_r + 0.105 * t ** 0.8) for t in (i / 64 for i in range(1, 65))]
    spawn = Vector((INK_PATH[0][0], INK_PATH[0][1], INK_Z))
    # Wisp shape until the Ink Ghost is designed (spec open question).
    Mesh().lathe(profile, "Placeholder_InkGhost", 160).finish("Ink_Ghost", spawn, "Ghosts")

    empty("Spawn_Player", (0, -3.3, 0), "Spawns")
    empty("Spawn_InkGhost", spawn, "Spawns", display="SPHERE", size=0.15)
    for i, (x, y) in enumerate(INK_PATH, 1):
        empty(f"Path_InkGhost_{i:02d}", (x, y, INK_Z), "Spawns", display="SPHERE", size=0.08)
    empty("Spawn_Battery_Emergency", (-0.9, -3.5, 0), "Spawns", display="CUBE", size=0.1)


def build_uv_lamp():
    """Floor pickup, 0.18 long, base-centre origin. Exported separately as uv-lamp.glb."""
    m = (Mesh()
         .cyl((0, 0, 0.03), 0.028, 0.028, 0.14, "X", "UV_Glass", 14)
         .cyl((-0.08, 0, 0.03), 0.032, 0.032, 0.02, "X", "Metal_Brass", 14)
         .cyl((0.08, 0, 0.03), 0.032, 0.032, 0.02, "X", "Metal_Brass", 14)
         .box((-0.05, -0.02, 0), (0.05, 0.02, 0.012), "Metal_Dark", 0.003))
    m.finish("Pickup_UV_Lamp", (4.5, 0, 0), "Held_Items")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def export_room():
    os.makedirs(EXPORT_DIR, exist_ok=True)
    objs = [o for name in ROOM_COLLECTIONS for o in bpy.data.collections[name].objects]
    export_glb(GLB_PATH, objs)
    lamp = bpy.data.objects["Pickup_UV_Lamp"]
    parked = lamp.location.copy()
    lamp.location = (0, 0, 0)
    export_glb(os.path.join(EXPORT_DIR, "uv-lamp.glb"), [lamp])
    lamp.location = parked


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    WORLD.clear()
    scene = bpy.context.scene
    scene.name = "Level_2"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    for name in COLLECTIONS:
        scene.collection.children.link(bpy.data.collections.new(name))
    for name, spec in MATERIALS.items():
        make_material(name, *spec)

    build_shell()
    build_window()
    build_doors()
    build_fireplace()
    build_ladder()
    build_stacks()
    build_hollow_dictionary()
    build_hidden_panel()
    build_table_and_mimic()
    build_desk()
    build_furniture()
    build_uv_message()
    build_ghosts_and_spawns()
    build_uv_lamp()

    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    export_room()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

    print("\n== Level 2 objects ==")
    tris = 0
    for coll in COLLECTIONS:
        for obj in bpy.data.collections[coll].objects:
            loc = obj.matrix_world.translation
            dim = obj.dimensions
            if obj.type == "MESH" and coll != "Colliders":
                tris += sum(len(p.vertices) - 2 for p in obj.data.polygons)
            print(f"{coll:14} {obj.name:30} origin=({loc.x:6.3f},{loc.y:6.3f},{loc.z:6.3f}) "
                  f"size=({dim.x:.3f},{dim.y:.3f},{dim.z:.3f})")
    print(f"\ntriangles (no colliders): {tris}")


if __name__ == "__main__":
    main()
