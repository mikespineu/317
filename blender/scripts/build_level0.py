"""Level 0 blockout builder.

Builds the whole study from docs/level-0-blender-asset-spec.md (step 1, blockout),
saves blender/level-0.blend and exports blender/export/*.glb.

Run:  /Applications/Blender.app/Contents/MacOS/Blender -b --python blender/scripts/build_level0.py

WARNING: this regenerates level-0.blend from scratch. Once the .blend has been
refined by hand, do not re-run it; use export_level0.py to re-export instead.

Conventions: 1 unit = 1 m, +Y is north/forward, +Z is up. Room interior is
x -2..2, y -2.5..2.5, z 0..2.8 with the floor centre at the world origin.
All meshes are built directly in their final orientation, so every object has
identity rotation and scale (transforms are "applied" by construction).
"""

import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER_DIR = os.path.dirname(HERE)
BLEND_PATH = os.path.join(BLENDER_DIR, "level-0.blend")
EXPORT_DIR = os.path.join(BLENDER_DIR, "export")

COLLECTIONS = ["Room", "Furniture", "Interactables", "Pickups", "Colliders", "Spawns", "Held_Items"]
ROOM_EXPORT_COLLECTIONS = ["Room", "Furniture", "Interactables", "Pickups", "Colliders", "Spawns"]

# name: (hex colour, roughness, metallic, alpha)
MATERIALS = {
    "Wood_Walnut": ("3a2a22", 0.85, 0.0, 1.0),
    "Wood_Floor": ("4a372c", 0.85, 0.0, 1.0),
    "Wood_Teal": ("35595b", 0.85, 0.0, 1.0),
    "Card_Plum": ("4a2f47", 0.95, 0.0, 1.0),
    "Card_Teal": ("3f6b6c", 0.95, 0.0, 1.0),
    "Card_Rust": ("8a4a35", 0.95, 0.0, 1.0),
    "Card_Cream": ("b9ad90", 0.95, 0.0, 1.0),
    "Felt_Plum": ("5a3352", 1.0, 0.0, 1.0),
    "Felt_Teal": ("2f5556", 1.0, 0.0, 1.0),
    "Clay_Cream": ("cfc3a3", 0.9, 0.0, 1.0),
    "Clay_Dark": ("2b2630", 0.9, 0.0, 1.0),
    "Metal_Brass": ("b08d3c", 0.35, 1.0, 1.0),
    "Metal_Dark": ("3b3b42", 0.5, 1.0, 1.0),
    "Glass": ("a9c4d6", 0.1, 0.0, 0.25),
    # Replaced by game shaders; only here so the meshes have a slot.
    "Placeholder_Mirror": ("9fb2bd", 0.05, 1.0, 1.0),
    "Placeholder_Canvas": ("8f8468", 0.95, 0.0, 1.0),
    "Placeholder_Wisp": ("a6f0dc", 0.6, 0.0, 1.0),
    "Collider": ("ff00ff", 1.0, 0.0, 0.15),
}

AXIS_MATRIX = {
    "Z": Matrix.Identity(4),
    "Y": Matrix.Rotation(-math.pi / 2, 4, "X"),  # +Z -> +Y
    "X": Matrix.Rotation(math.pi / 2, 4, "Y"),  # +Z -> +X
}

WORLD = {}  # object name -> world-space origin


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def make_material(name, hex_colour, roughness, metallic, alpha):
    rgb = [srgb_to_linear(int(hex_colour[i:i + 2], 16) / 255) for i in (0, 2, 4)]
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nodes = mat.node_tree.nodes
    bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
        out = nodes.new("ShaderNodeOutputMaterial")
        mat.node_tree.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = alpha
    mat.diffuse_color = (*rgb, alpha)
    mat.roughness = roughness
    mat.metallic = metallic
    if alpha < 1.0:
        try:
            mat.surface_render_method = "BLENDED"
        except Exception:
            mat.blend_method = "BLEND"
    return mat


class Mesh:
    """Collects primitive parts (in object-local coordinates) into one mesh."""

    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []

    def _slot(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def _merge(self, part, mat, bevel=0.0, smooth=False):
        if bevel > 0:
            bmesh.ops.bevel(part, geom=part.edges[:], offset=bevel, segments=1,
                            affect="EDGES", clamp_overlap=True)
        bmesh.ops.recalc_face_normals(part, faces=part.faces[:])
        slot = self._slot(mat)
        for face in part.faces:
            face.material_index = slot
            face.smooth = smooth
        tmp = bpy.data.meshes.new("_tmp")
        part.to_mesh(tmp)
        part.free()
        self.bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)

    def box(self, lo, hi, mat, bevel=0.0):
        lo, hi = Vector(lo), Vector(hi)
        size = hi - lo
        part = bmesh.new()
        matrix = Matrix.Translation((lo + hi) / 2) @ Matrix.Diagonal((size.x, size.y, size.z, 1.0))
        bmesh.ops.create_cube(part, size=1.0, matrix=matrix)
        self._merge(part, mat, min(bevel, min(size) * 0.3))
        return self

    def cyl(self, centre, r1, r2, depth, axis, mat, segments=16):
        """Cylinder/cone along `axis`; r1 is the radius at the negative end."""
        part = bmesh.new()
        matrix = Matrix.Translation(Vector(centre)) @ AXIS_MATRIX[axis]
        bmesh.ops.create_cone(part, cap_ends=True, cap_tris=False, segments=segments,
                              radius1=r1, radius2=r2, depth=depth, matrix=matrix)
        self._merge(part, mat)
        return self

    def sphere(self, centre, radius, mat):
        part = bmesh.new()
        bmesh.ops.create_uvsphere(part, u_segments=12, v_segments=8, radius=radius,
                                  matrix=Matrix.Translation(Vector(centre)))
        self._merge(part, mat, smooth=True)
        return self

    def quad(self, corners, mat, uvs):
        """Single quad; corners counter-clockwise seen from the front."""
        uv_layer = self.bm.loops.layers.uv.verify()
        face = self.bm.faces.new([self.bm.verts.new(c) for c in corners])
        face.material_index = self._slot(mat)
        for loop, uv in zip(face.loops, uvs):
            loop[uv_layer].uv = uv
        return self

    def lathe(self, profile, mat, segments=12, bend=None):
        """Revolve (z, radius) pairs around Z; first and last radius must be 0."""
        bm = self.bm
        slot = self._slot(mat)
        rings = []
        for z, r in profile:
            off = bend(z) if bend else Vector((0, 0, 0))
            if r == 0:
                rings.append([bm.verts.new(Vector((0, 0, z)) + off)])
            else:
                rings.append([
                    bm.verts.new(Vector((r * math.cos(2 * math.pi * i / segments),
                                         r * math.sin(2 * math.pi * i / segments), z)) + off)
                    for i in range(segments)
                ])
        faces = []
        for a, b in zip(rings, rings[1:]):
            for i in range(segments):
                j = (i + 1) % segments
                if len(a) == 1:
                    faces.append(bm.faces.new([a[0], b[i], b[j]]))
                elif len(b) == 1:
                    faces.append(bm.faces.new([a[i], b[0], a[j]]))
                else:
                    faces.append(bm.faces.new([a[i], b[i], b[j], a[j]]))
        for face in faces:
            face.material_index = slot
            face.smooth = True
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        return self

    def finish(self, name, world, collection, parent=None, collider=False):
        mesh = bpy.data.meshes.new(name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for mat in self.mats:
            mesh.materials.append(bpy.data.materials[mat])
        obj = bpy.data.objects.new(name, mesh)
        return place(obj, world, collection, parent, collider)


def place(obj, world, collection, parent=None, collider=False):
    bpy.data.collections[collection].objects.link(obj)
    world = Vector(world)
    WORLD[obj.name] = world
    if parent is not None:
        obj.parent = parent
        obj.location = world - WORLD[parent.name]
    else:
        obj.location = world
    if collider:
        obj.display_type = "WIRE"
        obj.hide_render = True
    return obj


def collider(name, lo, hi, parent=None):
    """Invisible collision box with its origin at the box centre (world coords)."""
    lo, hi = Vector(lo), Vector(hi)
    centre = (lo + hi) / 2
    return Mesh().box(lo - centre, hi - centre, "Collider").finish(
        name, centre, "Colliders", parent=parent, collider=True)


def empty(name, world, collection, display="ARROWS", size=0.3):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = display
    obj.empty_display_size = size
    return place(obj, world, collection)


# ---------------------------------------------------------------------------
# Room shell — all origins at the floor centre (world origin)
# ---------------------------------------------------------------------------

HX, HY, H = 2.0, 2.5, 2.8  # interior half-width, half-depth, height
T = 0.15  # wall thickness
WIN = (-0.6, 0.6, 1.0, 2.2)  # window opening: x min, x max, z min, z max
DOOR_W, DOOR_H = 1.0, 2.2  # clear door opening
FRAME = 0.1  # door frame thickness


def build_room():
    o = (0, 0, 0)
    Mesh().box((-HX - T, -HY - T, -0.1), (HX + T, HY + T, 0), "Wood_Floor").finish("Floor", o, "Room")
    Mesh().box((-HX - T, -HY - T, H), (HX + T, HY + T, H + 0.1), "Card_Cream").finish("Ceiling", o, "Room")

    x0, x1, z0, z1 = WIN
    (Mesh()
     .box((-HX - T, HY, 0), (x0, HY + T, H), "Card_Plum")
     .box((x1, HY, 0), (HX + T, HY + T, H), "Card_Plum")
     .box((x0, HY, 0), (x1, HY + T, z0), "Card_Plum")
     .box((x0, HY, z1), (x1, HY + T, H), "Card_Plum")
     .finish("Wall_N", o, "Room"))

    d = DOOR_W / 2 + FRAME  # wall opening half-width, frame included
    (Mesh()
     .box((-HX - T, -HY - T, 0), (-d, -HY, H), "Card_Plum")
     .box((d, -HY - T, 0), (HX + T, -HY, H), "Card_Plum")
     .box((-d, -HY - T, DOOR_H + FRAME), (d, -HY, H), "Card_Plum")
     .finish("Wall_S", o, "Room"))

    Mesh().box((HX, -HY, 0), (HX + T, HY, H), "Card_Plum").finish("Wall_E", o, "Room")
    Mesh().box((-HX - T, -HY, 0), (-HX, HY, H), "Card_Plum").finish("Wall_W", o, "Room")

    s, sh, b = 0.03, 0.12, 0.008
    (Mesh()
     .box((-HX, HY - s, 0), (HX, HY, sh), "Wood_Teal", b)
     .box((-HX, -HY, 0), (-d, -HY + s, sh), "Wood_Teal", b)
     .box((d, -HY, 0), (HX, -HY + s, sh), "Wood_Teal", b)
     .box((HX - s, -HY + s, 0), (HX, HY - s, sh), "Wood_Teal", b)
     .box((-HX, -HY + s, 0), (-HX + s, HY - s, sh), "Wood_Teal", b)
     .finish("Skirting", o, "Room"))

    # Door frame: chunky, proud of the wall on both sides.
    ya, yb = -HY - T - 0.03, -HY + 0.03
    (Mesh()
     .box((-d, ya, 0), (-DOOR_W / 2, yb, DOOR_H), "Wood_Teal", 0.012)
     .box((DOOR_W / 2, ya, 0), (d, yb, DOOR_H), "Wood_Teal", 0.012)
     .box((-d, ya, DOOR_H), (d, yb, DOOR_H + FRAME), "Wood_Teal", 0.012)
     .finish("Door_Frame", o, "Room"))

    # Window frame: border, cross mullions and a sill.
    f = 0.07
    ya, yb = HY - 0.03, HY + T + 0.03
    xm, zm = (x0 + x1) / 2, (z0 + z1) / 2
    (Mesh()
     .box((x0, ya, z0), (x0 + f, yb, z1), "Wood_Teal", 0.012)
     .box((x1 - f, ya, z0), (x1, yb, z1), "Wood_Teal", 0.012)
     .box((x0 + f, ya, z0), (x1 - f, yb, z0 + f), "Wood_Teal", 0.012)
     .box((x0 + f, ya, z1 - f), (x1 - f, yb, z1), "Wood_Teal", 0.012)
     .box((xm - 0.02, HY + 0.05, z0 + f), (xm + 0.02, HY + 0.10, z1 - f), "Wood_Teal", 0.006)
     .box((x0 + f, HY + 0.05, zm - 0.02), (x1 - f, HY + 0.10, zm + 0.02), "Wood_Teal", 0.006)
     .box((x0 - 0.08, HY - 0.12, z0 - 0.04), (x1 + 0.08, HY, z0), "Wood_Teal", 0.012)
     .finish("Window_Frame", o, "Room"))

    Mesh().box((x0 + f, HY + 0.07, z0 + f), (x1 - f, HY + 0.08, z1 - f), "Glass").finish(
        "Window_Glass", o, "Room")

    collider("Collider_Floor", (-HX - T, -HY - T, -0.1), (HX + T, HY + T, 0))
    collider("Collider_Ceiling", (-HX - T, -HY - T, H), (HX + T, HY + T, H + 0.1))
    collider("Collider_Wall_N", (-HX - T, HY, 0), (HX + T, HY + T, H))
    collider("Collider_Wall_E", (HX, -HY, 0), (HX + T, HY, H))
    collider("Collider_Wall_W", (-HX - T, -HY, 0), (-HX, HY, H))
    # South wall is split so the doorway is free once the door is open.
    collider("Collider_Wall_S_W", (-HX - T, -HY - T, 0), (-DOOR_W / 2, -HY, H))
    collider("Collider_Wall_S_E", (DOOR_W / 2, -HY - T, 0), (HX + T, -HY, H))


# ---------------------------------------------------------------------------
# Door — origin on the hinge edge at floor level, leaf extends along +X
# ---------------------------------------------------------------------------

def build_door():
    origin = Vector((-DOOR_W / 2, -HY - T / 2, 0))
    door = Mesh().box((0, -0.03, 0), (DOOR_W, 0.03, DOOR_H), "Wood_Teal", 0.01).finish(
        "Interact_Door", origin, "Interactables")

    # Oversized knob on both faces; origin at the centre of the spindle.
    (Mesh()
     .cyl((0, 0, 0), 0.015, 0.015, 0.17, "Y", "Metal_Brass", 12)
     .cyl((0, 0.035, 0), 0.05, 0.05, 0.01, "Y", "Metal_Brass")
     .cyl((0, -0.035, 0), 0.05, 0.05, 0.01, "Y", "Metal_Brass")
     .sphere((0, 0.09, 0), 0.045, "Metal_Brass")
     .sphere((0, -0.09, 0), 0.045, "Metal_Brass")
     .finish("Door_Handle", origin + Vector((0.88, 0, 1.05)), "Interactables", parent=door))

    collider("Collider_Door", origin + Vector((0, -0.03, 0)), origin + Vector((DOOR_W, 0.03, DOOR_H)),
             parent=door)


# ---------------------------------------------------------------------------
# Desk (north wall, under the window), drawer, padlock, key
# ---------------------------------------------------------------------------

DESK = Vector((0, 2.11, 0))  # body origin: floor centre


def build_desk():
    w = "Wood_Walnut"
    m = Mesh().box((-0.7, -0.35, 0.72), (0.7, 0.35, 0.78), w, 0.015)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * 0.63, sy * 0.28
            m.box((cx - 0.04, cy - 0.04, 0), (cx + 0.04, cy + 0.04, 0.72), w, 0.01)
        # Side aprons
        m.box((sx * 0.635 - 0.015, -0.24, 0.56), (sx * 0.635 + 0.015, 0.24, 0.72), w)
        # Front apron either side of the drawer
        m.box((min(sx * 0.31, sx * 0.59), -0.32, 0.56), (max(sx * 0.31, sx * 0.59), -0.29, 0.72), w)
    m.box((-0.59, 0.27, 0.56), (0.59, 0.30, 0.72), w)  # back apron
    m.box((-0.31, -0.32, 0.56), (0.31, -0.29, 0.58), w)  # rail under the drawer
    m.finish("Desk", DESK, "Furniture")

    # Drawer: origin at the centre of its back face, slides out along -Y.
    drawer_origin = DESK + Vector((0, 0.17, 0.65))
    drawer = (Mesh()
              .box((-0.27, -0.48, -0.065), (0.27, 0, -0.05), w)  # bottom
              .box((-0.27, -0.48, -0.05), (-0.255, 0, 0.065), w)
              .box((0.255, -0.48, -0.05), (0.27, 0, 0.065), w)
              .box((-0.255, -0.015, -0.05), (0.255, 0, 0.065), w)  # back
              .box((-0.30, -0.50, -0.07), (0.30, -0.48, 0.07), w, 0.008)  # front panel
              .finish("Interact_Desk_Drawer", drawer_origin, "Interactables"))

    # Padlock hanging on the drawer front; origin at the centre of its body.
    b = "Metal_Brass"
    (Mesh()
     .box((-0.045, -0.018, -0.04), (0.045, 0.018, 0.04), b, 0.008)
     .cyl((-0.025, 0, 0.06), 0.008, 0.008, 0.04, "Z", "Metal_Dark", 8)
     .cyl((0.025, 0, 0.06), 0.008, 0.008, 0.04, "Z", "Metal_Dark", 8)
     .cyl((0, 0, 0.08), 0.008, 0.008, 0.066, "X", "Metal_Dark", 8)
     .box((-0.012, 0.018, 0.05), (0.012, 0.03, 0.075), "Metal_Dark")  # staple on the drawer
     .cyl((0, -0.019, -0.005), 0.012, 0.012, 0.002, "Y", "Metal_Dark", 12)  # keyhole
     .finish("Desk_Padlock", drawer_origin + Vector((0, -0.53, -0.03)), "Interactables", parent=drawer))

    # Key lying in the drawer; origin at its centre, 0.1 long along X.
    (Mesh()
     .cyl((-0.03, 0, 0), 0.02, 0.02, 0.008, "Z", b, 12)
     .box((-0.012, -0.005, -0.004), (0.05, 0.005, 0.004), b)
     .box((0.025, -0.02, -0.004), (0.035, -0.005, 0.004), b)
     .box((0.04, -0.016, -0.004), (0.05, -0.005, 0.004), b)
     .finish("Pickup_Key", drawer_origin + Vector((0.05, -0.25, -0.046)), "Pickups", parent=drawer))

    collider("Collider_Desk", DESK + Vector((-0.7, -0.35, 0)), DESK + Vector((0.7, 0.35, 0.78)))


# ---------------------------------------------------------------------------
# Chair — one object, origin floor centre, faces the desk (+Y)
# ---------------------------------------------------------------------------

CHAIR = Vector((0, 1.50, 0))


def build_chair():
    w = "Wood_Walnut"
    m = Mesh()
    for sx in (-1, 1):
        cx = sx * 0.215
        m.box((cx - 0.03, 0.185, 0), (cx + 0.03, 0.245, 0.42), w, 0.008)  # front legs
        m.box((cx - 0.03, -0.25, 0), (cx + 0.03, -0.19, 0.95), w, 0.008)  # back posts
    m.box((-0.25, -0.25, 0.42), (0.25, 0.25, 0.47), w, 0.01)  # seat
    m.box((-0.21, -0.17, 0.47), (0.21, 0.22, 0.50), "Felt_Teal", 0.01)  # cushion
    m.box((-0.185, -0.24, 0.72), (0.185, -0.20, 0.93), w, 0.008)  # backrest
    m.box((-0.185, -0.24, 0.57), (0.185, -0.20, 0.63), w, 0.008)
    m.finish("Chair", CHAIR, "Furniture")
    collider("Collider_Chair", CHAIR + Vector((-0.25, -0.25, 0)), CHAIR + Vector((0.25, 0.25, 0.95)))


# ---------------------------------------------------------------------------
# Bookshelf (east wall, south end) with loose books, battery pack and clock
# ---------------------------------------------------------------------------

SHELF = Vector((HX - 0.03 - 0.175, -1.7, 0))  # floor centre; front faces -X
SHELF_TOPS = [0.10, 0.54, 0.98, 1.42]  # top surface of each board


def build_bookshelf():
    w = "Wood_Walnut"
    m = Mesh()
    for sy in (-1, 1):
        m.box((-0.175, min(sy * 0.46, sy * 0.5), 0), (0.175, max(sy * 0.46, sy * 0.5), 2.0), w, 0.01)
    m.box((0.155, -0.46, 0), (0.175, 0.46, 2.0), w)  # back
    for top in SHELF_TOPS:
        m.box((-0.17, -0.46, top - 0.04), (0.155, 0.46, top), w)
    m.box((-0.175, -0.5, 1.96), (0.175, 0.5, 2.0), w, 0.01)  # top
    m.box((-0.165, -0.46, 0), (-0.145, 0.46, 0.06), w)  # plinth
    m.finish("Bookshelf", SHELF, "Furniture")

    def book(name, y, z, thick, height, cover, flat=False):
        depth = 0.20
        m = Mesh()
        if flat:  # lying on its side: thickness along Z
            m.box((-depth / 2, -height / 2, 0), (depth / 2, height / 2, thick), cover, 0.006)
            m.box((-depth / 2 - 0.004, -height / 2 + 0.008, 0.008),
                  (depth / 2 - 0.012, height / 2 - 0.008, thick - 0.008), "Card_Cream")
        else:  # upright: thickness along Y, spine towards the room (-X)
            m.box((-depth / 2, -thick / 2, 0), (depth / 2, thick / 2, height), cover, 0.006)
            m.box((-depth / 2 + 0.012, -thick / 2 + 0.008, 0.008),
                  (depth / 2 + 0.004, thick / 2 - 0.008, height + 0.004), "Card_Cream")
        m.finish(name, SHELF + Vector((-0.06, y, z)), "Furniture")

    book("Book_1", -0.39, 0.98, 0.07, 0.30, "Card_Plum")
    book("Book_2", -0.31, 0.98, 0.08, 0.32, "Card_Teal")
    book("Book_3", -0.23, 0.98, 0.07, 0.27, "Card_Rust")
    book("Book_4", 0.22, 0.54, 0.07, 0.28, "Card_Teal", flat=True)

    # Battery pack hidden behind Book_1..3; origin base centre, 0.1 wide along Y.
    (Mesh()
     .box((-0.015, -0.05, 0), (0.015, 0.05, 0.06), "Clay_Dark", 0.005)
     .box((-0.016, -0.03, 0.015), (0.016, 0.03, 0.045), "Card_Cream")  # label
     .box((-0.008, 0.05, 0.02), (0.008, 0.056, 0.04), "Metal_Brass")  # terminal
     .finish("Pickup_Battery", SHELF + Vector((0.115, -0.31, 0.98)), "Pickups"))

    # Small clock on the upper shelf; origin base centre, face towards -X.
    (Mesh()
     .box((-0.03, -0.06, 0), (0.03, 0.06, 0.14), "Clay_Dark", 0.012)
     .cyl((-0.031, 0, 0.08), 0.045, 0.045, 0.004, "X", "Clay_Cream")
     .box((-0.035, -0.003, 0.08), (-0.033, 0.003, 0.11), "Clay_Dark")
     .box((-0.035, 0, 0.077), (-0.033, 0.025, 0.083), "Clay_Dark")
     .finish("Prop_Clock", SHELF + Vector((-0.03, 0.2, 1.42)), "Furniture"))

    collider("Collider_Bookshelf", SHELF + Vector((-0.175, -0.5, 0)), SHELF + Vector((0.175, 0.5, 2.0)))


# ---------------------------------------------------------------------------
# Mirror (west wall) and painting (east wall), facing each other
# ---------------------------------------------------------------------------

def wall_frame(mesh, sign, half_w, half_h, border):
    """Chunky frame hanging on a wall; `sign` is the direction it faces along X."""
    def xs(a, b):
        return (min(sign * a, sign * b), max(sign * a, sign * b))

    w = "Wood_Walnut"
    x0, x1 = xs(0, 0.05)
    bx0, bx1 = xs(0, 0.02)
    mesh.box((bx0, -half_w + 0.01, -half_h + 0.01), (bx1, half_w - 0.01, half_h - 0.01), w)  # backing
    mesh.box((x0, -half_w, -half_h), (x1, -half_w + border, half_h), w, 0.012)
    mesh.box((x0, half_w - border, -half_h), (x1, half_w, half_h), w, 0.012)
    mesh.box((x0, -half_w + border, -half_h), (x1, half_w - border, -half_h + border), w, 0.012)
    mesh.box((x0, -half_w + border, half_h - border), (x1, half_w - border, half_h), w, 0.012)
    return mesh


def build_mirror_and_painting():
    z = 1.5

    # Mirror: 0.7 x 0.05 x 1.1, origin at the centre of its back face.
    origin = Vector((-HX, 0, z))
    frame = wall_frame(Mesh(), 1, 0.35, 0.55, 0.07).finish("Mirror_Frame", origin, "Furniture")
    y, h = 0.28, 0.48
    (Mesh()
     .quad([(0, -y, -h), (0, y, -h), (0, y, h), (0, -y, h)], "Placeholder_Mirror",
           [(0, 0), (1, 0), (1, 1), (0, 1)])  # normal +X
     .finish("Mirror_Surface", origin + Vector((0.025, 0, 0)), "Interactables", parent=frame))

    # Painting: 0.8 x 0.05 x 1.0, origin at the centre of its back face.
    origin = Vector((HX, 0, z))
    frame = wall_frame(Mesh(), -1, 0.4, 0.5, 0.07).finish("Painting_Frame", origin, "Furniture")
    y, h = 0.33, 0.43
    # Normal -X. UVs fill 0..1 and read left-to-right for a viewer in the room.
    (Mesh()
     .quad([(0, y, -h), (0, -y, -h), (0, -y, h), (0, y, h)], "Placeholder_Canvas",
           [(0, 0), (1, 0), (1, 1), (0, 1)])
     .finish("Interact_Painting_Canvas", origin + Vector((-0.025, 0, 0)), "Interactables", parent=frame))


# ---------------------------------------------------------------------------
# Rug, candle, Wisp, spawns
# ---------------------------------------------------------------------------

def build_props():
    (Mesh()
     .box((-1.0, -0.7, 0), (1.0, 0.7, 0.012), "Felt_Plum", 0.004)
     .box((-0.85, -0.55, 0.012), (0.85, 0.55, 0.016), "Felt_Teal")
     .box((-0.78, -0.48, 0.016), (0.78, 0.48, 0.018), "Felt_Plum")
     .finish("Rug", (0, -0.5, 0), "Furniture"))

    # Candle on the desk; origin base centre.
    (Mesh()
     .cyl((0, 0, 0.0075), 0.055, 0.05, 0.015, "Z", "Metal_Brass")
     .cyl((0, 0, 0.03), 0.028, 0.028, 0.03, "Z", "Metal_Brass", 12)
     .cyl((0, 0, 0.10), 0.02, 0.018, 0.11, "Z", "Clay_Cream", 12)
     .cyl((0, 0, 0.16), 0.003, 0.003, 0.012, "Z", "Clay_Dark", 6)
     .finish("Prop_Candle", DESK + Vector((-0.5, 0.1, 0.78)), "Furniture"))


WISP_SPAWN = Vector((-0.5, -0.3, 1.5))


def build_wisp_and_spawns():
    profile = [(0.15, 0), (0.13, 0.075), (0.09, 0.12), (0.03, 0.147), (-0.03, 0.147),
               (-0.09, 0.125), (-0.15, 0.095), (-0.21, 0.065), (-0.27, 0.04), (-0.32, 0.018), (-0.35, 0)]

    def bend(z):  # tail trails behind (-Y)
        return Vector((0, -1.2 * (z + 0.09) ** 2 if z < -0.09 else 0, 0))

    Mesh().lathe(profile, "Placeholder_Wisp", 12, bend).finish("Wisp", WISP_SPAWN, "Interactables")

    # Spawns: position on the floor (feet) / in the air; +Y of the empty is forward.
    empty("Spawn_Player", (0, -1.8, 0), "Spawns")
    empty("Spawn_Wisp", WISP_SPAWN, "Spawns", display="SPHERE", size=0.15)


# ---------------------------------------------------------------------------
# Held items — parked east of the room in the .blend, exported at the origin
# ---------------------------------------------------------------------------

def build_held_items():
    # Flashlight: 0.25 long, lens along +Y, origin where the hand grips.
    body = (Mesh()
            .cyl((0, 0.01, 0), 0.022, 0.022, 0.18, "Y", "Clay_Dark")
            .cyl((0, -0.075, 0), 0.025, 0.025, 0.01, "Y", "Metal_Brass")  # end cap
            .cyl((0, 0.12, 0), 0.022, 0.042, 0.04, "Y", "Clay_Dark")
            .cyl((0, 0.154, 0), 0.042, 0.042, 0.028, "Y", "Metal_Brass")
            .box((-0.008, 0.03, 0.02), (0.008, 0.06, 0.03), "Metal_Brass", 0.003)  # switch
            .finish("Flashlight_Body", (3.5, -0.5, 1.0), "Held_Items"))
    (Mesh()
     .cyl((0, 0, 0), 0.036, 0.036, 0.004, "Y", "Glass")
     .finish("Flashlight_Lens", WORLD[body.name] + Vector((0, 0.168, 0)), "Held_Items", parent=body))

    # Camera: 0.14 x 0.07 x 0.09, lens along +Y, origin body centre.
    cam = (Mesh()
           .box((-0.07, -0.035, -0.045), (0.07, 0.035, 0.045), "Clay_Dark", 0.008)
           .box((-0.07, -0.036, -0.02), (0.07, 0.036, 0.015), "Card_Rust")  # leatherette band
           .box((-0.025, -0.02, 0.045), (0.02, 0.02, 0.06), "Clay_Dark", 0.004)  # viewfinder hump
           .finish("Camera_Body", (3.5, 0.5, 1.0), "Held_Items"))
    (Mesh()
     .cyl((0, 0.0175, 0), 0.032, 0.03, 0.035, "Y", "Metal_Dark")
     .cyl((0, 0.036, 0), 0.022, 0.022, 0.002, "Y", "Glass")
     .finish("Camera_Lens", WORLD[cam.name] + Vector((0, 0.035, 0)), "Held_Items", parent=cam))
    (Mesh()
     .cyl((0, 0, 0.005), 0.012, 0.012, 0.01, "Z", "Metal_Brass", 12)
     .finish("Camera_Shutter", WORLD[cam.name] + Vector((0.045, 0, 0.045)), "Held_Items", parent=cam))


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def export_glb(path, objects):
    for obj in bpy.context.scene.objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True,
        export_cameras=False, export_lights=False, export_extras=True,
        export_apply=True, export_yup=True)


def export_all():
    os.makedirs(EXPORT_DIR, exist_ok=True)
    room = [o for name in ROOM_EXPORT_COLLECTIONS for o in bpy.data.collections[name].objects]
    export_glb(os.path.join(EXPORT_DIR, "level-0.glb"), room)

    # Held items are exported with their root at the origin.
    for root_name, filename in (("Flashlight_Body", "flashlight.glb"), ("Camera_Body", "camera.glb")):
        root = bpy.data.objects[root_name]
        parked = root.location.copy()
        root.location = (0, 0, 0)
        export_glb(os.path.join(EXPORT_DIR, filename), [root, *root.children_recursive])
        root.location = parked


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "Level_0"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    for name in COLLECTIONS:
        scene.collection.children.link(bpy.data.collections.new(name))
    for name, spec in MATERIALS.items():
        make_material(name, *spec)

    build_room()
    build_door()
    build_desk()
    build_chair()
    build_bookshelf()
    build_mirror_and_painting()
    build_props()
    build_wisp_and_spawns()
    build_held_items()

    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    export_all()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

    print("\n== Level 0 objects ==")
    for coll in COLLECTIONS:
        for obj in bpy.data.collections[coll].objects:
            loc = obj.matrix_world.translation
            dim = obj.dimensions
            print(f"{coll:14} {obj.name:26} origin=({loc.x:6.3f},{loc.y:6.3f},{loc.z:6.3f}) "
                  f"size=({dim.x:.3f},{dim.y:.3f},{dim.z:.3f})")


if __name__ == "__main__":
    main()
