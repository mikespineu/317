"""Re-export blender/export/level-2.glb and uv-lamp.glb from the current blender/level-2.blend.

Use this after hand edits in Blender (it never rebuilds or modifies geometry).

Run:  /Applications/Blender.app/Contents/MacOS/Blender -b blender/level-2.blend --python blender/scripts/export_level2.py
"""

import os

import bpy

EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "export")
EXPORT_COLLECTIONS = ["Room", "Furniture", "Interactables", "Pickups", "Props", "UVOnly", "Ghosts", "Colliders", "Spawns"]


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


os.makedirs(EXPORT_DIR, exist_ok=True)
room = [o for name in EXPORT_COLLECTIONS for o in bpy.data.collections[name].objects]
export_glb(os.path.join(EXPORT_DIR, "level-2.glb"), room)

# The floor pickup is exported with its origin at the world origin.
lamp = bpy.data.objects["Pickup_UV_Lamp"]
parked = lamp.location.copy()
lamp.location = (0, 0, 0)
export_glb(os.path.join(EXPORT_DIR, "uv-lamp.glb"), [lamp])
lamp.location = parked
