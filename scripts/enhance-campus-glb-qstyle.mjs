/**
 * Q-style (chibi low-poly) campus scenery for public/models/campus.glb.
 * Style reference: warm cream/tan buildings with teal window grids, roof
 * parapets + AC units, plinth bands; orthogonal road network with dashed
 * center lines; trees in roadside rows and green clusters (satellite-style
 * distribution, not uniform random).
 *
 * Invariants (see AGENTS.md):
 *   - never renames/moves/removes PLACE_* or ANCHOR_* nodes
 *   - never edits existing mesh geometry (only material recolors)
 *   - deterministic output (fixed RNG seed)
 *
 * Usage: node scripts/enhance-campus-glb-qstyle.mjs
 */

import { NodeIO } from "@gltf-transform/core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GLB_PATH = join(ROOT, "public", "models", "campus.glb");

// ---------------------------------------------------------------- helpers

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h;
}

function srgbToLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  const out = [];
  for (const shift of [16, 8, 0]) {
    const c = ((n >> shift) & 0xff) / 255;
    out.push(c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  }
  return out;
}

function subVec(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function mat4FromNode(node) {
  const m = node.getMatrix();
  if (m) return Array.from(m);
  const t = node.getTranslation() ?? [0, 0, 0];
  const r = node.getRotation() ?? [0, 0, 0, 1];
  const s = node.getScale() ?? [1, 1, 1];
  const [x, y, z, w] = r;
  const rot = [
    1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y), 0,
    2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x), 0,
    2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1,
  ];
  const out = [];
  for (let c = 0; c < 4; c++) for (let rw = 0; rw < 4; rw++) out[c * 4 + rw] = rot[rw] * s[c];
  out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;
  out[12] = t[0]; out[13] = t[1]; out[14] = t[2];
  return out;
}

function mat4Mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let rw = 0; rw < 4; rw++) {
      o[c * 4 + rw] =
        a[rw] * b[c * 4] + a[4 + rw] * b[c * 4 + 1] + a[8 + rw] * b[c * 4 + 2] + a[12 + rw] * b[c * 4 + 3];
    }
  }
  return o;
}

function transformPoint(m, p) {
  return [0, 1, 2].map((i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]);
}

class MeshBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.indices = [];
  }

  triangle(a, b, c) {
    const n = normalize(cross(subVec(b, a), subVec(c, a)));
    const base = this.positions.length / 3;
    for (const p of [a, b, c]) {
      this.positions.push(...p);
      this.normals.push(...n);
    }
    this.indices.push(base, base + 1, base + 2);
  }

  quad(a, b, c, d) {
    this.triangle(a, b, c);
    this.triangle(a, c, d);
  }

  // axis-aligned box with outward winding
  box(x0, x1, y0, y1, z0, z1) {
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]); // +X
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]); // -X
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]); // +Y
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]); // -Y
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); // +Z
    this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]); // -Z
  }

  get triangleCount() {
    return this.indices.length / 3;
  }
}

// vertical wall quad facing `sign` along `axis`, spanning u/v, protruding outward
function emitWallQuad(b, face, ua, ub, va, vb, protrude) {
  const c = face.c + face.sign * protrude;
  const P = (u, v) => (face.axis === 0 ? [c, v, u] : [u, v, c]);
  const orderA = face.axis === 0 ? face.sign > 0 : face.sign < 0;
  if (orderA) b.quad(P(ua, va), P(ua, vb), P(ub, vb), P(ub, va));
  else b.quad(P(ua, va), P(ub, va), P(ub, vb), P(ua, vb));
}

function distToSegmentXZ(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  if (len2 === 0) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * abx + (pz - az) * abz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

// ---------------------------------------------------------------- palettes

const WALL_PALETTE = ["#f2e3c6", "#e9cfa4", "#f0d9b8", "#e6d6bd", "#f4e8d2", "#eec39a"];
const ROOF_TINT = 1.06;
const GLASS_COLORS = ["#2f8f96", "#3aa7a4"];
const PARAPET_COLOR = "#f7f0e1";
const PLINTH_COLOR = "#b99b78";
const AC_COLOR = "#d8d8d4";
const GRASS_COLOR = "#69a052";
const ROAD_COLOR = "#66625e";
const SIDEWALK_COLOR = "#cfc9bb";
const WALKWAY_COLOR = "#bdb5a4";
const DASH_COLOR = "#f5f2ea";
const TRUNK_COLOR = "#7b5b3a";
const CANOPY_COLORS = ["#57a03e", "#6fb84f"];

const COURT_COLORS = {
  basketball: "#9a5a42",
  tennis: "#46799e",
  badminton: "#4a8f5f",
  baseball: "#5d8a48",
  football: "#4e8a41",
  "ground track field": "#b3653f",
  square: "#d9c9a8",
};

const TREE_SEED = 20260814;

// ---------------------------------------------------------------- load

const io = new NodeIO();
const document = await io.read(GLB_PATH);
const root = document.getRoot();
const scene = root.getDefaultScene();
const buffer = root.listBuffers()[0];

const nodes = root.listNodes();
const parentOf = new Map();
for (const node of nodes) for (const child of node.listChildren()) parentOf.set(child, node);

function worldMatrix(node) {
  const chain = [];
  let cur = node;
  while (cur) {
    chain.push(cur);
    cur = parentOf.get(cur);
  }
  let m = null;
  for (let i = chain.length - 1; i >= 0; i--) {
    const local = mat4FromNode(chain[i]);
    m = m ? mat4Mul(m, local) : local;
  }
  return m;
}

// ---------------------------------------------------------------- scene analysis

const buildings = []; // { name, aabb, primitives: [{faces}] }
const courts = [];
const anchors = [];

for (const node of nodes) {
  const name = node.getName();
  if (name.startsWith("ANCHOR_")) {
    const w = transformPoint(worldMatrix(node), [0, 0, 0]);
    anchors.push({ name, x: w[0], z: w[2] });
    continue;
  }
  if (!name.startsWith("PLACE_")) continue;
  const mesh = node.getMesh();
  if (!mesh) continue;
  const m = worldMatrix(node);
  const id = name.slice("PLACE_".length);
  const courtCategory = Object.keys(COURT_COLORS).find((key) => id.startsWith(key));

  const aabb = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  const primitives = [];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    const arr = pos.getArray();
    const idx = prim.getIndices().getArray();
    // group triangles into axis-aligned faces
    const faces = new Map();
    for (let t = 0; t < idx.length; t += 3) {
      const vs = [0, 1, 2].map((k) => {
        const i = idx[t + k] * 3;
        return transformPoint(m, [arr[i], arr[i + 1], arr[i + 2]]);
      });
      for (const v of vs) {
        aabb.minX = Math.min(aabb.minX, v[0]); aabb.maxX = Math.max(aabb.maxX, v[0]);
        aabb.minZ = Math.min(aabb.minZ, v[2]); aabb.maxZ = Math.max(aabb.maxZ, v[2]);
      }
      const u = subVec(vs[1], vs[0]);
      const w2 = subVec(vs[2], vs[0]);
      const n = normalize(cross(u, w2));
      const ai = Math.abs(n[0]) > 0.7 ? 0 : Math.abs(n[2]) > 0.7 ? 2 : 1;
      const sign = n[ai] >= 0 ? 1 : -1;
      const c = Math.round(vs[0][ai] * 100) / 100;
      const key = `${ai}:${sign}:${c}`;
      if (!faces.has(key)) faces.set(key, { axis: ai, sign, c, verts: [] });
      faces.get(key).verts.push(...vs[0], ...vs[1], ...vs[2]);
    }
    primitives.push({ faces: [...faces.values()], material: prim.getMaterial() });
  }

  if (courtCategory) courts.push({ name, category: courtCategory, aabb, mesh });
  else buildings.push({ name, aabb, primitives, mesh });
}

console.log(`Found ${buildings.length} buildings, ${courts.length} courts, ${anchors.length} anchors.`);

let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (const { aabb } of [...buildings, ...courts]) {
  minX = Math.min(minX, aabb.minX); maxX = Math.max(maxX, aabb.maxX);
  minZ = Math.min(minZ, aabb.minZ); maxZ = Math.max(maxZ, aabb.maxZ);
}
const margin = Math.max(40, Math.max(maxX - minX, maxZ - minZ) * 0.12);
const ground = { minX: minX - margin, maxX: maxX + margin, minZ: minZ - margin, maxZ: maxZ + margin };

// ---------------------------------------------------------------- materials

function makeMaterial(name, hex, roughness = 0.95) {
  return document
    .createMaterial(name)
    .setBaseColorFactor([...srgbToLinear(hex), 1])
    .setRoughnessFactor(roughness)
    .setMetallicFactor(0);
}

const materialCache = new Map();
function cachedMaterial(name, hex, roughness) {
  if (!materialCache.has(name)) materialCache.set(name, makeMaterial(name, hex, roughness));
  return materialCache.get(name);
}

// recolor building boxes (warm Q-style walls) and courts
for (const building of buildings) {
  const wallHex = WALL_PALETTE[hashString(building.name) % WALL_PALETTE.length];
  const wall = srgbToLinear(wallHex);
  building.mesh.listPrimitives().forEach((prim, index) => {
    const tint = ROOF_TINT ** ((hashString(building.name) + index) % 2);
    const old = prim.getMaterial();
    prim.setMaterial(
      document
        .createMaterial(`QWall_${building.name}_${index}`)
        .setBaseColorFactor([...wall.map((c) => Math.min(1, c * tint)), 1])
        .setRoughnessFactor(0.9)
        .setMetallicFactor(0),
    );
    if (old) old.dispose();
  });
}
for (const court of courts) {
  const mat = cachedMaterial(`QCourt_${court.category}`, COURT_COLORS[court.category]);
  for (const prim of court.mesh.listPrimitives()) prim.setMaterial(mat);
}

// ---------------------------------------------------------------- builders

const glassBuilders = [new MeshBuilder(), new MeshBuilder()];
const parapetBuilder = new MeshBuilder();
const plinthBuilder = new MeshBuilder();
const acBuilder = new MeshBuilder();

const WINDOW_H = 1.3;
const FLOOR_H = 2.7;

for (const building of buildings) {
  const glassBuilder = glassBuilders[hashString(building.name) % 2];
  for (const primitive of building.primitives) {
    for (const face of primitive.faces) {
      if (face.axis === 1) {
        if (face.sign < 0) continue; // bottom
        // roof: parapet ring + AC units
        let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity, top = face.c;
        for (let i = 0; i < face.verts.length; i += 3) {
          u0 = Math.min(u0, face.verts[i]); u1 = Math.max(u1, face.verts[i]);
          w0 = Math.min(w0, face.verts[i + 2]); w1 = Math.max(w1, face.verts[i + 2]);
        }
        const t = 0.45;
        parapetBuilder.box(u0 - 0.1, u1 + 0.1, top, top + 0.7, w0 - 0.1, w0 + t);
        parapetBuilder.box(u0 - 0.1, u1 + 0.1, top, top + 0.7, w1 - t, w1 + 0.1);
        parapetBuilder.box(u0 - 0.1, u0 + t, top, top + 0.7, w0 - 0.1, w1 + 0.1);
        parapetBuilder.box(u1 - t, u1 + 0.1, top, top + 0.7, w0 - 0.1, w1 + 0.1);
        const h = hashString(building.name) % 3;
        const acCount = 1 + (h % 2);
        for (let k = 0; k < acCount; k++) {
          const fx = 0.25 + 0.4 * ((h + k * 2) % 3) / 2;
          const fz = 0.3 + 0.4 * ((h + k) % 2);
          const cx = u0 + (u1 - u0) * fx;
          const cz = w0 + (w1 - w0) * fz;
          acBuilder.box(cx - 0.9, cx + 0.9, top, top + 1.0, cz - 0.7, cz + 0.7);
        }
        continue;
      }
      // vertical wall: window grid + plinth
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      const uIdx = face.axis === 0 ? 2 : 0;
      for (let i = 0; i < face.verts.length; i += 3) {
        u0 = Math.min(u0, face.verts[i + uIdx]); u1 = Math.max(u1, face.verts[i + uIdx]);
        v0 = Math.min(v0, face.verts[i + 1]); v1 = Math.max(v1, face.verts[i + 1]);
      }
      if (u1 - u0 < 3 || v1 - v0 < 3) continue;
      // plinth band at the wall base
      emitWallQuad(plinthBuilder, face, u0, u1, v0, v0 + 0.9, 0.15);
      // windows
      const topLimit = v1 - 0.9;
      for (let sill = v0 + 1.2; sill + WINDOW_H < topLimit; sill += FLOOR_H) {
        const usable = u1 - u0 - 2.4;
        const cols = Math.floor((usable + 1.6) / 3.1);
        if (cols < 1) continue;
        const span = cols * 1.5 + (cols - 1) * 1.6;
        let u = u0 + (u1 - u0 - span) / 2;
        for (let col = 0; col < cols; col++) {
          emitWallQuad(glassBuilder, face, u, u + 1.5, sill, sill + WINDOW_H, 0.12);
          u += 3.1;
        }
      }
    }
  }
}

console.log(
  `Windows: ${glassBuilders[0].triangleCount + glassBuilders[1].triangleCount} tris; ` +
  `parapets ${parapetBuilder.triangleCount}; plinths ${plinthBuilder.triangleCount}; ac ${acBuilder.triangleCount}`,
);

// ---------------------------------------------------------------- roads

// axis-aligned segments: {axis: 'v'|'h', a: fixed coord, b0,b1: span}, main roads get asphalt+dashes+sidewalk
const ROADS = [
  { axis: "v", a: 44, b0: -210, b1: 300, main: true },
  { axis: "h", a: 0, b0: -260, b1: 410, main: true },
  { axis: "h", a: 190, b0: -260, b1: 410, main: true },
  { axis: "v", a: 320, b0: -80, b1: 290 },
  { axis: "v", a: -160, b0: 0, b1: 250 },
  { axis: "h", a: -95, b0: -20, b1: 330 },
  { axis: "v", a: 57, b0: -210, b1: -95 },
  { axis: "h", a: 280, b0: 100, b1: 270 },
  { axis: "v", a: 120, b0: 20, b1: 235 },
  { axis: "h", a: 93, b0: 80, b1: 160 },
  { axis: "h", a: 150, b0: 80, b1: 160 },
  { axis: "h", a: 225, b0: 80, b1: 160 },
  { axis: "v", a: 265, b0: 60, b1: 215 },
  { axis: "h", a: 230, b0: 225, b1: 270 },
  { axis: "v", a: 380, b0: 20, b1: 185 },
  { axis: "h", a: 20, b0: -245, b1: -155 },
  { axis: "h", a: 145, b0: -100, b1: 44 },
];

function roadEndpoints(r) {
  return r.axis === "v" ? { ax: r.a, az: r.b0, bx: r.a, bz: r.b1 } : { ax: r.b0, az: r.a, bx: r.b1, bz: r.a };
}

function distanceToRoads(x, z) {
  let best = Infinity;
  for (const r of ROADS) {
    const e = roadEndpoints(r);
    best = Math.min(best, distToSegmentXZ(x, z, e.ax, e.az, e.bx, e.bz));
  }
  return best;
}

// spurs: connect isolated anchors to the nearest road
const spurs = [];
for (const anchor of anchors) {
  if (distanceToRoads(anchor.x, anchor.z) < 7) continue;
  let best = null;
  for (const r of ROADS) {
    const e = roadEndpoints(r);
    const abx = e.bx - e.ax;
    const abz = e.bz - e.az;
    const len2 = abx * abx + abz * abz;
    let t = ((anchor.x - e.ax) * abx + (anchor.z - e.az) * abz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = e.ax + abx * t;
    const pz = e.az + abz * t;
    const d = Math.hypot(anchor.x - px, anchor.z - pz);
    if (!best || d < best.d) best = { d, px, pz };
  }
  spurs.push({ ax: anchor.x, az: anchor.z, bx: best.px, bz: best.pz });
}

const sidewalkBuilder = new MeshBuilder();
const roadBuilder = new MeshBuilder();
const walkwayBuilder = new MeshBuilder();
const dashBuilder = new MeshBuilder();

function flatQuad(b, ax, az, bx, bz, half) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 0.5) return;
  const nx = (-dz / len) * half;
  const nz = (dx / len) * half;
  const y = b === roadBuilder ? -0.012 : b === sidewalkBuilder ? -0.02 : -0.015;
  b.quad([ax + nx, y, az + nz], [bx + nx, y, bz + nz], [bx - nx, y, bz - nz], [ax - nx, y, az - nz]);
}

for (const r of ROADS) {
  const e = roadEndpoints(r);
  if (r.main) {
    flatQuad(sidewalkBuilder, e.ax, e.az, e.bx, e.bz, 5.4);
    flatQuad(roadBuilder, e.ax, e.az, e.bx, e.bz, 3.6);
    // dashed centerline
    const dx = e.bx - e.ax;
    const dz = e.bz - e.az;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    for (let s = 4; s < len - 4; s += 7) {
      const cx = e.ax + ux * s;
      const cz = e.az + uz * s;
      const ex = cx + ux * 2.6;
      const ez = cz + uz * 2.6;
      const nx = -uz * 0.28;
      const nz = ux * 0.28;
      dashBuilder.quad([cx + nx, -0.006, cz + nz], [ex + nx, -0.006, ez + nz], [ex - nx, -0.006, ez - nz], [cx - nx, -0.006, cz - nz]);
    }
  } else {
    flatQuad(walkwayBuilder, e.ax, e.az, e.bx, e.bz, 2.4);
  }
}
for (const s of spurs) flatQuad(walkwayBuilder, s.ax, s.az, s.bx, s.bz, 1.8);

console.log(`Roads: ${ROADS.length} segments, ${spurs.length} spurs.`);

// ---------------------------------------------------------------- trees

const rng = mulberry32(TREE_SEED);
const placements = [];

function blocked(x, z, pad) {
  if (buildings.some((bld) => x >= bld.aabb.minX - pad && x <= bld.aabb.maxX + pad && z >= bld.aabb.minZ - pad && z <= bld.aabb.maxZ + pad)) return true;
  if (courts.some((ct) => x >= ct.aabb.minX - pad && x <= ct.aabb.maxX + pad && z >= ct.aabb.minZ - pad && z <= ct.aabb.maxZ + pad)) return true;
  return false;
}

function tryPlace(x, z, minGap) {
  if (x < ground.minX + 2 || x > ground.maxX - 2 || z < ground.minZ + 2 || z > ground.maxZ - 2) return false;
  if (blocked(x, z, 2.5)) return false;
  if (distanceToRoads(x, z) < 4.6) return false;
  if (anchors.some((a) => Math.hypot(x - a.x, z - a.z) < 7)) return false;
  if (placements.some((p) => Math.hypot(x - p.x, z - p.z) < minGap)) return false;
  placements.push({ x, z, s: 0.75 + rng() * 0.6, variant: rng() });
  return true;
}

// 1) roadside rows along every road
for (const r of ROADS) {
  const e = roadEndpoints(r);
  const len = Math.hypot(e.bx - e.ax, e.bz - e.az);
  const ux = (e.bx - e.ax) / len;
  const uz = (e.bz - e.az) / len;
  const off = (r.main ? 3.6 : 2.4) + 2.6;
  for (let s = 6; s < len - 4; s += 15) {
    const x = e.ax + ux * s;
    const z = e.az + uz * s;
    tryPlace(x - uz * off, z + ux * off, 5);
    tryPlace(x + uz * off, z - ux * off, 5);
  }
}

// 2) building accent rows (deterministic per building)
for (const bld of buildings) {
  const h = hashString(bld.name);
  const { aabb } = bld;
  if (h % 3 === 0) {
    for (let x = aabb.minX + 3; x < aabb.maxX - 2; x += 9) tryPlace(x, aabb.maxZ + 3.2, 4);
  } else if (h % 3 === 1) {
    for (let z = aabb.minZ + 3; z < aabb.maxZ - 2; z += 9) tryPlace(aabb.maxX + 3.2, z, 4);
  }
}

// 3) green clusters (satellite-style forest patches)
const CLUSTERS = [
  { x: 280, z: 140, r: 26, n: 22 },
  { x: -60, z: 60, r: 30, n: 24 },
  { x: 200, z: -150, r: 24, n: 16 },
  { x: -100, z: 265, r: 22, n: 14 },
  { x: 150, z: -40, r: 18, n: 10 },
  { x: 330, z: 240, r: 16, n: 10 },
];
for (const cluster of CLUSTERS) {
  let placed = 0;
  for (let attempt = 0; attempt < cluster.n * 12 && placed < cluster.n; attempt++) {
    const angle = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * cluster.r;
    if (tryPlace(cluster.x + Math.cos(angle) * dist, cluster.z + Math.sin(angle) * dist, 4.2)) placed++;
  }
}

const trunkBuilder = new MeshBuilder();
const canopyBuilders = [new MeshBuilder(), new MeshBuilder()];

function addTree({ x, z, s, variant }) {
  const trunkTop = 1.9 * s;
  // trunk: 6-sided cylinder
  {
    const b = trunkBuilder;
    const sides = 6;
    const ring = (y) =>
      Array.from({ length: sides }, (_, i) => {
        const a = (i / sides) * Math.PI * 2;
        return [x + Math.cos(a) * 0.3 * s, y, z + Math.sin(a) * 0.3 * s];
      });
    const bottom = ring(-0.15);
    const top = ring(trunkTop);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      b.quad(bottom[i], top[i], top[j], bottom[j]);
    }
  }
  // canopy: faceted bipyramid (Q-style round tree)
  const b = canopyBuilders[variant < 0.5 ? 0 : 1];
  const sides = 7;
  const yMid = trunkTop + 1.9 * s;
  const radius = 1.9 * s;
  const ring = Array.from({ length: sides }, (_, i) => {
    const a = ((i + 0.5) / sides) * Math.PI * 2;
    return [x + Math.cos(a) * radius, yMid, z + Math.sin(a) * radius];
  });
  const topApex = [x, yMid + 2.6 * s, z];
  const botApex = [x, yMid - 1.4 * s, z];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    b.triangle(ring[j], ring[i], topApex);
    b.triangle(ring[i], ring[j], botApex);
  }
}

for (const p of placements) addTree(p);
console.log(`Trees placed: ${placements.length}`);

// ---------------------------------------------------------------- ground

const groundBuilder = new MeshBuilder();
groundBuilder.quad(
  [ground.minX, -0.03, ground.minZ],
  [ground.minX, -0.03, ground.maxZ],
  [ground.maxX, -0.03, ground.maxZ],
  [ground.maxX, -0.03, ground.minZ],
);

// ---------------------------------------------------------------- write meshes

function builderToPrimitive(b, material) {
  if (!b.indices.length) return null;
  const pos = document.createAccessor().setType("VEC3").setArray(new Float32Array(b.positions)).setBuffer(buffer);
  const nor = document.createAccessor().setType("VEC3").setArray(new Float32Array(b.normals)).setBuffer(buffer);
  const idx = document.createAccessor().setType("SCALAR").setArray(new Uint32Array(b.indices)).setBuffer(buffer);
  return document.createPrimitive().setAttribute("POSITION", pos).setAttribute("NORMAL", nor).setIndices(idx).setMaterial(material);
}

function addSceneryNode(name, entries) {
  const prims = entries.map(([b, mat]) => builderToPrimitive(b, mat)).filter(Boolean);
  if (!prims.length) return;
  const mesh = document.createMesh(name);
  for (const p of prims) mesh.addPrimitive(p);
  scene.addChild(document.createNode(name).setMesh(mesh));
}

addSceneryNode("SCENERY_ground", [[groundBuilder, cachedMaterial("Q_grass", GRASS_COLOR, 1)]]);
addSceneryNode("SCENERY_sidewalks", [[sidewalkBuilder, cachedMaterial("Q_sidewalk", SIDEWALK_COLOR, 1)]]);
addSceneryNode("SCENERY_roads", [
  [roadBuilder, cachedMaterial("Q_road", ROAD_COLOR, 1)],
  [dashBuilder, cachedMaterial("Q_dash", DASH_COLOR, 1)],
]);
addSceneryNode("SCENERY_walkways", [[walkwayBuilder, cachedMaterial("Q_walkway", WALKWAY_COLOR, 1)]]);
addSceneryNode("SCENERY_building_detail", [
  [parapetBuilder, cachedMaterial("Q_parapet", PARAPET_COLOR, 0.9)],
  [plinthBuilder, cachedMaterial("Q_plinth", PLINTH_COLOR, 0.95)],
  [acBuilder, cachedMaterial("Q_ac", AC_COLOR, 0.8)],
]);
addSceneryNode("SCENERY_windows", [
  [glassBuilders[0], cachedMaterial("Q_glass_0", GLASS_COLORS[0], 0.35)],
  [glassBuilders[1], cachedMaterial("Q_glass_1", GLASS_COLORS[1], 0.35)],
]);
addSceneryNode("SCENERY_trees", [
  [trunkBuilder, cachedMaterial("Q_trunk", TRUNK_COLOR, 1)],
  [canopyBuilders[0], cachedMaterial("Q_canopy_0", CANOPY_COLORS[0], 1)],
  [canopyBuilders[1], cachedMaterial("Q_canopy_1", CANOPY_COLORS[1], 1)],
]);

await io.write(GLB_PATH, document);
console.log(`Wrote ${GLB_PATH}`);
