// Bake a yaw rotation (around the up/Y axis) into a .glb, preserving Draco.
// Usage: node tools/rotate-glb.mjs <in.glb> <out.glb> <degrees>
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";

const [input, output, degArg] = process.argv.slice(2);
const deg = parseFloat(degArg || "90");
const rad = (deg * Math.PI) / 180;
const c = Math.cos(rad), s = Math.sin(rad);

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });

const doc = await io.read(input);

// Rotate around Y (vertical): x' = x*c + z*s ; z' = -x*s + z*c ; y unchanged.
function rotateAttr(arr) {
  for (let i = 0; i < arr.length; i += 3) {
    const x = arr[i], z = arr[i + 2];
    arr[i] = x * c + z * s;
    arr[i + 2] = -x * s + z * c;
  }
}

doc.getRoot().listMeshes().forEach((mesh) =>
  mesh.listPrimitives().forEach((prim) => {
    const pos = prim.getAttribute("POSITION");
    if (pos) { const a = pos.getArray().slice(); rotateAttr(a); pos.setArray(a); }
    const nrm = prim.getAttribute("NORMAL");
    if (nrm) { const a = nrm.getArray().slice(); rotateAttr(a); nrm.setArray(a); }
  })
);

doc.createExtension(KHRDracoMeshCompression)
  .setRequired(true)
  .setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER });

await io.write(output, doc);
console.log("rotated", deg, "deg around Y →", output);
