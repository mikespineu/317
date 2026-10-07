"""Preview renders of the Level 1 blockout (never saves the .blend).

Run:  /Applications/Blender.app/Contents/MacOS/Blender -b blender/level-1.blend --python blender/scripts/render_level1_previews.py

Writes blender/renders/level-1/*.png:
  plan.png        top-down plan, ceiling hidden (Workbench)
  cutaway.png     3/4 view with the south and east walls hidden (Workbench)
  spawn.png       the player's first view from Spawn_Player (Workbench)
  mirror.png      eye height on the rug, looking into the mirror, flashlight on the east wall (Cycles)
  east_wall.png   same spot, turned round to the east wall: the text is not there (Cycles)

In the Cycles shots MirrorOnly_* objects are hidden from the camera but visible
to reflections, the same rule the game uses.
"""

import math
import os

import bpy
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "renders", "level-1")
os.makedirs(OUT, exist_ok=True)
scene = bpy.context.scene

for obj in bpy.data.collections["Colliders"].objects:
    obj.hide_render = True
for name in ("Spawns",):
    for obj in bpy.data.collections[name].objects:
        obj.hide_render = True


def camera(name, loc, target, lens=24, ortho=None):
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam_data.clip_end = 100
    if ortho:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = ortho
    cam = bpy.data.objects.new(name, cam_data)
    scene.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return cam


def set_hidden(names, hidden):
    for n in names:
        obj = bpy.data.objects.get(n)
        if obj:
            for o in (obj, *obj.children_recursive):
                o.hide_render = hidden


def workbench():
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.color_type = "MATERIAL"
    sh.show_cavity = True
    sh.show_object_outline = True
    sh.show_shadows = True


def render(cam, filename, w=1280, h=720):
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.render.filepath = os.path.join(OUT, filename)
    bpy.ops.render.render(write_still=True)


# --- Workbench views --------------------------------------------------------
# Workbench ignores per-ray visibility, so mirror-only objects are simply hidden here.
for obj in bpy.data.collections["MirrorOnly"].objects:
    obj.hide_render = True
workbench()
CUT = ["Ceiling", "Cornice", "Chandelier"]
set_hidden(CUT, True)
render(camera("Cam_Plan", (0, 0, 20), (0, 0.0001, 0), ortho=9.4), "plan.png", 900, 1200)

CUT2 = ["Wall_S", "Wall_E", "Window_Frame", "Window_Glass", "Window_Curtain_L", "Window_Curtain_R",
        "Front_Door_Frame", "Front_Door_L", "Front_Door_R", "Library_Door_Frame", "Library_Door_Sign",
        "Interact_Library_Door", "Library_Vestibule", "Coat_Rack", "Coat_1", "Hat", "Interact_Coat_Pocket",
        "Pickup_Battery_Coat", "Umbrella_Stand"]
set_hidden(CUT2, True)
render(camera("Cam_Cutaway", (6.5, -8.0, 7.0), (-0.6, 0.8, 0.6), lens=28), "cutaway.png")
set_hidden(CUT + CUT2, False)

render(camera("Cam_Spawn", (0, -3.2, 1.6), (0.6, 3.8, 1.4), lens=20), "spawn.png")

# --- Cycles: mirror check ----------------------------------------------------
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.cycles.device = "CPU"
for obj in bpy.data.collections["MirrorOnly"].objects:
    obj.hide_render = False
    obj.visible_camera = False  # only reflections see it, like the game's reflector layer
    obj.visible_shadow = False

mirror_mat = bpy.data.materials["Placeholder_Mirror"]
bsdf = next(n for n in mirror_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
bsdf.inputs["Roughness"].default_value = 0.0
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Base Color"].default_value = (0.9, 0.92, 0.95, 1)

world = bpy.data.worlds.new("Night")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.025, 0.06, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
scene.world = world

amb = bpy.data.lights.new("Fill", "AREA")
amb.energy = 250
amb.size = 4
amb.color = (0.6, 0.65, 1.0)
fill = bpy.data.objects.new("Fill", amb)
scene.collection.objects.link(fill)
fill.location = (0, 0, 3.8)

eye = Vector((0.2, -0.4, 1.6))
flash = bpy.data.lights.new("Flashlight", "SPOT")
flash.energy = 900
flash.spot_size = math.radians(30)
flash.spot_blend = 0.4
flash.color = (1.0, 0.82, 0.55)
fl = bpy.data.objects.new("Flashlight", flash)
scene.collection.objects.link(fl)
fl.location = eye + Vector((0.15, -0.1, -0.15))
fl.rotation_euler = (Vector((3.0, -0.4, 2.6)) - fl.location).to_track_quat("-Z", "Y").to_euler()

render(camera("Cam_Mirror", eye, (-3.0, -0.4, 1.9), lens=32), "mirror.png", 960, 540)
render(camera("Cam_EastWall", eye, (3.0, -0.4, 2.2), lens=32), "east_wall.png", 960, 540)
print("renders in", OUT)
