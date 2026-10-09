"""Preview renders of the Level 2 blockout (never saves the .blend).

Run:  /Applications/Blender.app/Contents/MacOS/Blender -b blender/level-2.blend --python blender/scripts/render_level2_previews.py

Writes blender/renders/level-2/*.png (Workbench): plan.png, cutaway.png, spawn.png, aisle.png (eye height).
"""

import os

import bpy
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "renders", "level-2")
os.makedirs(OUT, exist_ok=True)
scene = bpy.context.scene

for name in ("Colliders", "Spawns"):
    for obj in bpy.data.collections[name].objects:
        obj.hide_render = True


def camera(name, loc, target, lens=24, ortho=None):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.clip_end = 100
    if ortho:
        data.type = "ORTHO"
        data.ortho_scale = ortho
    cam = bpy.data.objects.new(name, data)
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


def render(cam, filename, w=1280, h=720):
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.render.filepath = os.path.join(OUT, filename)
    bpy.ops.render.render(write_still=True)


scene.render.engine = "BLENDER_WORKBENCH"
sh = scene.display.shading
sh.light = "STUDIO"
sh.color_type = "MATERIAL"
sh.show_cavity = True
sh.show_object_outline = True
sh.show_shadows = True

# UV ink and ghost placeholders are not meant to be seen in white light.
for obj in [*bpy.data.collections["UVOnly"].objects, *bpy.data.collections["Ghosts"].objects]:
    obj.hide_render = True

CUT = ["Ceiling", "Cornice"]
set_hidden(CUT, True)
render(camera("Cam_Plan", (0, 0, 20), (0, 0.0001, 0), ortho=9.4), "plan.png", 900, 1200)

CUT2 = ["Wall_S", "Wall_E", "Window_Frame", "Window_Glass", "Window_Curtain_L", "Window_Curtain_R",
        "Entry_Door_Frame", "Entry_Door", "Hall_Vestibule"]
set_hidden(CUT2, True)
render(camera("Cam_Cutaway", (7.5, -9.0, 8.0), (-0.3, 0.6, 0.8), lens=28), "cutaway.png")
set_hidden(CUT + CUT2, False)

render(camera("Cam_Spawn", (0, -3.3, 1.6), (0.3, 3.8, 1.5), lens=20), "spawn.png")
render(camera("Cam_Aisle", (-0.4, 0.4, 1.6), (-3.0, 2.2, 1.9), lens=22), "aisle.png")
print("renders in", OUT)
