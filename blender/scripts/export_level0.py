"""Re-export the Level 0 .glb files from the current blender/level-0.blend.

Use this after hand edits in Blender (it never rebuilds or modifies geometry).

Run:  /Applications/Blender.app/Contents/MacOS/Blender -b blender/level-0.blend --python blender/scripts/export_level0.py
"""

import os

import bpy

EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "export")
ROOM_EXPORT_COLLECTIONS = ["Room", "Furniture", "Interactables", "Pickups", "Colliders", "Spawns"]
HELD_ITEMS = (("Flashlight_Body", "flashlight.glb"), ("Camera_Body", "camera.glb"))


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
room = [o for name in ROOM_EXPORT_COLLECTIONS for o in bpy.data.collections[name].objects]
export_glb(os.path.join(EXPORT_DIR, "level-0.glb"), room)

# Held items are parked beside the room in the .blend and exported at the origin.
for root_name, filename in HELD_ITEMS:
    root = bpy.data.objects[root_name]
    parked = root.location.copy()
    root.location = (0, 0, 0)
    export_glb(os.path.join(EXPORT_DIR, filename), [root, *root.children_recursive])
    root.location = parked
