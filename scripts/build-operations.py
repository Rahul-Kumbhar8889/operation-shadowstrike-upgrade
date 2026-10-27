"""Original operations-building art. Run: blender -b --python scripts/build-operations.py
Coordinates are authored in Three.js meters; exported glTF is Y-up.
No third-party geometry or textures are embedded in this model.
"""
from pathlib import Path
import bpy
from mathutils import Vector

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
materials = {}
for name, color, metal, rough in [
    ('Concrete', (.55, .53, .46, 1), 0, .9),
    ('PaintedMetal', (.24, .29, .25, 1), .15, .7),
    ('RoofMetal', (.32, .34, .30, 1), .65, .55),
    ('Glazing', (.065, .11, .12, 1), .25, .28),
    ('Recess', (.055, .065, .055, 1), 0, .95),
    ('Markings', (.71, .64, .40, 1), 0, .85),
]:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    materials[name] = mat


def box(name, mat, x, y, z, w, h, d, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(materials[mat])
    # World-scaled UVs: two meters per repeat, including normals/roughness/AO.
    uv = obj.data.uv_layers.active
    for face in obj.data.polygons:
        n = face.normal
        axis = max(range(3), key=lambda a: abs(n[a]))
        for loop_index in face.loop_indices:
            v = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co + obj.location
            if axis == 0: coords = (-v.y / 2, v.z / 2)
            elif axis == 1: coords = (v.x / 2, v.z / 2)
            else: coords = (v.x / 2, -v.y / 2)
            uv.data[loop_index].uv = coords
    if bevel:
        mod = obj.modifiers.new('Manufactured edge', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


# All geometry is within [-4,4] x [0,5] x [-1.5,1.5].
box('Solid shell', 'Concrete', 0, 2.3, 0, 7.84, 4.6, 2.70, .025)
box('Plinth', 'Recess', 0, .10, 0, 8, .20, 3, .012)
box('Foundation', 'Concrete', 0, .30, 0, 8, .40, 3, .015)
for side in [-1, 1]:
    for row, y in enumerate([1.45, 3.45]):
        for col in range(4):
            x = -3 + col * 2
            box('Precast facade module', 'Concrete', x, y, side * 1.385, 1.95, 1.84, .11, .015)
            # Sealed upper glazing; no cutout or accessible door is implied.
            if row == 1:
                box('Window backing', 'Recess', x, y + .12, side * 1.45, 1.33, .91, .05)
                box('Opaque window', 'Glazing', x, y + .12, side * 1.485, 1.18, .72, .015)
                for dx in [-.64, 0, .64]:
                    box('Window mullion', 'PaintedMetal', x + dx, y + .12, side * 1.48, .045, .87, .04, .006)
                for dy in [-.42, .42]:
                    box('Window sill', 'PaintedMetal', x, y + .12 + dy, side * 1.475, 1.33, .055, .05, .006)
    for x in [-3.92, -2, 0, 2, 3.92]:
        box('Structural pilaster', 'Concrete', x, 2.55, side * 1.43, .14, 4.1, .14, .01)
    box('Floor band', 'Concrete', 0, 2.48, side * 1.435, 7.9, .16, .13, .008)
    box('Parapet wall', 'Concrete', 0, 4.74, side * 1.40, 8, .28, .20, .008)
    box('Parapet cap', 'RoofMetal', 0, 4.94, side * 1.40, 8, .12, .20, .008)
    # Flush, waist-height utility cabinets rather than fake doors.
    for x in [-2.75, 2.75]:
        box('Service surround', 'Recess', x, 1.23, side * 1.455, 1.02, .98, .05)
        box('Service panel', 'PaintedMetal', x, 1.23, side * 1.48, .91, .87, .035, .012)
        for dx in [-.36, .36]:
            for dy in [-.33, .33]:
                box('Panel fixing', 'RoofMetal', x + dx, 1.23 + dy, side * 1.499, .028, .028, .002)
    box('Vent surround', 'Recess', 0, 1.3, side * 1.46, 1.25, .72, .06)
    for i in range(8):
        box('Vent louver', 'PaintedMetal', 0, 1.0 + i * .08, side * 1.483, 1.15, .035, .025)
    box('Sign backing', 'PaintedMetal', 0, 2.14, side * 1.46, 1.7, .37, .06, .01)
    # Ground-level damp course and skirting, fully within the existing envelope.
    box('Skirting', 'PaintedMetal', 0, .55, side * 1.47, 7.85, .08, .06)
for side in [-1, 1]:
    box('Side parapet', 'Concrete', side * 3.9, 4.74, 0, .2, .28, 2.8, .008)
    box('Side cap', 'RoofMetal', side * 3.9, 4.94, 0, .2, .12, 2.8, .008)
    for z in [-1.4, 0, 1.4]:
        box('Side pier', 'Concrete', side * 3.96, 2.7, z, .08, 4.3, .16, .008)
    box('Side metal panel', 'PaintedMetal', side * 3.95, 2.6, 0, .06, 2.5, 1.1, .008)
    for z in [-.45, -.3, -.15, 0, .15, .3, .45]:
        box('Side panel rib', 'RoofMetal', side * 3.985, 2.6, z, .025, 2.4, .025)
box('Recessed roof deck', 'RoofMetal', 0, 4.63, 0, 7.8, .08, 2.75)
for x in [-2.3, 2.3]:
    box('Rooftop HVAC housing', 'PaintedMetal', x, 4.79, 0, 1.1, .24, .9, .02)
    for z in [-.32, -.16, 0, .16, .32]:
        box('HVAC grille', 'Recess', x, 4.92, z, .91, .015, .035)

# Join by material: six render meshes, with readable modular source above.
for name, mat in materials.items():
    bpy.ops.object.select_all(action='DESELECT')
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.active_material == mat]
    if not objects:
        continue
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    bpy.context.object.name = name

output = Path(__file__).resolve().parents[1] / 'public/assets/operations/operations.glb'
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_yup=True,
                          export_animations=False, export_extras=True)
print('Exported original building:', output)
