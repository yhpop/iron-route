"""Bounded, data-only running-gear correction for the recovered tank.

Call apply_running_gear(bpy) AFTER apply_hardware and BEFORE scanned surfaces.
Only existing running-gear objects are edited. No operators, simulation, driver
namespace callbacks, body animation, camera changes, or extra objects are used.
Run this file with ordinary Python to check the geometry and driver expressions.
"""
import json
import math

ROAD_RADIUS = 0.37
ROAD_Y = 1.90
ROAD_Z = 0.60
ROAD_SPACING = 0.76
GUIDE_RADIUS = 0.34
GUIDE_Y = 2.60
GUIDE_Z = 0.98
ROAD_PATH_RADIUS = 0.43
GUIDE_PATH_RADIUS = 0.40
BOTTOM_Z = ROAD_Z - ROAD_PATH_RADIUS
TOP_Z = GUIDE_Z + GUIDE_PATH_RADIUS
LINKS_PER_SIDE = 56
PLATE_THICKNESS = 0.12
OLD_LENGTH = 8.8 + math.tau * 0.64
OLD_PITCH = OLD_LENGTH / LINKS_PER_SIDE

# Lower external tangent. Its outward normal is (sin(alpha), -cos(alpha)).
# Dot(normal, guide_center-road_center) = road_path_radius-guide_path_radius.
DY, DZ = GUIDE_Y - ROAD_Y, GUIDE_Z - ROAD_Z
CENTER_DISTANCE = math.hypot(DY, DZ)
ALPHA = math.atan2(DZ, DY) + math.asin(
    (ROAD_PATH_RADIUS - GUIDE_PATH_RADIUS) / CENTER_DISTANCE)
TANGENT_LENGTH = math.sqrt(
    CENTER_DISTANCE ** 2 - (ROAD_PATH_RADIUS - GUIDE_PATH_RADIUS) ** 2)
S1 = ROAD_Y + ROAD_PATH_RADIUS * ALPHA
S2 = S1 + TANGENT_LENGTH
S3 = S2 + GUIDE_PATH_RADIUS * (math.pi - ALPHA)
HALF_LENGTH = S3 + GUIDE_Y
LENGTH = 2 * HALF_LENGTH
PITCH = LENGTH / LINKS_PER_SIDE
TANGENT_Y = ROAD_Y + ROAD_PATH_RADIUS * math.sin(ALPHA)
TANGENT_Z = ROAD_Z - ROAD_PATH_RADIUS * math.cos(ALPHA)
# Thick rectangular shoes need a small inner-edge gap on the 0.40 m guides.
# 90% pitch would intersect at their inner corners; 87% is safely separated.
PLATE_LENGTH = 0.87 * PITCH
PAD_LENGTH = 0.17 * PITCH / OLD_PITCH


def _number(value):
    """Precision well beyond scene needs while keeping drivers below 255 chars."""
    return format(value, '.12g')


def driver_expressions():
    """Only Blender simple-expression arithmetic, sin/cos, fabs/fmod and conditionals."""
    n = _number
    # Fold a closed loop into a half-path from bottom midpoint to top midpoint.
    # The phase still begins at the left end of the grounded flat, y=-1.90.
    shifted = f'fmod(t+{n(LENGTH - ROAD_Y)},{n(LENGTH)})'
    angle = (
        f'0 if q<{n(ROAD_Y)} else (q-{n(ROAD_Y)})/{n(ROAD_PATH_RADIUS)} '
        f'if q<{n(S1)} else {n(ALPHA)} if q<{n(S2)} else '
        f'{n(ALPHA)}+(q-{n(S2)})/{n(GUIDE_PATH_RADIUS)} '
        f'if q<{n(S3)} else pi')
    y = (
        f'g*(q if q<{n(ROAD_Y)} else {n(ROAD_Y)}+{n(ROAD_PATH_RADIUS)}*sin(a) '
        f'if q<{n(S1)} else {n(TANGENT_Y)}+(q-{n(S1)})*{n(math.cos(ALPHA))} '
        f'if q<{n(S2)} else {n(GUIDE_Y)}+{n(GUIDE_PATH_RADIUS)}*sin(a) '
        f'if q<{n(S3)} else {n(HALF_LENGTH)}-q)')
    z = (
        f'{n(BOTTOM_Z)} if q<{n(ROAD_Y)} else {n(ROAD_Z)}-{n(ROAD_PATH_RADIUS)}*cos(a) '
        f'if q<{n(S1)} else {n(TANGENT_Z)}+(q-{n(S1)})*{n(math.sin(ALPHA))} '
        f'if q<{n(S2)} else {n(GUIDE_Z)}-{n(GUIDE_PATH_RADIUS)}*cos(a) '
        f'if q<{n(S3)} else {n(TOP_Z)}')
    result = {
        'fold': f'{n(HALF_LENGTH)}-fabs({shifted}-{n(HALF_LENGTH)})',
        'side': f'1 if {shifted}<{n(HALF_LENGTH)} else -1',
        'angle': angle,
        'y': y,
        'z': z,
        'rotation': f'0 if t<{n(2 * ROAD_Y)} else a if g>0 else 2*pi-a',
    }
    if max(map(len, result.values())) > 255:
        raise AssertionError('Running-gear expression exceeds legacy driver limit')
    return result


def phase_expression(index):
    # Percent modulo forces Blender 4.3 into restricted Python execution.
    # x-floor(x/L)*L is the same positive wrap and stays a simple expression.
    length = _number(LENGTH)
    raw = f'({index}*{length}/56-(travel+20))'
    return f'{raw}-floor({raw}/{length})*{length}'


def half_path(q):
    """Return y,z and tangent angle for arc length q along the positive half."""
    if q < ROAD_Y:
        return q, BOTTOM_Z, 0.0
    if q < S1:
        a = (q - ROAD_Y) / ROAD_PATH_RADIUS
        return (ROAD_Y + ROAD_PATH_RADIUS * math.sin(a),
                ROAD_Z - ROAD_PATH_RADIUS * math.cos(a), a)
    if q < S2:
        d = q - S1
        return (TANGENT_Y + d * math.cos(ALPHA),
                TANGENT_Z + d * math.sin(ALPHA), ALPHA)
    if q < S3:
        a = ALPHA + (q - S2) / GUIDE_PATH_RADIUS
        return (GUIDE_Y + GUIDE_PATH_RADIUS * math.sin(a),
                GUIDE_Z - GUIDE_PATH_RADIUS * math.cos(a), a)
    return HALF_LENGTH - q, TOP_Z, math.pi


def belt_path(t):
    """Exact closed, unit-speed reference path, starting at (-1.90, 0.17)."""
    t = t % LENGTH
    u = (t - ROAD_Y) % LENGTH
    g = 1 if u < HALF_LENGTH else -1
    q = HALF_LENGTH - abs(u - HALF_LENGTH)
    y, z, angle = half_path(q)
    rotation = 0.0 if t < 2 * ROAD_Y else angle if g > 0 else math.tau - angle
    return g * y, z, rotation


def _round_mesh_data(radius, depth, segments=48):
    """Bevelled cylinder along local X; outward winding including flat caps."""
    bevel = min(0.014, depth * 0.15)
    profile = [(radius - bevel, -depth / 2),
               (radius, -depth / 2 + bevel),
               (radius, depth / 2 - bevel),
               (radius - bevel, depth / 2)]
    vertices = []
    for r, x in profile:
        for k in range(segments):
            a = k * math.tau / segments
            vertices.append((x, r * math.cos(a), r * math.sin(a)))
    faces = []
    for j in range(len(profile) - 1):
        for k in range(segments):
            a = j * segments + k
            b = j * segments + (k + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces.extend([tuple(reversed(range(segments))),
                  tuple((len(profile) - 1) * segments + k for k in range(segments))])
    return vertices, faces


def _replace_round_mesh(bpy, ob, radius, depth):
    vertices, faces = _round_mesh_data(radius, depth)
    mesh = bpy.data.meshes.new(ob.name + ' / V5 coherent running gear')
    mesh.from_pydata(vertices, [], faces)
    for material in ob.data.materials:
        mesh.materials.append(material)
    for face in mesh.polygons:
        face.use_smooth = len(face.vertices) == 4
    mesh.update()
    ob.data = mesh
    ob.rotation_mode = 'XYZ'
    ob.rotation_euler = (0, 0, 0)
    ob.scale = (1, 1, 1)


def _set_driver(ob, data_path, expression, variables, index=None):
    if index is None:
        ob.driver_remove(data_path)
        driver = ob.driver_add(data_path).driver
    else:
        ob.driver_remove(data_path, index)
        driver = ob.driver_add(data_path, index).driver
    driver.type = 'SCRIPTED'
    for variable in list(driver.variables):
        driver.variables.remove(variable)
    for name, target, target_path in variables:
        variable = driver.variables.new()
        variable.name = name
        if target_path == 'LOCAL_TRAVEL_Y':
            variable.type = 'TRANSFORMS'
            variable.targets[0].id = target
            variable.targets[0].transform_type = 'LOC_Y'
            variable.targets[0].transform_space = 'LOCAL_SPACE'
        else:
            variable.type = 'SINGLE_PROP'
            variable.targets[0].id = target
            variable.targets[0].data_path = target_path
    driver.expression = expression


def _set_mesh_y_span(ob, span):
    # Edit local Y only; plate/pad width, thickness, parentage and materials stay.
    mesh = ob.data
    if mesh.users > 1:
        mesh = mesh.copy()
        ob.data = mesh
    ys = [v.co.y for v in mesh.vertices]
    old_span = max(ys) - min(ys)
    if old_span <= 0:
        raise ValueError('Degenerate running-gear mesh: ' + ob.name)
    center = (max(ys) + min(ys)) / 2
    for vertex in mesh.vertices:
        vertex.co.y = center + (vertex.co.y - center) * span / old_span
    mesh.update()


def apply_running_gear(bpy):
    """Patch the known tank after hardware refinement; return a QA summary."""
    numeric = validate_math()
    root = bpy.data.objects['TANK / animated motion controller']
    collection = bpy.data.collections['01_TANK_EDITABLE']
    objects = list(collection.objects)
    prefixes = {
        'wheels': 'Road wheel ', 'hubs': 'Steel road wheel hub',
        'caps': 'Wheel axle cap', 'idlers': 'End idler sprocket',
        'links': 'Tread link ',
    }
    groups = {key: [ob for ob in objects if ob.type == 'MESH' and ob.name.startswith(prefix)]
              for key, prefix in prefixes.items()}
    for key, count in [('wheels', 12), ('hubs', 12), ('caps', 12), ('idlers', 4), ('links', 112)]:
        if len(groups[key]) != count:
            raise ValueError(f'Expected {count} {key}; found {len(groups[key])}')
    for group in groups.values():
        if any(ob.parent != root for ob in group):
            raise ValueError('Running gear must remain parented to original TANK root')
    for link in groups['links']:
        if sum(ob.name.startswith('Track / traction rubber pad') for ob in link.children) != 1:
            raise ValueError('Expected one traction pad on ' + link.name)
        if sum(ob.name.startswith('Track / hinge pin') for ob in link.children) != 1:
            raise ValueError('Expected one hinge pin on ' + link.name)
    original_object_count = len(bpy.data.objects)
    original_link_ids = {ob.as_pointer() for ob in groups['links']}
    travel = [('travel', root, 'LOCAL_TRAVEL_Y')]
    for side in [-1, 1]:
        for kind, radius, depth in [('wheels', ROAD_RADIUS, 0.40),
                                    ('hubs', 0.27, 0.08), ('caps', 0.10, 0.10)]:
            group = sorted((ob for ob in groups[kind] if ob.location.x * side > 0),
                           key=lambda ob: ob.location.y)
            if len(group) != 6:
                raise ValueError('Expected six ' + kind + ' on each tank side')
            for j, ob in enumerate(group):
                ob.location.y = -ROAD_Y + j * ROAD_SPACING
                ob.location.z = ROAD_Z
                _replace_round_mesh(bpy, ob, radius, depth)
                _set_driver(ob, 'rotation_euler',
                            f'-(travel+20)/{_number(ROAD_RADIUS)}', travel, 0)
        for ob in groups['idlers']:
            if ob.location.x * side <= 0:
                continue
            ob.location.y = math.copysign(GUIDE_Y, ob.location.y)
            ob.location.z = GUIDE_Z
            _replace_round_mesh(bpy, ob, GUIDE_RADIUS, 0.395)
            _set_driver(ob, 'rotation_euler',
                        f'-(travel+20)/{_number(GUIDE_RADIUS)}', travel, 0)
    # Existing fasteners inherit their hub's new location and X rotation. Their
    # existing axial cylinder orientation stays correct; no separate spin needed.
    for hub in groups['hubs']:
        for bolt in hub.children:
            if bolt.name.startswith('Wheel hub fastener'):
                angle = math.atan2(bolt.location.z, bolt.location.y)
                bolt.location.y = 0.175 * math.cos(angle)
                bolt.location.z = 0.175 * math.sin(angle)

    expressions = driver_expressions()
    for link in groups['links']:
        index = int(link.name.rsplit(' ', 1)[1])
        if not 0 <= index < LINKS_PER_SIDE:
            raise ValueError('Unexpected tread link index: ' + link.name)
        link['belt_position'] = index * LENGTH / LINKS_PER_SIDE
        _set_driver(link, '["belt_position"]',
                    phase_expression(index), travel)
        link['rg_fold'] = 0.0
        link['rg_side'] = 1.0
        link['rg_angle'] = 0.0
        t = [('t', link, '["belt_position"]')]
        _set_driver(link, '["rg_fold"]', expressions['fold'], t)
        _set_driver(link, '["rg_side"]', expressions['side'], t)
        q = [('q', link, '["rg_fold"]')]
        _set_driver(link, '["rg_angle"]', expressions['angle'], q)
        variables = t + q + [('g', link, '["rg_side"]'), ('a', link, '["rg_angle"]')]
        _set_driver(link, 'location', expressions['y'], variables, 1)
        _set_driver(link, 'location', expressions['z'], variables, 2)
        _set_driver(link, 'rotation_euler', expressions['rotation'], variables, 0)
        link.rotation_euler.y = 0
        link.rotation_euler.z = 0
        _set_mesh_y_span(link, PLATE_LENGTH)
        for child in link.children:
            if child.name.startswith('Track / traction rubber pad'):
                _set_mesh_y_span(child, PAD_LENGTH)
            elif child.name.startswith('Track / hinge pin'):
                child.location.y = PITCH / 2
    assert len(bpy.data.objects) == original_object_count
    assert {ob.as_pointer() for ob in groups['links']} == original_link_ids
    assert all(ob.parent == root for group in groups.values() for ob in group)
    bpy.context.view_layer.update()
    return {
        'existing_objects_only': True, 'tread_links_preserved': len(groups['links']),
        'road_wheels': 12, 'hubs': 12, 'caps': 12, 'end_guides': 4,
        'local_spin_axis': 'X', 'wheel_mesh_radial_segments': 48,
        'flat_endcaps_outward_normals': True,
        'pure_expression_drivers': True, 'path_length_m': LENGTH,
        'link_pitch_m': PITCH, 'plate_length_m': PLATE_LENGTH,
        'tangent_angle_radians': ALPHA, 'numeric_qa': numeric,
    }


def validate_math():
    """Plain-Python QA of exact geometry and the actual serialized expressions."""
    expressions = driver_expressions()
    scope = {'sin': math.sin, 'cos': math.cos, 'pi': math.pi, 'fabs': math.fabs,
             'fmod': math.fmod, 'floor': math.floor}
    worst_error = 0.0
    for i in range(20001):
        t = LENGTH * i / 20000
        local = dict(scope, t=t)
        local['q'] = eval(expressions['fold'], {'__builtins__': {}}, local)
        local['g'] = eval(expressions['side'], {'__builtins__': {}}, local)
        local['a'] = eval(expressions['angle'], {'__builtins__': {}}, local)
        actual = [eval(expressions[key], {'__builtins__': {}}, local)
                  for key in ('y', 'z', 'rotation')]
        expected = belt_path(t)
        error = max(abs(actual[0] - expected[0]), abs(actual[1] - expected[1]),
                    abs(math.sin(actual[2]) - math.sin(expected[2])),
                    abs(math.cos(actual[2]) - math.cos(expected[2])))
        worst_error = max(worst_error, error)
    assert worst_error < 1e-8, worst_error
    first, last = belt_path(0), belt_path(LENGTH)
    assert max(abs(first[i] - last[i]) for i in range(3)) < 1e-12
    assert abs(first[0] + ROAD_Y) < 1e-12 and abs(first[1] - 0.17) < 1e-12
    worst_join_error = 0.0
    for q in [0, ROAD_Y, S1, S2, S3, HALF_LENGTH]:
        for t in [(q + ROAD_Y) % LENGTH, (-q + ROAD_Y) % LENGTH]:
            before = belt_path(t - 1e-7)
            after = belt_path(t + 1e-7)
            worst_join_error = max(worst_join_error,
                math.hypot(after[0] - before[0], after[1] - before[1]))
            assert math.hypot(math.cos(after[2]) - math.cos(before[2]),
                              math.sin(after[2]) - math.sin(before[2])) < 6e-7
            assert abs(math.hypot(after[0] - before[0], after[1] - before[1]) / 2e-7 - 1) < 2e-7
    assert worst_join_error < 2.000001e-7
    radial_normal = (math.sin(ALPHA), -math.cos(ALPHA))
    assert abs(radial_normal[0] * DY + radial_normal[1] * DZ -
               (ROAD_PATH_RADIUS - GUIDE_PATH_RADIUS)) < 1e-12
    wheels = [(-ROAD_Y + j * ROAD_SPACING, ROAD_Z, ROAD_RADIUS) for j in range(6)]
    wheels += [(-GUIDE_Y, GUIDE_Z, GUIDE_RADIUS), (GUIDE_Y, GUIDE_Z, GUIDE_RADIUS)]
    gaps = [math.hypot(y - yy, z - zz) - r - rr
            for i, (y, z, r) in enumerate(wheels)
            for yy, zz, rr in wheels[i + 1:]]
    assert min(gaps) >= 0.019999999
    wheel_clearance = min(gaps)
    guide_clearance = CENTER_DISTANCE - ROAD_RADIUS - GUIDE_RADIUS
    # Inner face of the shoe is exactly tangent to each contact circle.
    assert abs(ROAD_PATH_RADIUS - PLATE_THICKNESS / 2 - ROAD_RADIUS) < 1e-12
    assert abs(GUIDE_PATH_RADIUS - PLATE_THICKNESS / 2 - GUIDE_RADIUS) < 1e-12
    # Adjacent shoes on tightest circular arc remain separated at inner corners.
    corner_gap = 2 * (GUIDE_PATH_RADIUS - PLATE_THICKNESS / 2) * math.tan(PITCH / (2 * GUIDE_PATH_RADIUS)) - PLATE_LENGTH
    assert corner_gap > 0
    # Original contact height, including original root and unmodified pad Z.
    ground_height = -0.10 + BOTTOM_Z - 0.075 - 0.035 / 2
    assert abs(ground_height - (-0.0225)) < 1e-12
    assert abs(ground_height - (-0.025) - 0.0025) < 1e-12
    # Belt phase cancels forward travel on the grounded flat; it is identical
    # for both sides, and remains stationary when travel is stationary.
    for index in range(LINKS_PER_SIDE):
        for travel in [-20, -19.37, -11.2, -4.5, -1.1]:
            phase = (index * LENGTH / LINKS_PER_SIDE - (travel + 20)) % LENGTH
            serialized_phase = eval(phase_expression(index), {'__builtins__': {}}, dict(scope, travel=travel))
            phase_error = abs((serialized_phase - phase + LENGTH / 2) % LENGTH - LENGTH / 2)
            assert phase_error < 1e-8
            dt = 1e-6
            next_phase = (index * LENGTH / LINKS_PER_SIDE - (travel + dt + 20)) % LENGTH
            assert abs((phase - next_phase) % LENGTH - dt) < 1e-8
            y, z, angle = belt_path(phase)
            yy, zz, unused = belt_path(next_phase)
            assert abs(math.hypot(yy - y, zz - z) / dt - 1) < 1e-7
            if 1e-5 < phase < 2 * ROAD_Y - 1e-5:
                assert abs((yy + travel + dt) - (y + travel)) < 1e-10
            for radius in [ROAD_RADIUS, GUIDE_RADIUS]:
                delta_rotation = -(travel + dt + 20) / radius + (travel + 20) / radius
                assert abs(delta_rotation * radius + dt) < 1e-12
    # Closed-mesh signed volume and cap/cylinder normals are outward along X.
    vertices, faces = _round_mesh_data(ROAD_RADIUS, 0.40)
    volume6 = 0.0
    for face in faces:
        p = vertices[face[0]]
        q = vertices[face[1]]
        r = vertices[face[2]]
        u = tuple(q[i] - p[i] for i in range(3))
        v = tuple(r[i] - p[i] for i in range(3))
        normal = (u[1] * v[2] - u[2] * v[1],
                  u[2] * v[0] - u[0] * v[2],
                  u[0] * v[1] - u[1] * v[0])
        centroid = tuple(sum(vertices[k][i] for k in face) / len(face) for i in range(3))
        assert sum(a * b for a, b in zip(normal, centroid)) > 0
        for j in range(1, len(face) - 1):
            q, r = vertices[face[j]], vertices[face[j + 1]]
            volume6 += (p[0] * (q[1]*r[2] - q[2]*r[1]) +
                        p[1] * (q[2]*r[0] - q[0]*r[2]) +
                        p[2] * (q[0]*r[1] - q[1]*r[0]))
    assert volume6 > 0
    return {
        'path_closure': True, 'tangent_continuity': True, 'arc_length_unit_speed': True,
        'phase_and_stop_preserved': True, 'wheel_mesh_outward_winding': True,
        'driver_reference_samples': 20001, 'max_driver_math_error': worst_error,
        'min_wheel_gap_m': wheel_clearance, 'idler_road_gap_m': guide_clearance,
        'inner_shoe_corner_gap_m': corner_gap, 'pad_contact_world_z': ground_height,
        'road_world_z': -0.025, 'unchanged_ground_clearance_m': 0.0025,
        'longest_driver_expression': max(map(len, expressions.values())),
    }


if __name__ == '__main__':
    print(json.dumps({'length_m': LENGTH, 'pitch_m': PITCH,
                      'tangent_angle_radians': ALPHA, 'qa': validate_math()}, indent=2))
