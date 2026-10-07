"""Level 1 (Entrance Hall) blockout builder.

Builds the hall from docs/level-1-blender-asset-spec.md (step 1, blockout),
saves blender/level-1.blend and exports blender/export/level-1.glb.

Run:  /Applications/Blender.app/Contents/MacOS/Blender -b --python blender/scripts/build_level1.py

WARNING: this regenerates level-1.blend from scratch. Once the .blend has been
refined by hand, do not re-run it; use export_level1.py to re-export instead.

Conventions (same as Level 0): 1 unit = 1 m, +Y is north, +Z is up. The hall
interior is x -3..3, y -4..4, z 0..4 with the floor centre at the world origin.
Static meshes are built in their final orientation (identity rotation and
scale). Parts are mostly given in world coordinates and moved to the object
origin by `finish_at`.

Shared helpers (Mesh, collider, empty, wall_frame, materials, export) come
from build_level0.py, which is only imported, never run.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_level0 as L0  # noqa: E402
from build_level0 import WORLD, Mesh, collider, empty, export_glb, make_material, place, wall_frame  # noqa: E402

BLENDER_DIR = os.path.dirname(HERE)
BLEND_PATH = os.path.join(BLENDER_DIR, "level-1.blend")
EXPORT_DIR = os.path.join(BLENDER_DIR, "export")
GLB_PATH = os.path.join(EXPORT_DIR, "level-1.glb")

COLLECTIONS = ["Room", "Furniture", "Interactables", "Pickups", "MirrorOnly", "Ghosts", "Colliders", "Spawns"]

MATERIALS = dict(L0.MATERIALS)
MATERIALS.update({
    "Wallpaper_Plum": ("3d2539", 0.95, 0.0, 1.0),
    "Paper": ("efe4c6", 0.95, 0.0, 1.0),
    "Paint_Vermilion": ("c63b2b", 0.9, 0.0, 1.0),
    "Void": ("0d0c1f", 1.0, 0.0, 1.0),
    # Replaced by textures later (portrait paintings, clock note); flat stand-ins for now.
    "Placeholder_Portrait_1": ("6e5a48", 0.95, 0.0, 1.0),
    "Placeholder_Portrait_2": ("56607a", 0.95, 0.0, 1.0),
    "Placeholder_Portrait_3": ("7a5a3c", 0.95, 0.0, 1.0),
    "Placeholder_Clock_Glass": ("a9c4d6", 0.1, 0.0, 0.3),
})

# ---------------------------------------------------------------------------
# Dimensions
# ---------------------------------------------------------------------------

HX, HY, H = 3.0, 4.0, 4.0  # interior half-width, half-depth, height
T = 0.15  # wall thickness
WAIN_H, WAIN_T = 1.0, 0.03  # wainscot height and depth (cap rail sits on top, 0.05 deep)
CAP = 0.05

FD_W, FD_H, FD_FRAME = 1.6, 2.6, 0.12  # front door clear opening, frame
WIN = (-2.4, -1.4, 0.6, 3.0)  # window: x min, x max, z min, z max (south wall)

LD_Y, LD_W, LD_H, LD_FRAME = 3.0, 1.0, 2.2, 0.1  # Library door on the east wall
LD_Y0, LD_Y1 = LD_Y - LD_W / 2 - LD_FRAME, LD_Y + LD_W / 2 + LD_FRAME  # wall opening
LD_TOP = LD_H + LD_FRAME

ST_Y0 = HY - 1.2  # staircase inner (hall-side) edge; stairs run along the north wall
ST_FOOT_X = 1.0  # first riser
N_RISERS = 14
LANDING_Z = 2.4
ST_RUN = 0.2
LANDING_X = ST_FOOT_X - (N_RISERS - 1) * ST_RUN  # -1.6: landing spans x -3..-1.6
RISE = LANDING_Z / N_RISERS

MIRROR_Y, MIRROR_Z = -0.4, 1.75  # mirror centre on the west wall
TEXT_Z = 2.85  # mirror-only text centre on the east wall

CHEST = Vector((-1.6, 2.35, 0))  # in front of the stairs, so its inside can be seen
CLOCK = Vector((2.1, HY - 0.2, 0))
DESK = Vector((-HX + 0.05 + 0.275, -2.4, 0))
CONSOLE = Vector((-HX + 0.035 + 0.175, MIRROR_Y, 0))
COAT_RACK = Vector((2.4, -3.4, 0))
WISP_KEY_SPAWN = Vector((0, 0.6, 1.4))
WISP_GALLERY_SPAWN = Vector((-2.3, 3.4, 3.0))


# ---------------------------------------------------------------------------
# Helpers on top of Level 0's Mesh
# ---------------------------------------------------------------------------

def finish_at(m, name, origin, collection, parent=None):
    """Finish a mesh whose parts were given in world coordinates, with its origin at `origin`."""
    origin = Vector(origin)
    bmesh.ops.translate(m.bm, verts=m.bm.verts[:], vec=-origin)
    return m.finish(name, origin, collection, parent)


def beam(m, p1, p2, w, h, mat):
    """Box from p1 to p2 (any direction), w x h cross-section."""
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    rot = Vector((1, 0, 0)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    part = bmesh.new()
    matrix = Matrix.Translation((p1 + p2) / 2) @ rot @ Matrix.Diagonal((d.length, w, h, 1.0))
    bmesh.ops.create_cube(part, size=1.0, matrix=matrix)
    m._merge(part, mat)
    return m


def rotated_box(m, centre, size, angle, axis, mat):
    part = bmesh.new()
    matrix = Matrix.Translation(Vector(centre)) @ Matrix.Rotation(angle, 4, axis) @ Matrix.Diagonal((*size, 1.0))
    bmesh.ops.create_cube(part, size=1.0, matrix=matrix)
    m._merge(part, mat)
    return m


class Rot:
    """Adds boxes to `mesh` in a frame turned k quarter-turns about Z (k=1: local +X -> world +Y)."""

    def __init__(self, mesh, k):
        self.m = mesh
        self.c, self.s = ((1, 0), (0, 1), (-1, 0), (0, -1))[k % 4]

    def _p(self, x, y):
        return (x * self.c - y * self.s, x * self.s + y * self.c)

    def box(self, lo, hi, mat, bevel=0.0):
        a, b = self._p(lo[0], lo[1]), self._p(hi[0], hi[1])
        self.m.box((min(a[0], b[0]), min(a[1], b[1]), lo[2]),
                   (max(a[0], b[0]), max(a[1], b[1]), hi[2]), mat, bevel)
        return self


def quad_facing(m, centre, half_u, half_v, normal, mat):
    """Wall-mounted quad; UVs read left-to-right for a viewer looking at its front."""
    cx, cy, cz = centre
    if normal == "-X":  # on the east wall; viewer faces +X, their right is -Y
        corners = [(cx, cy + half_u, cz - half_v), (cx, cy - half_u, cz - half_v),
                   (cx, cy - half_u, cz + half_v), (cx, cy + half_u, cz + half_v)]
    elif normal == "+X":  # on the west wall; viewer faces -X, their right is +Y
        corners = [(cx, cy - half_u, cz - half_v), (cx, cy + half_u, cz - half_v),
                   (cx, cy + half_u, cz + half_v), (cx, cy - half_u, cz + half_v)]
    elif normal == "-Y":  # viewer faces +Y, their right is +X
        corners = [(cx - half_u, cy, cz - half_v), (cx + half_u, cy, cz - half_v),
                   (cx + half_u, cy, cz + half_v), (cx - half_u, cy, cz + half_v)]
    else:
        raise ValueError(normal)
    return m.quad(corners, mat, [(0, 0), (1, 0), (1, 1), (0, 1)])


def battery(m, centre_base, along="X"):
    """Level 0 battery pack (0.1 long), base centre at `centre_base` (local coords)."""
    x, y, z = centre_base
    if along == "X":
        m.box((x - 0.05, y - 0.015, z), (x + 0.05, y + 0.015, z + 0.06), "Clay_Dark", 0.005)
        m.box((x - 0.03, y - 0.016, z + 0.015), (x + 0.03, y + 0.016, z + 0.045), "Card_Cream")
        m.box((x - 0.056, y - 0.008, z + 0.02), (x - 0.05, y + 0.008, z + 0.04), "Metal_Brass")
    else:
        m.box((x - 0.015, y - 0.05, z), (x + 0.015, y + 0.05, z + 0.06), "Clay_Dark", 0.005)
        m.box((x - 0.016, y - 0.03, z + 0.015), (x + 0.016, y + 0.03, z + 0.045), "Card_Cream")
        m.box((x - 0.008, y + 0.05, z + 0.02), (x + 0.008, y + 0.056, z + 0.04), "Metal_Brass")
    return m


# ---------------------------------------------------------------------------
# Room shell
# ---------------------------------------------------------------------------

def build_shell():
    o = (0, 0, 0)
    W = "Wallpaper_Plum"
    Mesh().box((-HX - T, -HY - T, -0.1), (HX + T, HY + T, 0), "Wood_Floor").finish("Floor", o, "Room")
    Mesh().box((-HX - T, -HY - T, H), (HX + T, HY + T, H + 0.1), "Card_Cream").finish("Ceiling", o, "Room")

    Mesh().box((-HX - T, HY, 0), (HX + T, HY + T, H), W).finish("Wall_N", o, "Room")
    Mesh().box((-HX - T, -HY, 0), (-HX, HY, H), W).finish("Wall_W", o, "Room")
    (Mesh()
     .box((HX, -HY, 0), (HX + T, LD_Y0, H), W)
     .box((HX, LD_Y1, 0), (HX + T, HY, H), W)
     .box((HX, LD_Y0, LD_TOP), (HX + T, LD_Y1, H), W)
     .finish("Wall_E", o, "Room"))

    d = FD_W / 2 + FD_FRAME
    x0, x1, z0, z1 = WIN
    (Mesh()
     .box((-HX - T, -HY - T, 0), (x0, -HY, H), W)
     .box((x0, -HY - T, 0), (x1, -HY, z0), W)
     .box((x0, -HY - T, z1), (x1, -HY, H), W)
     .box((x1, -HY - T, 0), (-d, -HY, H), W)
     .box((-d, -HY - T, FD_H + FD_FRAME), (d, -HY, H), W)
     .box((d, -HY - T, 0), (HX + T, -HY, H), W)
     .finish("Wall_S", o, "Room"))

    # Wainscot: dark walnut panelling with a cap rail, skipping the doorways.
    wood = "Wood_Walnut"
    wain = Mesh()
    segs = [  # (lo xy, hi xy) of each run, as panel footprints
        ((-HX, HY - WAIN_T), (HX, HY)),
        ((-HX, -HY + WAIN_T), (-HX + WAIN_T, HY - WAIN_T)),
        ((HX - WAIN_T, -HY + WAIN_T), (HX, LD_Y0)),
        ((HX - WAIN_T, LD_Y1), (HX, HY - WAIN_T)),
        ((-HX, -HY), (x0, -HY + WAIN_T)),
        ((x1, -HY), (-d, -HY + WAIN_T)),
        ((d, -HY), (HX, -HY + WAIN_T)),
    ]
    for (ax, ay), (bx, by) in segs:
        wain.box((ax, ay, 0), (bx, by, WAIN_H), wood)
        # cap rail: grow the footprint towards the room by CAP - WAIN_T
        g = CAP - WAIN_T
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
    wain.box((x0, -HY, 0), (x1, -HY + WAIN_T, z0), wood)  # under the window
    wain.finish("Wainscot", o, "Room")

    # Cornice along the top of every wall.
    c, ch = 0.08, 0.15
    (Mesh()
     .box((-HX, HY - c, H - ch), (HX, HY, H), wood, 0.01)
     .box((-HX, -HY, H - ch), (HX, -HY + c, H), wood, 0.01)
     .box((-HX, -HY + c, H - ch), (-HX + c, HY - c, H), wood, 0.01)
     .box((HX - c, -HY + c, H - ch), (HX, HY - c, H), wood, 0.01)
     .finish("Cornice", o, "Room"))

    collider("Collider_Floor", (-HX - T, -HY - T, -0.1), (HX + T, HY + T, 0))
    collider("Collider_Ceiling", (-HX - T, -HY - T, H), (HX + T, HY + T, H + 0.1))
    collider("Collider_Wall_N", (-HX - T, HY, 0), (HX + T, HY + T, H))
    collider("Collider_Wall_S", (-HX - T, -HY - T, 0), (HX + T, -HY, H))
    collider("Collider_Wall_W", (-HX - T, -HY, 0), (-HX, HY, H))
    # East wall is split so the doorway is free once the Library door is open.
    collider("Collider_Wall_E_S", (HX, -HY, 0), (HX + T, LD_Y - LD_W / 2, H))
    collider("Collider_Wall_E_N", (HX, LD_Y + LD_W / 2, 0), (HX + T, HY, H))


def build_window():
    x0, x1, z0, z1 = WIN
    f, tw = 0.08, "Wood_Teal"
    ya, yb = -HY - T - 0.03, -HY + 0.03
    xm = (x0 + x1) / 2
    m = (Mesh()
         .box((x0, ya, z0), (x0 + f, yb, z1), tw, 0.012)
         .box((x1 - f, ya, z0), (x1, yb, z1), tw, 0.012)
         .box((x0 + f, ya, z0), (x1 - f, yb, z0 + f), tw, 0.012)
         .box((x0 + f, ya, z1 - f), (x1 - f, yb, z1), tw, 0.012)
         .box((xm - 0.025, -HY - 0.10, z0 + f), (xm + 0.025, -HY - 0.05, z1 - f), tw, 0.006))
    for z in (1.4, 2.2):  # glazing bars
        m.box((x0 + f, -HY - 0.10, z - 0.02), (x1 - f, -HY - 0.05, z + 0.02), tw, 0.006)
    m.box((x0 - 0.08, -HY, z0 - 0.04), (x1 + 0.08, -HY + 0.14, z0), tw, 0.012)  # sill
    m.cyl(((x0 + x1) / 2, -HY + 0.11, 3.45), 0.02, 0.02, (x1 - x0) + 0.9, "X", "Metal_Brass", 12)  # curtain rod
    finish_at(m, "Window_Frame", (xm, -HY, z0), "Room")

    glass = Mesh().box((x0 + f, -HY - 0.085, z0 + f), (x1 - f, -HY - 0.075, z1 - f), "Glass")
    finish_at(glass, "Window_Glass", (xm, -HY, z0), "Room")

    for name, a, b in (("Window_Curtain_L", x0 - 0.38, x0 - 0.04), ("Window_Curtain_R", x1 + 0.04, x1 + 0.38)):
        cm = Mesh().box((a, -HY + 0.06, 0.25), (b, -HY + 0.16, 3.42), "Felt_Plum", 0.02)
        # a tie-back bulge halfway down
        cm.box((a - 0.02, -HY + 0.04, 1.35), (b + 0.02, -HY + 0.18, 1.45), "Metal_Brass", 0.01)
        finish_at(cm, name, ((a + b) / 2, -HY + 0.11, 0), "Room")


# ---------------------------------------------------------------------------
# Doors
# ---------------------------------------------------------------------------

def build_front_door():
    d = FD_W / 2 + FD_FRAME
    ya, yb = -HY - T - 0.03, -HY + 0.03
    fr = (Mesh()
          .box((-d, ya, 0), (-FD_W / 2, yb, FD_H), "Wood_Walnut", 0.015)
          .box((FD_W / 2, ya, 0), (d, yb, FD_H), "Wood_Walnut", 0.015)
          .box((-d - 0.05, ya, FD_H), (d + 0.05, yb + 0.02, FD_H + FD_FRAME + 0.05), "Wood_Walnut", 0.015))
    finish_at(fr, "Front_Door_Frame", (0, -HY, 0), "Room")

    # Two leaves, closed, hinged on their outer edges. The intro opens them
    # (custom property intro_open_deg) and slams them shut.
    hinge_y = -HY - T / 2
    half = FD_W / 2
    for name, sx in (("Front_Door_L", -1), ("Front_Door_R", 1)):
        origin = Vector((sx * half, hinge_y, 0))
        lo, hi = (0.0, half) if sx < 0 else (-half, 0.0)
        tw = "Wood_Teal"
        m = Mesh().box((lo, -0.04, 0), (hi, 0.04, FD_H), tw, 0.01)
        for z_lo, z_hi in ((0.25, 1.1), (1.3, 2.4)):  # raised panels on the hall side
            m.box((lo + 0.1, 0.04, z_lo), (hi - 0.1, 0.06, z_hi), tw, 0.008)
        hx = hi - 0.1 if sx < 0 else lo + 0.1  # handle near the meeting edge
        m.cyl((hx, 0.07, 1.1), 0.035, 0.035, 0.02, "Y", "Metal_Brass", 12)
        m.sphere((hx, 0.105, 1.1), 0.045, "Metal_Brass")
        door = m.finish(name, origin, "Interactables")
        door["intro_open_deg"] = 70.0 if sx < 0 else -70.0  # rotation about Z that opens it into the hall

    collider("Collider_Front_Door", (-FD_W / 2, -HY - T, 0), (FD_W / 2, -HY, FD_H))


def build_library_door():
    xa, xb = HX - 0.03, HX + T + 0.03
    tw = "Wood_Walnut"
    fr = (Mesh()
          .box((xa, LD_Y0, 0), (xb, LD_Y - LD_W / 2, LD_H), tw, 0.012)
          .box((xa, LD_Y + LD_W / 2, 0), (xb, LD_Y1, LD_H), tw, 0.012)
          .box((xa, LD_Y0 - 0.04, LD_H), (xb + 0.0, LD_Y1 + 0.04, LD_TOP + 0.03), tw, 0.012))
    finish_at(fr, "Library_Door_Frame", (HX, LD_Y, 0), "Room")

    # Leaf: origin on the hinge edge (south side) at floor level, leaf along +Y.
    origin = Vector((HX + T / 2, LD_Y - LD_W / 2, 0))
    m = Mesh().box((-0.03, 0, 0), (0.03, LD_W, LD_H), "Wood_Teal", 0.01)
    for z_lo, z_hi in ((0.2, 0.95), (1.15, 2.0)):
        m.box((-0.045, 0.1, z_lo), (-0.03, LD_W - 0.1, z_hi), "Wood_Teal", 0.006)
    door = m.finish("Interact_Library_Door", origin, "Interactables")

    (Mesh()
     .cyl((0, 0, 0), 0.015, 0.015, 0.17, "X", "Metal_Brass", 12)
     .cyl((-0.035, 0, 0), 0.05, 0.05, 0.01, "X", "Metal_Brass")
     .cyl((0.035, 0, 0), 0.05, 0.05, 0.01, "X", "Metal_Brass")
     .sphere((-0.09, 0, 0), 0.045, "Metal_Brass")
     .sphere((0.09, 0, 0), 0.045, "Metal_Brass")
     .cyl((-0.031, 0, -0.08), 0.012, 0.012, 0.003, "X", "Clay_Dark", 10)  # keyhole
     .finish("Library_Door_Handle", origin + Vector((0, 0.88, 1.05)), "Interactables", parent=door))

    collider("Collider_Library_Door", origin + Vector((-0.03, 0, 0)), origin + Vector((0.03, LD_W, LD_H)),
             parent=door)

    sign = Mesh().box((HX - 0.015, LD_Y - 0.18, LD_TOP + 0.1), (HX, LD_Y + 0.18, LD_TOP + 0.2), "Metal_Brass", 0.004)
    finish_at(sign, "Library_Door_Sign", (HX, LD_Y, LD_TOP + 0.15), "Room")

    # A dark vestibule behind the door, so the opening never shows the void.
    vx0, vx1 = HX + T, HX + T + 1.2
    v = (Mesh()
         .box((vx0, LD_Y0 - 0.15, -0.1), (vx1 + 0.15, LD_Y1 + 0.15, 0), "Void")
         .box((vx0, LD_Y0 - 0.15, LD_TOP), (vx1 + 0.15, LD_Y1 + 0.15, LD_TOP + 0.1), "Void")
         .box((vx1, LD_Y0, 0), (vx1 + 0.15, LD_Y1, LD_TOP), "Void")
         .box((vx0, LD_Y0 - 0.15, 0), (vx1, LD_Y0, LD_TOP), "Void")
         .box((vx0, LD_Y1, 0), (vx1, LD_Y1 + 0.15, LD_TOP), "Void"))
    finish_at(v, "Library_Vestibule", (vx0, LD_Y, 0), "Room")
    collider("Collider_Vestibule_Back", (vx1, LD_Y0, 0), (vx1 + 0.15, LD_Y1, LD_TOP))
    collider("Collider_Vestibule_S", (vx0, LD_Y0 - 0.15, 0), (vx1, LD_Y0, LD_TOP))
    collider("Collider_Vestibule_N", (vx0, LD_Y1, 0), (vx1, LD_Y1 + 0.15, LD_TOP))


def build_boarded_door():
    y, w, h = 1.8, 1.0, 2.2
    x = -HX
    m = (Mesh()
         .box((x, y - w / 2 - 0.1, 0), (x + 0.08, y - w / 2, h), "Wood_Walnut", 0.01)
         .box((x, y + w / 2, 0), (x + 0.08, y + w / 2 + 0.1, h), "Wood_Walnut", 0.01)
         .box((x, y - w / 2 - 0.1, h), (x + 0.08, y + w / 2 + 0.1, h + 0.1), "Wood_Walnut", 0.01)
         .box((x, y - w / 2, 0), (x + 0.05, y + w / 2, h), "Wood_Teal"))
    for z, ang in ((0.5, 0.45), (1.15, -0.4), (1.75, 0.3)):
        rotated_box(m, (x + 0.09, y, z), (0.04, 1.35, 0.16), ang, "X", "Wood_Floor")
    finish_at(m, "Boarded_Door", (x, y, 0), "Room")


# ---------------------------------------------------------------------------
# Staircase along the north wall, rising west to a landing; not climbable
# ---------------------------------------------------------------------------

def step_top(i):
    return (i + 1) * RISE


def step_x(i):
    return ST_FOOT_X - (i + 1) * ST_RUN, ST_FOOT_X - i * ST_RUN  # (x lo, x hi)


BAY = (-2.1, -1.1, 0.9)  # open bay for the chest under the stairs: x lo, x hi, height


def build_stairs():
    m = Mesh()
    for i in range(N_RISERS - 1):
        xl, xh = step_x(i)
        top = step_top(i)
        m.box((xl, ST_Y0, max(0.0, top - 0.4)), (xh, HY - WAIN_T, top - 0.03), "Wood_Walnut")
        m.box((xl - 0.03, ST_Y0 - 0.02, top - 0.03), (xh, HY - WAIN_T, top), "Wood_Walnut", 0.006)  # nosing
        m.box((xl, ST_Y0 + 0.25, top), (xh, HY - 0.3, top + 0.008), "Felt_Plum")  # runner
    finish_at(m, "Stairs", (ST_FOOT_X, ST_Y0, 0), "Room")

    landing = (Mesh()
               .box((-HX, ST_Y0, LANDING_Z - 0.12), (LANDING_X, HY - WAIN_T, LANDING_Z), "Wood_Walnut", 0.008)
               .box((-HX + 0.2, ST_Y0 + 0.25, LANDING_Z), (LANDING_X, HY - 0.3, LANDING_Z + 0.008), "Felt_Plum"))
    finish_at(landing, "Landing", (LANDING_X, ST_Y0, LANDING_Z), "Room")

    # Panelling closing the space under the stairs on the hall side, with the chest bay left open.
    under = Mesh()
    columns = [(step_x(i)[0], step_x(i)[1], step_top(i) - 0.4) for i in range(N_RISERS - 1)]
    columns.append((-HX, LANDING_X, LANDING_Z - 0.12))
    bx0, bx1, bz = BAY
    for xl, xh, ztop in columns:
        if ztop <= 0:
            continue
        pieces = []
        if xh <= bx0 or xl >= bx1:
            pieces.append((xl, xh, 0.0))
        else:
            if xl < bx0:
                pieces.append((xl, bx0, 0.0))
            if xh > bx1:
                pieces.append((bx1, xh, 0.0))
            pieces.append((max(xl, bx0), min(xh, bx1), bz))
        for a, b, z0 in pieces:
            if ztop > z0:
                under.box((a, ST_Y0, z0), (b, ST_Y0 + 0.03, ztop), "Wood_Walnut")
    under.box((bx0 - 0.05, ST_Y0 - 0.02, 0), (bx0, ST_Y0 + 0.04, bz + 0.05), "Wood_Walnut", 0.006)  # bay trim
    under.box((bx1, ST_Y0 - 0.02, 0), (bx1 + 0.05, ST_Y0 + 0.04, bz + 0.05), "Wood_Walnut", 0.006)
    under.box((bx0 - 0.05, ST_Y0 - 0.02, bz), (bx1 + 0.05, ST_Y0 + 0.04, bz + 0.05), "Wood_Walnut", 0.006)
    under.box((bx0, ST_Y0 + 0.03, 0), (bx1, HY - WAIN_T, 0.005), "Clay_Dark")  # nook floor shadow
    finish_at(under, "Stairs_Underside", (-1.6, ST_Y0, 0), "Room")

    # Intact banister from step 4 up to the landing.
    py = ST_Y0 + 0.05
    ban = Mesh()
    for i in range(4, N_RISERS - 1, 2):
        xl, xh = step_x(i)
        xm = (xl + xh) / 2
        ban.box((xm - 0.025, py - 0.025, step_top(i)), (xm + 0.025, py + 0.025, step_top(i) + 0.9), "Wood_Walnut")
    x4 = sum(step_x(4)) / 2
    beam(ban, (x4 + 0.1, py, step_top(4) + 0.9 + 0.1 * RISE / ST_RUN * -1), (LANDING_X, py, LANDING_Z + 0.9),
         0.07, 0.06, "Wood_Walnut")
    ban.box((LANDING_X - 0.06, py - 0.06, LANDING_Z), (LANDING_X + 0.06, py + 0.06, LANDING_Z + 1.05), "Wood_Walnut", 0.01)
    ban.sphere((LANDING_X, py, LANDING_Z + 1.1), 0.06, "Wood_Walnut")
    # Broken stubs where the lower banister snapped off.
    for i in (0, 2):
        xl, xh = step_x(i)
        xm = (xl + xh) / 2
        ban.box((xm - 0.025, py - 0.025, step_top(i)), (xm + 0.025, py + 0.025, step_top(i) + 0.28), "Wood_Walnut")
    finish_at(ban, "Banister", (x4, py, step_top(4)), "Room")

    # The snapped newel post lies across the foot of the stairs; a rail leans against the steps.
    broken = Mesh()
    rotated_box(broken, (1.45, 2.45, 0.06), (1.15, 0.11, 0.11), 0.45, "Z", "Wood_Walnut")
    broken.sphere((1.98, 2.72, 0.07), 0.07, "Wood_Walnut")
    beam(broken, (1.75, 2.62, 0.03), (0.35, ST_Y0 + 0.06, step_top(3) + 0.45), 0.07, 0.06, "Wood_Walnut")
    for k in range(3):  # a few spindles scattered on the floor
        rotated_box(broken, (1.1 + 0.25 * k, 2.25 - 0.12 * k, 0.025), (0.7, 0.045, 0.045), 0.9 + 0.5 * k, "Z", "Wood_Walnut")
    finish_at(broken, "Banister_Broken", (1.4, 2.45, 0), "Room")

    # Landing railing (where the optional Wisp floats).
    rail = Mesh()
    x = -HX + 0.05
    while x < LANDING_X - 0.05:
        rail.box((x - 0.02, py - 0.02, LANDING_Z), (x + 0.02, py + 0.02, LANDING_Z + 0.9), "Wood_Walnut")
        x += 0.25
    rail.box((-HX, py - 0.035, LANDING_Z + 0.9), (LANDING_X, py + 0.035, LANDING_Z + 0.96), "Wood_Walnut", 0.008)
    finish_at(rail, "Landing_Railing", (-2.3, py, LANDING_Z), "Room")

    collider("Collider_Stairs", (-HX, ST_Y0 - 0.15, 0), (2.0, HY, LANDING_Z + 1.0))


# ---------------------------------------------------------------------------
# Grandfather clock — the signature object, opposite the front door
# ---------------------------------------------------------------------------

def build_clock():
    W, D, B = "Wood_Walnut", "Clay_Dark", "Metal_Brass"
    m = (Mesh()
         .box((-0.33, -0.2, 0), (0.33, 0.2, 0.06), W, 0.01)
         .box((-0.3, -0.175, 0.06), (0.3, 0.175, 0.32), W, 0.015)
         .box((-0.22, -0.13, 0.32), (-0.17, 0.14, 1.55), W)
         .box((0.17, -0.13, 0.32), (0.22, 0.14, 1.55), W)
         .box((-0.17, 0.10, 0.32), (0.17, 0.14, 1.55), D)
         .box((-0.17, -0.13, 0.32), (0.17, -0.10, 0.5), W)
         .box((-0.17, -0.13, 1.45), (0.17, -0.10, 1.55), W)
         .box((-0.3, -0.175, 1.55), (0.3, 0.175, 2.15), W, 0.015)
         .box((-0.32, -0.19, 1.55), (0.32, 0.19, 1.6), W, 0.01)
         .box((-0.32, -0.19, 2.1), (0.32, 0.19, 2.16), W, 0.01)
         .cyl((0, 0, 2.16), 0.26, 0.26, 0.30, "Y", W, 24)
         .sphere((0, 0, 2.5), 0.06, B)
         .sphere((-0.27, 0, 2.22), 0.045, B)
         .sphere((0.27, 0, 2.22), 0.045, B))
    clock = m.finish("Grandfather_Clock", CLOCK, "Furniture")

    face_c = CLOCK + Vector((0, -0.185, 1.85))
    f = (Mesh()
         .cyl((0, 0.004, 0), 0.245, 0.245, 0.008, "Y", B, 32)
         .cyl((0, 0, 0), 0.22, 0.22, 0.01, "Y", "Paper", 32)
         .cyl((0, -0.012, 0), 0.014, 0.014, 0.02, "Y", D, 10))  # bare centre pin: no hands
    for k in range(12):
        a = k / 12 * 2 * math.pi
        cx, cz = 0.18 * math.sin(a), 0.18 * math.cos(a)
        long = 0.035 if k % 3 == 0 else 0.02
        rotated_box(f, (cx, -0.006, cz), (0.012, 0.004, long), a, "Y", D)
    f.finish("Clock_Face", face_c, "Furniture", parent=clock)

    pend = (Mesh()
            .box((-0.008, -0.005, -0.75), (0.008, 0.005, 0), B)
            .cyl((0, 0, -0.77), 0.07, 0.07, 0.02, "Y", B, 24))
    pend.finish("Clock_Pendulum", CLOCK + Vector((0, 0.0, 1.45)), "Furniture", parent=clock)

    g = Mesh()
    quad_facing(g, (0, 0, 0), 0.17, 0.475, "-Y", "Placeholder_Clock_Glass")
    glass = g.finish("Interact_Clock_Glass", CLOCK + Vector((0, -0.115, 0.975)), "Interactables", parent=clock)
    glass["note"] = "smeared note; reads 3:17 under UV (return visit)"

    collider("Collider_Clock", CLOCK + Vector((-0.33, -0.2, 0)), CLOCK + Vector((0.33, 0.2, 2.56)))


# ---------------------------------------------------------------------------
# Mirror, console table, mirror-only text
# ---------------------------------------------------------------------------

def build_mirror():
    origin = Vector((-HX + WAIN_T, MIRROR_Y, MIRROR_Z))
    fm = wall_frame(Mesh(), 1, 0.45, 0.7, 0.1)
    fm.box((0, -0.22, 0.68), (0.07, 0.22, 0.86), "Wood_Walnut", 0.015)  # crest
    fm.sphere((0.04, 0, 0.9), 0.05, "Metal_Brass")
    frame = fm.finish("Mirror_Frame", origin, "Furniture")
    s = Mesh()
    quad_facing(s, (0, 0, 0), 0.35, 0.6, "+X", "Placeholder_Mirror")
    s.finish("Mirror_Surface", origin + Vector((0.025, 0, 0)), "Interactables", parent=frame)

    # Writing that exists only in the reflection. The texture is flipped
    # horizontally, so it reads correctly in the mirror (UVs read normally).
    t = Mesh()
    quad_facing(t, (0, 0, 0), 0.9, 0.175, "-X", "Paint_Vermilion")
    text = t.finish("MirrorOnly_Text", (HX - 0.005, MIRROR_Y, TEXT_Z), "MirrorOnly")
    text["mirror_only"] = True
    text["text"] = "Eldest first"


def build_console():
    W = "Wood_Walnut"
    m = Mesh().box((-0.175, -0.5, 0.8), (0.175, 0.5, 0.85), W, 0.012)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * 0.13, sy * 0.45
            m.box((cx - 0.025, cy - 0.025, 0), (cx + 0.025, cy + 0.025, 0.8), W, 0.006)
    m.box((-0.15, -0.45, 0.7), (0.15, 0.45, 0.8), W)  # apron
    m.box((-0.14, -0.43, 0.14), (0.14, 0.43, 0.17), W)  # lower shelf
    m.finish("Console_Table", CONSOLE, "Furniture")
    collider("Collider_Console", CONSOLE + Vector((-0.175, -0.5, 0)), CONSOLE + Vector((0.175, 0.5, 0.85)))

    top = CONSOLE + Vector((0, 0, 0.85))
    battery(Mesh(), (0, 0, 0), along="Y").finish("Pickup_Battery_Console", top + Vector((0.02, -0.3, 0)), "Pickups")

    # Candelabra: base, stem, two arms, three candles.
    B = "Metal_Brass"
    c = (Mesh()
         .cyl((0, 0, 0.01), 0.07, 0.06, 0.02, "Z", B, 16)
         .cyl((0, 0, 0.16), 0.012, 0.012, 0.3, "Z", B, 10)
         .box((-0.005, -0.13, 0.27), (0.005, 0.13, 0.29), B))
    for y in (-0.13, 0.0, 0.13):
        zc = 0.31 if y else 0.33
        c.cyl((0, y, zc), 0.025, 0.025, 0.03, "Z", B, 10)
        c.cyl((0, y, zc + 0.08), 0.014, 0.014, 0.13, "Z", "Clay_Cream", 10)
    c.finish("Prop_Candelabra", top + Vector((0, 0.3, 0)), "Furniture")

    v = Mesh().lathe([(0.0, 0.0), (0.0, 0.05), (0.06, 0.08), (0.14, 0.06), (0.2, 0.035), (0.23, 0.045)],
                     "Clay_Cream", 14)
    for k, (dx, dy, dz) in enumerate(((0.06, 0.03, 0.42), (-0.05, 0.06, 0.4), (0.0, -0.08, 0.45), (0.08, -0.04, 0.36))):
        beam(v, (0, 0, 0.2), (dx, dy, dz), 0.008, 0.008, "Clay_Dark")
        v.sphere((dx, dy, dz), 0.025, "Card_Rust")
    v.finish("Prop_Vase", top + Vector((0.02, 0.02, 0)), "Furniture")


# ---------------------------------------------------------------------------
# Portraits on the east wall
# ---------------------------------------------------------------------------

PORTRAITS = [  # (y, birth year, symbol); eldest first = moon, bat, pumpkin
    (-2.0, 1874, "bat"),
    (-0.4, 1869, "moon"),
    (1.2, 1877, "pumpkin"),
]


def build_portraits():
    for n, (y, year, symbol) in enumerate(PORTRAITS, start=1):
        origin = Vector((HX, y, 1.8))
        frame = wall_frame(Mesh(), -1, 0.35, 0.45, 0.08).finish(f"Portrait_{n}_Frame", origin, "Furniture")
        c = Mesh()
        quad_facing(c, (0, 0, 0), 0.27, 0.37, "-X", f"Placeholder_Portrait_{n}")
        canvas = c.finish(f"Portrait_{n}_Canvas", origin + Vector((-0.025, 0, 0)), "Furniture", parent=frame)
        canvas["birth_year"] = year
        canvas["symbol"] = symbol
        p = Mesh().box((-0.02, -0.12, -0.035), (0, 0.12, 0.035), "Metal_Brass", 0.006)
        plaque = p.finish(f"Portrait_{n}_Plaque", origin + Vector((0, 0, -0.45 - 0.08)), "Furniture", parent=frame)
        plaque["birth_year"] = year


# ---------------------------------------------------------------------------
# Writing desk (west wall), drawer, letter; side chair
# ---------------------------------------------------------------------------

def build_writing_desk():
    W = "Wood_Walnut"
    m = Mesh().box((-0.275, -0.55, 0.74), (0.275, 0.55, 0.8), W, 0.012)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * 0.235, sy * 0.51
            m.box((cx - 0.03, cy - 0.03, 0), (cx + 0.03, cy + 0.03, 0.74), W, 0.008)
        m.box((-0.24, sx * 0.51 - 0.015, 0.58), (0.24, sx * 0.51 + 0.015, 0.74), W)  # side aprons
        m.box((0.22, min(sx * 0.32, sx * 0.5), 0.58), (0.25, max(sx * 0.32, sx * 0.5), 0.74), W)  # front apron
    m.box((-0.25, -0.5, 0.58), (-0.22, 0.5, 0.74), W)  # back apron
    m.box((0.22, -0.32, 0.58), (0.25, 0.32, 0.6), W)  # rail under the drawer
    # Low hutch with pigeonholes at the back.
    m.box((-0.275, -0.5, 0.8), (-0.25, 0.5, 1.15), W)
    m.box((-0.275, -0.52, 1.12), (-0.11, 0.52, 1.16), W, 0.008)
    for y in (-0.5, -0.17, 0.17, 0.5):
        m.box((-0.25, y - 0.012, 0.8), (-0.12, y + 0.012, 1.12), W)
    m.box((-0.25, -0.5, 0.95), (-0.12, 0.5, 0.97), W)
    m.finish("Writing_Desk", DESK, "Furniture")

    # Drawer: origin at the centre of its back face, slides out along +X (into the hall).
    drawer_origin = DESK + Vector((-0.2, 0, 0.66))
    dm = (Mesh()
          .box((0, -0.29, -0.065), (0.42, 0.29, -0.05), W)
          .box((0, -0.29, -0.05), (0.42, -0.275, 0.065), W)
          .box((0, 0.275, -0.05), (0.42, 0.29, 0.065), W)
          .box((0, -0.275, -0.05), (0.015, 0.275, 0.065), W)
          .box((0.42, -0.31, -0.07), (0.445, 0.31, 0.07), W, 0.008)
          .cyl((0.446, 0, 0.02), 0.028, 0.028, 0.003, "X", "Metal_Brass", 16)  # escutcheon
          .cyl((0.448, 0, 0.02), 0.01, 0.01, 0.003, "X", "Clay_Dark", 10)  # keyhole
          .sphere((0.47, 0, -0.025), 0.022, "Metal_Brass"))
    drawer = dm.finish("Interact_Writing_Desk_Drawer", drawer_origin, "Interactables")

    letter = (Mesh()
              .box((-0.075, -0.1, 0), (0.075, 0.1, 0.004), "Paper")
              .box((-0.072, -0.1, 0.004), (0.0, 0.1, 0.008), "Paper"))  # folded half, slightly raised
    letter.finish("Pickup_Letter", drawer_origin + Vector((0.22, 0.04, -0.05)), "Pickups", parent=drawer)

    stack = Mesh()
    for k in range(4):
        stack.box((-0.07 + 0.01 * k, -0.05 - 0.008 * k, 0.006 * k), (0.07 + 0.01 * k, 0.05 - 0.008 * k, 0.006 * k + 0.005),
                  "Paper" if k % 2 == 0 else "Card_Cream")
    stack.finish("Prop_Letters", DESK + Vector((0.05, 0.3, 0.8)), "Furniture")

    collider("Collider_Writing_Desk", DESK + Vector((-0.275, -0.55, 0)), DESK + Vector((0.275, 0.55, 1.16)))


CHAIR = Vector((-2.55, -3.35, 0))


def build_chair():
    # Level 0 chair, turned to face east (local +Y -> world +X).
    w = "Wood_Walnut"
    r = Rot(Mesh(), 3)
    for sx in (-1, 1):
        cx = sx * 0.215
        r.box((cx - 0.03, 0.185, 0), (cx + 0.03, 0.245, 0.42), w, 0.008)
        r.box((cx - 0.03, -0.25, 0), (cx + 0.03, -0.19, 1.0), w, 0.008)
    r.box((-0.25, -0.25, 0.42), (0.25, 0.25, 0.47), w, 0.01)
    r.box((-0.21, -0.17, 0.47), (0.21, 0.22, 0.50), "Felt_Teal", 0.01)
    r.box((-0.185, -0.24, 0.74), (0.185, -0.20, 0.97), w, 0.008)
    r.box((-0.185, -0.24, 0.58), (0.185, -0.20, 0.64), w, 0.008)
    r.m.finish("Hall_Chair", CHAIR, "Furniture")
    collider("Collider_Hall_Chair", CHAIR + Vector((-0.25, -0.25, 0)), CHAIR + Vector((0.25, 0.25, 1.0)))


# ---------------------------------------------------------------------------
# Chest under the stairs, symbol lock, Library key
# ---------------------------------------------------------------------------

def build_chest():
    W, B = "Wood_Walnut", "Metal_Brass"
    hw, hd, hb = 0.45, 0.25, 0.40
    m = (Mesh()
         .box((-hw, -hd, 0), (hw, hd, 0.05), W)
         .box((-hw, -hd, 0.05), (hw, -hd + 0.04, hb), W, 0.008)
         .box((-hw, hd - 0.04, 0.05), (hw, hd, hb), W, 0.008)
         .box((-hw, -hd + 0.04, 0.05), (-hw + 0.04, hd - 0.04, hb), W, 0.008)
         .box((hw - 0.04, -hd + 0.04, 0.05), (hw, hd - 0.04, hb), W, 0.008)
         .box((-hw + 0.05, -hd + 0.05, 0.05), (hw - 0.05, hd - 0.05, 0.065), "Felt_Plum"))  # cloth
    for x in (-0.3, 0.3):  # brass straps, front and back
        m.box((x - 0.03, -hd - 0.008, 0), (x + 0.03, -hd, hb), B)
        m.box((x - 0.03, hd, 0), (x + 0.03, hd + 0.008, hb), B)
    for sx in (-1, 1):  # corner caps
        m.box((sx * hw - 0.035, -hd - 0.008, 0), (sx * hw + 0.035, -hd + 0.03, 0.06), B)
    chest = m.finish("Chest", CHEST, "Furniture")

    # Lid: origin on the back hinge edge at the top of the body.
    hinge = CHEST + Vector((0, hd, hb))
    lid = (Mesh()
           .box((-hw - 0.01, -2 * hd - 0.01, 0), (hw + 0.01, 0.01, 0.1), W, 0.012)
           .box((-hw + 0.04, -2 * hd + 0.04, 0.1), (hw - 0.04, -0.04, 0.15), W, 0.012))
    for x in (-0.3, 0.3):
        lid.box((x - 0.03, -2 * hd - 0.018, -0.005), (x + 0.03, 0.01, 0.105), B)
        lid.box((x - 0.03, -2 * hd + 0.03, 0.1), (x + 0.03, -0.03, 0.155), B)
    lid.box((-0.06, -2 * hd - 0.02, -0.07), (0.06, -2 * hd - 0.005, 0.02), B)  # hasp
    lid.finish("Interact_Chest_Lid", hinge, "Interactables")

    # Symbol lock: brass plate with three dials, scenery (like Desk_Padlock in Level 0).
    lock_c = CHEST + Vector((0, -hd - 0.012, 0.28))
    lk = Mesh().box((-0.15, -0.01, -0.06), (0.15, 0.004, 0.06), B, 0.006)
    for k, x in enumerate((-0.09, 0.0, 0.09)):
        lk.cyl((x, -0.02, 0), 0.038, 0.038, 0.022, "Y", B, 20)
        lk.box((x - 0.012, -0.032, -0.012), (x + 0.012, -0.03, 0.012), "Clay_Dark")  # symbol stand-in
    lock = lk.finish("Chest_SymbolLock", lock_c, "Interactables", parent=chest)
    lock["solution"] = "moon,bat,pumpkin"

    key = Mesh()
    key.cyl((-0.05, 0, 0), 0.035, 0.035, 0.01, "Z", "Metal_Dark", 20)
    key.cyl((-0.05, 0, 0.006), 0.016, 0.016, 0.004, "Z", B, 12)
    key.box((-0.02, -0.006, -0.005), (0.08, 0.006, 0.005), "Metal_Dark")
    key.box((0.05, -0.03, -0.005), (0.065, -0.006, 0.005), "Metal_Dark")
    key.box((0.07, -0.022, -0.005), (0.08, -0.006, 0.005), "Metal_Dark")
    key.cyl((-0.012, 0, 0), 0.012, 0.012, 0.012, "X", B, 10)  # collar
    key.finish("Pickup_Library_Key", CHEST + Vector((0, 0, 0.075)), "Pickups")

    collider("Collider_Chest", CHEST + Vector((-hw, -hd, 0)), CHEST + Vector((hw, hd, 0.55)))


# ---------------------------------------------------------------------------
# Coat rack, umbrella stand, chandelier, rug, small props
# ---------------------------------------------------------------------------

def build_coat_rack():
    W = "Wood_Walnut"
    m = (Mesh()
         .cyl((0, 0, 0.94), 0.025, 0.025, 1.88, "Z", W, 12)
         .box((-0.3, -0.03, 0), (0.3, 0.03, 0.05), W, 0.01)
         .box((-0.03, -0.3, 0), (0.03, 0.3, 0.05), W, 0.01))
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        beam(m, (0, 0, 1.68), (dx * 0.14, dy * 0.14, 1.76), 0.025, 0.025, W)
    m.finish("Coat_Rack", COAT_RACK, "Furniture")

    (Mesh()
     .cyl((0, 0, 1.2), 0.24, 0.13, 0.95, "Z", "Felt_Teal", 14)
     .sphere((0, 0, 1.68), 0.07, "Felt_Teal")
     .finish("Coat_1", COAT_RACK + Vector((0.12, -0.08, 0)), "Furniture"))

    pocket = (Mesh()
              .cyl((0, 0, 1.15), 0.25, 0.14, 1.0, "Z", "Felt_Plum", 14)
              .sphere((0, 0, 1.66), 0.07, "Felt_Plum")
              .box((-0.12, -0.25, 0.9), (0.02, -0.21, 1.02), "Felt_Plum", 0.01))  # pocket flap
    pocket.finish("Interact_Coat_Pocket", COAT_RACK + Vector((-0.14, 0.04, 0)), "Interactables")

    (Mesh()
     .cyl((0, 0, 0), 0.17, 0.17, 0.012, "Z", "Clay_Dark", 18)
     .cyl((0, 0, 0.07), 0.1, 0.095, 0.13, "Z", "Clay_Dark", 18)
     .box((-0.1, -0.1, 0.02), (0.1, 0.1, 0.04), "Card_Rust")
     .finish("Hat", COAT_RACK + Vector((0, 0, 1.885)), "Furniture"))

    # Battery in the coat pocket, hidden until the pocket is searched.
    battery(Mesh(), (0, 0, 0)).finish("Pickup_Battery_Coat", COAT_RACK + Vector((-0.19, -0.18, 0.92)), "Pickups")

    collider("Collider_Coat_Rack", COAT_RACK + Vector((-0.32, -0.3, 0)), COAT_RACK + Vector((0.32, 0.3, 1.95)))


def build_umbrella_stand():
    pos = Vector((1.15, -3.65, 0))
    m = (Mesh()
         .cyl((0, 0, 0.3), 0.14, 0.14, 0.6, "Z", "Metal_Dark", 16)
         .cyl((0, 0, 0.6), 0.15, 0.15, 0.03, "Z", "Metal_Brass", 16))
    beam(m, (-0.04, 0.02, 0.1), (-0.12, 0.05, 0.95), 0.035, 0.035, "Card_Rust")
    beam(m, (0.04, -0.02, 0.1), (0.1, -0.08, 0.9), 0.035, 0.035, "Clay_Dark")
    m.sphere((-0.12, 0.05, 0.97), 0.03, "Wood_Walnut")
    m.sphere((0.1, -0.08, 0.92), 0.03, "Wood_Walnut")
    m.finish("Umbrella_Stand", pos, "Furniture")
    collider("Collider_Umbrella_Stand", pos + Vector((-0.15, -0.15, 0)), pos + Vector((0.15, 0.15, 0.95)))


def build_chandelier():
    # Origin at the ceiling hook; hangs crooked (tilt baked into the mesh).
    B = "Metal_Brass"
    m = (Mesh()
         .cyl((0, 0, -0.3), 0.015, 0.015, 0.6, "Z", "Metal_Dark", 8)
         .cyl((0, 0, -0.82), 0.05, 0.07, 0.45, "Z", B, 12)
         .sphere((0, 0, -1.12), 0.07, B))
    n, r, zr = 6, 0.5, -0.92
    pts = [(r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n)) for k in range(n)]
    for k, (x, y) in enumerate(pts):
        x2, y2 = pts[(k + 1) % n]
        beam(m, (x, y, zr), (x2, y2, zr), 0.03, 0.03, B)
        beam(m, (0, 0, -1.02), (x, y, zr), 0.025, 0.025, B)
        m.cyl((x, y, zr + 0.03), 0.035, 0.03, 0.04, "Z", B, 10)
        m.cyl((x, y, zr + 0.11), 0.015, 0.015, 0.12, "Z", "Clay_Cream", 8)
    bmesh.ops.rotate(m.bm, verts=m.bm.verts[:], cent=(0, 0, 0),
                     matrix=Matrix.Rotation(math.radians(9), 3, "Y") @ Matrix.Rotation(math.radians(-6), 3, "X"))
    m.finish("Chandelier", (0, -0.4, H), "Room")


def build_rug_and_props():
    (Mesh()
     .box((-1.5, -1.0, 0), (1.5, 1.0, 0.012), "Felt_Plum", 0.004)
     .box((-1.35, -0.85, 0.012), (1.35, 0.85, 0.016), "Felt_Teal")
     .box((-1.25, -0.75, 0.016), (1.25, 0.75, 0.018), "Felt_Plum")
     .finish("Rug", (0, -0.4, 0), "Furniture"))

    # A picture that fell off the wall, lying near the boarded door.
    f = Mesh()
    rotated_box(f, (0, 0, 0.02), (0.6, 0.45, 0.04), 0.35, "Z", "Wood_Walnut")
    rotated_box(f, (0, 0, 0.041), (0.48, 0.33, 0.004), 0.35, "Z", "Card_Teal")
    f.finish("Prop_Fallen_Frame", (-2.3, 0.7, 0), "Furniture")


# ---------------------------------------------------------------------------
# Ghosts, brass key, spawns
# ---------------------------------------------------------------------------

def build_ghosts_and_spawns():
    # Same sheet-ghost mesh as Level 0; both Wisps share one mesh.
    head_r = 0.13
    profile = [(head_r * math.cos(a), head_r * math.sin(a))
               for a in (i / 16 * math.pi / 2 for i in range(17))]
    profile += [(-0.5 * t, head_r + 0.105 * t ** 0.8) for t in (i / 64 for i in range(1, 65))]
    key_wisp = Mesh().lathe(profile, "Placeholder_Wisp", 160).finish("Wisp_Key", WISP_KEY_SPAWN, "Ghosts")
    gallery = bpy.data.objects.new("Wisp_Gallery", key_wisp.data)
    place(gallery, WISP_GALLERY_SPAWN, "Ghosts")

    # Brass key dropped by the key Wisp; the game hides it until the drop.
    b = "Metal_Brass"
    (Mesh()
     .cyl((-0.025, 0, 0), 0.017, 0.017, 0.007, "Z", b, 12)
     .box((-0.01, -0.004, -0.0035), (0.04, 0.004, 0.0035), b)
     .box((0.02, -0.016, -0.0035), (0.028, -0.004, 0.0035), b)
     .box((0.032, -0.013, -0.0035), (0.04, -0.004, 0.0035), b)
     .finish("Pickup_Brass_Key", WISP_KEY_SPAWN, "Pickups"))

    empty("Spawn_Player", (0, -3.2, 0), "Spawns")
    empty("Spawn_Wisp_Key", WISP_KEY_SPAWN, "Spawns", display="SPHERE", size=0.15)
    empty("Spawn_Wisp_Gallery", WISP_GALLERY_SPAWN, "Spawns", display="SPHERE", size=0.15)
    empty("Spawn_InkGhost", (2.1, 3.0, 1.5), "Spawns", display="SPHERE", size=0.15)
    empty("Spawn_Battery_Emergency", (-0.5, -3.5, 0), "Spawns", display="CUBE", size=0.1)
    empty("Spawn_Intro_Look", CLOCK + Vector((0, -0.19, 1.85)), "Spawns", display="SPHERE", size=0.1)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def export_room():
    os.makedirs(EXPORT_DIR, exist_ok=True)
    objs = [o for name in COLLECTIONS for o in bpy.data.collections[name].objects]
    export_glb(GLB_PATH, objs)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    WORLD.clear()
    scene = bpy.context.scene
    scene.name = "Level_1"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    for name in COLLECTIONS:
        scene.collection.children.link(bpy.data.collections.new(name))
    for name, spec in MATERIALS.items():
        make_material(name, *spec)

    build_shell()
    build_window()
    build_front_door()
    build_library_door()
    build_boarded_door()
    build_stairs()
    build_clock()
    build_mirror()
    build_console()
    build_portraits()
    build_writing_desk()
    build_chair()
    build_chest()
    build_coat_rack()
    build_umbrella_stand()
    build_chandelier()
    build_rug_and_props()
    build_ghosts_and_spawns()

    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    export_room()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

    print("\n== Level 1 objects ==")
    for coll in COLLECTIONS:
        for obj in bpy.data.collections[coll].objects:
            loc = obj.matrix_world.translation
            dim = obj.dimensions
            print(f"{coll:14} {obj.name:30} origin=({loc.x:6.3f},{loc.y:6.3f},{loc.z:6.3f}) "
                  f"size=({dim.x:.3f},{dim.y:.3f},{dim.z:.3f})")


if __name__ == "__main__":
    main()
