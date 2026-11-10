"""V5.2 restrained surface pass for the recovered tank film.

Usage, after opening the preserved baseline: apply_materials(bpy).
This module never opens/saves a .blend, renders, changes geometry, lights,
cameras, animation, scene color management, or volume effects. Its texture
inputs are spatial only: no frame seed, time driver, external file, displacement,
AO/pointiness sampling, or shader bevel. Existing camouflage remains intact.

Notes: paint is dielectric; exposed edge/steel remains metallic. Dust primarily
uses the existing lower-hull mask. Building families retain brick/plaster masks.
Micro-relief is deliberately restrained for native 720p temporal stability.
"""

PATCH_VERSION = "tank-surfaces-v5.3-20261004"
_TAG = "tank_surface_patch_version"


def _principled(material):
    if not material.use_nodes or material.node_tree is None:
        return None
    return next((n for n in material.node_tree.nodes
                 if n.type == 'BSDF_PRINCIPLED'), None)


def _set(node, socket, value):
    entry = node.inputs.get(socket)
    if entry is not None:
        entry.default_value = value


def _nodes(material, node_type):
    return [n for n in material.node_tree.nodes if n.type == node_type]


def _noise(material, label, vector, scale, detail=2.0):
    node = material.node_tree.nodes.get("V5 / " + label)
    if node is None:
        node = material.node_tree.nodes.new('ShaderNodeTexNoise')
    node.name = "V5 / " + label
    node.label = label
    node.noise_dimensions = '3D'
    _set(node, 'Scale', scale)
    _set(node, 'Detail', detail)
    _set(node, 'Roughness', 0.63)
    if vector is not None:
        material.node_tree.links.new(vector, node.inputs['Vector'])
    return node


def _ramp(material, label, source, low, high, positions=(0.18, 0.82)):
    node = material.node_tree.nodes.get("V5 / " + label)
    if node is None:
        node = material.node_tree.nodes.new('ShaderNodeValToRGB')
    node.name = "V5 / " + label
    node.label = label
    node.color_ramp.interpolation = 'LINEAR'
    node.color_ramp.elements[0].position = positions[0]
    node.color_ramp.elements[0].color = tuple(low) + (1.0,)
    node.color_ramp.elements[1].position = positions[1]
    node.color_ramp.elements[1].color = tuple(high) + (1.0,)
    material.node_tree.links.new(source, node.inputs['Fac'])
    return node


def _vector(material, keep_controller=False):
    """Keep the armor controller, attach micro-detail on moving parts locally."""
    nodes = _nodes(material, 'TEX_COORD')
    if nodes:
        node = nodes[0]
    else:
        node = material.node_tree.nodes.new('ShaderNodeTexCoord')
        node.name = 'V5 / stable local coordinates'
    if not keep_controller:
        node.object = None
    return node.outputs['Object']


def _mix(material, label, factor, a, b, blend='MIX'):
    node = material.node_tree.nodes.get("V5 / " + label)
    if node is None:
        node = material.node_tree.nodes.new('ShaderNodeMixRGB')
    node.name = "V5 / " + label
    node.label = label
    node.blend_type = blend
    if isinstance(factor, (int, float)):
        node.inputs[0].default_value = factor
    else:
        material.node_tree.links.new(factor, node.inputs[0])
    for index, value in ((1, a), (2, b)):
        if isinstance(value, (tuple, list)):
            node.inputs[index].default_value = value
        else:
            material.node_tree.links.new(value, node.inputs[index])
    return node.outputs['Color']


def _source(socket):
    return socket.links[0].from_socket if socket.is_linked else None


def _material_roughness(material, principled, source, lo, hi):
    rough = _ramp(material, 'stable roughness variation', source,
                  (lo,) * 3, (hi,) * 3)
    material.node_tree.links.new(rough.outputs['Color'], principled.inputs['Roughness'])
    return rough.outputs['Color']


def _bump(material, strength, distance):
    for node in _nodes(material, 'BUMP'):
        _set(node, 'Strength', strength)
        _set(node, 'Distance', distance)


def _finish(material, principled, metallic, roughness, specular=0.4):
    _set(principled, 'Metallic', metallic)
    _set(principled, 'Roughness', roughness)
    _set(principled, 'Specular IOR Level', specular)
    # Compatibility with older Principled versions, without changing unrelated
    # transmission or emission sockets.
    _set(principled, 'Specular', specular)
    _set(principled, 'Coat Weight', 0.0)
    _set(principled, 'Clearcoat', 0.0)


def _paint(material, p):
    # Retain the CONSTANT camo boundaries, scale and controller. V5.2 compresses
    # only the palette: its warm beige became chalky under the stronger sun.
    # Paint stays dielectric; metallic glints belong on the separate edge shader.
    _finish(material, p, 0.045, 0.61, 0.38)
    fine, broad = None, None
    for noise in _nodes(material, 'TEX_NOISE'):
        scale = noise.inputs['Scale'].default_value
        if scale > 30:
            fine = noise
            _set(noise, 'Scale', 78.0)
            _set(noise, 'Detail', 1.5)
            _set(noise, 'Roughness', 0.60)
        elif 3.0 < scale < 5.0:
            broad = noise
            _set(noise, 'Detail', 2.0)
    olive_palette = ((0.078, 0.099, 0.063),
                     (0.150, 0.178, 0.115),
                     (0.225, 0.242, 0.168))
    for node in _nodes(material, 'VALTORGB'):
        elements = node.color_ramp.elements
        if len(elements) == 3 and node.color_ramp.interpolation == 'CONSTANT':
            for element, color in zip(elements, olive_palette):
                element.color = color + (1.0,)
    _bump(material, 0.16, 0.0019)
    for node in _nodes(material, 'MIX_RGB'):
        if node.blend_type == 'MULTIPLY':
            node.inputs[0].default_value = 0.53
    dust = _source(p.inputs['Base Color'])
    dust_node = dust.node if dust is not None else None
    if dust_node is not None and dust_node.type == 'MIX_RGB':
        dust_node.inputs[2].default_value = (0.127, 0.113, 0.079, 1.0)
    for node in _nodes(material, 'MAP_RANGE'):
        _set(node, 'From Max', 1.8)
        _set(node, 'To Min', 0.60)
        _set(node, 'To Max', 0.0)
    # Macro variation survives the native frame's pixel footprint; tiny random
    # roughness alone averages into the same clean finish over the whole tank.
    rough_source = broad if broad is not None else fine
    if rough_source is not None:
        rough = _material_roughness(material, p, rough_source.outputs['Fac'], 0.44, 0.75)
        if dust_node is not None and dust_node.type == 'MIX_RGB':
            dust_mask = _source(dust_node.inputs[0])
            if dust_mask is not None:
                out = _mix(material, 'dust roughens lower armor', dust_mask,
                           rough, (0.86, 0.86, 0.86, 1.0))
                material.node_tree.links.new(out, p.inputs['Roughness'])


def _small_surface(material, p, kind):
    # Two inexpensive noise scales; the original bump graph is reused.
    configurations = {
        'edge': ((0.078, 0.091, 0.065), (0.171, 0.181, 0.143),
                 0.70, 0.43, 0.65, 67.0, 0.11, 0.0010),
        'metal': ((0.042, 0.047, 0.046), (0.095, 0.102, 0.097),
                  0.88, 0.39, 0.65, 73.0, 0.14, 0.0014),
        'rubber': ((0.016, 0.018, 0.015), (0.031, 0.032, 0.026),
                   0.0, 0.74, 0.91, 85.0, 0.13, 0.0012),
        'mud': ((0.092, 0.067, 0.042), (0.172, 0.137, 0.090),
                0.0, 0.87, 0.98, 34.0, 0.26, 0.006),
        'sand': ((0.223, 0.185, 0.124), (0.315, 0.267, 0.186),
                 0.0, 0.83, 0.96, 72.0, 0.20, 0.0020),
    }
    low, high, metallic, rlow, rhigh, scale, strength, distance = configurations[kind]
    _finish(material, p, metallic, (rlow + rhigh) * 0.5,
            0.30 if kind == 'rubber' else 0.40)
    vector = _vector(material)
    noises = _nodes(material, 'TEX_NOISE')
    fine = noises[0] if noises else _noise(material, 'micrograin', vector, scale)
    _set(fine, 'Scale', scale)
    _set(fine, 'Detail', 1.5)
    _set(fine, 'Roughness', 0.60)
    material.node_tree.links.new(vector, fine.inputs['Vector'])
    _bump(material, strength, distance)
    coarse = _noise(material, 'settled surface variation', vector,
                    4.6 if kind in ('edge', 'metal', 'rubber') else 6.0, 2.0)
    color = _ramp(material, 'muted surface tones', coarse.outputs['Fac'], low, high)
    material.node_tree.links.new(color.outputs['Color'], p.inputs['Base Color'])
    _material_roughness(material, p, coarse.outputs['Fac'], rlow, rhigh)
    if kind == 'edge':
        # Patchy remaining paint interrupts a continuous toy-like metal rim.
        wear = _ramp(material, 'paint remaining on exposed edges', coarse.outputs['Fac'],
                     (0.22,) * 3, (0.86,) * 3, (0.30, 0.72))
        material.node_tree.links.new(wear.outputs['Color'], p.inputs['Metallic'])
    material.diffuse_color = tuple((a + b) * 0.5 for a, b in zip(low, high)) + (1.0,)


def _concrete(material, p, family_index=None):
    _finish(material, p, 0.0, 0.88, 0.32)
    vector = _vector(material)
    noises = _nodes(material, 'TEX_NOISE')
    aggregate = noises[0] if noises else _noise(material, 'aggregate', vector, 42.0)
    _set(aggregate, 'Scale', 42.0)
    _set(aggregate, 'Detail', 2.0)
    _set(aggregate, 'Roughness', 0.65)
    _bump(material, 0.24, 0.007)
    tone = 1.0 if family_index is None else (0.78, 0.94, 1.06, 0.86, 1.10, 0.98)[family_index % 6]
    grain = _ramp(material, 'small concrete aggregate', aggregate.outputs['Fac'],
                  tuple(v * tone for v in (0.150, 0.148, 0.130)),
                  tuple(v * tone for v in (0.305, 0.296, 0.257)))
    coarse = _noise(material, 'meter-scale concrete aging', vector, 0.68, 2.0)
    aging = _ramp(material, 'subtle concrete stains', coarse.outputs['Fac'],
                  (0.72, 0.72, 0.69), (1.06, 1.05, 1.02))
    color = _mix(material, 'mineral grain with aging', 0.48,
                 grain.outputs['Color'], aging.outputs['Color'], 'MULTIPLY')
    material.node_tree.links.new(color, p.inputs['Base Color'])
    _material_roughness(material, p, coarse.outputs['Fac'], 0.80, 0.94)


def _wall(material, p, family_index=None):
    # Preserve exposed-brick construction, dimensions, face projection and masks.
    _finish(material, p, 0.0, 0.88, 0.32)
    _bump(material, 0.25, 0.010)
    coarse = None
    for node in _nodes(material, 'TEX_NOISE'):
        scale = node.inputs['Scale'].default_value
        if scale < 2.0:
            coarse = node
            _set(node, 'Detail', 3.0)
        elif scale > 20.0:
            _set(node, 'Scale', 46.0)
            _set(node, 'Detail', 2.0)
    # The two-input plaster palette is distinct from the black/white damage mask.
    for node in _nodes(material, 'VALTORGB'):
        elements = node.color_ramp.elements
        if len(elements) != 2:
            continue
        first = elements[0].color
        second = elements[1].color
        if 0.025 < first[0] < 0.13 and 0.18 < second[0] < 0.45:
            tone = 1.0 if family_index is None else (0.94, 1.04, 0.99, 1.08, 0.91)[family_index % 5]
            elements[0].color = tuple(tone * v for v in (0.098, 0.096, 0.085)) + (1.0,)
            elements[1].color = tuple(tone * v for v in (0.30, 0.292, 0.254)) + (1.0,)
    if coarse is not None:
        _material_roughness(material, p, coarse.outputs['Fac'], 0.79, 0.94)


def _road(material, p):
    # Original crack masks stay connected; avoid making the whole avenue glossy.
    _finish(material, p, 0.0, 0.74, 0.30)
    _bump(material, 0.24, 0.0035)
    coarse = None
    for node in _nodes(material, 'TEX_NOISE'):
        scale = node.inputs['Scale'].default_value
        if scale < 1.0:
            coarse = node
            _set(node, 'Detail', 2.0)
        elif scale > 50.0:
            _set(node, 'Scale', 88.0)
            _set(node, 'Detail', 1.5)
        elif 2.0 < scale < 3.0:
            # Previously 2.6/m: tiny disconnected threshold islands clipped
            # the crack network into scattered black dashes. Use broad patches.
            _set(node, 'Scale', 0.24)
            _set(node, 'Detail', 1.5)
    for node in _nodes(material, 'TEX_VORONOI'):
        if node.feature == 'DISTANCE_TO_EDGE':
            _set(node, 'Scale', 0.55)
    for node in _nodes(material, 'MATH'):
        if node.operation == 'GREATER_THAN':
            node.inputs[1].default_value = 0.58
        elif node.operation == 'LESS_THAN':
            node.inputs[1].default_value = 0.0035
    road_color = _source(p.inputs['Base Color'])
    if road_color is not None and road_color.node.type == 'MIX_RGB':
        # Dark mineral fissures, rather than near-black graphic marks.
        road_color.node.inputs[2].default_value = (0.015, 0.017, 0.015, 1.0)
    if coarse is not None:
        _material_roughness(material, p, coarse.outputs['Fac'], 0.67, 0.85)
    for node in _nodes(material, 'VALTORGB'):
        elements = node.color_ramp.elements
        if len(elements) != 2:
            continue
        a, b = elements[0].color, elements[1].color
        if 0.015 < a[0] < 0.06 and 0.03 < b[0] < 0.08:
            elements[0].color = (0.034, 0.037, 0.035, 1.0)
            elements[1].color = (0.047, 0.048, 0.043, 1.0)


def apply_materials(bpy):
    """Patch named baseline surface materials in memory; return a QA summary.

    Idempotent for this version. Unrecognized materials, volumes, and their
    animation are untouched. The caller owns saving and Blender render QA.
    """
    report = {'version': PATCH_VERSION, 'updated': [], 'skipped': [], 'missing': []}
    exact = {
        'FINAL / worn multi-tone armor': ('paint', None),
        'FINAL / exposed armor edge': ('edge', None),
        'FINAL / oiled steel': ('metal', None),
        'FINAL / wheel tire rubber': ('rubber', None),
        'FINAL / dried earth deposits': ('mud', None),
        'FINAL / sandbag canvas': ('sand', None),
        'FINAL / broken aggregate concrete': ('concrete', None),
        'FINAL / scarred plaster and masonry': ('wall', None),
        'Exposed old brick': ('wall', None),
        'FINAL / rain-wet cracked asphalt': ('road', None),
        'FINAL / optical glass': ('glass', None),
    }
    for name in exact:
        if bpy.data.materials.get(name) is None:
            report['missing'].append(name)
    for material in bpy.data.materials:
        name = material.name
        classification = exact.get(name)
        if classification is None and name.startswith('Road rubble family '):
            suffix = name[len('Road rubble family '):].split('.')[0]
            classification = ('concrete', int(suffix) if suffix.isdigit() else None)
        if classification is None and name.startswith('CONCRETE / '):
            suffix = name[len('CONCRETE / '):].split('.')[0]
            classification = ('wall', int(suffix) if suffix.isdigit() else None)
        if classification is None:
            continue
        if material.get(_TAG) == PATCH_VERSION:
            report['skipped'].append(name)
            continue
        p = _principled(material)
        if p is None:
            report['skipped'].append(name + ' (no Principled surface)')
            continue
        kind, index = classification
        if kind == 'paint':
            _paint(material, p)
        elif kind in ('edge', 'metal', 'rubber', 'mud', 'sand'):
            _small_surface(material, p, kind)
        elif kind == 'concrete':
            _concrete(material, p, index)
        elif kind == 'wall':
            _wall(material, p, index)
        elif kind == 'road':
            _road(material, p)
        elif kind == 'glass':
            # Opaque coated optical apertures; avoid expensive refraction and
            # incorrect transparent holes in their solid black housings.
            _finish(material, p, 0.28, 0.20, 0.50)
            _set(p, 'Base Color', (0.017, 0.036, 0.043, 1.0))
        material[_TAG] = PATCH_VERSION
        report['updated'].append(name)
    return report
