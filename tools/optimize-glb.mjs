// Optimize a heavy AI-generated .glb for web/map use:
// weld → simplify (decimate) → prune/dedup → assign stone colour → Draco compress.
// Usage: node tools/optimize-glb.mjs <input.glb> <output.glb> [ratio]
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from "@gltf-transform/extensions";
import { weld, simplify, prune, dedup } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import draco3d from "draco3dgltf";

const [input, output, ratioArg] = process.argv.slice(2);
const ratio = ratioArg ? parseFloat(ratioArg) : 0.12;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });

const doc = await io.read(input);
await MeshoptSimplifier.ready;

// count tris before
function triCount(d) {
  let t = 0;
  d.getRoot().listMeshes().forEach((m) =>
    m.listPrimitives().forEach((p) => {
      const idx = p.getIndices();
      if (idx) t += idx.getCount() / 3;
      else { const pos = p.getAttribute("POSITION"); if (pos) t += pos.getCount() / 3; }
    })
  );
  return Math.round(t);
}
const before = triCount(doc);

await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.003 }),
  prune(),
  dedup()
);

// Give the (texture-less) mesh a warm limestone colour so it reads as stone.
doc.getRoot().listMaterials().forEach((mat) => {
  mat.setBaseColorFactor([0.82, 0.78, 0.68, 1.0]);
  mat.setMetallicFactor(0.0);
  mat.setRoughnessFactor(0.9);
});

// Draco compression on write.
doc.createExtension(KHRDracoMeshCompression)
  .setRequired(true)
  .setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER, quantizationVolume: "mesh" });

await io.write(output, doc);
const after = triCount(doc);
console.log("triangles:", before, "→", after, "(ratio " + ratio + ")");
console.log("wrote", output);
