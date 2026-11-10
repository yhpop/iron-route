"""Geometry-only, deterministic hero-corridor refinement for recovered tank v4.

Usage in an already loaded Blender scene: apply_environment(bpy)
No scene rebuild, operators, rendering, external assets, shader edits, or simulation.
Revision 4 / 2026-10-04. All measurements are metres. Near-action details stay
outside |x| < 5.05 except flush road marks; the far district starts more than
100 m beyond the animated roadblock. Existing action and motion stay untouched.
"""
import json
import math
import random

REVISION = "v5_environment_20261004_r4"
_PREVIOUS_REVISION = "v5_environment_20261004_r3"
_PERIPHERY_REVISION = "v5_environment_20261004_r2"
_INITIAL_REVISION = "v5_environment_20261004_r1"
COLLECTION_NAME = "07_V5_ENVIRONMENT_DETAIL"
_SEED = 5100417


def _vadd(a, b):
    return tuple(a[i] + b[i] for i in range(3))


def _vsub(a, b):
    return tuple(a[i] - b[i] for i in range(3))


def _vmul(a, t):
    return tuple(v * t for v in a)


def _cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def _unit(a):
    length = math.sqrt(sum(v*v for v in a))
    return tuple(v / max(length, 1e-12) for v in a)


class _Batch:
    """One mesh per visual family, with material slots instead of many objects."""
    def __init__(self, name, materials):
        self.name = name
        self.materials = materials
        self.vertices = []
        self.faces = []
        self.material_indices = []

    def add(self, vertices, faces, material=0):
        base = len(self.vertices)
        self.vertices.extend(tuple(v) for v in vertices)
        self.faces.extend(tuple(base+i for i in f) for f in faces)
        self.material_indices.extend([material] * len(faces))

    def box(self, center, dimensions, material=0, yaw=0.0, tilt=(0., 0.)):
        # A small local XYZ Euler rotation avoids operators and modifiers.
        sx, cx = math.sin(tilt[0]), math.cos(tilt[0])
        sy, cy = math.sin(tilt[1]), math.cos(tilt[1])
        sz, cz = math.sin(yaw), math.cos(yaw)
        vertices = []
        for x, y, z in ((-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),
                        (1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)):
            x, y, z = x*dimensions[0]/2, y*dimensions[1]/2, z*dimensions[2]/2
            y, z = cx*y-sx*z, sx*y+cx*z
            x, z = cy*x+sy*z, -sy*x+cy*z
            x, y = cz*x-sz*y, sz*x+cz*y
            vertices.append((center[0]+x, center[1]+y, center[2]+z))
        self.add(vertices, [(2,6,4,0),(5,7,3,1),(4,5,1,0),
                            (3,7,6,2),(1,3,2,0),(6,7,5,4)], material)

    def rod(self, a, b, radius, material=0, sides=6, end_radius=None):
        direction = _unit(_vsub(b, a))
        if sum(v*v for v in _vsub(b, a)) < 1e-10:
            return
        reference = (0., 0., 1.) if abs(direction[2]) < .92 else (0., 1., 0.)
        u = _unit(_cross(direction, reference))
        v = _cross(direction, u)
        verts = []
        for point, r in ((a, radius), (b, radius if end_radius is None else end_radius)):
            for i in range(sides):
                angle = i * math.tau / sides
                offset = _vadd(_vmul(u, math.cos(angle)*r), _vmul(v, math.sin(angle)*r))
                verts.append(_vadd(point, offset))
        faces = [tuple(reversed(range(sides))), tuple(range(sides, sides*2))]
        faces.extend((i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides))
        self.add(verts, faces, material)

    def shard(self, center, scale, rng, material=0, count=5, yaw=None):
        """An asymmetrical low-poly stone, rather than another rectangular block."""
        angle = rng.random()*math.tau if yaw is None else yaw
        verts = []
        # Two offset irregular rings and genuinely irregular top facets.
        for ring in range(2):
            for i in range(count):
                theta = angle + i*math.tau/count
                radial = rng.uniform(.69, 1.07) * (.81 if ring else 1.)
                verts.append((center[0]+math.cos(theta)*scale[0]*radial,
                              center[1]+math.sin(theta)*scale[1]*radial,
                              center[2]+scale[2]*(rng.uniform(.1,.32) if not ring else rng.uniform(.68,1.))))
        top = len(verts)
        verts.append((center[0]+rng.uniform(-.18,.18)*scale[0],
                      center[1]+rng.uniform(-.18,.18)*scale[1],
                      center[2]+scale[2]*rng.uniform(.88,1.12)))
        faces = [tuple(reversed(range(count)))]
        for i in range(count):
            j = (i+1)%count
            faces.append((i,j,j+count,i+count))
            faces.append((i+count,j+count,top))
        self.add(verts, faces, material)

    def ribbon(self, points, width, material=0):
        """Flat raised-by-millimetres marks/cracks; no decals or alpha shaders."""
        for a, b in zip(points[:-1], points[1:]):
            dx, dy = b[0]-a[0], b[1]-a[1]
            length = math.hypot(dx, dy)
            if length < 1e-7:
                continue
            ox, oy = -dy/length*width/2, dx/length*width/2
            self.add([(a[0]-ox,a[1]-oy,a[2]),(b[0]-ox,b[1]-oy,b[2]),
                      (b[0]+ox,b[1]+oy,b[2]),(a[0]+ox,a[1]+oy,a[2])], [(0,1,2,3)], material)

    def emit(self, bpy, collection):
        if not self.faces:
            return None
        mesh = bpy.data.meshes.new(self.name + " / mesh")
        mesh.from_pydata(self.vertices, [], self.faces)
        for material in self.materials:
            mesh.materials.append(material)
        for polygon, index in zip(mesh.polygons, self.material_indices):
            polygon.material_index = index
        mesh.update()
        obj = bpy.data.objects.new(self.name, mesh)
        collection.objects.link(obj)
        obj["environment_revision"] = REVISION
        obj["static_batched_detail"] = True
        if ("vehicle shells" in self.name or "background ruined skyline" in self.name
                or "far cross-street district" in self.name):
            obj["contains_intentional_open_panels"] = True
        return obj


def _component_data(mesh):
    """Read the original batched eight-vertex box islands without Blender ops."""
    if len(mesh.vertices) % 8:
        return None
    count = len(mesh.vertices) // 8
    groups = [[] for _ in range(count)]
    for p in mesh.polygons:
        idx = min(p.vertices) // 8
        if any(v // 8 != idx for v in p.vertices):
            return None
        groups[idx].append(tuple(v-idx*8 for v in p.vertices))
    result = []
    for i, faces in enumerate(groups):
        if len(faces) != 6:
            return None
        vertices = [tuple(v.co) for v in mesh.vertices[i*8:i*8+8]]
        lo = tuple(min(v[k] for v in vertices) for k in range(3))
        hi = tuple(max(v[k] for v in vertices) for k in range(3))
        center = tuple((lo[k]+hi[k])/2 for k in range(3))
        dims = tuple(hi[k]-lo[k] for k in range(3))
        result.append((vertices, faces, lo, hi, center, dims))
    return result


def _slab_fracture(lo, hi, side, rng):
    """Watertight extruded footprint, with two varied broken-away front bites."""
    front = lo[0] if side > 0 else hi[0]
    back = hi[0] if side > 0 else lo[0]
    depth = abs(back-front)
    length = hi[1]-lo[1]
    steps = 11
    mouth = rng.uniform(.24,.69)
    shoulder = rng.uniform(.12,.23)
    profile = []
    for i in range(steps):
        t = i/(steps-1)
        bite = max(0., 1.-abs(t-mouth)/shoulder) * rng.uniform(.45,1.05)
        secondary = max(0., 1.-abs(t-(1.-mouth))/.10) * .31
        cut = min(depth*.34, .04+rng.uniform(.015,.23)+bite+secondary)
        if i in (0, steps-1):
            cut *= .28
        profile.append((front+side*cut, lo[1]+t*length))
    outline = [(back,lo[1])] + profile + [(back,hi[1])]
    # Ensure the XY polygon is counterclockwise, independent of road side.
    area = sum(outline[i][0]*outline[(i+1)%len(outline)][1]-
               outline[(i+1)%len(outline)][0]*outline[i][1] for i in range(len(outline)))
    if area < 0:
        outline.reverse()
    n = len(outline)
    verts = [(x,y,lo[2]) for x,y in outline] + [(x,y,hi[2]) for x,y in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n,2*n))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    return verts, faces, profile


def _wall_fracture(lo, hi, rng):
    """Top-floor cross wall with a credible stepped and ragged broken skyline."""
    n = 8
    tops = []
    mouth = rng.randint(2, n-3)
    height = hi[2]-lo[2]
    for i in range(n):
        damage = rng.uniform(.03,.19)*height
        if abs(i-mouth) <= 1:
            damage += rng.uniform(.22,.60)*height
        tops.append((lo[0]+(hi[0]-lo[0])*i/(n-1), max(lo[2]+.27,hi[2]-damage)))
    # Counterclockwise in the XZ plane; front face points towards -Y.
    outline = [(lo[0],lo[2]),(hi[0],lo[2])] + list(reversed(tops))
    count = len(outline)
    verts = [(x,lo[1],z) for x,z in outline] + [(x,hi[1],z) for x,z in outline]
    faces = [tuple(range(count)), tuple(reversed(range(count,count*2)))]
    faces.extend((i,i+count,(i+1)%count+count,(i+1)%count) for i in range(count))
    return verts, faces, tops


def _add_wreck(batch, cx, cy, yaw, rng):
    """One unbranded, unoccupied burned vehicle shell at the curb."""
    cosine, sine = math.cos(yaw), math.sin(yaw)
    def world(v):
        x,y,z = v
        return (cx+cosine*x-sine*y,cy+sine*x+cosine*y,z+.095)
    def panel(vs, mat=0, normal=(0.,0.,1.)):
        # These are deliberately open sheets. Set their visible surface normal
        # explicitly instead of relying on a closed-shell normal recalculation.
        face_normal=_cross(_vsub(vs[1],vs[0]),_vsub(vs[2],vs[0]))
        if sum(face_normal[i]*normal[i] for i in range(3))<0:
            vs=list(reversed(vs))
        batch.add([world(v) for v in vs], [tuple(range(len(vs)))], mat)
    def rod(a,b,r=.032,mat=0,sides=6):
        batch.rod(world(a),world(b),r,mat,sides)
    # Dented belly pan, side sills, hood and crushed trunk. Deliberately open cabin.
    panel([(-.77,-1.65,.34),(.77,-1.67,.36),(.80,1.52,.37),(-.72,1.60,.31)],1)
    panel([(-.74,.72,.79),(-.70,1.70,.61),(.71,1.68,.66),(.77,.74,.84),(.13,.70,.75)])
    panel([(-.75,-1.68,.67),(-.70,-1.08,.82),(.68,-1.03,.78),(.76,-1.66,.62)])
    panel([(-.55,-.75,1.33),(-.44,.29,1.41),(.51,.39,1.31),(.58,-.77,1.29),(.03,-.90,1.21)])
    for side in (-1,1):
        x=side*.80
        panel([(x,-1.60,.39),(x,1.54,.41),(x*.97,1.62,.63),
               (x*.93,.72,.80),(x*.93,-.95,.79),(x*.96,-1.62,.64)],normal=(side,0.,0.))
        panel([(x,-.88,.44),(x,.53,.43),(x*.96,.52,.79),(x*.94,-.90,.80)],1 if side<0 else 0,normal=(side,0.,0.))
        rod((x*.94,-.99,.77),(side*.55,-.75,1.33))
        rod((x*.94,.73,.80),(side*.48,.31,1.36))
        rod((side*.55,-.75,1.33),(side*.48,.31,1.36))
        rod((side*.77,-1.51,.45),(side*.79,1.49,.43),.053)
        for wheel_y in (-1.14,1.10):
            # A hollow tire torus with rectangular cross section, only 12 segments.
            verts=[]
            center_x=side*.80
            for off,radius in ((-.095,.31),(.095,.31),(-.095,.17),(.095,.17)):
                for i in range(12):
                    a=i*math.tau/12
                    verts.append(world((center_x+off,wheel_y+math.cos(a)*radius,.35+math.sin(a)*radius)))
            faces=[]
            for i in range(12):
                j=(i+1)%12
                faces.extend([(i,j,j+12,i+12),(i+24,i+36,j+36,j+24),
                              (i,i+24,j+24,j),(i+12,j+12,j+36,i+36)])
            batch.add(verts,faces,2)
            rod((center_x-side*.075,wheel_y,.35),(center_x+side*.10,wheel_y,.35),.14,0,10)
    rod((-.55,-.75,1.33),(.58,-.77,1.29))
    rod((-.44,.29,1.41),(.51,.39,1.31))
    rod((-.73,1.61,.54),(.71,1.65,.53),.045)
    rod((-.70,-1.64,.53),(.74,-1.64,.50),.045)
    # Two seat remnants and a steering hoop suggest an interior without occupants.
    for x in (-.35,.35):
        panel([(x-.22,-.46,.47),(x+.22,-.44,.47),(x+.21,-.12,.56),(x-.23,-.11,.55)],1)
        panel([(x-.22,-.47,.48),(x+.22,-.45,.47),(x+.19,-.63,.99),(x-.20,-.61,.94)],1,normal=(0.,1.,0.))
    # Broken lamp cavities and asymmetric detached sheet metal stay on the sidewalk.
    for x in (-.48,.48):
        panel([(x-.13,1.705,.52),(x+.13,1.705,.52),(x+.12,1.705,.63),(x-.12,1.705,.64)],1,normal=(0.,1.,0.))
    for i in range(4):
        batch.shard(world((rng.uniform(-.8,.8),rng.uniform(-1.6,1.6),.03)),
                    (.12,.17,.065),rng,0,4)


def _make_periphery(bpy):
    """Very low-cost world closure, using existing unmodified material datablocks."""
    names = ("FINAL / rain-wet cracked asphalt", "CONCRETE / 4",
             "CONCRETE / 0", "FINAL / dried earth deposits")
    missing = [name for name in names if bpy.data.materials.get(name) is None]
    if missing:
        raise RuntimeError("Missing periphery materials: " + ", ".join(missing))
    asphalt, wall_a, wall_b, muted_recess = [bpy.data.materials[name] for name in names]
    ground = _Batch("V5 / peripheral ground continuation", [asphalt])
    skyline = _Batch("V5 / background ruined skyline", [wall_a,wall_b,muted_recess])
    # Main avenue top is -0.025 m. A 2 cm separation prevents z-fighting, fills
    # the original road's ±9.5 m limit and continues beneath both city sections.
    ground.box((0.,25.,-.195),(220.,560.,.30))
    rng = random.Random(_SEED+201)
    buildings = 0
    apertures = 0
    for side in (-1,1):
        for index, y in enumerate((-48.,-25.,2.,33.,65.)):
            y += rng.uniform(-2.0,2.0)
            depth = rng.uniform(7.5,10.5)
            length = rng.uniform(12.0,17.0)
            front = side*rng.uniform(22.5,25.0)
            back = front+side*depth
            height = rng.uniform(10.0,17.0)
            lo_y,hi_y=y-length/2,y+length/2
            # A closed, solid far shell with an uneven stepped roof profile.
            # The longest visible planes stay quiet: no bricks, rubble or rebar.
            z0=-.045
            roof=[(lo_y,height-.45),(lo_y+length*.23,height-.45),
                  (lo_y+length*.24,height-1.75),(lo_y+length*.54,height-1.52),
                  (lo_y+length*.55,height-.17),(hi_y,height-.52)]
            profile=[(lo_y,z0),(hi_y,z0)]+list(reversed(roof))
            n=len(profile)
            min_x,max_x=min(front,back),max(front,back)
            # CCW in YZ points along +X; min-X face therefore uses reverse order.
            verts=[(min_x,yy,z) for yy,z in profile]+[(max_x,yy,z) for yy,z in profile]
            faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]
            faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
            skyline.add(verts,faces,index%2)
            # One restrained roof setback breaks the familiar first-row blocks.
            if index in (1,3):
                skyline.box((back-side*depth*.32,y-length*.12,height-.12),
                            (depth*.40,length*.28,2.15),index%2)
            # Sparse dark, recessed-looking window marks are subdued earth rather
            # than near-black cutouts; all are open upward-independent facade faces.
            for row in range(1,4):
                for col in range(3):
                    if rng.random()<.27:
                        continue
                    z=row*2.75
                    if z+1.25>height-1.8:
                        continue
                    yy=y+(col-1)*length*.235+rng.uniform(-.10,.10)
                    x=front-side*.016
                    panel=[(x,yy-.44,z),(x,yy+.44,z),
                           (x,yy+.44,z+1.10),(x,yy-.44,z+1.10)]
                    # +Y cross +Z is +X. The near face points towards the road.
                    order=(3,2,1,0) if side>0 else (0,1,2,3)
                    skyline.add(panel,[order],2)
                    apertures+=1
            buildings+=1
    # Two still farther, low unadorned masses interrupt long sightlines between
    # the second-row shells, without multiplying close architectural detail.
    for side,y in ((-1,-12.),(1,39.)):
        skyline.box((side*44.,y,5.7),(13.,20.,11.49),1)
        skyline.box((side*46.,y+4.,12.2),(7.0,9.0,2.1),1)
        buildings+=1
    additions={"ground_continuation":ground,"background_skyline":skyline}
    faces=sum(len(batch.faces) for batch in additions.values())
    tris=sum(sum(len(face)-2 for face in batch.faces) for batch in additions.values())
    if faces>2000:
        raise RuntimeError("Peripheral mesh budget exceeded before commit")
    info={"added_objects":2,"added_polygons":faces,"added_triangles":tris,
          "building_silhouettes":buildings,"sparse_facade_marks":apertures,
          "ground_bounds_x":[-110.,110.],"ground_bounds_y":[-255.,305.],
          "ground_top_z":-.045,"background_minimum_abs_x":22.5,
          "material_nodes_changed":0}
    return additions,info


def _make_far_district(bpy):
    """Five staggered far ruins close the forward and oblique set-edge horizon."""
    names=("CONCRETE / 4","CONCRETE / 0","FINAL / dried earth deposits")
    missing=[name for name in names if bpy.data.materials.get(name) is None]
    if missing:
        raise RuntimeError("Missing far-district materials: "+", ".join(missing))
    batch=_Batch("V5 / far cross-street district",[bpy.data.materials[name] for name in names])
    rng=random.Random(_SEED+303)
    # (X centre, front Y, width, depth, height). Staggered depths and silhouettes
    # imply a cross street rather than a single continuous flat terminal wall.
    layout=[(-38.,84.5,18.,13.,16.8),(-21.,94.,14.,15.,22.6),
            (-4.,78.,19.,14.,17.8),(15.,94.,17.,14.,20.8),
            (35.,83.5,17.,15.,14.8)]
    windows=0
    for building,(cx,front,width,depth,height) in enumerate(layout):
        left,right=cx-width/2,cx+width/2
        roof=[(right,height-1.35),(right-width*.23,height-1.35),
              (right-width*.25,height-.18),(cx+.25,height-.18),
              (cx-.10,height-2.05),(left+width*.18,height-2.05),
              (left,height-.78)]
        profile=[(left,-.045),(right,-.045)]+roof
        n=len(profile)
        verts=[(x,front,z) for x,z in profile]+[(x,front+depth,z) for x,z in profile]
        # XZ counterclockwise points towards -Y, the visible front of the shell.
        faces=[tuple(range(n)),tuple(reversed(range(n,n*2)))]
        faces.extend((i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n))
        batch.add(verts,faces,building%2)
        floors=int((height-2.7)/3.0)
        columns=6 if width>=17 else 5
        # Differing aperture proportions and missing windows keep the distant
        # facades legible without introducing texture assets or new shaders.
        for row in range(floors):
            z=1.10+row*3.05
            for col in range(columns):
                if rng.random()<.16:
                    continue
                x=left+1.45+col*(width-2.9)/(columns-1)
                ww=rng.uniform(.83,1.13)
                hh=rng.uniform(1.25,1.64)
                batch.add([(x-ww/2,front-.021,z),(x+ww/2,front-.021,z),
                           (x+ww/2,front-.021,z+hh),(x-ww/2,front-.021,z+hh)],
                          [(0,1,2,3)],2)
                windows+=1
            # Two restrained projecting storey bands per building, not a dense
            # lattice competing with the action and nearer broken structures.
            if row in (1,floors-1):
                batch.box((cx,front-.055,z-.31),(width,.19,.16),building%2)
        # Side elevations matter in the impact camera's oblique view. These marks
        # have explicit side-facing normals and restrained material contrast.
        for side in (-1,1):
            x=(left if side<0 else right)+side*.019
            for row in range(max(1,floors-1)):
                z=1.2+row*3.05
                for col in range(3):
                    if rng.random()<.22:
                        continue
                    y=front+2.15+col*(depth-4.3)/2
                    panel=[(x,y-.50,z),(x,y+.50,z),
                           (x,y+.50,z+1.45),(x,y-.50,z+1.45)]
                    batch.add(panel,[(0,1,2,3) if side>0 else (3,2,1,0)],2)
                    windows+=1
        # Broken parapet/stair-head fragments preserve the damaged-city silhouette.
        for side in (-1,1):
            x=cx+side*width*.32
            batch.box((x,front+depth*.48,height-1.65),
                      (rng.uniform(.4,.8),depth*.35,1.30),building%2)
        if building in (1,3):
            batch.box((cx+width*.16,front+depth*.67,height-.24),
                      (width*.27,depth*.29,1.75),building%2)
    # r4: keep the terminal district well behind the action. Scale about the
    # common ground elevation so lowering the skyline cannot leave floating bases.
    batch.vertices=[(x,y+55.,-.045+(z+.045)*.65) for x,y,z in batch.vertices]
    triangles=sum(len(face)-2 for face in batch.faces)
    if len(batch.faces)>=1000:
        raise RuntimeError("Far cross-street geometry budget exceeded before commit")
    bounds=[(min(v[k] for v in batch.vertices),max(v[k] for v in batch.vertices)) for k in range(3)]
    info={"added_objects":1,"added_polygons":len(batch.faces),
          "added_triangles":triangles,"building_masses":len(layout),
          "front_and_side_window_marks":windows,"bounds_x":list(bounds[0]),
          "bounds_y":list(bounds[1]),"main_mass_height_range_m":[14.8*.65,22.6*.65],
          "depth_shift_from_r3_m":55.,"vertical_scale_from_r3":.65,
          "maximum_geometry_height_m":bounds[2][1],
          "closest_distance_beyond_barricade_m":bounds[1][0]-26.,"material_nodes_changed":0}
    return {"far_cross_street":batch},info


def _upgrade_periphery(bpy, scene, collection):
    """Upgrade r1/r2/r3 without repeating city damage or duplicating the skyline."""
    previous=scene.get("environment_geometry_revision")
    report=json.loads(scene.get("environment_geometry_report","{}"))
    accepted=(_INITIAL_REVISION,_PERIPHERY_REVISION,_PREVIOUS_REVISION)
    if not report or report.get("revision")!=previous or previous not in accepted:
        raise RuntimeError("Cannot verify the existing geometry report for a safe upgrade.")
    additions={}
    infos=[]
    if previous==_INITIAL_REVISION:
        extra,info=_make_periphery(bpy)
        additions.update(extra)
        infos.append(info)
        report["periphery"]=info
    else:
        ground=bpy.data.objects.get("V5 / peripheral ground continuation")
        if ground is None or ground.type!="MESH":
            raise RuntimeError("Expected existing peripheral ground was not found.")
    extra,district_info=_make_far_district(bpy)
    if previous==_PREVIOUS_REVISION:
        district=bpy.data.objects.get("V5 / far cross-street district")
        if district is None or district.type!="MESH":
            raise RuntimeError("Expected r3 cross-street geometry was not found.")
    else:
        additions.update(extra)
        infos.append(district_info)
    if any(bpy.data.objects.get(batch.name) is not None for batch in additions.values()):
        raise RuntimeError("Partial peripheral upgrade geometry exists; reload the last valid scene before retrying.")
    # The r3 -> r4 correction is coordinate-only, preserving all existing mesh
    # faces, material slots, object identities and any normal corrections.
    if previous==_PREVIOUS_REVISION:
        if district.data.users>1:
            district.data=district.data.copy()
        for vertex in district.data.vertices:
            vertex.co.y+=55.
            vertex.co.z=-.045+(vertex.co.z+.045)*.65
        district.data.update()
        district["environment_revision"]=REVISION
    if previous!=_INITIAL_REVISION:
        if ground.data.users>1:
            ground.data=ground.data.copy()
        lo=min(v.co.y for v in ground.data.vertices)
        hi=max(v.co.y for v in ground.data.vertices)
        if hi<=lo:
            raise RuntimeError("Existing peripheral ground has invalid Y bounds.")
        for vertex in ground.data.vertices:
            vertex.co.y=-255.+(vertex.co.y-lo)/(hi-lo)*560.
        ground.data.update()
        ground["environment_revision"]=REVISION
        report.setdefault("periphery",{})["ground_bounds_y"]=[-255.,305.]
    created=[]
    for batch in additions.values():
        created.append(batch.emit(bpy,collection).name)
    report["revision"]=REVISION
    report["upgraded_from"]=previous
    report["far_cross_street"]=district_info
    report["added_objects"]=report.get("added_objects",0)+sum(info["added_objects"] for info in infos)
    report["added_polygons"]=report.get("added_polygons",0)+sum(info["added_polygons"] for info in infos)
    report["added_triangles_estimate"]=report.get("added_triangles_estimate",0)+sum(info["added_triangles"] for info in infos)
    report["detail_vertices"]=report.get("detail_vertices",0)+sum(len(batch.vertices) for batch in additions.values())
    report["objects"]=report.get("objects",[])+created
    changes=report.setdefault("changes",{})
    if previous==_INITIAL_REVISION:
        changes["background_building_silhouettes"]=report["periphery"]["building_silhouettes"]
        changes["ground_continuation_slabs"]=1
    changes["far_cross_street_masses"]=district_info["building_masses"]
    changes["far_skyline_depth_shift_m"]=55.
    changes["far_skyline_vertical_scale"]=.65
    report["r4_geometry_delta"]={"added_objects":len(created),
                                 "added_polygons":sum(info["added_polygons"] for info in infos)}
    scene["environment_geometry_revision"]=REVISION
    scene["environment_geometry_report"]=json.dumps(report,sort_keys=True)
    return report


def apply_environment(bpy):
    """Apply once to the loaded v4 scene and return a JSON-serializable report."""
    scene = bpy.context.scene
    if scene.get("environment_geometry_revision") == REVISION:
        report = json.loads(scene.get("environment_geometry_report", "{}"))
        report["already_applied"] = True
        return report
    existing_collection=bpy.data.collections.get(COLLECTION_NAME)
    if existing_collection is not None and scene.get("environment_geometry_revision") in (_INITIAL_REVISION,_PERIPHERY_REVISION,_PREVIOUS_REVISION):
        return _upgrade_periphery(bpy,scene,existing_collection)
    if existing_collection is not None:
        raise RuntimeError("A partial environment patch collection exists; reload the clean baseline before retrying.")
    city = bpy.data.collections.get("02_RUINED_CITY")
    if city is None:
        raise RuntimeError("Expected recovered v4 city collection was not found.")
    names = ["FINAL / broken aggregate concrete", "FINAL / oiled steel",
             "FINAL / scorched interior", "FINAL / dried earth deposits",
             "FINAL / sandbag canvas", "FINAL / wheel tire rubber",
             "Exposed old brick"]
    missing = [name for name in names if bpy.data.materials.get(name) is None]
    if missing:
        raise RuntimeError("Missing baseline materials: " + ", ".join(missing))
    concrete, metal, dark, earth, sand, rubber, brick = [bpy.data.materials[name] for name in names]
    rng = random.Random(_SEED)
    batches = {
        "aggregate": _Batch("V5 / clustered gravel and irregular masonry",[concrete,earth,brick,dark]),
        "rebar": _Batch("V5 / exposed reinforcement and service pipes",[metal]),
        "interiors": _Batch("V5 / broken room ribs and surviving lintels",[concrete,dark,brick]),
        "road": _Batch("V5 / worn road paint and branching surface fractures",[sand,dark,earth]),
        "drains": _Batch("V5 / curb drainage grates and inspection cover",[metal,dark]),
        "wrecks": _Batch("V5 / two curbside burned vehicle shells",[metal,dark,rubber]),
    }
    aggregate, rebar, interiors = batches["aggregate"],batches["rebar"],batches["interiors"]
    road, drains, wrecks = batches["road"],batches["drains"],batches["wrecks"]
    originals=[]
    top_floors={}
    # The distant continuation shares original mesh datablocks. Never edit a mesh
    # in place: near-city objects receive new data; distant objects keep v4 data.
    for obj in sorted(city.objects,key=lambda obj:obj.name):
        if obj.type != "MESH" or obj.name.startswith("Distant continuation"):
            continue
        if obj.animation_data or obj.parent:
            continue
        if not all(abs(v) < 1e-6 for v in obj.location):
            continue
        components = _component_data(obj.data)
        if components is None:
            continue
        originals.append((obj,components))
        for verts,faces,lo,hi,center,dims in components:
            if dims[0]>3.0 and dims[1]>5.0 and dims[2]<.5 and abs(center[1])<39:
                building = (1 if center[0]>0 else -1,round((center[1]+34.)/10.)*10.-34.)
                top_floors[building]=max(top_floors.get(building,-1),int(round((center[2]-.22)/3.15)))
    planned=[]
    counts={"fractured_floor_slabs":0,"fractured_top_walls":0,"edited_city_meshes":0,
            "curb_gravel_clusters":0,"road_crack_chains":0,"burned_vehicle_shells":2}
    old_faces=0
    new_faces=0
    for obj,components in originals:
        # Exclude black interior masses, which must continue to occlude open rooms.
        if not obj.data.materials or "scorched interior" in obj.data.materials[0].name:
            continue
        batch=_Batch(obj.name+" / V5 fractured geometry",list(obj.data.materials))
        changed=False
        for verts,faces,lo,hi,center,dims in components:
            cx,cy,cz=center
            side=1 if cx>0 else -1
            building_y=round((cy+34.)/10.)*10.-34.
            highest=top_floors.get((side,building_y),100)
            floor=int(round((lo[2]-.4)/3.15))
            in_hero=-37.0<=cy<=31.0 and abs(cx)>=9.0
            if in_hero and dims[0]>3.0 and dims[1]>5.0 and dims[2]<.5 and cz>2.0 and rng.random()<.84:
                vs,fs,profile=_slab_fracture(lo,hi,side,rng)
                batch.add(vs,fs)
                counts["fractured_floor_slabs"]+=1
                changed=True
                # Reinforcement protrudes only from occasional fractures, never a
                # perfectly spaced picket fence along every floor.
                for index in rng.sample(list(range(2,len(profile)-2)),3):
                    x,y=profile[index]
                    z=(lo[2]+hi[2])/2
                    reach=rng.uniform(.23,.64)
                    a=(x+side*.17,y,z)
                    elbow=(x-side*reach*.66,y+rng.uniform(-.12,.12),z+rng.uniform(-.06,.07))
                    end=(x-side*reach,y+rng.uniform(-.19,.19),z+rng.uniform(-.25,.19))
                    rebar.rod(a,elbow,.014)
                    rebar.rod(elbow,end,.012,end_radius=.009)
                    if rng.random()<.38:
                        rebar.rod((x+side*.05,y-.23,z),(x+side*.02,y+.20,z+.018),.011)
                # A few stones in the exposed thickness read as real aggregate.
                for index in (2,4,6,8):
                    x,y=profile[index]
                    aggregate.shard((x-side*.009,y,rng.uniform(lo[2]+.025,hi[2]-.075)),
                                    (.055,.09,.065),rng,0,4)
            elif in_hero and dims[0]>3.8 and dims[1]<.55 and .7<dims[2]<3.4 and floor>=highest:
                vs,fs,tops=_wall_fracture(lo,hi,rng)
                batch.add(vs,fs)
                counts["fractured_top_walls"]+=1
                changed=True
                for index in (2,5):
                    x,z=tops[index]
                    a=(x,center[1],z-.04)
                    b=(x+rng.uniform(-.05,.05),center[1],z+rng.uniform(.16,.36))
                    c=(b[0]+rng.uniform(-.17,.17),b[1]+rng.uniform(-.09,.09),b[2]+rng.uniform(.08,.27))
                    rebar.rod(a,b,.014)
                    rebar.rod(b,c,.012)
            else:
                batch.add(verts,faces)
        if changed:
            planned.append((obj,batch))
            old_faces+=len(obj.data.polygons)
            new_faces+=len(batch.faces)
    # Sparse secondary room structure and exposed utilities give the street
    # facades depth. Each building gets a different amount of surviving detail.
    for side in (-1,1):
        for building_y in (-24.,-14.,-4.,6.,16.,26.):
            highest=top_floors.get((side,building_y),2)
            limit=min(highest,3)
            for level in range(1,limit+1):
                if rng.random()<.27:
                    continue
                z=level*3.15+.40
                yy=building_y+rng.uniform(-1.8,1.8)
                x=side*rng.uniform(10.55,11.45)
                interiors.box((x,yy,z+1.17),(.19,.24,2.34),1)
                interiors.box((side*11.17,yy,z+2.37),(2.38,.18,.19),1,
                              tilt=(0,side*rng.uniform(-.06,.06)))
                # Stacked irregularly missing infill bricks, kept inside frames.
                if level<=2 and rng.random()<.73:
                    for row in range(rng.randint(2,4)):
                        for col in range(4-row//2):
                            if rng.random()<.22:
                                continue
                            y=yy-.7+col*.35+(row%2)*.15
                            interiors.box((side*9.62,y,z+.11+row*.20),(.23,.33,.175),2,
                                          yaw=rng.uniform(-.025,.025))
            if rng.random()<.68:
                yy=building_y+2.9
                x=side*9.54
                zmax=min(9.0,highest*3.15+rng.uniform(.6,1.5))
                rebar.rod((x,yy,.42),(x,yy,zmax*.66),.032,sides=8)
                rebar.rod((x,yy,zmax*.66),(x-side*.18,yy+.13,zmax),.030,sides=8)
                for z in (1.1,3.3,5.6):
                    if z<zmax:
                        rebar.rod((x,yy,z),(x+side*.27,yy,z),.017)
    # Clustered scales: gravel, brick chips, thin plaster and occasional larger
    # angular fragments. The strip immediately around the tank stays clear.
    for side in (-1,1):
        for k in range(14):
            cy=-32.+k*4.05+rng.uniform(-.9,.9)
            cx=side*rng.uniform(6.15,7.70)
            counts["curb_gravel_clusters"]+=1
            for j in range(rng.randint(22,36)):
                x=cx+rng.gauss(0,.34)
                y=cy+rng.gauss(0,.67)
                x=side*min(8.65,max(5.12,abs(x)))
                size=rng.uniform(.035,.14)
                ground = .137 if abs(x) > 7.90 else (.312 if abs(x) >= 7.67 else -.011)
                aggregate.shard((x,y,ground),(size*rng.uniform(.7,1.5),size,size*rng.uniform(.38,.85)),
                                rng,rng.choices([0,1,2,3],[5,3,2,1])[0],4 if size<.09 else 5)
            for j in range(rng.randint(3,6)):
                x=side*rng.uniform(6.6,8.4)
                y=cy+rng.uniform(-1.,1.)
                size=rng.uniform(.14,.32)
                ground = .137 if abs(x) > 7.90 else (.312 if abs(x) >= 7.67 else .014)
                aggregate.shard((x,y,ground),(size*rng.uniform(.6,1.6),size,size*rng.uniform(.27,.73)),
                                rng,0 if rng.random()<.66 else 2,5)
            # Low debris-dust accumulation, not an artificial smooth dirt mound.
            if k%2==0:
                aggregate.shard((side*rng.uniform(7.08,7.55),cy,-.018),
                                (rng.uniform(.30,.60),rng.uniform(.6,1.15),rng.uniform(.035,.068)),rng,1,7)
        # A few fallen rods/wood-like charred fragments among curb rubble.
        for k in range(16):
            x=side*rng.uniform(6.8,8.7)
            y=rng.uniform(-30.,25.)
            end_x=x+rng.uniform(-.45,.45)
            start_z=.345 if abs(x)>=7.60 else .08
            end_z=.345 if abs(end_x)>=7.60 else .055
            rebar.rod((x,y,start_z),(end_x,y+rng.uniform(.6,1.8),end_z),
                      rng.uniform(.014,.027),sides=5)
    # Flush fragmented centre paint has metre-scale cadence, fine chips and large
    # missing sections. Existing dark guide-strip geometry is left unchanged.
    for cy in range(-32,25,5):
        for j in range(10):
            if rng.random()<.43:
                continue
            y=cy+j*.14
            width=rng.uniform(.035,.095)
            x=rng.uniform(-.026,.026)
            road.add([(x-width/2,y,.018),(x+width/2,y+rng.uniform(-.015,.015),.018),
                      (x+width*.44,y+.105,.018),(x-width*.42,y+.13,.018)],[(0,1,2,3)],0)
    # Branching broad-scale cracks complement the material's microcracks. All
    # lie nearly flush, outside the tank tread band and outside the impact area.
    for side in (-1,1):
        for k in range(13):
            x=side*rng.uniform(3.15,6.30)
            y=rng.uniform(-31.,21.)
            points=[(x,y,.009)]
            angle=rng.uniform(-math.pi,math.pi)
            for j in range(rng.randint(3,6)):
                angle+=rng.uniform(-.65,.65)
                step=rng.uniform(.22,.46)
                x+=math.cos(angle)*step
                y+=math.sin(angle)*step
                x=side*max(2.7,min(6.9,abs(x)))
                points.append((x,y,.009))
            road.ribbon(points,rng.uniform(.014,.031),1)
            counts["road_crack_chains"]+=1
            split=points[len(points)//2]
            branch=[split,(split[0]+side*.24,split[1]-.17,.010),
                    (split[0]+side*.38,split[1]-.44,.010)]
            road.ribbon(branch,.009,1)
    # Existing road top is -0.025 m; these details rise only a few centimetres.
    for side in (-1,1):
        for y in (-22.,-2.,18.):
            x=side*7.47
            drains.box((x,y,.008),(.34,.82,.044),1)
            for offset in (-.16,.16):
                drains.box((x+offset,y,.041),(.028,.82,.025),0)
            for j in range(11):
                drains.box((x,y-.37+j*.074,.043),(.31,.027,.022),0)
    drains.rod((4.75,-8.,-.018),(4.75,-8.,.012),.34,1,sides=24)
    for j in range(7):
        off=(j-3)*.073
        half=math.sqrt(max(0,.28*.28-off*off))
        drains.box((4.75+off,-8.,.020),(.014,half*2,.008),0)
    _add_wreck(wrecks,8.79,-10.2,-.10,rng)
    _add_wreck(wrecks,-8.73,10.8,.075,rng)
    periphery_batches,periphery_report=_make_periphery(bpy)
    batches.update(periphery_batches)
    district_batches,district_report=_make_far_district(bpy)
    batches.update(district_batches)
    counts["far_cross_street_masses"]=district_report["building_masses"]
    counts["far_skyline_depth_shift_m"]=55.
    counts["far_skyline_vertical_scale"]=.65
    counts["background_building_silhouettes"]=periphery_report["building_silhouettes"]
    counts["ground_continuation_slabs"]=1
    # Validate bounded cost before any destructive/scene-level mutation.
    added_faces=sum(len(batch.faces) for batch in batches.values())+new_faces-old_faces
    added_triangles=sum(sum(max(1,len(face)-2) for face in batch.faces) for batch in batches.values())
    added_triangles+=sum(sum(max(1,len(face)-2) for face in batch.faces) for _,batch in planned)-old_faces*2
    if added_faces>42000 or added_triangles>72000:
        raise RuntimeError("Environment geometry budget exceeded before commit: %s faces, %s triangles" % (added_faces,added_triangles))
    collection=bpy.data.collections.new(COLLECTION_NAME)
    scene.collection.children.link(collection)
    for obj,batch in planned:
        old_mesh=obj.data
        replacement=bpy.data.meshes.new(old_mesh.name+" / V5 chipped silhouette")
        replacement.from_pydata(batch.vertices,[],batch.faces)
        for material in batch.materials:
            replacement.materials.append(material)
        replacement.update()
        obj.data=replacement
        obj["environment_revision"]=REVISION
        if old_mesh.users==0:
            bpy.data.meshes.remove(old_mesh)
        counts["edited_city_meshes"]+=1
    created=[]
    for batch in batches.values():
        obj=batch.emit(bpy,collection)
        if obj:
            created.append(obj.name)
    report={"revision":REVISION,"seed":_SEED,"added_objects":len(created),
            "added_polygons":added_faces,"added_triangles_estimate":added_triangles,
            "detail_vertices":sum(len(batch.vertices) for batch in batches.values()),
            "material_nodes_changed":0,"animation_changed":False,
            "minimum_new_raised_road_detail_abs_x":4.41,
            "hero_corridor_y":[-37,31],"changes":counts,"objects":created,
            "periphery":periphery_report,"far_cross_street":district_report}
    scene["environment_geometry_revision"]=REVISION
    scene["environment_geometry_report"]=json.dumps(report,sort_keys=True)
    return report
