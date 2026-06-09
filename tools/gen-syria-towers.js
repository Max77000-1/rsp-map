// Procedural massing-model generator for the Syria Towers Complex (Baramkeh).
// Builds a clean, brand-coloured .glb: twin towers on a podium, a horseshoe of
// lower perimeter blocks, a circular plaza and a central fountain.
// glTF is Y-up; the map's custom layer rotates Y-up -> Z-up automatically.
// Model is built at real-world metres; set CMS "Model Height (m)" ~= 102.
const fs = require("fs");
const path = require("path");

// ---- brand palette (sRGB 0..1) -------------------------------
const MAT = {
  glass:  { color: [0.60, 0.77, 0.79, 1.0], metallic: 0.15, roughness: 0.25 }, // #99C5CB pale teal
  stone:  { color: [0.90, 0.91, 0.93, 1.0], metallic: 0.00, roughness: 0.85 }, // #E5E9ED neutral light
  navy:   { color: [0.18, 0.31, 0.46, 1.0], metallic: 0.10, roughness: 0.55 }, // #2E5077 primary navy
  teal:   { color: [0.30, 0.63, 0.66, 1.0], metallic: 0.20, roughness: 0.30 }, // #4DA1A9 primary teal
  plaza:  { color: [0.97, 0.97, 0.97, 1.0], metallic: 0.00, roughness: 0.95 }, // #F7F7F7
  green:  { color: [0.37, 0.75, 0.49, 1.0], metallic: 0.00, roughness: 0.90 }  // #5FBF7C landscaping
};

// per-material geometry accumulators
const G = {};
Object.keys(MAT).forEach(k => { G[k] = { pos: [], nrm: [], idx: [], v: 0 }; });

function pushTri(g, a, b, c) { g.idx.push(a, b, c); }
function vert(g, p, n) { g.pos.push(p[0], p[1], p[2]); g.nrm.push(n[0], n[1], n[2]); return g.v++; }

function box(matKey, cx, cy, cz, sx, sy, sz) {
  const g = G[matKey];
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const faces = [
    { n: [ 1, 0, 0], c: [[hx,-hy,-hz],[hx, hy,-hz],[hx, hy, hz],[hx,-hy, hz]] },
    { n: [-1, 0, 0], c: [[-hx,-hy, hz],[-hx, hy, hz],[-hx, hy,-hz],[-hx,-hy,-hz]] },
    { n: [ 0, 1, 0], c: [[-hx, hy,-hz],[-hx, hy, hz],[ hx, hy, hz],[ hx, hy,-hz]] },
    { n: [ 0,-1, 0], c: [[-hx,-hy,-hz],[ hx,-hy,-hz],[ hx,-hy, hz],[-hx,-hy, hz]] },
    { n: [ 0, 0, 1], c: [[-hx,-hy, hz],[ hx,-hy, hz],[ hx, hy, hz],[-hx, hy, hz]] },
    { n: [ 0, 0,-1], c: [[ hx,-hy,-hz],[-hx,-hy,-hz],[-hx, hy,-hz],[ hx, hy,-hz]] }
  ];
  for (const f of faces) {
    const base = g.v;
    for (const corner of f.c) vert(g, [corner[0] + cx, corner[1] + cy, corner[2] + cz], f.n);
    pushTri(g, base, base + 1, base + 2);
    pushTri(g, base, base + 2, base + 3);
  }
}

function cylinder(matKey, cx, cy, cz, radius, height, segments) {
  const g = G[matKey];
  const hy = height / 2, seg = segments || 40;
  // side
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const x0 = Math.cos(a0), z0 = Math.sin(a0), x1 = Math.cos(a1), z1 = Math.sin(a1);
    const b = g.v;
    vert(g, [cx + x0 * radius, cy - hy, cz + z0 * radius], [x0, 0, z0]);
    vert(g, [cx + x0 * radius, cy + hy, cz + z0 * radius], [x0, 0, z0]);
    vert(g, [cx + x1 * radius, cy + hy, cz + z1 * radius], [x1, 0, z1]);
    vert(g, [cx + x1 * radius, cy - hy, cz + z1 * radius], [x1, 0, z1]);
    pushTri(g, b, b + 1, b + 2); pushTri(g, b, b + 2, b + 3);
  }
  // top + bottom caps
  for (const [yy, ny, flip] of [[cy + hy, 1, false], [cy - hy, -1, true]]) {
    const center = vert(g, [cx, yy, cz], [0, ny, 0]);
    const ring = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      ring.push(vert(g, [cx + Math.cos(a) * radius, yy, cz + Math.sin(a) * radius], [0, ny, 0]));
    }
    for (let i = 0; i < seg; i++) {
      const a = ring[i], bb = ring[(i + 1) % seg];
      if (flip) pushTri(g, center, bb, a); else pushTri(g, center, a, bb);
    }
  }
}

// ============ THE MASSING ============
// XZ plane is ground; +Y is up. Plaza toward +Z (front), towers toward -Z (back).

// Podium under the towers
box("stone", 0, 6, -32, 92, 12, 54);
box("navy",  0, 12.4, -32, 94, 1.2, 56); // podium roof band

// Twin towers (curved-slab impression via two tall splayed slabs)
box("glass", -19, 12 + 45, -34, 26, 90, 30);
box("glass",  19, 12 + 45, -34, 26, 90, 30);
// tower crowns
box("navy", -19, 12 + 90 + 1, -34, 27, 2, 31);
box("navy",  19, 12 + 90 + 1, -34, 27, 2, 31);
// connecting lobby between towers
box("teal", 0, 12 + 9, -30, 14, 18, 26);

// Perimeter lower blocks (horseshoe around the plaza)
function block(cx, cz, sx, sz) {
  box("stone", cx, 12.5, cz, sx, 25, sz);
  box("navy",  cx, 25.3, cz, sx + 1, 1.2, sz + 1); // roof band
}
block(-72, 6,  42, 42);   // left block
block( 72, 6,  42, 42);   // right block
block(-34, 56, 52, 24);   // front-left arcade
block( 34, 56, 52, 24);   // front-right arcade

// Central circular plaza + fountain
cylinder("plaza", 0, 0.3, 22, 40, 0.6, 48);
cylinder("teal",  0, 0.7, 22, 11, 1.2, 40);

// A few landscaping strips for life
box("green", -38, 0.4, 30, 6, 0.8, 26);
box("green",  38, 0.4, 30, 6, 0.8, 26);
box("green",   0, 0.4, 46, 30, 0.8, 6);

// ============ ASSEMBLE GLB ============
const buffers = [];      // {data: Buffer, target: number}
const accessors = [];
const bufferViews = [];
const meshPrimitives = [];
const materials = [];

let byteOffset = 0;
const matKeys = Object.keys(G).filter(k => G[k].v > 0);

matKeys.forEach((k, mi) => {
  const g = G[k];
  // POSITION
  const posArr = Float32Array.from(g.pos);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < g.pos.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const val = g.pos[i + j];
      if (val < min[j]) min[j] = val;
      if (val > max[j]) max[j] = val;
    }
  }
  const posBuf = Buffer.from(posArr.buffer, posArr.byteOffset, posArr.byteLength);
  bufferViews.push({ buffer: 0, byteOffset, byteLength: posBuf.length, target: 34962 });
  const posBV = bufferViews.length - 1; buffers.push(posBuf); byteOffset += posBuf.length;
  accessors.push({ bufferView: posBV, componentType: 5126, count: g.v, type: "VEC3", min, max });
  const posAcc = accessors.length - 1;

  // NORMAL
  const nrmArr = Float32Array.from(g.nrm);
  const nrmBuf = Buffer.from(nrmArr.buffer, nrmArr.byteOffset, nrmArr.byteLength);
  bufferViews.push({ buffer: 0, byteOffset, byteLength: nrmBuf.length, target: 34962 });
  const nrmBV = bufferViews.length - 1; buffers.push(nrmBuf); byteOffset += nrmBuf.length;
  accessors.push({ bufferView: nrmBV, componentType: 5126, count: g.v, type: "VEC3" });
  const nrmAcc = accessors.length - 1;

  // INDICES (Uint32)
  const idxArr = Uint32Array.from(g.idx);
  const idxBuf = Buffer.from(idxArr.buffer, idxArr.byteOffset, idxArr.byteLength);
  bufferViews.push({ buffer: 0, byteOffset, byteLength: idxBuf.length, target: 34963 });
  const idxBV = bufferViews.length - 1; buffers.push(idxBuf); byteOffset += idxBuf.length;
  accessors.push({ bufferView: idxBV, componentType: 5125, count: g.idx.length, type: "SCALAR" });
  const idxAcc = accessors.length - 1;

  const m = MAT[k];
  materials.push({
    name: k,
    doubleSided: true,
    pbrMetallicRoughness: {
      baseColorFactor: m.color,
      metallicFactor: m.metallic,
      roughnessFactor: m.roughness
    }
  });
  meshPrimitives.push({
    attributes: { POSITION: posAcc, NORMAL: nrmAcc },
    indices: idxAcc,
    material: mi,
    mode: 4
  });
});

const binBuffer = Buffer.concat(buffers);
const gltf = {
  asset: { version: "2.0", generator: "RSP procedural massing generator" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: "syria-towers-massing" }],
  meshes: [{ primitives: meshPrimitives }],
  materials,
  accessors,
  bufferViews,
  buffers: [{ byteLength: binBuffer.length }]
};

// JSON chunk (pad to 4 with spaces)
let jsonStr = JSON.stringify(gltf);
while (jsonStr.length % 4 !== 0) jsonStr += " ";
const jsonBuf = Buffer.from(jsonStr, "utf8");
// BIN chunk (pad to 4 with zeros)
let binPad = binBuffer;
if (binPad.length % 4 !== 0) {
  binPad = Buffer.concat([binPad, Buffer.alloc(4 - (binPad.length % 4))]);
}

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546C67, 0); // "glTF"
header.writeUInt32LE(2, 4);
const total = 12 + 8 + jsonBuf.length + 8 + binPad.length;
header.writeUInt32LE(total, 8);

const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonBuf.length, 0);
jsonHeader.writeUInt32LE(0x4E4F534A, 4); // "JSON"

const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binPad.length, 0);
binHeader.writeUInt32LE(0x004E4942, 4); // "BIN\0"

const glb = Buffer.concat([header, jsonHeader, jsonBuf, binHeader, binPad]);
const outDir = path.join(__dirname, "..", "assets", "models");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "syria-towers-massing.glb");
fs.writeFileSync(outFile, glb);

// report
let bbox = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
matKeys.forEach(k => {
  const g = G[k];
  for (let i = 0; i < g.pos.length; i += 3)
    for (let j = 0; j < 3; j++) {
      if (g.pos[i + j] < bbox.min[j]) bbox.min[j] = g.pos[i + j];
      if (g.pos[i + j] > bbox.max[j]) bbox.max[j] = g.pos[i + j];
    }
});
console.log("wrote", outFile, "bytes:", glb.length);
console.log("materials:", matKeys.join(", "));
console.log("bbox min:", bbox.min.map(n => n.toFixed(1)));
console.log("bbox max:", bbox.max.map(n => n.toFixed(1)));
console.log("size (m):", [(bbox.max[0]-bbox.min[0]).toFixed(1),(bbox.max[1]-bbox.min[1]).toFixed(1),(bbox.max[2]-bbox.min[2]).toFixed(1)]);
