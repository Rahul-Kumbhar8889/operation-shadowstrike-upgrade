"""Original static operator study, no external geometry, textures, rig or animations.
Run: blender -b --python scripts/build-soldier-prototype.py
Authored in Three.js coordinates: +Y up, -Z facing forward; export glTF Y-up.
"""
import bpy
import math
import json
import random
import tempfile
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dev-assets/soldier-prototype'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Original woven camouflage and textile data maps, generated offline.
# Pillow is supplied by the system Python; Blender calls the helper script first.
texture_dir = Path('/tmp/shadowstrike-soldier-textures')
texture_dir.mkdir(exist_ok=True)
import subprocess
subprocess.run(['/usr/bin/env', 'python3', str(ROOT / 'scripts/soldier-textures.py'), str(texture_dir)], check=True)


def mat(name, color, rough=.8, metal=0, textile=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if textile:
        nodes = m.node_tree.nodes
        for suffix, socket, space in [('albedo.jpg', 'Base Color', 'sRGB'), ('rough.png', 'Roughness', 'Non-Color')]:
            node = nodes.new('ShaderNodeTexImage')
            node.image = bpy.data.images.load(str(texture_dir / f'{textile}-{suffix}'), check_existing=True)
            node.image.colorspace_settings.name = space
            m.node_tree.links.new(node.outputs['Color'], bsdf.inputs[socket])
        normal = nodes.new('ShaderNodeTexImage')
        normal.image = bpy.data.images.load(str(texture_dir / 'woven-normal.png'), check_existing=True)
        normal.image.colorspace_settings.name = 'Non-Color'
        normal_node = nodes.new('ShaderNodeNormalMap')
        normal_node.inputs['Strength'].default_value = .35
        m.node_tree.links.new(normal.outputs['Color'], normal_node.inputs['Color'])
        m.node_tree.links.new(normal_node.outputs['Normal'], bsdf.inputs['Normal'])
    return m


M = {
    'uniform': mat('Original woodland fabric', (1,1,1), textile='camo'),
    'gear': mat('Original olive Cordura', (1,1,1), textile='cordura'),
    'mask': mat('Original charcoal balaclava', (1,1,1), textile='charcoal'),
    'rubber': mat('Rubber and polymer', (.045,.052,.044), .88),
    'leather': mat('Boot leather', (.12,.105,.075), .78),
    'webbing': mat('Webbing and seam thread', (.21,.235,.15), .92),
    'metal': mat('Matte metal fittings', (.15,.17,.15), .5, .6),
    'lens': mat('Opaque protective lenses', (.015,.025,.022), .28, .02),
}


def world(p):
    return (p[0], -p[2], p[1])


def finish(name, verts, faces, material, uv_scale=3):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([world(v) for v in verts], [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(M[material])
    uv = mesh.uv_layers.new(name='UVMap')
    for face in mesh.polygons:
        normal = face.normal
        axis = max(range(3), key=lambda a: abs(normal[a]))
        face.use_smooth = True
        for index in face.loop_indices:
            v = mesh.vertices[mesh.loops[index].vertex_index].co
            if axis == 0: coords = (-v.y * uv_scale, v.z * uv_scale)
            elif axis == 1: coords = (v.x * uv_scale, v.z * uv_scale)
            else: coords = (v.x * uv_scale, -v.y * uv_scale)
            uv.data[index].uv = coords
    return obj


def loft(name, rings, material, segments=32, wrinkle=0):
    # Cross sections are (y, centerX, centerZ, radiusX, radiusZ).
    verts = []
    for j, (y,x,z,rx,rz) in enumerate(rings):
        for i in range(segments):
            a = i * math.tau / segments
            fold = 1 + wrinkle * math.sin(j*2.6+i*.82) * math.sin(math.pi*j/max(1,len(rings)-1))
            verts.append((x + math.cos(a)*rx*fold, y, z+math.sin(a)*rz*fold))
    faces = []
    for j in range(len(rings)-1):
        for i in range(segments):
            a=j*segments+i; b=j*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple((len(rings)-1)*segments+i for i in range(segments)))
    return finish(name,verts,faces,material)


def ellipsoid(name, location, scale, material, segments=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=world(location))
    obj=bpy.context.object;obj.name=name;obj.scale=(scale[0],scale[2],scale[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(M[material])
    for p in obj.data.polygons:p.use_smooth=True
    return obj


def rounded(name, location, dimensions, material, bevel=.025, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1,location=world(location))
    obj=bpy.context.object;obj.name=name
    obj.dimensions=(dimensions[0],dimensions[2],dimensions[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(M[material])
    mod=obj.modifiers.new('Soft manufactured edge','BEVEL');mod.width=bevel;mod.segments=segments
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # Smooth bevels; weighted normals keep broad fabric panels readable.
    for p in obj.data.polygons:p.use_smooth=True
    normal=obj.modifiers.new('Panel normals','WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=normal.name)
    return obj


def tube(name, points, radius, material, sides=6):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D'
    curve.resolution_u=1;curve.bevel_depth=radius;curve.bevel_resolution=0;curve.resolution_u=1
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for point,co in zip(spline.points,points):point.co=(*world(co),1)
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(M[material])
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.object.convert(target='MESH');obj.select_set(False)
    for p in obj.data.polygons:p.use_smooth=True
    return obj


def limb(name, start, end, radii, material, segments=28, wrinkle=.035):
    a,b=Vector(start),Vector(end)
    direction=(b-a).normalized()
    u=direction.cross(Vector((0,0,1))).normalized()
    if u.length<.1:u=Vector((1,0,0))
    v=direction.cross(u).normalized()
    verts=[]
    for j,radius in enumerate(radii):
        t=j/(len(radii)-1);center=a.lerp(b,t)
        for i in range(segments):
            angle=i*math.tau/segments
            fold=1+wrinkle*math.sin(j*2.4+i*.9)*math.sin(t*math.pi)
            p=center+(u*math.cos(angle)+v*math.sin(angle))*(radius*fold)
            verts.append(tuple(p))
    faces=[]
    for j in range(len(radii)-1):
        for i in range(segments):
            p=j*segments+i;q=j*segments+(i+1)%segments
            faces.append((p,q,q+segments,p+segments))
    faces.extend([tuple(reversed(range(segments))),tuple((len(radii)-1)*segments+i for i in range(segments))])
    return finish(name,verts,faces,material)


# Human proportions: helmet height ~2.52 game units, 7.5-head clothed silhouette.
# The game units and camera match the existing character; no controller scaling.
loft('Pelvis and trouser seat',[(1.03,0,.035,.20,.14),(1.12,0,.025,.25,.17),(1.24,0,.015,.255,.17),(1.34,0,0,.235,.15),(1.41,0,0,.215,.14)],'uniform',40)
loft('Shaped uniform torso',[(1.30,0,.01,.215,.145),(1.4,0,0,.225,.15),(1.5,0,0,.24,.16),(1.65,0,0,.275,.185),(1.82,0,0,.30,.18),(1.96,0,.015,.285,.15),(2.03,0,.02,.22,.12),(2.08,0,.02,.13,.10)],'uniform',48,.025)
loft('Collar and neck',[(2.00,0,.005,.12,.10),(2.07,0,.005,.13,.105),(2.13,0,.005,.10,.095),(2.19,0,0,.105,.10)],'gear',32)

for side in [-1,1]:
    x=side*.145
    loft('Anatomical thigh',[(.69,x,.015,.115,.12),(.76,x,.005,.125,.13),(.83,x,.005,.13,.145),(.91,x,.02,.145,.15),(1.02,x,.025,.155,.17),(1.12,x,.02,.158,.17),(1.21,x,.015,.15,.16),(1.27,x,.015,.135,.145)],'uniform',36,.045)
    loft('Calf and gathered trouser cuff',[(.22,x,.025,.095,.09),(.27,x,.025,.11,.11),(.32,x,.03,.105,.115),(.39,x,.04,.12,.135),(.48,x,.04,.13,.135),(.57,x,.03,.12,.125),(.64,x,.025,.11,.115),(.72,x,.02,.115,.12),(.77,x,.015,.12,.125)],'uniform',36,.065)
    # Patella shape and flexible knee pad rather than a square box.
    ellipsoid('Knee pad textile surround',(x,.73,-.108),(.125,.145,.055),'gear',24,14)
    ellipsoid('Moulded knee protector',(x,.73,-.15),(.095,.112,.035),'rubber',24,14)
    for yy in [.68,.74,.8]:tube('Knee moulding',[(x-.06,yy,-.176),(x,yy-.01,-.184),(x+.06,yy,-.176)],.004,'webbing')
    # Rounded boot last, ankle shaft, treaded sole and toe cap.
    loft('Leather ankle boot',[(.06,x,-.065,.11,.20),(.12,x,-.07,.115,.205),(.19,x,-.05,.105,.17),(.25,x,.01,.095,.12),(.34,x,.025,.095,.105),(.41,x,.03,.09,.10)],'leather',36)
    loft('Boot outsole',[(.005,x,-.07,.115,.21),(.025,x,-.07,.12,.215),(.055,x,-.07,.12,.21),(.075,x,-.07,.115,.205)],'rubber',36)
    ellipsoid('Reinforced boot toe',(x,.12,-.20),(.108,.068,.085),'rubber',24,12)
    for j in range(5):
        y=.19+j*.039;z=-.16+j*.011
        tube('Crossed boot lace',[(x-.065,y,z),(x+.065,y+.028,z+.008)],.005,'webbing')
        tube('Crossed boot lace',[(x+.065,y,z),(x-.065,y+.028,z+.008)],.005,'webbing')
    for j in range(6):rounded('Sole tread',(x,.027,-.22+j*.055),(.225,.032,.018),'rubber',.004,1)
    # Trouser cargo pocket with bellows, flap and twin stitching lines.
    rounded('Thigh cargo pocket',(x+side*.13,1.02,.012),(.075,.25,.20),'uniform',.026,3)
    rounded('Cargo flap',(x+side*.16,1.125,.01),(.035,.055,.21),'gear',.012,2)
    tube('Trouser outer seam',[(x+side*.10,.34,.07),(x+side*.125,.62,.08),(x+side*.145,.9,.08),(x+side*.15,1.23,.08)],.003,'webbing')

# Original head volume under balaclava; jaw tapers independently of cranium.
loft('Anatomical covered head',[(2.09,0,-.015,.064,.065),(2.14,0,-.025,.085,.085),(2.20,0,-.035,.115,.105),(2.27,0,-.025,.137,.12),(2.35,0,-.005,.143,.13),(2.42,0,.005,.13,.125),(2.47,0,.012,.095,.10),(2.49,0,.015,.035,.04)],'mask',48)
ellipsoid('Covered nose bridge',(0,2.28,-.127),(.024,.035,.016),'mask',24,12)
# High-cut helmet cover: curved shell, defined brow rim, rails and NVG mount.
loft('High cut ballistic helmet',[(2.32,0,.015,.15,.145),(2.35,0,.015,.17,.16),(2.40,0,.02,.18,.17),(2.46,0,.025,.165,.155),(2.51,0,.03,.135,.13),(2.55,0,.03,.085,.085),(2.565,0,.03,.02,.02)],'uniform',64)
helmet_rim=[(.173*math.cos(i*math.tau/48),2.35+.018*math.cos(i*math.tau/48),.015+.16*math.sin(i*math.tau/48)) for i in range(49)]
tube('Helmet rubber edging',helmet_rim,.008,'rubber')
for side in [-1,1]:
    rounded('Helmet accessory rail',(side*.168,2.37,.035),(.025,.045,.15),'rubber',.008,2)
    for z in [-.02,.035,.09]:ellipsoid('Helmet rail screw',(side*.183,2.37,z),(.008,.008,.008),'metal',12,8)
    tube('Helmet chin strap',[(side*.135,2.37,-.055),(side*.12,2.23,-.07),(side*.055,2.14,-.09),(0,2.125,-.08)],.012,'webbing')
rounded('NVG mounting plate',(0,2.41,-.163),(.075,.085,.018),'metal',.01,2)
rounded('NVG mounting slot',(0,2.415,-.177),(.034,.045,.012),'rubber',.006,2)
# Low-profile protective goggles; opaque lenses avoid an unverified face sculpt.
for side in [-1,1]:
    ellipsoid('Goggle rubber orbital seal',(side*.069,2.32,-.122),(.076,.031,.027),'rubber',32,16)
    ellipsoid('Smoked protective lens',(side*.069,2.323,-.151),(.066,.023,.012),'lens',32,16)
tube('Goggle nose bridge',[(-.02,2.325,-.167),(0,2.335,-.173),(.02,2.325,-.167)],.009,'rubber')
tube('Goggle elastic strap',[(-.13,2.32,-.08),(-.15,2.32,.07),(0,2.32,.145),(.15,2.32,.07),(.13,2.32,-.08)],.014,'rubber')

# Sculpted plate carrier, curved front/back and side cummerbund.
loft('Plate carrier torso wrap',[(1.40,0,.01,.242,.175),(1.47,0,0,.26,.19),(1.65,0,0,.29,.21),(1.84,0,.015,.30,.20),(1.95,0,.02,.26,.155)],'gear',48)
rounded('Front ballistic plate',(0,1.70,-.174),(.45,.40,.10),'gear',.055,5)
rounded('Rear ballistic plate',(0,1.70,.19),(.43,.43,.095),'gear',.05,5)
for side in [-1,1]:
    tube('Carrier shoulder strap',[(side*.19,1.84,-.17),(side*.20,2.015,-.08),(side*.20,2.04,.05),(side*.19,1.86,.19)],.025,'webbing')
    rounded('Shoulder buckle',(side*.19,1.94,-.12),(.07,.07,.025),'rubber',.009,2)
    tube('Carrier binding seam',[(side*.22,1.49,-.213),(side*.23,1.68,-.22),(side*.21,1.87,-.21)],.004,'webbing')
for row in range(4):
    y=1.49+row*.085
    rounded('MOLLE webbing',(0,y,-.234),(.43,.025,.012),'webbing',.004,1)
    for x in [-.17,-.085,0,.085,.17]:tube('MOLLE bar tack',[(x,y-.013,-.243),(x,y+.013,-.243)],.002,'gear')
for x in [-.145,0,.145]:
    rounded('Magazine pouch',(x,1.47,-.26),(.13,.24,.10),'gear',.023,3)
    rounded('Magazine pouch flap',(x,1.59,-.28),(.13,.045,.09),'webbing',.012,2)
    tube('Pouch retention',[(x-.035,1.55,-.32),(x,1.61,-.325),(x+.035,1.55,-.32)],.004,'rubber')
rounded('Blank velcro identification patch',(0,1.85,-.227),(.23,.055,.015),'webbing',.007,2)
# Web belt with proportionate field equipment.
loft('Duty belt',[(1.30,0,.01,.247,.18),(1.37,0,.01,.247,.18)],'webbing',48)
rounded('Belt buckle',(0,1.335,-.18),(.07,.045,.025),'rubber',.006,2)
rounded('Utility radio',(-.28,1.68,-.03),(.08,.16,.075),'rubber',.015,3)
tube('Radio aerial',[(-.28,1.75,-.02),(-.28,1.97,-.02)],.006,'rubber')
rounded('Medical pouch',(.255,1.35,.08),(.13,.17,.17),'gear',.025,3)

# Backpack: fitted pack body with curved silhouette, compartments, seams, straps.
loft('Field backpack',[(1.28,0,.25,.14,.095),(1.34,0,.29,.19,.14),(1.46,0,.31,.215,.16),(1.66,0,.31,.22,.16),(1.83,0,.29,.205,.145),(1.95,0,.26,.16,.10),(2.00,0,.24,.10,.065)],'gear',40)
rounded('Backpack outer compartment',(0,1.53,.445),(.33,.32,.10),'gear',.05,5)
rounded('Backpack top pocket',(0,1.83,.415),(.30,.14,.10),'gear',.04,4)
for side in [-1,1]:
    rounded('Pack compression strap',(side*.135,1.58,.475),(.03,.51,.015),'webbing',.006,2)
    rounded('Pack compression buckle',(side*.135,1.55,.49),(.05,.055,.015),'rubber',.005,2)
    tube('Pack side seam',[(side*.16,1.35,.39),(side*.20,1.57,.43),(side*.17,1.83,.38)],.004,'webbing')
    tube('Pack shoulder harness',[(side*.17,1.45,.17),(side*.24,1.8,.14),(side*.25,2.0,.05),(side*.2,1.97,-.1),(side*.21,1.73,-.19)],.018,'webbing')
tube('Pack carry handle',[(-.07,1.96,.26),(-.07,2.025,.26),(.07,2.025,.26),(.07,1.96,.26)],.012,'rubber')
tube('Hydration tube',[(-.13,1.92,.30),(-.28,2.03,.12),(-.29,1.94,-.1),(-.24,1.7,-.23),(-.19,1.66,-.24)],.009,'rubber')

# Static low-ready study: no rig, clips or claims of animation readiness.
for side in [-1,1]:
    shoulder=(side*.32,1.95,.015)
    elbow=(side*.36,1.60,-.18 if side==1 else -.28)
    wrist=(.22,1.34,-.57) if side==1 else (-.05,1.43,-.73)
    ellipsoid('Rounded deltoid',shoulder,(.115,.115,.115),'uniform',28,16)
    limb('Sleeve upper arm',shoulder,elbow,[.11,.125,.12,.115,.11,.105,.10,.095],'uniform',32)
    limb('Sleeve forearm',elbow,wrist,[.10,.105,.10,.095,.09,.085,.08,.075,.07],'uniform',32,.05)
    ellipsoid('Elbow reinforcement',elbow,(.10,.10,.10),'gear',20,12)
    rounded('Glove palm',(wrist[0],wrist[1]-.035,wrist[2]-.035),(.13,.11,.15),'gear',.038,4)
    # Segmented curled fingers, instead of a mitten-like box.
    for i in range(4):
        x=wrist[0]-.045+i*.03
        limb('Gloved finger',(x,wrist[1]-.015,wrist[2]-.085),(x,wrist[1]-.09,wrist[2]-.105),[.016,.017,.016,.014],'rubber',10,0)
        ellipsoid('Knuckle protector',(x,wrist[1]+.005,wrist[2]-.075),(.017,.018,.020),'rubber',12,8)
    limb('Gloved thumb',(wrist[0]-.065,wrist[1]-.015,wrist[2]-.02),(wrist[0]-.075,wrist[1]-.065,wrist[2]-.08),[.022,.023,.02,.016],'gear',12,0)
    # Wrist closure and shoulder insignia provide scale without borrowed markings.
    rounded('Glove wrist closure',(wrist[0],wrist[1]+.045,wrist[2]),(.15,.045,.12),'webbing',.015,3)
    rounded('Blank sleeve patch',(side*.425,1.85,-.035),(.018,.105,.075),'gear',.007,2)

# Consolidate by material. Static, intentionally no armature or animation clips.
for key,material in M.items():
    bpy.ops.object.select_all(action='DESELECT')
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.active_material==material]
    if not objects:continue
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    bpy.context.object.name=material.name
    bpy.context.object['original_artwork']=True
    bpy.context.object['rigged']=False

# Count evaluated exported triangles, not Blender polygon quads.
triangles=0
for obj in bpy.context.scene.objects:
    if obj.type=='MESH':obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
model=OUT/'soldier-static.glb'
bpy.ops.export_scene.gltf(filepath=str(model),export_format='GLB',export_yup=True,
                          export_animations=False,export_extras=True)
metadata={'triangles':triangles,'bytes':model.stat().st_size,'rigged':False,'animations':0,
          'original_geometry':True,'original_textures':True,'authoring':'scripts/build-soldier-prototype.py',
          'intended_use':'Development-only static visual study; not a production character replacement.'}
(OUT/'metrics.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps(metadata))
