"use client";

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Lightformer, Environment } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { progressRef, registerCore } from "./useForgeStore";
import type { CardRect } from "./RuleGrid";

/* ------------------------------------------------------------------ *
 *  Timeline helpers — every S1–S5 visual is a pure function of p (§5.1)
 * ------------------------------------------------------------------ */

const CLIP = 3.75;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const remap = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

type Key = [number, number];
function track(keys: Key[], t: number) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return lerp(v0, v1, smooth((t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
}

/** §5.2 camera distance, core radius 1, fov 32° */
const CAM: Key[] = [
  [0, 12.7],
  [1.0, 12.0],
  [1.5, 9.5],
  [2.0, 7.2],
  [2.5, 4.5],
  [2.75, 4.5],
  [3.25, 8.0],
  [3.75, 12.7],
];

const FOV = 32;
const SETTLED_DIST = 12.7;

/* ------------------------------------------------------------------ *
 *  Geometry: icosahedron faces, edges, vertices
 * ------------------------------------------------------------------ */

function useIcoParts() {
  return React.useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    const faces: { geo: THREE.BufferGeometry; normal: THREE.Vector3; top: boolean }[] = [];
    const vertexKey = new Map<string, THREE.Vector3>();
    const edgeKey = new Set<string>();
    const edges: [THREE.Vector3, THREE.Vector3][] = [];
    const k = (v: THREE.Vector3) =>
      `${v.x.toFixed(4)}|${v.y.toFixed(4)}|${v.z.toFixed(4)}`;

    let maxY = -Infinity;
    for (let f = 0; f < pos.count / 3; f++) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, f * 3);
      const b = new THREE.Vector3().fromBufferAttribute(pos, f * 3 + 1);
      const c = new THREE.Vector3().fromBufferAttribute(pos, f * 3 + 2);
      for (const v of [a, b, c]) vertexKey.set(k(v), v.clone());
      for (const [p, q] of [
        [a, b],
        [b, c],
        [c, a],
      ] as [THREE.Vector3, THREE.Vector3][]) {
        const key = [k(p), k(q)].sort().join("~");
        if (!edgeKey.has(key)) {
          edgeKey.add(key);
          edges.push([p.clone(), q.clone()]);
        }
      }
      const normal = new THREE.Vector3()
        .addVectors(a, b)
        .add(c)
        .divideScalar(3);
      const centroidY = normal.y;
      if (centroidY > maxY) maxY = centroidY;
      const g = new THREE.BufferGeometry();
      // triangle re-centred on its own centroid so the mesh can slide out
      const arr = new Float32Array([
        a.x - normal.x, a.y - normal.y, a.z - normal.z,
        b.x - normal.x, b.y - normal.y, b.z - normal.z,
        c.x - normal.x, c.y - normal.y, c.z - normal.z,
      ]);
      g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      g.computeVertexNormals();
      faces.push({ geo: g, normal, top: false });
    }
    // one frosted top facet (§7)
    const topIdx = faces.reduce(
      (best, f, i, all) => (f.normal.y > all[best].normal.y ? i : best),
      0
    );
    faces[topIdx].top = true;

    const vertices = Array.from(vertexKey.values()); // 12
    geo.dispose();
    return { faces, edges, vertices };
  }, []);
}

/* ------------------------------------------------------------------ *
 *  Sprite textures (no network fetch, §7)
 * ------------------------------------------------------------------ */

function makeTexture(draw: (c: CanvasRenderingContext2D, s: number) => void) {
  const s = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d")!;
  draw(ctx, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function useSprites() {
  return React.useMemo(() => {
    const dot = makeTexture((c, s) => {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.35, "rgba(255,255,255,.45)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    });
    const star = makeTexture((c, s) => {
      c.translate(s / 2, s / 2);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, s / 2);
      g.addColorStop(0, "rgba(255,240,205,1)");
      g.addColorStop(1, "rgba(255,200,90,0)");
      c.fillStyle = g;
      for (let i = 0; i < 4; i++) {
        c.rotate(Math.PI / 2);
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(s * 0.06, -s * 0.16, 0, -s / 2);
        c.quadraticCurveTo(-s * 0.06, -s * 0.16, 0, 0);
        c.fill();
      }
      c.beginPath();
      c.arc(0, 0, s * 0.09, 0, Math.PI * 2);
      c.fill();
    });
    return { dot, star };
  }, []);
}

/* ------------------------------------------------------------------ *
 *  Core
 * ------------------------------------------------------------------ */

const STEEL = new THREE.Color("#9fb3c4");
const EDGE_STEEL = new THREE.Color("#b9cbd8");

function Core({ gold, idle }: { gold: THREE.Color; idle: boolean }) {
  const { faces, edges } = useIcoParts();
  const group = React.useRef<THREE.Group>(null!);
  const faceRefs = React.useRef<THREE.Mesh[]>([]);
  const edgeRef = React.useRef<THREE.InstancedMesh>(null!);
  const wireRef = React.useRef<THREE.LineSegments>(null!);

  const faceMat = React.useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: STEEL.clone(),
        metalness: 0.4,
        roughness: 0.25,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        envMapIntensity: 1.2,
      }),
    []
  );
  const topMat = React.useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#ccd8e0"),
        metalness: 0.3,
        roughness: 0.55,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      }),
    []
  );
  const edgeMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: EDGE_STEEL.clone(),
        emissive: new THREE.Color("#000000"),
        emissiveIntensity: 1,
        roughness: 0.3,
        metalness: 0.8,
      }),
    []
  );
  const wireMat = React.useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: EDGE_STEEL,
        transparent: true,
        opacity: 0.25,
      }),
    []
  );
  const innerGeo = React.useMemo(
    () => new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.62, 1)),
    []
  );
  const cylGeo = React.useMemo(
    () => new THREE.CylinderGeometry(1, 1, 1, 6, 1, true),
    []
  );

  // static edge-bar transforms
  React.useEffect(() => {
    const m = edgeRef.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    edges.forEach(([a, b], i) => {
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(b, a);
      dummy.position.copy(mid);
      dummy.quaternion.setFromUnitVectors(up, dir.clone().normalize());
      dummy.scale.set(0.028, dir.length(), 0.028);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [edges]);

  const pulseRef = React.useRef(0); // absorb() boost

  useFrame((state, dt) => {
    const t = progressRef.current * CLIP;
    const unseal = smooth(remap(t, 1.0, 1.75));
    const sep = track(
      [
        [1.0, 0],
        [1.25, 0.09],
        [2.0, 0.02],
        [3.75, 0.02],
      ],
      t
    );
    pulseRef.current = Math.max(0, pulseRef.current - dt * 1.7);

    // faces
    faceRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const n = faces[i].normal;
      mesh.position.copy(n).multiplyScalar(1 + sep);
    });

    faceMat.color.copy(STEEL).lerp(gold, unseal);
    faceMat.opacity = lerp(0.18, 0.96, unseal);
    faceMat.metalness = lerp(0.4, 0.9, unseal);
    faceMat.roughness = lerp(0.25, 0.3, unseal);
    topMat.opacity = lerp(0.85, 0.96, unseal);
    topMat.color.copy(new THREE.Color("#ccd8e0")).lerp(gold, unseal);
    topMat.metalness = lerp(0.3, 0.9, unseal);

    const slowPulse = idle ? 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 1.57) : 0;
    edgeMat.color.copy(EDGE_STEEL).lerp(gold, unseal);
    edgeMat.emissive.copy(gold);
    edgeMat.emissiveIntensity =
      unseal * (1.1 + slowPulse * 0.5 + pulseRef.current * 1.6);
    wireMat.opacity = 0.25 * (1 - unseal);

    // idle rotation runs off the render clock (the one exception, §5.1)
    if (group.current) {
      group.current.rotation.y += dt * 0.16;
      group.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.5) * 0.06;
      group.current.rotation.z =
        Math.cos(state.clock.elapsedTime * 0.37) * 0.04;
    }
  });

  React.useEffect(() => {
    registerCoreAbsorb(() => {
      pulseRef.current = 1;
    });
  }, []);

  return (
    <group ref={group}>
      {faces.map((f, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) faceRefs.current[i] = el;
          }}
          geometry={f.geo}
          material={f.top ? topMat : faceMat}
        />
      ))}
      <instancedMesh
        ref={edgeRef}
        args={[cylGeo, edgeMat, edges.length]}
        frustumCulled={false}
      />
      <lineSegments ref={wireRef} geometry={innerGeo} material={wireMat} />
    </group>
  );
}

let absorbCb: (() => void) | null = null;
const registerCoreAbsorb = (cb: () => void) => {
  absorbCb = cb;
};

/* ------------------------------------------------------------------ *
 *  Sealed traces + nodes (S1)
 * ------------------------------------------------------------------ */

function SealedNetwork({
  nodes,
  dot,
}: {
  nodes: THREE.Vector3[];
  dot: THREE.Texture;
}) {
  const lineRef = React.useRef<THREE.LineSegments>(null!);
  const ptsRef = React.useRef<THREE.Points>(null!);

  const geo = React.useMemo(() => {
    const verts: number[] = [];
    nodes.forEach((n, i) => {
      const dir = Math.sign(n.x) || 1;
      const bundle = (i % 3) * 0.12;
      const a = new THREE.Vector3(dir * (0.9 + bundle), n.y * 0.18, 0);
      const b = new THREE.Vector3(a.x + dir * 0.9, a.y, 0);
      const chamfer = Math.min(0.5, Math.abs(n.y - a.y) / 2);
      const sy = Math.sign(n.y - a.y) || 1;
      const c = new THREE.Vector3(b.x + dir * chamfer, a.y + sy * chamfer, 0);
      const d = new THREE.Vector3(c.x, n.y, 0);
      const e = new THREE.Vector3(n.x, n.y, 0);
      const path = [a, b, c, d, e];
      for (let s = 0; s < path.length - 1; s++) {
        verts.push(path[s].x, path[s].y, path[s].z);
        verts.push(path[s + 1].x, path[s + 1].y, path[s + 1].z);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return g;
  }, [nodes]);

  const nodeGeo = React.useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        nodes.flatMap((n) => [n.x, n.y, n.z]),
        3
      )
    );
    return g;
  }, [nodes]);

  const lineMat = React.useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: "#8fa3b3",
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );
  const nodeMat = React.useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.22,
        map: dot,
        color: "#e6f1ff",
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    [dot]
  );

  useFrame((state) => {
    const t = progressRef.current * CLIP;
    const a = 1 - smooth(remap(t, 1.0, 2.0)); // full until 1.0, gone by 2.0
    lineMat.opacity = 0.5 * a;
    nodeMat.opacity = a;
    if (ptsRef.current) {
      // 2–3px idle bob, no orbiting (§7)
      ptsRef.current.position.y =
        Math.sin(state.clock.elapsedTime * 0.9) * 0.015;
    }
    if (lineRef.current) lineRef.current.visible = a > 0.01;
    if (ptsRef.current) ptsRef.current.visible = a > 0.01;
  });

  return (
    <group>
      <lineSegments ref={lineRef} geometry={geo} material={lineMat} />
      <points ref={ptsRef} geometry={nodeGeo} material={nodeMat} />
    </group>
  );
}

/* ------------------------------------------------------------------ *
 *  Dust + bokeh
 * ------------------------------------------------------------------ */

function Dust({ dot, gold }: { dot: THREE.Texture; gold: THREE.Color }) {
  const ref = React.useRef<THREE.Points>(null!);
  const bok = React.useRef<THREE.Points>(null!);

  const make = (n: number, spread: number, depth: number) => {
    const g = new THREE.BufferGeometry();
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = (Math.random() - 0.5) * spread;
      a[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.62;
      a[i * 3 + 2] = (Math.random() - 0.5) * depth;
    }
    g.setAttribute("position", new THREE.BufferAttribute(a, 3));
    return g;
  };

  const g1 = React.useMemo(() => make(250, 18, 8), []);
  const g2 = React.useMemo(() => make(15, 16, 6), []);

  const m1 = React.useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.07,
        map: dot,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: new THREE.Color("#cfe2ff"),
      }),
    [dot]
  );
  const m2 = React.useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 1.5,
        map: dot,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: new THREE.Color("#b9d4ff"),
      }),
    [dot]
  );

  useFrame((state, dt) => {
    const t = progressRef.current * CLIP;
    const warm = smooth(remap(t, 1.8, 2.6));
    m1.color.copy(new THREE.Color("#cfe2ff")).lerp(gold, warm);
    m2.color.copy(new THREE.Color("#b9d4ff")).lerp(gold, warm * 0.8);
    if (ref.current) ref.current.rotation.y += dt * 0.012;
    if (bok.current) {
      bok.current.position.y = Math.sin(state.clock.elapsedTime * 0.12) * 0.25;
    }
  });

  return (
    <group>
      <points ref={ref} geometry={g1} material={m1} />
      <points ref={bok} geometry={g2} material={m2} />
    </group>
  );
}

/* ------------------------------------------------------------------ *
 *  Spark ring (S2–S3)
 * ------------------------------------------------------------------ */

function SparkRing({ dot, gold }: { dot: THREE.Texture; gold: THREE.Color }) {
  const ref = React.useRef<THREE.Points>(null!);
  const N = 120;
  const geo = React.useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    return g;
  }, []);
  const mat = React.useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.06,
        map: dot,
        color: gold,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [dot, gold]
  );

  useFrame(() => {
    const t = progressRef.current * CLIP;
    const r = track(
      [
        [1.15, 1.25],
        [2.25, 1.8],
      ],
      t
    );
    const a =
      smooth(remap(t, 1.15, 1.3)) * (1 - smooth(remap(t, 2.0, 2.4)));
    mat.opacity = a;
    if (!ref.current || a <= 0.001) {
      if (ref.current) ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2;
      p.setXYZ(i, Math.cos(ang) * r, Math.sin(ang) * r, 0);
    }
    p.needsUpdate = true;
  });

  return <points ref={ref} geometry={geo} material={mat} />;
}

/* ------------------------------------------------------------------ *
 *  Shards + ribbon trails (S4–S5)
 * ------------------------------------------------------------------ */

const shardShape = () => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.34);
  s.lineTo(0.13, -0.08);
  s.lineTo(0, 0.02);
  s.lineTo(-0.13, -0.08);
  s.closePath();
  return s;
};

function Shards({
  vertices,
  targets,
  gold,
}: {
  vertices: THREE.Vector3[];
  targets: THREE.Vector3[];
  gold: THREE.Color;
}) {
  const group = React.useRef<THREE.Group>(null!);
  const meshes = React.useRef<THREE.Mesh[]>([]);
  const ribbons = React.useRef<THREE.Mesh[]>([]);

  const geo = React.useMemo(
    () =>
      new THREE.ExtrudeGeometry(shardShape(), {
        depth: 0.05,
        bevelEnabled: true,
        bevelSize: 0.012,
        bevelThickness: 0.012,
        bevelSegments: 1,
      }),
    []
  );

  const mat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: gold,
        emissive: gold,
        emissiveIntensity: 0.7,
        metalness: 0.95,
        roughness: 0.25,
        transparent: true,
      }),
    [gold]
  );

  const ribbonMat = React.useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: gold,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [gold]
  );

  const SEG = 22;
  const ribbonGeos = React.useMemo(
    () =>
      vertices.map(() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3)
        );
        const idx: number[] = [];
        for (let i = 0; i < SEG; i++) {
          const a = i * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        g.setIndex(idx);
        return g;
      }),
    [vertices]
  );

  /** cubic Bézier from vertex → card landing point (§7) */
  const curves = React.useMemo(
    () =>
      vertices.map((v, i) => {
        const to = targets[i] ?? v.clone().multiplyScalar(6);
        const out = v.clone().normalize();
        const c1 = v.clone().add(out.clone().multiplyScalar(3.4));
        const c2 = new THREE.Vector3(
          to.x * 0.55 + out.x * 2.2,
          to.y * 0.55 + out.y * 2.6,
          out.z * 1.2
        );
        return new THREE.CubicBezierCurve3(v.clone(), c1, c2, to);
      }),
    [vertices, targets]
  );

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  useFrame(() => {
    const t = progressRef.current * CLIP;
    if (!group.current) return;
    const anyVisible = t > 2.2 && t < 3.9;
    group.current.visible = anyVisible;
    if (!anyVisible) return;

    for (let i = 0; i < curves.length; i++) {
      const launch = 2.25 + i * 0.03;
      const arrive = 3.1 + i * (0.65 / 11);
      const u = clamp01((t - launch) / (arrive - launch));
      const eased = smooth(u);
      const curve = curves[i];
      const mesh = meshes.current[i];
      if (mesh) {
        curve.getPoint(eased, tmpA);
        mesh.position.copy(tmpA);
        curve.getTangent(Math.min(0.999, eased), tmpB);
        mesh.quaternion.setFromUnitVectors(up, tmpB.normalize());
        const fade = 1 - smooth(remap(u, 0.86, 1));
        mesh.scale.setScalar(lerp(0.55, 1, smooth(remap(u, 0, 0.18))) * (0.3 + 0.7 * fade));
        mesh.visible = u > 0 && u < 1;
      }

      // ribbon: the stretch of curve just behind the head, tapering to zero
      const rg = ribbonGeos[i];
      const pos = rg.attributes.position as THREE.BufferAttribute;
      const tail = Math.max(0, eased - 0.35);
      const headFade = 1 - smooth(remap(u, 0.8, 1));
      for (let s = 0; s <= SEG; s++) {
        const f = s / SEG;
        const cu = lerp(tail, eased, f);
        curve.getPoint(cu, tmpA);
        curve.getTangent(Math.min(0.999, cu), tmpB);
        const side = tmpB.clone().cross(new THREE.Vector3(0, 0, 1)).normalize();
        const w = 0.055 * f * f * headFade;
        pos.setXYZ(s * 2, tmpA.x + side.x * w, tmpA.y + side.y * w, tmpA.z + side.z * w);
        pos.setXYZ(s * 2 + 1, tmpA.x - side.x * w, tmpA.y - side.y * w, tmpA.z - side.z * w);
      }
      pos.needsUpdate = true;
      const rib = ribbons.current[i];
      if (rib) rib.visible = u > 0.02 && headFade > 0.02;
    }
    ribbonMat.opacity = 0.85 * (1 - smooth(remap(t, 3.4, 3.8)));
    mat.opacity = 1 - smooth(remap(t, 3.5, 3.85));
  });

  return (
    <group ref={group}>
      {vertices.map((_, i) => (
        <React.Fragment key={i}>
          <mesh
            ref={(el) => {
              if (el) meshes.current[i] = el;
            }}
            geometry={geo}
            material={mat}
          />
          <mesh
            ref={(el) => {
              if (el) ribbons.current[i] = el;
            }}
            geometry={ribbonGeos[i]}
            material={ribbonMat}
            frustumCulled={false}
          />
        </React.Fragment>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ *
 *  Orbit ring (S4)
 * ------------------------------------------------------------------ */

function OrbitRing({ gold, dot }: { gold: THREE.Color; dot: THREE.Texture }) {
  const ring = React.useRef<THREE.Mesh>(null!);
  const head = React.useRef<THREE.Sprite>(null!);
  const geo = React.useMemo(() => new THREE.TorusGeometry(1.65, 0.012, 6, 128), []);
  const mat = React.useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: gold,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [gold]
  );
  const headMat = React.useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: dot,
        color: "#fff3d0",
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [dot]
  );

  useFrame((state) => {
    const t = progressRef.current * CLIP;
    const a =
      smooth(remap(t, 2.25, 2.45)) * (1 - smooth(remap(t, 2.9, 3.3)));
    mat.opacity = a * 0.9;
    headMat.opacity = a;
    if (ring.current) {
      ring.current.visible = a > 0.01;
      ring.current.rotation.set(Math.PI / 2 - 0.35, 0, state.clock.elapsedTime * 0.6);
    }
    if (head.current) {
      const ang = state.clock.elapsedTime * 2.2;
      head.current.position.set(
        Math.cos(ang) * 1.65,
        Math.sin(ang) * 1.65 * 0.34,
        Math.sin(ang) * 1.2
      );
      head.current.scale.setScalar(0.5);
      head.current.visible = a > 0.01;
    }
  });

  return (
    <group>
      <mesh ref={ring} geometry={geo} material={mat} />
      <sprite ref={head} material={headMat} />
    </group>
  );
}

/* ------------------------------------------------------------------ *
 *  Reactions: flare / shockwave (§7)
 * ------------------------------------------------------------------ */

function Reactions({ star }: { star: THREE.Texture }) {
  const flare = React.useRef<THREE.Sprite>(null!);
  const wave = React.useRef<THREE.Mesh>(null!);
  const flareT = React.useRef(-1);
  const waveT = React.useRef(-1);
  const lastFlare = React.useRef(0);

  const flareMat = React.useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: star,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [star]
  );
  const waveGeo = React.useMemo(() => new THREE.SphereGeometry(1, 32, 24), []);
  const waveMat = React.useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#dfe7f2",
        transparent: true,
        opacity: 0,
        roughness: 0.6,
        metalness: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  React.useEffect(() => {
    registerCore({
      flare: () => {
        const now = performance.now();
        if (now - lastFlare.current < 250) return; // debounce 250ms
        lastFlare.current = now;
        flareT.current = 0;
      },
      absorb: () => absorbCb?.(),
      shockwave: () => {
        waveT.current = 0;
      },
    });
    return () => registerCore(null);
  }, []);

  useFrame((_, dt) => {
    if (flareT.current >= 0) {
      flareT.current += dt / 0.35;
      const u = flareT.current;
      if (u >= 1) {
        flareT.current = -1;
        flareMat.opacity = 0;
        if (flare.current) flare.current.visible = false;
      } else if (flare.current) {
        flare.current.visible = true;
        const s = u < 0.5 ? lerp(0, 1.6, u / 0.5) : lerp(1.6, 1.0, (u - 0.5) / 0.5);
        flare.current.scale.setScalar(s * 2.6);
        flareMat.opacity = lerp(0.8, 0, u);
      }
    }
    if (waveT.current >= 0) {
      waveT.current += dt / 0.9;
      const u = waveT.current;
      if (u >= 1) {
        waveT.current = -1;
        waveMat.opacity = 0;
        if (wave.current) wave.current.visible = false;
      } else if (wave.current) {
        wave.current.visible = true;
        wave.current.scale.setScalar(lerp(0.6, 2.2, smooth(u)));
        waveMat.opacity = lerp(0.5, 0, u);
      }
    }
  });

  return (
    <group>
      <sprite ref={flare} material={flareMat} visible={false} />
      <mesh ref={wave} geometry={waveGeo} material={waveMat} visible={false} />
    </group>
  );
}

/* ------------------------------------------------------------------ *
 *  Rig: camera + landing-point projection
 * ------------------------------------------------------------------ */

function Rig({
  rects,
  stage,
  onTargets,
}: {
  rects: CardRect[];
  stage: { w: number; h: number };
  onTargets: (v: THREE.Vector3[]) => void;
}) {
  const { camera, size } = useThree();

  React.useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = FOV;
    cam.updateProjectionMatrix();
  }, [camera]);

  // settled-camera unprojection of the measured card rects onto z = 0 (§7)
  React.useEffect(() => {
    if (!rects.length || !stage.w || !stage.h) return;
    const vh = 2 * SETTLED_DIST * Math.tan((FOV * Math.PI) / 360);
    const vw = vh * (size.width / size.height);
    const byId = new Map(rects.map((r) => [r.id, r]));
    const out: THREE.Vector3[] = [];
    for (let i = 1; i <= 12; i++) {
      const r = byId.get(i);
      if (!r) continue;
      out.push(
        new THREE.Vector3(
          (r.cx / stage.w - 0.5) * vw,
          (0.5 - r.cy / stage.h) * vh,
          0
        )
      );
    }
    onTargets(out);
  }, [rects, stage.w, stage.h, size.width, size.height, onTargets]);

  useFrame(() => {
    const t = progressRef.current * CLIP;
    camera.position.set(0, 0, track(CAM, t));
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ------------------------------------------------------------------ *
 *  Scene root
 * ------------------------------------------------------------------ */

interface SceneProps {
  rects: CardRect[];
  stage: { w: number; h: number };
  goldHex: string;
  bloom?: boolean;
  /** render loop is driven by the parent's IntersectionObserver (§7) */
  active: boolean;
}

function SceneContents({ rects, stage, goldHex, bloom }: Omit<SceneProps, "active">) {
  const gold = React.useMemo(() => new THREE.Color(goldHex), [goldHex]);
  const { vertices } = useIcoParts();
  const { dot, star } = useSprites();
  const [targets, setTargets] = React.useState<THREE.Vector3[]>([]);

  // 12 sealed nodes on a jittered ellipse (§7)
  const nodes = React.useMemo(() => {
    const out: THREE.Vector3[] = [];
    const rx = 6.4;
    const ry = 3.4;
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + 0.26;
      const j = (n: number) => (Math.sin(n * 91.7) * 0.5) * 0.9;
      out.push(
        new THREE.Vector3(
          Math.cos(ang) * rx + j(i + 1),
          Math.sin(ang) * ry + j(i + 5) * 0.6,
          0
        )
      );
    }
    return out;
  }, []);

  const handleTargets = React.useCallback((v: THREE.Vector3[]) => setTargets(v), []);

  return (
    <>
      <Rig rects={rects} stage={stage} onTargets={handleTargets} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 5, 3]} intensity={1.6} color="#ffe2a0" />
      <directionalLight position={[-2, -1, -4]} intensity={0.5} color="#8fb2d8" />
      <Environment resolution={128}>
        <Lightformer intensity={3} position={[0, 4, 2]} scale={[6, 3, 1]} color="#ffe2a0" />
        <Lightformer intensity={1.2} position={[-4, 0, -3]} scale={[4, 4, 1]} color="#7fa8d8" />
        <Lightformer intensity={0.8} position={[4, -2, 2]} scale={[4, 2, 1]} color="#ffffff" />
      </Environment>

      <Dust dot={dot} gold={gold} />
      <SealedNetwork nodes={nodes} dot={dot} />
      <Core gold={gold} idle />
      <SparkRing dot={dot} gold={gold} />
      <OrbitRing gold={gold} dot={dot} />
      {targets.length === 12 && (
        <Shards vertices={vertices} targets={targets} gold={gold} />
      )}
      <Reactions star={star} />

      {bloom !== false && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.7} luminanceSmoothing={0.2} />
        </EffectComposer>
      )}
    </>
  );
}

export default function ForgeCoreScene({ active, ...rest }: SceneProps) {
  return (
    <div className="fc-canvas-layer" aria-hidden="true">
      <Canvas
        frameloop={active ? "always" : "never"}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: FOV, position: [0, 0, SETTLED_DIST], near: 0.1, far: 100 }}
        style={{ background: "transparent" }}
      >
        <SceneContents {...rest} />
      </Canvas>
    </div>
  );
}
