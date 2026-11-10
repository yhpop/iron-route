"""Bounded, deterministic impact FX refinement for the recovered tank film.

Call ``apply_effects(bpy)`` on the loaded candidate AFTER the other look/geometry
patches. No Blender import at module scope, operators, simulation, new geometry,
new volume objects, assets, rendering, tank animation, or camera changes.

The existing 26 smoke meshes become 14 brief blast puffs, six thinning upper
puffs, and six connected low fire-smoke puffs. Four cheap, edge-faded materials
replace only impact smoke / ground dust materials; distant and muzzle smoke and
all flame/lighting animations retain their original materials and timing.

Run this file with ordinary Python for numeric trajectory / contact self-tests.
Actual Eevee appearance must be reviewed by the calling render workflow.
"""
import json
import math
import random

VERSION = 'v5_effects_20261004_r2'
_PREVIOUS_VERSION = 'v5_effects_20261004_r1'
_TAG = 'bounded_impact_effects_version'
_REPORT = 'bounded_impact_effects_report'
_GROUND_Z = -.012
_FPS = 24.0
# r2 only: renderer QA showed the edge/noise product hid the late aftermath.
# Keep the same hue, boundaries, births, geometry and motion. Lower density is
# exactly 3x r1; upper changes are restrained and still decay toward zero.
_UPPER_DENSITY_KEYS = [(1, 0), (526, 0), (550, .28), (574, .32),
                       (601, .32), (630, .22), (660, .10),
                       (690, .03), (720, .012)]
_LOWER_DENSITY_KEYS = [(1, 0), (538, 0), (557, .81), (584, .93),
                       (620, .75), (660, .57), (695, .42), (720, .33)]


def _clamp(value, lo=0.0, hi=1.0):
    return min(hi, max(lo, value))


def _lerp(a, b, t):
    return tuple(x + (y-x)*t for x, y in zip(a, b))


def _smooth(t):
    t = _clamp(t)
    return t*t*(3.0-2.0*t)


def _rotate(v, r):
    """XYZ Euler rotation, matching an unparented Blender mesh's local axes."""
    x, y, z = v
    sx, cx = math.sin(r[0]), math.cos(r[0])
    sy, cy = math.sin(r[1]), math.cos(r[1])
    sz, cz = math.sin(r[2]), math.cos(r[2])
    y, z = cx*y-sx*z, sx*y+cx*z
    x, z = cy*x+sy*z, -sy*x+cy*z
    return (cz*x-sz*y, sz*x+cz*y, z)


def _support_z(vertices, rotation, ground=_GROUND_Z):
    return ground - min(_rotate(v, rotation)[2] for v in vertices)


def _block_pose(index, frame, base, vertices):
    """Heavy blocks topple around road contact rather than levitating a metre."""
    if frame <= 510:
        return tuple(base), (0.0, 0.0, 0.0)
    t = _clamp((frame-510.0)/(33.0 + index*2.0))
    # Accelerating first half, then a short damped angular settling at contact.
    angle = -math.pi*.5 * (t*t*(2.0-t))
    if t >= 1.0:
        elapsed = frame-(543.0+index*2.0)
        angle += .025*math.exp(-elapsed/3.5)*math.sin(elapsed*.75)
    side = index-1
    r = (angle, side*.045*_smooth(t), side*.065*_smooth(t))
    travel = _smooth(t)
    # Geometric support follows the lowest actual vertex; bevels cut inward.
    z = _support_z(vertices, r)
    return ((base[0] + side*.24*travel,
             base[1] + (1.05 + .12*index)*travel,
             z), r)


def _ballistic_plan(index, base, vertices, bag=False):
    """24fps gravity, exact first contact and a small dissipating ground slide."""
    rng = random.Random(44091 + index + (1000 if bag else 0))
    launch = 510 + index % 3
    if bag:
        velocity = (rng.uniform(-.75, .75), rng.uniform(.9, 1.8),
                    rng.uniform(.8, 1.8))
        angular = (rng.uniform(-1.5, -.5), rng.uniform(-.5, .5),
                   rng.uniform(-.5, .5))
    else:
        velocity = (rng.uniform(-3.3, 3.3), rng.uniform(-1.0, 3.5),
                    rng.uniform(3.4, 7.2))
        angular = (rng.uniform(-5.5, 5.5), rng.uniform(-4, 4),
                   rng.uniform(-3, 3))

    def airborne(t):
        rotation = tuple(w*t for w in angular)
        location = (base[0]+velocity[0]*t, base[1]+velocity[1]*t,
                    base[2]+velocity[2]*t-4.905*t*t)
        return location, rotation

    # Bracket the FIRST road hit despite changing projected fragment height.
    lo = 0.0
    hi = 1.0/240.0
    while hi < 4.0:
        loc, rot = airborne(hi)
        if loc[2] <= _support_z(vertices, rot):
            break
        lo, hi = hi, hi + 1.0/240.0
    for _ in range(32):
        mid = (lo+hi)*.5
        loc, rot = airborne(mid)
        if loc[2] > _support_z(vertices, rot):
            lo = mid
        else:
            hi = mid
    hit_time = (lo+hi)*.5
    hit_loc, hit_rot = airborne(hit_time)
    # Settle onto the nearest face, never unwind several airborne turns.
    face_step = math.pi if bag else math.pi*.5
    final_rot = (round(hit_rot[0]/face_step)*face_step,
                 round(hit_rot[1]/face_step)*face_step,
                 hit_rot[2] + angular[2]*.025)
    settle = .22 if bag else .28

    def pose(frame):
        t = max(0.0, (frame-launch)/_FPS)
        if t < hit_time:
            return airborne(t)
        u = _clamp((t-hit_time)/settle)
        damping = 1.0-(1.0-u)**2
        rotation = _lerp(hit_rot, final_rot, _smooth(u))
        drag = .035 if bag else .075
        return ((hit_loc[0] + velocity[0]*drag*damping,
                 hit_loc[1] + velocity[1]*drag*damping,
                 _support_z(vertices, rotation)), rotation)

    # Include exact collision / settling keys so no overshoot is interpolated.
    frames = sorted(set([1.0, 509.0, float(launch),
                         launch+hit_time*_FPS,
                         launch+(hit_time+settle)*_FPS, 565.0, 720.0]
                        + list(range(launch, 566))))
    return [(f, *pose(f)) for f in frames], launch+hit_time*_FPS


def _fcurves(idblock):
    """Legacy actions and newer layered actions, without depending on version."""
    anim = getattr(idblock, 'animation_data', None)
    action = getattr(anim, 'action', None)
    if action is None:
        return []
    curves = getattr(action, 'fcurves', None)
    if curves is not None:
        return list(curves)
    result = []
    for layer in getattr(action, 'layers', []):
        for strip in getattr(layer, 'strips', []):
            for bag in getattr(strip, 'channelbags', []):
                result.extend(bag.fcurves)
    return result


def _linear(idblock):
    for curve in _fcurves(idblock):
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'


def _poses(ob, keys):
    for frame, location, rotation in keys:
        ob.location = location
        ob.rotation_euler = rotation
        ob.keyframe_insert('location', frame=frame)
        ob.keyframe_insert('rotation_euler', frame=frame)
    _linear(ob)


def _volume_material(bpy, label, color, density_keys, noise_scale):
    """Low-octave noise, soft radial boundary and an explicit density fade."""
    name = 'V5 FX / '+label
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    mat.node_tree.animation_data_clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    vol = nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (*color, 1)
    vol.inputs['Anisotropy'].default_value = .12
    coord = nodes.new('ShaderNodeTexCoord')
    center = nodes.new('ShaderNodeVectorMath')
    center.operation = 'SUBTRACT'
    center.inputs[1].default_value = (.5, .5, .5)
    links.new(coord.outputs['Generated'], center.inputs[0])
    radius = nodes.new('ShaderNodeVectorMath')
    radius.operation = 'LENGTH'
    links.new(center.outputs['Vector'], radius.inputs[0])
    edge = nodes.new('ShaderNodeMapRange')
    edge.clamp = True
    edge.interpolation_type = 'SMOOTHSTEP'
    edge.inputs['From Min'].default_value = .09
    edge.inputs['From Max'].default_value = .50
    edge.inputs['To Min'].default_value = 1.0
    edge.inputs['To Max'].default_value = 0.0
    links.new(radius.outputs['Value'], edge.inputs['Value'])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.noise_dimensions = '3D'
    noise.inputs['Scale'].default_value = noise_scale
    noise.inputs['Detail'].default_value = 1.6
    noise.inputs['Roughness'].default_value = .65
    links.new(coord.outputs['Generated'], noise.inputs['Vector'])
    broken = nodes.new('ShaderNodeValToRGB')
    broken.color_ramp.elements[0].position = .30
    broken.color_ramp.elements[0].color = (0, 0, 0, 1)
    broken.color_ramp.elements[1].position = .72
    broken.color_ramp.elements[1].color = (1, 1, 1, 1)
    links.new(noise.outputs['Fac'], broken.inputs['Fac'])
    texture = nodes.new('ShaderNodeMath')
    texture.operation = 'MULTIPLY'
    links.new(broken.outputs['Color'], texture.inputs[0])
    links.new(edge.outputs['Result'], texture.inputs[1])
    amount = nodes.new('ShaderNodeValue')
    amount.name = 'V5 FX / actual density fade'
    for frame, density in density_keys:
        amount.outputs[0].default_value = density
        amount.outputs[0].keyframe_insert('default_value', frame=frame)
    density = nodes.new('ShaderNodeMath')
    density.operation = 'MULTIPLY'
    links.new(texture.outputs[0], density.inputs[0])
    links.new(amount.outputs[0], density.inputs[1])
    links.new(density.outputs[0], vol.inputs['Density'])
    links.new(vol.outputs['Volume'], out.inputs['Volume'])
    _linear(mat.node_tree)
    mat[_TAG] = VERSION
    return mat


def _assign(ob, material):
    # The source has one independently-created mesh per puff. Copy only if a
    # later candidate intentionally linked a mesh, to avoid shared slot edits.
    if ob.data.users > 1:
        ob.data = ob.data.copy()
    ob.data.materials.clear()
    ob.data.materials.append(material)


def _smoke_animation(ob, start, base, dims, travel, finish, scale_end=1.5):
    ob.animation_data_clear()
    ob.rotation_mode = 'XYZ'
    ob.rotation_euler = (0, 0, 0)
    # Invisible before birth; fade is in shader density, never a shrinking ball.
    for f, scale in [(1, .001), (start, .001), (start+10, .60),
                     (start+27, 1.0), (finish, scale_end), (720, scale_end)]:
        ob.scale = tuple(s*scale for s in dims)
        ob.keyframe_insert('scale', frame=f)
    for frame in sorted(set([1, start, start+27, finish, 720])):
        age = _clamp((frame-start)/max(1.0, finish-start))
        # Rise is quickest early, gradually slowing as hot dust loses buoyancy.
        drift = 1.0-(1.0-age)**1.4
        ob.location = tuple(base[i]+travel[i]*drift for i in range(3))
        ob.rotation_euler.z = .11*age
        ob.keyframe_insert('location', frame=frame)
        ob.keyframe_insert('rotation_euler', frame=frame)
    _linear(ob)
    ob[_TAG] = VERSION


def apply_effects(bpy):
    """Apply once; return a JSON-safe summary. Restore the caller's frame."""
    scene = bpy.context.scene
    if scene.get(_TAG) == VERSION:
        report = json.loads(scene[_REPORT])
        report['already_applied'] = True
        return report
    if scene.get(_TAG) == _PREVIOUS_VERSION:
        # The loaded r1 candidate needs ONLY two density envelopes updated.
        # Do not clear/recreate any object's transforms or animation action.
        updates = []
        for name, keys in [('V5 FX / thinning upper smoke', _UPPER_DENSITY_KEYS),
                           ('V5 FX / connected low fire smoke', _LOWER_DENSITY_KEYS)]:
            mat = bpy.data.materials.get(name)
            amount = (mat.node_tree.nodes.get('V5 FX / actual density fade')
                      if mat is not None and mat.node_tree is not None else None)
            if amount is None:
                raise ValueError('Cannot upgrade r1: expected density node in '+name)
            updates.append((mat, amount, keys))
        report = json.loads(scene[_REPORT])
        frame, subframe = scene.frame_current, scene.frame_subframe
        for mat, amount, keys in updates:
            mat.node_tree.animation_data_clear()
            for f, value in keys:
                amount.outputs[0].default_value = value
                amount.outputs[0].keyframe_insert('default_value', frame=f)
            _linear(mat.node_tree)
            mat[_TAG] = VERSION
        report.update({'version': VERSION, 'already_applied': False,
                       'density_only_upgrade_from': _PREVIOUS_VERSION,
                       'lower_density_multiplier': 3.0,
                       'density_at_frame_660': {'lower': .57, 'upper': .10}})
        scene[_REPORT] = json.dumps(report, sort_keys=True)
        scene[_TAG] = VERSION
        scene.frame_set(frame, subframe=subframe)
        return report
    blocks = [bpy.data.objects.get('Concrete roadblock %02d' % j)
              for j in (3, 4, 5)]
    smoke = sorted((o for o in scene.objects
                    if o.name.startswith('Rolling impact smoke ')),
                   key=lambda o: o.name)
    debris = sorted((o for o in scene.objects
                     if o.name.startswith('Flying concrete debris')),
                    key=lambda o: o.name)
    dust = [o for o in scene.objects if o.name.startswith('Ground shockwave dust')]
    bags = sorted((o for o in scene.objects
                   if o.name.startswith('Sandbag') and o.animation_data
                   and o.animation_data.action), key=lambda o: o.name)
    if not all(blocks) or len(smoke) != 26 or len(debris) != 32:
        raise ValueError('Expected three center roadblocks, 26 impact puffs, '
                         'and 32 debris pieces from the preserved tank source.')
    if any(o.parent for o in blocks+smoke+debris+bags):
        raise ValueError('Impact FX must retain the source unparented coordinates.')

    before_objects = len(scene.objects)
    before_faces = sum(len(o.data.polygons) for o in scene.objects if o.type == 'MESH')
    old_frame, old_subframe = scene.frame_current, scene.frame_subframe
    report = {}
    try:
        scene.frame_set(509)
        block_bases = [tuple(o.location) for o in blocks]
        bag_bases = [tuple(o.location) for o in bags]
        debris_bases = [tuple(o.location) for o in debris]
        # Scale is real on the source bags, but the source debris is hidden by
        # animated scale at 509: its applied mesh dimensions are authoritative.
        bag_vertices = [[tuple(v.co[k]*o.scale[k] for k in range(3))
                         for v in o.data.vertices] for o in bags]
        block_vertices = [[tuple(v.co[k]*o.scale[k] for k in range(3))
                           for v in o.data.vertices] for o in blocks]
        debris_vertices = [[tuple(v.co) for v in o.data.vertices] for o in debris]

        burst = _volume_material(bpy, 'warm gray blast dust', (.39, .35, .29),
                [(1, 0), (512, 0), (524, .48), (549, .55), (575, .30),
                 (601, .105), (623, .028), (648, 0), (720, 0)], 4.4)
        upper = _volume_material(bpy, 'thinning upper smoke', (.31, .30, .27),
                                 _UPPER_DENSITY_KEYS, 3.9)
        lower = _volume_material(bpy, 'connected low fire smoke', (.32, .30, .26),
                                 _LOWER_DENSITY_KEYS, 4.6)
        ground = _volume_material(bpy, 'low concrete dust wash', (.43, .38, .30),
                [(1, 0), (510, 0), (519, .62), (535, .42), (554, .17),
                 (578, 0), (720, 0)], 4.0)

        rng = random.Random(510660)
        for i, ob in enumerate(smoke[:14]):
            _assign(ob, burst)
            base = (rng.uniform(-1.45, 1.45), 26+rng.uniform(-.60, .55),
                    rng.uniform(1.15, 3.15))
            dims = (rng.uniform(.80, 1.12), rng.uniform(.72, 1.02),
                    rng.uniform(.95, 1.40))
            _smoke_animation(ob, 513+i%8, base, dims,
                             (1.25+rng.random()*.7, .60, 2.6+rng.random()),
                             643, 1.60)
            # Retire zero-density blast containers to avoid wasted traversal.
            for frame, hidden in [(1, False), (648, False), (649, True), (720, True)]:
                ob.hide_render = hidden
                ob.keyframe_insert('hide_render', frame=frame)
        for i, ob in enumerate(smoke[14:20]):
            _assign(ob, upper)
            base = (-.55+.24*i, 26.25+.10*(i%3), 1.5+.39*i)
            dims = (.80+.035*i, .72+.04*i, 1.05+.04*i)
            _smoke_animation(ob, 527+i*3, base, dims,
                             (1.05+.11*i, .55, 2.30+.08*i), 690, 1.52)
        # Six reused puffs give the fire a contiguous, asymmetric base at 660.
        lower_plan = [(-.72, .05, .72, .76, .66, .90),
                      (.58, -.10, .88, .80, .65, 1.05),
                      (-.35, .12, 1.72, .90, .75, 1.30),
                      (.46, .30, 2.45, 1.00, .85, 1.40),
                      (.22, .54, 3.24, 1.15, .90, 1.50),
                      (.75, .68, 4.15, 1.30, 1.00, 1.40)]
        for i, (ob, plan) in enumerate(zip(smoke[20:], lower_plan)):
            _assign(ob, lower)
            x, y, z, sx, sy, sz = plan
            _smoke_animation(ob, 538+i*2, (x, 26+y, z), (sx, sy, sz),
                             (.12+.095*i, .09+.055*i, .12+.06*i), 720, 1.10)
        for ob in dust:
            _assign(ob, ground)
            ob[_TAG] = VERSION

        for i, ob in enumerate(blocks):
            ob.animation_data_clear()
            ob.rotation_mode = 'XYZ'
            frames = [1, 509, 510]+list(range(511, 561))+[580, 720]
            _poses(ob, [(f, *_block_pose(i, f, block_bases[i], block_vertices[i]))
                        for f in frames])
            ob[_TAG] = VERSION
        impact_frames = []
        for i, ob in enumerate(debris):
            ob.animation_data_clear()
            ob.rotation_mode = 'XYZ'
            keys, contact = _ballistic_plan(i, debris_bases[i], debris_vertices[i])
            _poses(ob, keys)
            for frame, value in [(1, .001), (510, .001), (513, 1), (720, 1)]:
                ob.scale = (value,)*3
                ob.keyframe_insert('scale', frame=frame)
            _linear(ob)
            ob[_TAG] = VERSION
            impact_frames.append(contact)
        for i, ob in enumerate(bags):
            ob.animation_data_clear()
            ob.rotation_mode = 'XYZ'
            keys, contact = _ballistic_plan(i, bag_bases[i], bag_vertices[i], bag=True)
            _poses(ob, keys)
            ob[_TAG] = VERSION

        after_faces = sum(len(o.data.polygons) for o in scene.objects if o.type == 'MESH')
        assert len(scene.objects) == before_objects and after_faces == before_faces
        report = {'version': VERSION, 'already_applied': False,
                  'impact_smoke_reused': len(smoke), 'burst_puffs': 14,
                  'upper_puffs': 6, 'connected_lower_puffs': 6,
                  'ground_dust_retextured': len(dust), 'materials_added': 4,
                  'center_blocks_grounded': len(blocks),
                  'debris_ballistic': len(debris), 'sandbags_ballistic': len(bags),
                  'debris_first_contact_frames': [round(min(impact_frames), 2),
                                                  round(max(impact_frames), 2)],
                  'objects_added': 0, 'volume_objects_added': 0, 'faces_added': 0,
                  'preserved_events': {'fire': 481, 'impact': 510, 'restart': 601},
                  'tank_camera_fire_lighting_untouched': True,
                  'simulation_or_bake': False, 'render_qa_required': True,
                  'lower_density_multiplier': 3.0,
                  'density_at_frame_660': {'lower': .57, 'upper': .10}}
        scene[_REPORT] = json.dumps(report, sort_keys=True)
        scene[_TAG] = VERSION
    finally:
        scene.frame_set(old_frame, subframe=old_subframe)
    return report


def _self_test():
    block = [(x*.69, y*.45, z*.625)
             for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    tests = 0
    for i in range(3):
        for frame in range(511, 721):
            location, rotation = _block_pose(i, frame, ((i-1)*1.5, 26, .62), block)
            bottom = location[2] + min(_rotate(v, rotation)[2] for v in block)
            assert abs(bottom-_GROUND_Z) < 1e-9
            assert location[2] < .85, (frame, location)
            tests += 1
    for bag in (False, True):
        dimensions = (.41, .31, .17) if bag else (.10, .12, .13)
        vertices = [tuple(v[k]*dimensions[k] for k in range(3))
                    for v in [(x, y, z) for x in (-1, 1)
                              for y in (-1, 1) for z in (-1, 1)]]
        for i in range(32):
            keys, contact = _ballistic_plan(i, (0, 26, 1.36 if bag else 1.1),
                                            vertices, bag)
            assert 510 < contact < 558
            assert keys[-1][0] == 720
            for frame, location, rotation in keys:
                bottom = location[2]+min(_rotate(v, rotation)[2] for v in vertices)
                assert bottom >= _GROUND_Z-1e-8, (i, frame, bottom)
                if frame >= contact:
                    assert abs(bottom-_GROUND_Z) < 1e-8
                tests += 1
            assert keys[-1][1:] == keys[-2][1:]
            # Linear sub-frame interpolation stays within the intentional
            # 13 mm road clearance; this catches angular unwinding at landing.
            for (_, pa, ra), (_, pb, rb) in zip(keys, keys[1:]):
                for u in (.25, .5, .75):
                    p, r = _lerp(pa, pb, u), _lerp(ra, rb, u)
                    bottom = p[2]+min(_rotate(v, r)[2] for v in vertices)
                    assert bottom >= _GROUND_Z-.003, (i, bottom)
                    tests += 1
    return {'numeric_pose_checks': tests, 'blocks_sampled_contact_supported': True,
            'debris_bags_gravity_and_rest_verified': True,
            'blender_or_render_invoked': False}


if __name__ == '__main__':
    print(json.dumps(_self_test(), sort_keys=True))
