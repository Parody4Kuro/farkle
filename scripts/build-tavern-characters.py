"""Reproducible Blender 4.5 + MPFB 2.0.17 character build.

Run with the isolated MPFB profile documented in artifacts/art-source/README.md.
MakeHuman CC0 anatomy/skin/eyes/hair, original costume cuts, accessories and clips.
The .blend sources retain rigs, clips and packed textures. No renderer needs Blender.
"""
import bpy
import bmesh
import importlib
import json
import math
import struct
import os
import hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'artifacts/art-source'
OUTPUT = ROOT / 'public/art/characters'
ASSETS = Path(os.environ.get('TAVERN_MH_ASSETS', '/private/tmp/tavern-art-tools/system-assets'))
MPFB = importlib.import_module('bl_ext.user_default.mpfb')
if not MPFB.MPFB_CONTEXTUAL_INFORMATION:
    MPFB.register()
Human = importlib.import_module(MPFB.__name__ + '.services.humanservice').HumanService
Target = importlib.import_module(MPFB.__name__ + '.services.targetservice').TargetService

CHARACTERS = {
    'mara': dict(gender=0.0, age=0.58, weight=0.48, muscle=0.38, height=0.47, skin='middleage_caucasian_female', hair='braid01', color=(0.095, 0.16, 0.115, 1)),
    'osric': dict(gender=1.0, age=0.68, weight=0.53, muscle=0.72, height=0.62, skin='middleage_caucasian_male', hair='short03', color=(0.16, 0.19, 0.21, 1)),
    'rue': dict(gender=0.0, age=0.50, weight=0.37, muscle=0.42, height=0.48, skin='young_asian_female', hair='bob02', color=(0.20, 0.075, 0.095, 1)),
    'keeper': dict(gender=1.0, age=0.76, weight=0.72, muscle=0.55, height=0.60, skin='old_caucasian_male', hair='short02', color=(0.17, 0.11, 0.065, 1)),
}

def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True); bpy.context.view_layer.objects.active = obj

def material(name, color, rough=0.75, metal=0, texture=None):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    bs = mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = color
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    if texture and texture.exists():
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(str(texture), check_existing=True)
        tex.image.colorspace_settings.name = 'Non-Color'
        normal = mat.node_tree.nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value = 0.24
        mat.node_tree.links.new(tex.outputs['Color'], normal.inputs['Color'])
        mat.node_tree.links.new(normal.outputs['Normal'], bs.inputs['Normal'])
    return mat

def freeze_shape(obj):
    activate(obj)
    if obj.data.shape_keys:
        mix = obj.shape_key_add(name='FinalAnatomy', from_mix=True)
        coords = [v.co.copy() for v in mix.data]
        obj.shape_key_clear()
        for v, co in zip(obj.data.vertices, coords): v.co = co
    for modifier in list(obj.modifiers):
        if modifier.type == 'MASK': bpy.ops.object.modifier_apply(modifier=modifier.name)
    for face in obj.data.polygons: face.use_smooth = True

def remove_vertices(obj, predicate):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if predicate(v.co)], context='VERTS')
    bm.to_mesh(obj.data); bm.free(); obj.data.update()

def parent_bone(obj, rig, bone):
    # Preserve bind-space location when attaching an original accessory.
    obj.parent = rig
    group = obj.vertex_groups.new(name=bone); group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    modifier = obj.modifiers.new('Armature', 'ARMATURE'); modifier.object = rig

def sphere(name, center, scale, mat, rig=None, bone='head'):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=center)
    obj = bpy.context.object; obj.name = name; obj.scale = scale
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.materials.append(mat)
    for p in obj.data.polygons: p.use_smooth = True
    if rig: parent_bone(obj, rig, bone)
    return obj

def strip(name, points, width, mat, rig, bone):
    curve = bpy.data.curves.new(name, 'CURVE'); curve.dimensions = '3D'; curve.bevel_depth = width; curve.bevel_resolution = 2
    spline = curve.splines.new('BEZIER'); spline.bezier_points.add(len(points) - 1)
    for p, pos in zip(spline.bezier_points, points): p.co = pos; p.handle_left_type = 'AUTO'; p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve); bpy.context.collection.objects.link(obj); activate(obj)
    bpy.ops.object.convert(target='MESH'); obj = bpy.context.object
    obj.data.materials.append(mat); parent_bone(obj, rig, bone)
    return obj

def costume(body, rig, ident, config):
    neck = rig.data.bones['neck_01'].head_local.z
    hip = rig.data.bones['pelvis'].head_local.z
    jacket = body.copy(); jacket.data = body.data.copy(); bpy.context.collection.objects.link(jacket); jacket.name = ident + '_tailored_coat'
    hand_group_ids = {g.index for g in body.vertex_groups if any(k in g.name for k in ['hand_', 'index_', 'middle_', 'ring_', 'pinky_', 'thumb_'])}
    hand_vertices = {v.index for v in body.data.vertices if any(g.group in hand_group_ids and g.weight > 0.2 for g in v.groups)}
    bm = bmesh.new(); bm.from_mesh(jacket.data); bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > neck - 0.025 or v.co.z < hip - 0.11 or v.index in hand_vertices], context='VERTS')
    for v in bm.verts:
        v.co += v.normal * (0.018 if abs(v.co.x) < 0.2 else 0.009)
    bm.normal_update()
    boundary=[v for v in bm.verts if v.is_boundary]
    for _ in range(5):
        smoothed={v:sum((e.other_vert(v).co for e in v.link_edges if e.is_boundary),Vector())/max(1,sum(1 for e in v.link_edges if e.is_boundary)) for v in boundary}
        for v,co in smoothed.items():v.co=v.co.lerp(co,0.42)
    bm.to_mesh(jacket.data); bm.free()
    jacket.data.materials.clear()
    cloth = material(ident + '_woven_wool', config['color'], texture=ROOT / 'public/art/materials/fabric-normal.jpg')
    jacket.data.materials.append(cloth)
    solid = jacket.modifiers.new('Sewn edges', 'SOLIDIFY'); solid.thickness = 0.003
    # Original sleeveless over-garment: a merchant's waistcoat / guard's jerkin / keeper's apron.
    leather = material(ident + '_leather_trim', (0.115, 0.062, 0.028, 1), 0.61, texture=ROOT / 'public/art/materials/leather-normal.jpg')
    brass = material('Aged brass', (0.40, 0.24, 0.08, 1), 0.42, 0.78)
    front = min(v.co.y for v in jacket.data.vertices if abs(v.co.x) < 0.08 and hip + 0.12 < v.co.z < neck - 0.08) - 0.005
    for i in range(5):
        z = hip + 0.08 + i * (neck - hip - 0.18) / 5
        sphere('Cast brass button', (0, front, z), (0.007, 0.003, 0.007), brass, rig, 'spine_03' if z > hip + 0.23 else 'spine_02')
    for s in [-1, 1]:
        strip('Stitched lapel', [(s * 0.10, front + 0.015, neck - 0.035), (s * 0.07, front - 0.002, neck - 0.15), (s * 0.016, front - 0.008, hip + 0.22)], 0.008, leather, rig, 'spine_03')
    if ident in ['mara', 'keeper']:
        # A draped apron panel, with modeled folds, follows the torso rig.
        verts=[]; faces=[]
        for row in range(13):
            z = hip - 0.15 + row * (neck - hip - 0.08) / 12
            width = 0.145 if row < 7 else 0.11
            for col in range(13):
                x = (col / 12 * 2 - 1) * width
                verts.append((x, front - 0.018 - math.sin(col * 1.5) * 0.003 - (1-row/12)*0.008, z))
        for row in range(12):
            for col in range(12):
                a=row*13+col; faces.append((a,a+1,a+14,a+13))
        mesh=bpy.data.meshes.new('Apron cloth');mesh.from_pydata(verts,[],faces);mesh.update()
        obj=bpy.data.objects.new('Worn linen apron',mesh);bpy.context.collection.objects.link(obj)
        obj.data.materials.append(material('Apron linen',(0.32,0.25,0.16,1),0.95,texture=ROOT/'public/art/materials/fabric-normal.jpg'))
        parent_bone(obj,rig,'spine_02')
        for p in mesh.polygons:p.use_smooth=True
    if ident == 'osric':
        sphere('Guard insignia', (0.105, front - 0.018, neck - 0.13), (0.022,0.004,0.026), brass, rig, 'spine_03')
    # Bound cuffs and a stitched collar cover the cut edges of the tailored mesh.
    for side in ['l','r']:
        forearm=rig.data.bones['lowerarm_'+side];hand=rig.data.bones['hand_'+side]
        direction=(hand.head_local-forearm.head_local).normalized()
        center=hand.head_local-direction*0.012
        bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=0.038,radius2=0.030,depth=0.045,location=center)
        cuff=bpy.context.object;cuff.name='Bound leather cuff'
        cuff.rotation_quaternion=Vector((0,0,1)).rotation_difference(direction);cuff.rotation_mode='QUATERNION'
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        cuff.data.materials.append(leather);parent_bone(cuff,rig,'lowerarm_'+side)
        for p in cuff.data.polygons:p.use_smooth=True
    # A continuous standing collar overlaps both the neck and shoulder cut.
    collar_center=rig.data.bones['neck_01'].head_local.copy();collar_center.z-=0.016
    bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=0.112,radius2=0.063,depth=0.075,end_fill_type='NOTHING',location=collar_center)
    collar=bpy.context.object;collar.name='Standing wool collar';collar.scale.y=0.78
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    collar.data.materials.append(cloth);parent_bone(collar,rig,'spine_03')
    for p in collar.data.polygons:p.use_smooth=True
    solid=collar.modifiers.new('Collar hem','SOLIDIFY');solid.thickness=0.003
    collar_points=[(0.063*math.cos(i*math.tau/32),collar_center.y+0.049*math.sin(i*math.tau/32),neck+0.0215) for i in range(33)]
    strip('Soft stitched collar',collar_points,0.003,leather,rig,'spine_03')
    # Hide the covered body, retaining neck, face and anatomically correct hands.
    bm=bmesh.new();bm.from_mesh(body.data);bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z < neck - 0.04 and v.index not in hand_vertices],context='VERTS')
    bm.to_mesh(body.data);bm.free();body.data.update()

def facial_shapes(body, rig):
    body.shape_key_add(name='Basis')
    head = rig.data.bones['head'].head_local
    # Small original expression targets. The skull/skin remains the MakeHuman anatomy.
    for name in ['thoughtful','pleased','disappointed']:
        key=body.shape_key_add(name=name)
        for v in key.data:
            x,y,z=v.co
            if y < head.y - 0.045 and head.z - 0.055 < z < head.z + 0.04 and abs(x)<0.08:
                weight=max(0,1-abs(z-(head.z-0.022))/0.06)*min(1,abs(x)/0.04)
                v.co.z += weight * (0.0035 if name=='pleased' else -0.0025 if name=='disappointed' else 0.0007)

def make_clips(rig, ident):
    rig.animation_data_create()
    # Baked local skeletal motion: the renderer layers contact IK over these curves.
    settings={'idle':(120,0.015,0),'inspect':(70,0.06,0.07),'shake':(50,0.03,0.11),'pour':(32,0.035,0.08),'collect':(45,0.075,0.02),'bank':(58,0.05,-0.035),'bust':(62,-0.08,-0.09),'victory':(85,-0.04,0.1),'defeat':(85,0.10,-0.06)}
    personality={'mara':(0.8,0.8),'osric':(0.65,-0.65),'rue':(1.2,1.35),'keeper':(0.9,-0.8)}[ident]
    for name,(length,lean,tilt) in settings.items():
        lean*=personality[0];tilt*=personality[1]
        action=bpy.data.actions.new(name);rig.animation_data.action=action
        for frame,blend in [(1,0),(int(length*.45),1),(length,0)]:
            for bone in rig.pose.bones:bone.rotation_mode='XYZ';bone.rotation_euler=(0,0,0)
            rig.pose.bones['spine_03'].rotation_euler.x=lean*blend
            rig.pose.bones['head'].rotation_euler.z=tilt*blend
            for side in ['l','r']:
                for finger in ['index','middle','ring','pinky']:
                    for n in ['01','02','03']:
                        bone=rig.pose.bones.get(f'{finger}_{n}_{side}')
                        if bone:bone.rotation_euler.x=(0.6 if name in ['shake','pour'] else 0.08)*blend
            for bone in rig.pose.bones:bone.keyframe_insert(data_path='rotation_euler',frame=frame,group=bone.name)
        track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,action);strip.action_frame_end=length
        track.mute=True
    rig.animation_data.action=None
    for bone in rig.pose.bones:bone.rotation_euler=(0,0,0)

def normalize_gltf(path):
    # MPFB game-engine shaders wire image alpha even for opaque skin. Explicit
    # material modes prevent mouth/eye interior surfaces sorting over the face.
    data=path.read_bytes(); length=struct.unpack_from('<I',data,12)[0]
    model=json.loads(data[20:20+length])
    for mat in model.get('materials',[]):
        name=mat.get('name','')
        if '.body' in name:
            mat['alphaMode']='OPAQUE';mat['doubleSided']=False
        elif any(tag in name for tag in ['braid','short','bob','eyebrow']):
            mat['alphaMode']='MASK';mat['alphaCutoff']=0.45;mat['doubleSided']=True
    raw=json.dumps(model,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4)
    tail=data[20+length:]
    path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(raw)+len(tail))+struct.pack('<II',len(raw),0x4e4f534a)+raw+tail)

def build(ident, config):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    # Remove unused data between characters; source .blend files stay self-contained.
    for _ in range(2):bpy.ops.outliner.orphans_purge(do_recursive=True)
    macro=Target.get_default_macro_info_dict()
    macro.update({k:config[k] for k in ['gender','age','weight','muscle','height']})
    macro['race']={'caucasian':0.70,'asian':0.20,'african':0.10} if ident!='rue' else {'caucasian':0.15,'asian':0.70,'african':0.15}
    body=Human.create_human(scale=0.1,macro_detail_dict=macro);body.name=ident+'_skin'
    rig=Human.add_builtin_rig(body,'game_engine');rig.name='TavernRig'
    Human.set_character_skin(str(ASSETS/'skins'/config['skin']/(config['skin']+'.mhmat')),body,skin_type='GAMEENGINE',material_instances=False)
    for category,asset in [('eyes','high-poly'),('eyebrows','eyebrow005'),('hair',config['hair'])]:
        mesh=Human.add_mhclo_asset(str(ASSETS/category/asset/(asset+'.mhclo')),body,asset_type={'eyes':'Eyes','eyebrows':'Eyebrows','hair':'Hair'}[category],subdiv_levels=0,material_type='GAMEENGINE')
        mesh.name=ident+'_'+category
        for face in mesh.data.polygons:face.use_smooth=True
    freeze_shape(body)
    costume(body,rig,ident,config)
    facial_shapes(body,rig)
    # A cloth cap and swept hair silhouette distinguish the merchant and gambler.
    h=rig.data.bones['head'].tail_local
    if ident=='mara':
        cap=sphere('Linen merchant coif',(0,h.y+0.017,h.z-0.042),(0.092,0.087,0.070),material('Coif linen',(0.30,0.28,0.20,1),0.98),rig)
        remove_vertices(cap,lambda co: co.z<h.z-0.055 and co.y<h.y)
    if ident=='rue':
        cap=sphere('Burgundy felt cap',(0.015,h.y,h.z-0.022),(0.13,0.105,0.075),material('Felt',(0.115,0.027,0.045,1),0.98),rig)
        remove_vertices(cap,lambda co:co.z<h.z-0.048)
    make_clips(rig,ident)
    bpy.context.scene.render.fps=30
    bpy.context.scene.frame_set(1)
    for image in bpy.data.images:
        if image.source=='FILE' and image.has_data:
            if max(image.size)>2048:
                ratio=2048/max(image.size);image.scale(int(image.size[0]*ratio),int(image.size[1]*ratio))
            image.pack()
    # Explicit material roughness prevents waxy/plastic skin under the tavern lights.
    for mat in bpy.data.materials:
        if mat.use_nodes:
            bs=mat.node_tree.nodes.get('Principled BSDF')
            if bs and ('skin' in mat.name.lower() or 'caucasian' in mat.name.lower() or 'asian' in mat.name.lower()):bs.inputs['Roughness'].default_value=0.62
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(ident+'.blend')))
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT/(ident+'.glb')),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_morph=True,export_yup=True,export_apply=False,export_extras=True)
    normalize_gltf(OUTPUT/(ident+'.glb'))
    manifest={'id':ident,'source':'MakeHuman official CC0 base mesh and system assets via MPFB 2.0.17','blender':bpy.app.version_string,'macro':macro,'assets':{k:config[k] for k in ['skin','hair']},'bones':[b.name for b in rig.data.bones],'clips':list(['idle','inspect','shake','pour','collect','bank','bust','victory','defeat']),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')}
    (SOURCE/(ident+'.json')).write_text(json.dumps(manifest,indent=2)+'\n')
    if ident=='mara':
        # First-person model uses the exact same skinned anatomy and finger rig.
        for obj in list(bpy.context.scene.objects):
            if obj.type=='MESH' and obj!=body and obj.name != ident+'_tailored_coat' and not obj.name.startswith('Bound leather cuff'):bpy.data.objects.remove(obj,do_unlink=True)
        remove_vertices(body,lambda co:abs(co.x)<0.26)
        # Only sleeves belong in the first-person asset: a complete torso would
        # cross the close-up camera when it turns toward the opponent.
        for obj in bpy.context.scene.objects:
            if obj.type=='MESH' and obj.name==ident+'_tailored_coat':
                remove_vertices(obj,lambda co:abs(co.x)<0.24)
        body.name='PlayerHands'
        body.shape_key_clear()
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'player-hands.blend'))
        bpy.ops.export_scene.gltf(filepath=str(OUTPUT/'player-hands.glb'),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_morph=False,export_yup=True)
        normalize_gltf(OUTPUT/'player-hands.glb')
    print('TAVERN_CHARACTER',ident,manifest['triangles'],flush=True)

SOURCE.mkdir(parents=True,exist_ok=True);OUTPUT.mkdir(parents=True,exist_ok=True)
for ident,config in CHARACTERS.items():
    if not os.environ.get('TAVERN_CHARACTER') or os.environ['TAVERN_CHARACTER']==ident:build(ident,config)
manifest_path=SOURCE/'manifest.json'
manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
manifest['files']=[{'file':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(OUTPUT.glob('*.glb'))+sorted(SOURCE.glob('*.blend'))]
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
