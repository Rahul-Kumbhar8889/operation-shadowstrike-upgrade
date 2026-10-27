# Original operator study — unapproved visual prototype

**The requested realism quality gate was not met.** This asset is retained as a
static development study and authoring starting point, not a production-ready
or visually approved modern tactical-shooter character.

## Provenance and licensing

All model geometry and embedded artwork were generated specifically for this
project by the included `scripts/build-soldier-prototype.py` and
`scripts/soldier-textures.py`. No downloaded character, anatomy scan, commercial
asset pack, proprietary Project IGI asset, insignia or real military emblem is
included. The camouflage pattern, textile albedo, roughness and tangent-space
normal maps are original deterministic procedural artwork.

No third-party model or texture license/attribution is required for this study.
This statement does not grant permission for future third-party animations or
assets. No new blanket license for the repository is declared here. Blender and
Pillow are authoring tools; Three.js, its loaders and its RoomEnvironment helper
remain software dependencies under their own licenses, not character-art sources.

## Verified exported data

- 31,792 rendered triangles; 21,960 exported vertices including UV/normal splits.
- 8 meshes / 8 material primitives. No unseen duplicate low-poly body embedded.
- 1,367,008-byte GLB, approximately 1.30 MiB, including all texture images.
- 3 original albedo images at 1024², 3 roughness images at 512², and one shared
  tangent-space woven normal image at 512². Albedo is JPEG; data maps are PNG.
- 0 skins, 0 armatures and 0 animation clips. It is **not rigged**.
- Feet remain near y=0; total helmet height is approximately 2.565 existing game
  units. No player root position, scale, collision primitive or firing rule is
  changed to accommodate it.

`metrics.json` is generated during export. The automated test cross-checks its
triangle count and byte size against the actual GLB and verifies the absence of
skins/animations and external image dependencies.

Rebuild from the repository root (Blender 4.3.2, Python 3 and Pillow were used):

    blender -b --python scripts/build-soldier-prototype.py

The exporter may report that its optional Draco library is absent; this asset
does not request Draco and exports as a normal GLB. Textures are embedded and
transfer-compressed, not KTX2 GPU-compressed. There are no LODs or animation rigs.

## Why this is not approved as realistic

The procedural covered face, eyewear, shoulder forms, clothing and soft equipment
still read as stylized mannequin geometry. Textile detail is not a substitute for
an anatomy/cloth sculpt, seam construction, realistic creases and baked detail.
Glove/weapon contact and garment deformation have not been authored. Polygon
count is within the requested range, but does not establish visual quality.

The next useful art work is a sculpt and proportion pass, manual garment and
hand-pose refinement, UV/normal/AO baking and retopology. Only after visual approval
should a tested skeleton, skin weights, locomotion clips and hand IK be added.
