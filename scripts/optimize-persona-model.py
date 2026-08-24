"""Create a web-sized GLB while preserving the source model and active animation.

Usage:
  blender -b --python scripts/optimize-persona-model.py -- input.glb output.glb [max_texture_px] [target_faces]
"""

from __future__ import annotations

import sys
from pathlib import Path

import bpy


def script_args() -> list[str]:
    try:
        separator = sys.argv.index("--")
    except ValueError as error:
        raise SystemExit("Expected arguments after --") from error
    return sys.argv[separator + 1 :]


def resize_images(max_texture_px: int) -> None:
    for image in bpy.data.images:
        width, height = image.size
        largest_side = max(width, height)
        if largest_side <= max_texture_px:
            continue

        ratio = max_texture_px / largest_side
        image.scale(max(1, round(width * ratio)), max(1, round(height * ratio)))
        image.update()


def simplify_meshes(target_faces: int) -> None:
    mesh_objects = [item for item in bpy.context.scene.objects if item.type == "MESH"]
    total_faces = sum(len(item.data.polygons) for item in mesh_objects)
    if total_faces <= target_faces:
        return

    ratio = max(0.05, target_faces / total_faces)
    for item in mesh_objects:
        if not item.data.polygons:
            continue
        modifier = item.modifiers.new(name="PersonaWebDecimate", type="DECIMATE")
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = item
        item.select_set(True)
        bpy.ops.object.modifier_move_to_index(modifier=modifier.name, index=0)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        item.select_set(False)


def main() -> None:
    args = script_args()
    if len(args) < 2:
        raise SystemExit("Usage: input.glb output.glb [max_texture_px] [target_faces]")

    source = Path(args[0]).resolve()
    destination = Path(args[1]).resolve()
    max_texture_px = int(args[2]) if len(args) > 2 else 1024
    target_faces = int(args[3]) if len(args) > 3 else 90000

    if not source.is_file():
        raise SystemExit(f"Source model does not exist: {source}")

    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    resize_images(max_texture_px)
    simplify_meshes(target_faces)

    bpy.ops.export_scene.gltf(
        filepath=str(destination),
        export_animation_mode="ACTIVE_ACTIONS",
        export_animations=True,
        export_apply=False,
        export_frame_step=2,
        export_format="GLB",
        export_image_format="WEBP",
        export_image_quality=78,
        export_image_webp_fallback=False,
        export_optimize_animation_size=True,
    )

    print(f"Optimized {source.name} -> {destination} ({destination.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
