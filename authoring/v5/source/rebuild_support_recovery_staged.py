"""Reconstruct the support correction as a NEW, unapproved recovery identity.

This is an additive recovery helper, not a replacement for the pinned historical
builders. It never renders, freezes production, creates approvals, imports old
frames, edits input files, or takes the production render lock. Run only when no
render is active and the operator has arranged exclusive Blender use. All output
must go to a newly created directory outside this preserved project.

Use ordinary Python with --check-only for a read-only preflight. Actual rebuilding
requires Blender 4.3.2, --python-exit-code 1, and arguments following --.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
SOURCE = Path(__file__).resolve().parents[2] / 'tank_quality_v5_20261004/revision_v5_1_20261004/source'
PRESERVED_PROJECT = SOURCE.parent.parent
RECIPE_HASHES = {
    "apply_sandbag_support_v5_1.py": "5491641006911fbb4f56f17b252db681a6404d99f7730f1d90110ad2186ecca8",
    "apply_sandbag_support_v5_1_r2.py": "c8e6362c597b2524018aa2fe4d54c935c2c719e38a1996c76ca0468a8dfcf29c",
}
GEAR_HASH = "2b80dec2baeb0d3c42bfb1efc14c82a996155cf22a4106a097e60fd9cedda4af"
ORIGINAL_SHA = "5a0034ec68847611c8e5ac9570d34b324d93786366bc181474c7db230fc991e5"
HISTORICAL_REVISION_SHA = "cf98e1f584da96adf541721fbae4aeea71fd6fd0e4743a47197e5a7f26397c50"


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def save_json(path, value):
    # Exclusive creation protects previous recovery output even after a crash.
    with Path(path).open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(value, indent=2, sort_keys=True) + "\n")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--input-sha256", required=True)
    parser.add_argument("--input-review", type=Path, required=True)
    parser.add_argument("--input-review-sha256", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--check-only", action="store_true")
    if argv is None:
        argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def preflight(args):
    source = args.input.resolve(strict=True)
    review_path = args.input_review.resolve(strict=True)
    output = args.output_dir.resolve()
    require(source.is_file() and source.suffix == ".blend", "Input must be a reviewed V5 .blend")
    require(not args.output_dir.is_symlink(), "Output directory cannot be a symlink")
    require(not output.exists(), "Output directory already exists; choose a fresh recovery directory")
    require(output.parent.is_dir(), "Output parent directory must already exist")
    require(not output.is_relative_to(PRESERVED_PROJECT), "Output must be outside the preserved project")
    require(not source.is_relative_to(output), "Output cannot contain the input")
    require(not review_path.is_relative_to(output), "Output cannot contain the input review")
    for value in (args.input_sha256, args.input_review_sha256):
        require(len(value) == 64 and all(c in "0123456789abcdef" for c in value), "Require lowercase SHA256")
    require(sha256(source) == args.input_sha256, "Actual input SHA256 does not match explicit input pin")
    require(sha256(review_path) == args.input_review_sha256, "Actual input review SHA256 differs")
    review = json.loads(review_path.read_text(encoding="utf-8"))
    require(review.get("source_sha256") == args.input_sha256, "Visual review is bound to another input")
    historical = (
        args.input_sha256 == ORIGINAL_SHA
        and review.get("status") == "production_source_frozen_pending_motion_and_final_film_validation"
        and args.input_review_sha256 == "835c74ecba9509f0e5f404f78c5ca03fb68b0191a360809188fe40ac9269029e"
    )
    fresh = (review.get("approved") is True and review.get("status") == "approved_for_support_reconstruction"
             and review.get("production_freeze_approved") is False
             and review.get("intended_corrections") == ["upper_and_lower_sandbag_support"])
    require(historical or fresh, "Require an actual six-shot input review scoped to sandbag-support reconstruction; this does not authorize production freeze")
    require(review.get("frames_visually_reviewed") == [60, 193, 324, 445, 523, 660], "Review must cover six V5 stills")
    require(len(review.get("observations", [])) >= 6, "Review must contain actual six-shot findings")
    require(not review.get("unresolved_blockers", []), "Input review has unresolved blockers")
    dependencies = {}
    for name, expected in RECIPE_HASHES.items():
        path = SOURCE / name
        require(sha256(path) == expected, "Support recipe has changed: " + name)
        dependencies[str(path)] = expected
    gear = PRESERVED_PROJECT / "source" / "improve_running_gear.py"
    require(sha256(gear) == GEAR_HASH, "Parent running-gear validator dependency differs")
    dependencies[str(gear)] = GEAR_HASH
    return source, review_path, output, dependencies


def full_timeline(bpy, gear, source_hash):
    """Same 720-frame checks as validate_scene_v5_1.py, with explicit output binding."""
    scene = bpy.context.scene
    require(bpy.app.version_string == "4.3.2", "Blender 4.3.2 is required")
    require((scene.frame_start, scene.frame_end) == (1, 720), "Expected all 720 timeline frames")
    require(scene.render.engine == "BLENDER_EEVEE_NEXT", "Expected Eevee Next")
    require((scene.render.resolution_x, scene.render.resolution_y,
             scene.render.resolution_percentage, scene.render.fps,
             scene.render.fps_base) == (1280, 720, 100, 24, 1), "Native 720p24 is required")
    require(scene.eevee.taa_render_samples == 96 and scene.eevee.use_raytracing,
            "Expected 96 samples and ray tracing")
    require(scene.eevee.ray_tracing_options.resolution_scale == "1"
            and not scene.eevee.ray_tracing_options.denoise_temporal,
            "Expected full ray tracing resolution and temporal denoise disabled")
    markers = sorted(m.frame for m in scene.timeline_markers if m.camera)
    require(markers == [1, 121, 265, 385, 505, 601], "Shot boundaries differ")
    packed = [image for image in bpy.data.images if image.packed_file
              and image.name.startswith(("worn_asphalt", "damaged_concrete_floor"))]
    require(len(packed) == 6, "Expected six packed scanned textures")
    root = bpy.data.objects["TANK / animated motion controller"]
    links = sorted((o for o in scene.objects if o.name.startswith("Tread link ")), key=lambda o: o.name)
    require(len(links) == 112, "Expected 112 tread links")
    worst = 0.0
    invalid = set()
    stopped = []
    for frame in range(1, 721):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        travel = root.location.y
        for obj in links:
            index = int(obj.name.rsplit(" ", 1)[1])
            expected = gear.belt_path((index * gear.LENGTH / gear.LINKS_PER_SIDE - (travel + 20)) % gear.LENGTH)
            error = max(abs(obj.location.y - expected[0]), abs(obj.location.z - expected[1]),
                        abs(math.sin(obj.rotation_euler.x) - math.sin(expected[2])),
                        abs(math.cos(obj.rotation_euler.x) - math.cos(expected[2])))
            worst = max(worst, error)
            require(error <= 2e-5, f"Tread geometry failed: frame {frame}, {obj.name}, {error}")
        for obj in scene.objects:
            if obj.animation_data:
                invalid.update((obj.name, curve.data_path, curve.array_index)
                               for curve in obj.animation_data.drivers if not curve.driver.is_valid)
            require(all(math.isfinite(float(value)) for row in obj.matrix_world for value in row),
                    f"Nonfinite transform at {frame}: {obj.name}")
        if 481 <= frame <= 600:
            stopped.append([travel] + [float(obj["belt_position"]) for obj in links])
    require(not invalid, "Invalid drivers: " + repr(sorted(invalid)))
    for column in range(113):
        require(max(row[column] for row in stopped) - min(row[column] for row in stopped) < 1e-6,
                "Stopped interval moved")
    scene.frame_set(1)
    return {"source_sha256": source_hash, "blender_version": bpy.app.version_string,
            "timeline_frames_checked": 720, "tread_links_checked_per_frame": 112,
            "max_driver_geometry_error": worst, "invalid_drivers": [],
            "stop_frames_checked": [481, 600], "shot_starts": markers, "packed_scans": 6,
            "native_resolution": [1280, 720], "fps": 24, "render_samples": 96,
            "raytracing_resolution": "1", "temporal_denoise": False}


def save_new_blend(bpy, path):
    require(not path.exists(), "Refusing to replace any Blender output: " + str(path))
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(path), check_existing=True)
    require(path.is_file(), "Blender did not save output")
    return sha256(path)


def rebuild(args):
    source, review, output, dependencies = preflight(args)
    if args.check_only:
        print(json.dumps({"read_only_preflight": "passed", "input_sha256": args.input_sha256,
                          "proposed_output": str(output), "dependencies": dependencies,
                          "blender_not_started": True, "no_output_written": True}, indent=2))
        return

    import bpy
    require(bpy.app.version_string == "4.3.2", "Blender 4.3.2 is required")
    sys.path.insert(0, str(PRESERVED_PROJECT / "source"))
    sys.path.insert(0, str(SOURCE))
    upper = importlib.import_module("apply_sandbag_support_v5_1")
    lower = importlib.import_module("apply_sandbag_support_v5_1_r2")
    gear = importlib.import_module("improve_running_gear")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    require(upper.TAG not in bpy.context.scene and lower.TAG not in bpy.context.scene,
            "Input already has support tags; provide the reviewed unmodified V5 input")
    output.mkdir(exist_ok=False)
    qa = output / "qa"
    qa.mkdir(exist_ok=False)
    save_json(output / "RECOVERY_INPUT.json", {
        "status": "new_identity_reconstruction_started_not_approved",
        "input_path": str(source), "input_sha256": args.input_sha256,
        "input_review": str(review), "input_review_sha256": args.input_review_sha256,
        "recipe_dependencies": dependencies, "helper_sha256": sha256(__file__),
        "historical_identity_is_not_promised": True, "rendered": False})

    save_json(qa / "input_full_timeline.json", full_timeline(bpy, gear, args.input_sha256))
    save_json(qa / "baseline_support_geometry.json", upper.audit_timeline(bpy, False, [509, 550, 600, 720]))
    save_json(qa / "upper_patch.json", upper.apply_sandbag_support(bpy))
    integer_qa = upper.audit_timeline(bpy, True, range(1, 721))
    subframes = [frame + sub for frame in range(510, 541) for sub in (0.25, 0.5, 0.75)]
    subframe_qa = upper.audit_timeline(bpy, True, subframes)
    save_json(qa / "upper_timeline.json", integer_qa)
    save_json(qa / "upper_subframes.json", subframe_qa)
    require(integer_qa["changed_objects_pass"] and subframe_qa["changed_objects_pass"],
            "Upper support QA failed; no candidate saved")
    intermediate = output / "Recovery_Upper_Support.blend"
    intermediate_hash = save_new_blend(bpy, intermediate)

    # Reopen the actual new intermediate, preserving the historical stage boundary.
    # Its true hash is recorded, never compared to or relabeled as historical f227.
    bpy.ops.wm.open_mainfile(filepath=str(intermediate))
    allowed = lower.capture_inherited_soft_contacts(bpy)
    save_json(qa / "lower_patch.json", lower.apply_lower_support(bpy))
    subframes = [frame + sub for frame in range(510, 561) for sub in (0.25, 0.5, 0.75)]
    integer_qa = lower.validate_all_bags(bpy, allowed, range(1, 721))
    subframe_qa = lower.validate_all_bags(bpy, allowed, subframes)
    save_json(qa / "support_timeline.json", integer_qa)
    save_json(qa / "support_subframes.json", subframe_qa)
    require(integer_qa["all33_pass_except_named_baseline_soft_seating"]
            and subframe_qa["all33_pass_except_named_baseline_soft_seating"], "Lower support QA failed")
    candidate = output / "Recovery_V5_1_Candidate.blend"
    candidate_hash = save_new_blend(bpy, candidate)
    bpy.ops.wm.open_mainfile(filepath=str(candidate))
    before = upper.invariant_snapshot(bpy)
    require(lower.apply_lower_support(bpy) == json.loads(bpy.context.scene["v5_1_lower_bag_support_report"]),
            "Reloaded lower report differs")
    require(before == upper.invariant_snapshot(bpy), "Reload idempotence failed")
    reload_integer = lower.validate_all_bags(bpy, allowed, range(1, 721))
    reload_subframes = lower.validate_all_bags(bpy, allowed, subframes)
    save_json(qa / "reloaded_support_timeline.json", reload_integer)
    save_json(qa / "reloaded_support_subframes.json", reload_subframes)
    require(reload_integer["all33_pass_except_named_baseline_soft_seating"]
            and reload_subframes["all33_pass_except_named_baseline_soft_seating"], "Reloaded support QA failed")
    save_json(qa / "V5_full_timeline_validation.json", full_timeline(bpy, gear, candidate_hash))
    require(sha256(source) == args.input_sha256, "Input changed during recovery")
    require(sha256(review) == args.input_review_sha256, "Input review changed during recovery")
    require(sha256(intermediate) == intermediate_hash, "Intermediate changed during recovery")
    require(sha256(candidate) == candidate_hash, "Candidate changed during validation")
    for path, expected in dependencies.items():
        require(sha256(path) == expected, "Recipe dependency changed during recovery")
    report = {
        "status": "reconstructed_geometry_checked_new_visual_QA_required",
        "input_sha256": args.input_sha256, "intermediate_sha256": intermediate_hash,
        "candidate_sha256": candidate_hash, "candidate_path": str(candidate),
        "matches_historical_revision_bytes": candidate_hash == HISTORICAL_REVISION_SHA,
        "rendered": False, "production_frozen": False, "approved": False,
        "old_frames_imported": 0, "reload_idempotence_verified": True,
        "integer_frames_checked_per_support_stage": 720,
        "upper_subframes_checked": 93, "lower_subframes_checked": 153,
        "all33_support_pass_except_named_baseline_soft_seating": True,
        "new_visual_review_required": True, "impact_motion_review_required": True,
        "full_film_and_audio_review_required": True,
        "historical_approvals_must_not_be_rebound": True,
        "qa_files": [{"path": str(path.relative_to(output)), "bytes": path.stat().st_size,
                      "sha256": sha256(path)} for path in sorted(qa.glob("*.json"))],
    }
    save_json(output / "RECOVERY_RESULT.json", report)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    rebuild(parse_args())
