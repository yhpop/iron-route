# Minimal local reproduction inputs

These are unchanged bytes copied from the frozen, already-acquired structure
source audit. The packed recovered Blender file is an adapter containing the
original LFA meshes, both OBJ UV sets and the original two-image multiply
material. It is opened with `--disable-autoexec`; no embedded script executes.
The two original OBJ files, two BMP maps, CC0 concrete image, and previously
saved primary attribution/license pages are included independently.

Run from the candidate root, with Blender 4.3.2 already installed:

    blender --background --disable-autoexec originals/ruined-depot/evidence/lfa-recovered-two-uv-audit.blend --python evidence/ruined-depot/asset/author_ruins.py

All input reads are package-relative. The script overwrites only Task1 asset
and evidence outputs. CPU render denoising is disabled because this Blender
build has no OpenImageDenoise support. The initial failed attempt is retained.
No install, network, external DCC script execution or original-file mutation.
