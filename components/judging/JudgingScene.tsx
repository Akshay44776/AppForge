"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

import { CRITERIA, type Criterion } from "./criteria";
import type { SimState } from "./simState";
import {
  CARD_TEX_H,
  CARD_TEX_W,
  drawCardFace,
  drawMiniFace,
  sampleGlyph,
} from "./textures";

/* ═══════════════════════════════════════════════════════════════════════════
   Stage geometry — one place, so the HTML overlay and the 3D scene can never
   drift apart. World units; the camera sits at z = 10.4 with a 32° vertical
   FOV, which puts ~5.9 units of height in frame.
   ═══════════════════════════════════════════════════════════════════════════ */
export const STAGE = {
  coreY: 0.3,
  shellR: 0.95,
  /* the whole rig is lifted so the platform ellipse clears the bottom of the
     stage instead of being sliced by it */
  rootY: 0.55,
  platformY: -1.45,
  platformR: 3.2,
  cardPos: new THREE.Vector3(-3.0, 0.5, 0),
  cardW: 2.6,
  cardH: (2.6 * CARD_TEX_H) / CARD_TEX_W,
  glyphCenter: new THREE.Vector3(3.05, 0.66, 0),
  glyphSize: 2.45,
  impact: new THREE.Vector3(-0.62, 0.32, 0.46),
  cameraZ: 10.4,
  cameraY: 1.1,
};

const NEUTRAL_EDGE = new THREE.Color("#cfe0e3");
const GLASS = new THREE.Color("#9fb0b5");

/* ═══════════════════════════════════════════════════════════════════════════
   Shared shader chunks
   ═══════════════════════════════════════════════════════════════════════════ */

const NOISE_GLSL = `
float hash31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = mix(
    mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
        mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
        mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
  return n;
}
float fbm(vec3 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}`;

/* ═══════════════════════════════════════════════════════════════════════════
   Colour director — lerps the live accent toward the selected criterion's.
   Every other component reads `colors`, never the raw hex.
   ═══════════════════════════════════════════════════════════════════════════ */
export type LiveColors = { cur: THREE.Color; hi: THREE.Color };

function ColorDirector({ sim, colors }: { sim: SimState; colors: LiveColors }) {
  const target = useMemo(() => new THREE.Color(), []);
  const targetHi = useMemo(() => new THREE.Color(), []);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 1 / 20);
    target.set(sim.accent);
    targetHi.set(sim.accentHi);
    const k = 1 - Math.exp(-dt * 5.5);
    colors.cur.lerp(target, k);
    colors.hi.lerp(targetHi, k);
  });
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Camera + fit. The scene root scales down on narrow viewports so the card,
   the shell and the glyph always sit inside the frame instead of clipping.
   ═══════════════════════════════════════════════════════════════════════════ */
function CameraRig({ sim }: { sim: SimState }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    camera.position.set(0, STAGE.cameraY, STAGE.cameraZ);
    camera.updateProjectionMatrix();
  }, [camera]);

  useFrame(() => {
    /* re-aimed every frame: the camera never moves, so this costs nothing and
       it cannot be knocked off target by a resize or a prop re-apply */
    camera.position.set(0, STAGE.cameraY, STAGE.cameraZ);
    camera.lookAt(0, STAGE.coreY, 0);
    const aspect = size.width / Math.max(1, size.height);
    sim.fit = THREE.MathUtils.clamp(aspect / 1.95, 0.52, 1);
  });
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Background dust
   ═══════════════════════════════════════════════════════════════════════════ */
function Dust({ sim, count }: { sim: SimState; count: number }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 9;
      pos[i * 3 + 2] = -1 - Math.random() * 7;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count]);

  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color("#dfe6ec"),
        size: 0.035,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    []
  );

  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  useFrame(() => {
    const p = ref.current;
    if (!p) return;
    p.rotation.y = sim.clock * 0.006 + sim.mouseX * 0.02;
    p.rotation.x = sim.mouseY * -0.012;
  });

  return <points ref={ref} geometry={geo} material={mat} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Holographic platform — concentric rings, a ticked outer dial, the accent
   wedge that sits under whichever criterion is in focus, and a ground glow.
   ═══════════════════════════════════════════════════════════════════════════ */
function Platform({ sim, colors }: { sim: SimState; colors: LiveColors }) {
  const radii = [1.32, 1.86, 2.4, 2.84, STAGE.platformR];

  /* THREE.Line objects are built by hand and mounted with <primitive/>: the
     intrinsic <line/> collides with the SVG element of the same name. */
  const rings = useMemo(
    () =>
      radii.map((r, i) => {
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 128; k++) {
          const a = (k / 128) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({
          color: new THREE.Color("#b8c6cf"),
          transparent: true,
          opacity: [0.3, 0.22, 0.34, 0.2, 0.42][i],
          depthWrite: false,
        });
        return new THREE.LineLoop(geo, mat);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const ticks = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const R = STAGE.platformR;
    for (let deg = 0; deg < 360; deg += 3) {
      const a = (deg * Math.PI) / 180;
      const long = deg % 15 === 0;
      const inner = R - (long ? 0.17 : 0.08);
      pts.push(new THREE.Vector3(Math.cos(a) * inner, Math.sin(a) * inner, 0));
      pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  const tickMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color("#9fb0bb"),
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    []
  );

  const wedgeGeo = useMemo(
    () => new THREE.RingGeometry(1.42, 2.52, 48, 1, -Math.PI / 2 - 0.4, 0.8),
    []
  );
  const wedgeMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    []
  );

  const glowMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uOpacity: { value: 0.28 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: `
          varying vec2 vUv; uniform float uOpacity;
          void main(){
            float d = length(vUv - 0.5) * 2.0;
            float a = smoothstep(1.0, 0.0, d);
            gl_FragColor = vec4(vec3(1.0, 0.56, 0.18) * a, a * uOpacity);
          }`,
      }),
    []
  );

  const group = useRef<THREE.Group>(null);

  useEffect(
    () => () => {
      rings.forEach((l) => {
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      });
      ticks.dispose();
      tickMat.dispose();
      wedgeGeo.dispose();
      wedgeMat.dispose();
      glowMat.dispose();
    },
    [rings, ticks, tickMat, wedgeGeo, wedgeMat, glowMat]
  );

  useFrame(() => {
    rings[0].rotation.z = sim.clock * 0.05;
    rings[2].rotation.z = -sim.clock * 0.032;
    rings[4].rotation.z = sim.clock * 0.018;
    wedgeMat.opacity = sim.v.wedge * 0.4;
    wedgeMat.color.copy(colors.cur);
    glowMat.uniforms.uOpacity.value = 0.22 + Math.sin(sim.clock * 1.1) * 0.03;
  });

  return (
    <group ref={group} position={[0, STAGE.platformY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {rings.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
      <lineSegments geometry={ticks} material={tickMat} />
      <mesh geometry={wedgeGeo} material={wedgeMat} position={[0, 0, 0.012]} />
      <mesh material={glowMat} position={[0, 0, 0.004]}>
        <planeGeometry args={[5.8, 5.8]} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Core — the orange plasma sphere. It never takes the accent colour; only
   its flare responds, so the criterion colour always reads as "the beam",
   not "the star".
   ═══════════════════════════════════════════════════════════════════════════ */
function Core({ sim }: { sim: SimState }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uFlare: { value: 0 } },
        vertexShader: `
          varying vec3 vPos; varying vec3 vNrm;
          void main(){
            vPos = position;
            vNrm = normalMatrix * normal;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          varying vec3 vPos; varying vec3 vNrm;
          uniform float uTime; uniform float uFlare;
          ${NOISE_GLSL}
          void main(){
            vec3 n = normalize(vNrm);
            float f = fbm(vPos * 3.4 + vec3(0.0, uTime * 0.34, uTime * 0.14));
            float g = fbm(vPos * 8.0 - vec3(uTime * 0.22));
            float h = clamp(f * 0.8 + g * 0.32, 0.0, 1.0);
            float fres = pow(1.0 - abs(dot(n, vec3(0.0, 0.0, 1.0))), 1.7);
            vec3 c = mix(vec3(0.88, 0.32, 0.03), vec3(1.0, 0.66, 0.12), h);
            c = mix(c, vec3(1.0, 0.96, 0.78), pow(h, 3.2));
            c = mix(c, vec3(0.46, 0.11, 0.0), fres * 0.5);
            c *= 1.0 + uFlare * 1.1;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    []
  );

  const haloMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uA: { value: 0.3 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: `
          varying vec2 vUv; uniform float uA;
          void main(){
            float d = length(vUv - 0.5) * 2.0;
            float a = pow(smoothstep(1.0, 0.0, d), 2.2);
            gl_FragColor = vec4(vec3(1.0, 0.58, 0.16) * a, a * uA);
          }`,
      }),
    []
  );

  const novaMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#fff0c8"),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  const streakMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uA: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: `
          varying vec2 vUv; uniform float uA;
          void main(){
            float x = abs(vUv.x - 0.5) * 2.0;
            float y = abs(vUv.y - 0.5) * 2.0;
            float a = pow(1.0 - x, 2.0) * pow(1.0 - y, 3.0);
            gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * a, a * uA);
          }`,
      }),
    []
  );

  const core = useRef<THREE.Mesh>(null);
  const nova = useRef<THREE.Mesh>(null);
  const streak = useRef<THREE.Mesh>(null);

  useEffect(
    () => () => {
      mat.dispose();
      haloMat.dispose();
      novaMat.dispose();
      streakMat.dispose();
    },
    [mat, haloMat, novaMat, streakMat]
  );

  useFrame(() => {
    const v = sim.v;
    mat.uniforms.uTime.value = sim.clock;
    mat.uniforms.uFlare.value = v.flare;
    haloMat.uniforms.uA.value = 0.26 + v.flare * 0.5 + v.nova * 0.7;
    if (core.current) {
      const s = 1 + Math.sin(sim.clock * 0.85) * 0.035 + v.flare * 0.12 + v.nova * 1.3;
      core.current.scale.setScalar(s);
    }
    if (nova.current) {
      novaMat.opacity = v.nova * 0.85;
      nova.current.scale.setScalar(0.6 + v.nova * 2.6);
      nova.current.visible = v.nova > 0.002;
    }
    if (streak.current) {
      streakMat.uniforms.uA.value = Math.pow(v.nova, 1.6) * 0.9;
      streak.current.visible = v.nova > 0.002;
    }
  });

  return (
    <group position={[0, STAGE.coreY, 0]}>
      <mesh ref={core} material={mat}>
        <sphereGeometry args={[0.4, 48, 48]} />
      </mesh>
      <mesh material={haloMat}>
        <planeGeometry args={[2.9, 2.9]} />
      </mesh>
      <mesh ref={nova} material={novaMat}>
        <sphereGeometry args={[0.55, 32, 32]} />
      </mesh>
      <mesh ref={streak} material={streakMat} position={[0, 0, 0.4]}>
        <planeGeometry args={[15, 0.5]} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Shell — the faceted glass icosahedron. `uTint` is what turns the whole
   simulation green, indigo, red…
   ═══════════════════════════════════════════════════════════════════════════ */
function Shell({
  sim,
  colors,
  onCoreClick,
}: {
  sim: SimState;
  colors: LiveColors;
  onCoreClick: () => void;
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTint: { value: new THREE.Color("#3ECF8E") },
          uT: { value: 0 },
        },
        vertexShader: `
          varying vec3 vNrm;
          void main(){
            vNrm = normalMatrix * normal;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          varying vec3 vNrm; uniform vec3 uTint; uniform float uT;
          void main(){
            vec3 n = normalize(vNrm);
            float fres = pow(1.0 - abs(dot(n, vec3(0.0, 0.0, 1.0))), 2.0);
            vec3 base = vec3(0.60, 0.68, 0.71);
            vec3 c = mix(base, uTint, uT);
            float a = (0.085 + fres * 0.30) * (0.62 + uT * 0.95);
            gl_FragColor = vec4(c * (0.55 + fres * 0.95 + uT * 0.75), a);
          }`,
      }),
    []
  );

  const edgeGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(STAGE.shellR, 0)),
    []
  );
  const edgeMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: NEUTRAL_EDGE.clone(),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    []
  );
  const innerGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(STAGE.shellR * 0.63, 0)),
    []
  );
  const innerMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: NEUTRAL_EDGE.clone(),
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    []
  );

  const group = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Color(), []);

  useEffect(
    () => () => {
      mat.dispose();
      edgeGeo.dispose();
      edgeMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
    },
    [mat, edgeGeo, edgeMat, innerGeo, innerMat]
  );

  useFrame(() => {
    const v = sim.v;
    mat.uniforms.uTint.value.copy(colors.cur);
    mat.uniforms.uT.value = v.tint;
    tmp.copy(GLASS).lerp(colors.hi, v.tint * 0.9);
    edgeMat.color.copy(tmp);
    edgeMat.opacity = 0.5 + v.tint * 0.35;
    innerMat.color.copy(tmp);
    innerMat.opacity = 0.14 + v.tint * 0.22;

    const g = group.current;
    if (!g) return;
    g.rotation.y = sim.clock * 0.12 + sim.mouseX * 0.06;
    g.rotation.x = Math.sin(sim.clock * 0.4) * 0.06 + sim.mouseY * -0.04;
    g.position.y = STAGE.coreY + Math.sin(sim.clock * 0.55) * 0.055;
    const s = 1 + v.flare * 0.05;
    g.scale.setScalar(s);
  });

  return (
    <group ref={group} position={[0, STAGE.coreY, 0]}>
      <mesh
        material={mat}
        onClick={(e) => {
          e.stopPropagation();
          onCoreClick();
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <icosahedronGeometry args={[STAGE.shellR, 0]} />
      </mesh>
      <lineSegments geometry={edgeGeo} material={edgeMat} />
      <lineSegments geometry={innerGeo} material={innerMat} />
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Shockwave — the frosted ring that leaves the core the moment a card is
   picked and passes beyond the frame.
   ═══════════════════════════════════════════════════════════════════════════ */
function Shockwave({ sim }: { sim: SimState }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uA: { value: 0 }, uTime: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: `
          varying vec2 vUv; uniform float uA; uniform float uTime;
          ${NOISE_GLSL}
          void main(){
            /* RingGeometry uv is a square map, so radius comes from its centre */
            vec2 p = vUv - 0.5;
            float d = length(p) * 2.0;
            float band = 1.0 - clamp(abs(d - 0.89) / 0.12, 0.0, 1.0);
            float ang = atan(p.y, p.x);
            float n = vnoise(vec3(ang * 3.0, uTime * 0.6, 0.0));
            float a = pow(band, 1.5) * (0.6 + n * 0.6) * uA;
            gl_FragColor = vec4(vec3(0.82, 0.86, 0.9) * a, a * 0.6);
          }`,
      }),
    []
  );
  const ref = useRef<THREE.Mesh>(null);
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(() => {
    const v = sim.v.shock;
    const m = ref.current;
    if (!m) return;
    m.visible = v > 0.002 && v < 0.999;
    if (!m.visible) return;
    const s = 0.55 + v * 7.2;
    m.scale.setScalar(s);
    mat.uniforms.uA.value = Math.sin(Math.PI * Math.min(1, v * 1.05)) * 0.55;
    mat.uniforms.uTime.value = sim.clock;
  });

  return (
    <mesh ref={ref} material={mat} position={[0, STAGE.coreY, 0]}>
      <ringGeometry args={[0.78, 1.0, 96]} />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Glass dome — inflates around the shell while the glyph is being born.
   ═══════════════════════════════════════════════════════════════════════════ */
function Dome({ sim }: { sim: SimState }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uA: { value: 0 }, uTime: { value: 0 } },
        vertexShader: `
          varying vec3 vNrm; varying vec3 vPos;
          uniform float uTime;
          ${NOISE_GLSL}
          void main(){
            vNrm = normalMatrix * normal;
            vPos = position;
            float w = fbm(position * 1.7 + vec3(0.0, uTime * 0.5, uTime * 0.25)) - 0.5;
            vec3 p = position + normal * w * 0.16;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: `
          varying vec3 vNrm; varying vec3 vPos; uniform float uA;
          void main(){
            vec3 n = normalize(vNrm);
            float fres = pow(1.0 - abs(dot(n, vec3(0.0, 0.0, 1.0))), 2.4);
            float a = (0.035 + fres * 0.42) * uA;
            gl_FragColor = vec4(vec3(0.86, 0.9, 0.93) * (0.6 + fres), a);
          }`,
      }),
    []
  );
  const ref = useRef<THREE.Mesh>(null);
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(() => {
    const v = sim.v.dome;
    const m = ref.current;
    if (!m) return;
    m.visible = v > 0.004;
    if (!m.visible) return;
    m.scale.setScalar(0.72 + v * 0.34);
    mat.uniforms.uA.value = v;
    mat.uniforms.uTime.value = sim.clock;
  });

  return (
    <mesh ref={ref} material={mat} position={[0, STAGE.platformY + 0.02, 0]}>
      <sphereGeometry args={[2.2, 56, 32, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Featured card — a glass slab carrying a canvas texture. On a warm re-pick
   it flips edge-on, swaps its face at the midpoint, and flips back, which
   hides the texture swap completely.
   ═══════════════════════════════════════════════════════════════════════════ */
function FeaturedCard({ sim }: { sim: SimState }) {
  const canvas = useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.createElement("canvas");
  }, []);

  const tex = useMemo(() => {
    if (!canvas) return null;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.minFilter = THREE.LinearFilter;
    return t;
  }, [canvas]);

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: tex ?? undefined,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [tex]
  );

  const drawn = useRef(-1);
  const ref = useRef<THREE.Mesh>(null);

  const paint = (index: number) => {
    if (!canvas || !tex || index < 0) return;
    drawCardFace(canvas, CRITERIA[index], true);
    tex.needsUpdate = true;
    drawn.current = index;
  };

  /* repaint once webfonts are ready, otherwise the first frame uses the
     fallback family and the title jumps a moment later */
  useEffect(() => {
    let cancelled = false;
    const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
    fonts?.ready?.then(() => {
      if (!cancelled && drawn.current >= 0) paint(drawn.current);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      mat.dispose();
      tex?.dispose();
    },
    [mat, tex]
  );

  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const v = sim.v;
    const idx = sim.selected;

    m.visible = v.card > 0.004 && idx >= 0;
    if (!m.visible) return;

    /* swap the face while the card is edge-on (warm) or invisible (cold) */
    if (idx !== drawn.current && (v.card < 0.05 || v.flip > 0.5)) paint(idx);
    if (drawn.current < 0) paint(idx);

    const enter = v.card;
    const p = STAGE.cardPos;
    m.position.set(
      p.x - (1 - enter) * 1.1,
      p.y - (1 - enter) * 1.0 + Math.sin(sim.clock * 0.8) * 0.035,
      p.z + (1 - enter) * -0.6
    );

    const flipScale = Math.max(0.035, Math.abs(Math.cos(Math.PI * v.flip)));
    const grow = 0.62 + 0.38 * enter;
    m.scale.set(grow * flipScale, grow, 1);
    m.rotation.set(-0.02, 0.19 + sim.mouseX * 0.025, 0);
    mat.opacity = enter;
  });

  return (
    <mesh ref={ref} material={mat}>
      <planeGeometry args={[STAGE.cardW, STAGE.cardH]} />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Orbiting idle cards — the ring that stands around the shell before a
   criterion is picked, and that reassembles for the overview finale.
   ═══════════════════════════════════════════════════════════════════════════ */
/* ─────────────────────────────────────────────────────────────────────────
   The card ring.

   A wide, shallow ellipse rather than a circle. On a true circle two of the
   six cards end up buried behind the core and the outer pair pile up at the
   same screen x, because sine flattens near its peak. Stretching x and
   squashing z spreads all six evenly across the frame: the outer pair sits
   nearly edge-on at the edges, the inner pair flanks the shell with a clean
   gap, and every card stays readable.
   ───────────────────────────────────────────────────────────────────────── */
const RING_RX = 4.2;
const RING_RZ = 1.6;
const RING_Y = -0.12;
const RING_FAN = 2.6;
const ringAngle = (i: number) =>
  -RING_FAN / 2 + (i / (CRITERIA.length - 1)) * RING_FAN;
const ringX = (i: number) => Math.sin(ringAngle(i)) * RING_RX;
const ringZ = (i: number) => Math.cos(ringAngle(i)) * RING_RZ;
/** turned to face outward from the centre, softened so the edge cards stay legible */
const ringYaw = (i: number) => Math.atan2(ringX(i), ringZ(i)) * 0.8;
const ringPoint = (i: number, out: THREE.Vector3) =>
  out.set(ringX(i), RING_Y, ringZ(i));

function IdleRing({ sim }: { sim: SimState }) {
  const items = useMemo(() => {
    if (typeof document === "undefined") return [];
    return CRITERIA.map((c) => {
      const cv = document.createElement("canvas");
      drawMiniFace(cv, c);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      const m = new THREE.MeshBasicMaterial({
        map: t,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        toneMapped: false,
      });
      return { tex: t, mat: m };
    });
  }, []);

  const group = useRef<THREE.Group>(null);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);

  useEffect(
    () => () => {
      items.forEach(({ tex, mat }) => {
        tex.dispose();
        mat.dispose();
      });
    },
    [items]
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const v = sim.v;
    g.visible = v.idle > 0.004;
    if (!g.visible) return;
    /* a slow sway rather than a spin: a fanned arc must keep facing the
       camera, and a full rotation would swing cards out of frame */
    g.rotation.y = Math.sin(sim.clock * 0.18) * 0.07;
    items.forEach(({ mat }, i) => {
      mat.opacity = v.idle * 0.95;
      const m = meshes.current[i];
      if (m) {
        m.position.y = RING_Y + Math.sin(sim.clock * 0.7 + i) * 0.05;
        m.scale.setScalar(0.72 + 0.28 * v.idle);
      }
    });
  });

  return (
    <group ref={group}>
      {items.map(({ mat }, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          material={mat}
          position={[ringX(i), RING_Y, ringZ(i)]}
          rotation={[0, ringYaw(i), 0]}
        >
          <planeGeometry args={[0.98, 1.3]} />
        </mesh>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Beams — three curved strands from the card's right edge into one hot
   impact point on the shell. Each is a thin bright tube plus a fat soft one.
   ═══════════════════════════════════════════════════════════════════════════ */
/** x of the card's glowing right edge, where every beam is born */
const EMITTER_X = -1.93;

function Beams({ sim, colors }: { sim: SimState; colors: LiveColors }) {
  const curves = useMemo(() => {
    const ex = EMITTER_X;
    const ys = [0.66, 0.0, -0.66];
    return ys.map((dy, i) => {
      const from = new THREE.Vector3(ex, STAGE.cardPos.y + dy, -0.02);
      const ctrl = new THREE.Vector3(
        (ex + STAGE.impact.x) / 2,
        STAGE.cardPos.y + dy * 0.55,
        0.3 + (i === 1 ? 0 : 0.12)
      );
      return new THREE.QuadraticBezierCurve3(from, ctrl, STAGE.impact.clone());
    });
  }, []);

  const geos = useMemo(
    () => curves.map((c) => new THREE.TubeGeometry(c, 72, 0.017, 8, false)),
    [curves]
  );
  const glowGeos = useMemo(
    () => curves.map((c) => new THREE.TubeGeometry(c, 72, 0.075, 8, false)),
    [curves]
  );

  const makeMat = (core: number, alpha: number) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uProgress: { value: 0 },
        uColor: { value: new THREE.Color("#3ECF8E") },
        uTime: { value: 0 },
        uCore: { value: core },
        uAlpha: { value: alpha },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uProgress; uniform vec3 uColor; uniform float uTime;
        uniform float uCore; uniform float uAlpha;
        void main(){
          float on = smoothstep(uProgress, uProgress - 0.07, vUv.x);
          float packet = pow(fract(vUv.x * 5.0 - uTime * 1.45), 7.0);
          vec3 c = mix(uColor, vec3(1.0), 0.35 * uCore + packet * 0.6);
          float a = on * uAlpha * (0.55 + packet * 0.9);
          gl_FragColor = vec4(c * (uCore + packet * 1.4), a);
        }`,
    });

  const coreMats = useMemo(() => curves.map(() => makeMat(1.0, 0.95)), [curves]);
  const glowMats = useMemo(() => curves.map(() => makeMat(0.45, 0.22)), [curves]);

  const sparkMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uA: { value: 0 }, uColor: { value: new THREE.Color() } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: `
          varying vec2 vUv; uniform float uA; uniform vec3 uColor;
          void main(){
            float d = length(vUv - 0.5) * 2.0;
            float a = pow(smoothstep(1.0, 0.0, d), 2.0);
            gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.6) * a, a * uA);
          }`,
      }),
    []
  );

  const emitterMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose());
      glowGeos.forEach((g) => g.dispose());
      coreMats.forEach((m) => m.dispose());
      glowMats.forEach((m) => m.dispose());
      sparkMat.dispose();
      emitterMat.dispose();
    },
    [geos, glowGeos, coreMats, glowMats, sparkMat, emitterMat]
  );

  const spark = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const v = sim.v;
    for (let i = 0; i < 3; i++) {
      const p = v.beam[i];
      coreMats[i].uniforms.uProgress.value = p;
      glowMats[i].uniforms.uProgress.value = p;
      coreMats[i].uniforms.uTime.value = sim.clock;
      glowMats[i].uniforms.uTime.value = sim.clock;
      coreMats[i].uniforms.uColor.value.copy(colors.hi);
      glowMats[i].uniforms.uColor.value.copy(colors.cur);
    }
    const any = Math.max(v.beam[0], v.beam[1], v.beam[2]);
    sparkMat.uniforms.uA.value = Math.min(1, any * 1.2) * (0.5 + v.flare);
    sparkMat.uniforms.uColor.value.copy(colors.hi);
    emitterMat.color.copy(colors.hi);
    emitterMat.opacity = v.card * (0.35 + any * 0.6);
    if (spark.current) {
      spark.current.visible = any > 0.01;
      spark.current.scale.setScalar(0.5 + any * 0.6 + v.flare * 0.8);
    }
  });

  const ex = EMITTER_X;

  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={`c${i}`} geometry={g} material={coreMats[i]} />
      ))}
      {glowGeos.map((g, i) => (
        <mesh key={`g${i}`} geometry={g} material={glowMats[i]} />
      ))}
      {[0.66, 0, -0.66].map((dy, i) => (
        <mesh key={`e${i}`} material={emitterMat} position={[ex, STAGE.cardPos.y + dy, -0.02]}>
          <circleGeometry args={[0.035, 16]} />
        </mesh>
      ))}
      <mesh
        ref={spark}
        material={sparkMat}
        position={[STAGE.impact.x, STAGE.impact.y, STAGE.impact.z]}
      >
        <planeGeometry args={[1.1, 1.1]} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Glyph — the particle cloud that bursts out of the shell and settles into
   the criterion's own icon. Re-picking a criterion morphs the cloud straight
   from the old shape into the new one.
   ═══════════════════════════════════════════════════════════════════════════ */
function Glyph({ sim, colors, count }: { sim: SimState; colors: LiveColors; count: number }) {
  const data = useMemo(() => {
    const position = new Float32Array(count * 3);
    const start = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const delay = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seed[i] = Math.random();
      delay[i] = Math.random() * 0.34;
    }
    return { position, start, target, seed, delay };
  }, [count]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(data.position, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(data.seed, 1));
    return g;
  }, [data]);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uColor: { value: new THREE.Color("#8be2bb") },
          uSize: { value: 4.0 },
        },
        vertexShader: `
          attribute float aSeed;
          varying float vA;
          uniform float uTime; uniform float uSize; uniform float uOpacity;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float tw = 0.62 + 0.38 * sin(uTime * 2.1 + aSeed * 6.2831);
            vA = tw * uOpacity;
            /* grains, not blobs: oversized points pile up under additive
               blending and the glyph burns out to a white disc */
            gl_PointSize = uSize * (0.6 + aSeed * 0.85) * (10.0 / max(0.001, -mv.z));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          varying float vA; uniform vec3 uColor;
          void main(){
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float a = smoothstep(0.5, 0.08, d) * vA * 0.62;
            gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.12), a);
          }`,
      }),
    []
  );

  const lastEpoch = useRef(-1);
  const ref = useRef<THREE.Points>(null);

  /* Rasterising an icon costs a getImageData, so each shape is sampled once
     and reused for the rest of the session — switching criteria stays free. */
  const cache = useRef<Map<string, Float32Array>>(new Map());

  const retarget = (criterion: Criterion, cold: boolean) => {
    let sampled = cache.current.get(criterion.id);
    if (!sampled) {
      sampled = sampleGlyph(criterion.icon, count);
      cache.current.set(criterion.id, sampled);
    }
    const c = STAGE.glyphCenter;
    const s = STAGE.glyphSize;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      data.target[i3] = c.x + sampled[i3] * s;
      data.target[i3 + 1] = c.y + sampled[i3 + 1] * s;
      data.target[i3 + 2] = c.z + sampled[i3 + 2] * s;

      if (cold) {
        /* burst out of the shell */
        const u = Math.random() * Math.PI * 2;
        const v = Math.acos(2 * Math.random() - 1);
        const r = STAGE.shellR * (0.35 + Math.random() * 0.5);
        data.start[i3] = Math.sin(v) * Math.cos(u) * r;
        data.start[i3 + 1] = STAGE.coreY + Math.cos(v) * r;
        data.start[i3 + 2] = Math.sin(v) * Math.sin(u) * r;
      } else {
        data.start[i3] = data.position[i3];
        data.start[i3 + 1] = data.position[i3 + 1];
        data.start[i3 + 2] = data.position[i3 + 2];
      }
      data.delay[i] = Math.random() * 0.34;
    }
  };

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat]
  );

  useFrame(() => {
    const v = sim.v;
    const p = ref.current;
    if (!p) return;

    if (sim.epoch !== lastEpoch.current && sim.selected >= 0) {
      retarget(CRITERIA[sim.selected], !sim.warm || lastEpoch.current < 0);
      lastEpoch.current = sim.epoch;
    }

    p.visible = v.glyphIn > 0.004 && sim.selected >= 0;
    if (!p.visible) return;

    const g = v.glyph;
    const pos = data.position;
    const st = data.start;
    const tg = data.target;
    const t = sim.clock;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const d = data.delay[i];
      let u = (g - d) / (1 - d);
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const e = 1 - Math.pow(1 - u, 4);
      const sd = data.seed[i];
      /* a little curl on the way in, a slow shimmer once settled */
      const swirl = (1 - e) * 0.55;
      const wob = 0.014 * e;
      pos[i3] =
        st[i3] + (tg[i3] - st[i3]) * e + Math.sin(t * 1.2 + sd * 9.0) * (swirl * 0.4 + wob);
      pos[i3 + 1] =
        st[i3 + 1] +
        (tg[i3 + 1] - st[i3 + 1]) * e +
        Math.cos(t * 1.0 + sd * 7.0) * (swirl * 0.4 + wob);
      pos[i3 + 2] =
        st[i3 + 2] + (tg[i3 + 2] - st[i3 + 2]) * e + Math.sin(t * 0.8 + sd * 5.0) * swirl * 0.5;
    }
    (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;

    mat.uniforms.uTime.value = t;
    mat.uniforms.uOpacity.value = v.glyphIn;
    /* the saturated accent, not the pale tint: on the lighter criteria the
       tint read as plain white once additive blending piled up */
    mat.uniforms.uColor.value.copy(colors.cur);
    p.rotation.y = sim.mouseX * 0.09;
  });

  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Digital rain behind the glyph
   ═══════════════════════════════════════════════════════════════════════════ */
function Rain({ sim, colors, count }: { sim: SimState; colors: LiveColors; count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const cols = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: 1.75 + Math.random() * 2.75,
        z: -0.9 + Math.random() * 1.6,
        y: -0.9 + Math.random() * 4.4,
        speed: 1.3 + Math.random() * 2.6,
        len: 0.14 + Math.random() * 0.42,
        bright: 0.35 + Math.random() * 0.65,
      })),
    [count]
  );

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 1 / 20);
    const m = ref.current;
    if (!m) return;
    const a = sim.v.rain;
    m.visible = a > 0.004;
    mat.opacity = a * 0.55;
    mat.color.copy(colors.cur);
    if (!m.visible) return;

    for (let i = 0; i < count; i++) {
      const c = cols[i];
      c.y -= c.speed * dt;
      if (c.y < -1.2) {
        c.y = 3.6 + Math.random() * 0.9;
        c.x = 1.75 + Math.random() * 2.75;
      }
      dummy.position.set(c.x, c.y, c.z);
      dummy.scale.set(1, c.len, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[undefined as never, undefined as never, count]}
      material={mat}
      frustumCulled={false}
    >
      <planeGeometry args={[0.022, 1]} />
    </instancedMesh>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Waveform link — the quiet "data line" that stays between card and shell
   once the beams recede.
   ═══════════════════════════════════════════════════════════════════════════ */
const WAVE_BARS = 56;

function Waveform({ sim, colors }: { sim: SimState; colors: LiveColors }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const phase = useMemo(
    () => Array.from({ length: WAVE_BARS }, () => Math.random() * 6.28),
    []
  );
  useEffect(() => () => mat.dispose(), [mat]);

  const x0 = EMITTER_X + 0.05;
  const x1 = -1.02;

  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const a = sim.v.wave;
    m.visible = a > 0.004;
    mat.opacity = a * 0.7;
    mat.color.copy(colors.hi);
    if (!m.visible) return;

    for (let i = 0; i < WAVE_BARS; i++) {
      const u = i / (WAVE_BARS - 1);
      const env = Math.pow(1 - u, 1.5);
      const n =
        0.55 +
        0.45 * Math.sin(sim.clock * 5.2 + phase[i]) * Math.sin(sim.clock * 1.7 + i * 0.4);
      const h = 0.06 + env * 0.5 * n;
      dummy.position.set(x0 + (x1 - x0) * u, STAGE.cardPos.y - 0.06, 0.02);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[undefined as never, undefined as never, WAVE_BARS]}
      material={mat}
      frustumCulled={false}
    >
      <planeGeometry args={[0.013, 1]} />
    </instancedMesh>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Finale — six beams in six colours converging on the core.
   ═══════════════════════════════════════════════════════════════════════════ */
function FinaleBeams({ sim }: { sim: SimState }) {
  const mats = useMemo(
    () =>
      CRITERIA.map(
        (c) =>
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(c.accentHi),
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          })
      ),
    []
  );
  const glowMats = useMemo(
    () =>
      CRITERIA.map(
        (c) =>
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(c.accent),
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          })
      ),
    []
  );

  const refs = useRef<(THREE.Group | null)[]>([]);
  const target = useMemo(() => new THREE.Vector3(0, STAGE.coreY, 0), []);
  const from = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  useEffect(
    () => () => {
      mats.forEach((m) => m.dispose());
      glowMats.forEach((m) => m.dispose());
    },
    [mats, glowMats]
  );

  useFrame(() => {
    const v = sim.v;
    const sway = Math.sin(sim.clock * 0.18) * 0.07;
    for (let i = 0; i < CRITERIA.length; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const p = v.fbeam[i];
      mats[i].opacity = p * 0.95;
      glowMats[i].opacity = p * 0.3;
      g.visible = p > 0.004;
      if (!g.visible) continue;

      /* the ring sways, so the beam roots are recomputed with the same sway
         instead of being baked in — they can never drift off a card */
      ringPoint(i, from);
      from.applyAxisAngle(up, sway);
      dir.copy(target).sub(from);
      const dist = dir.length();
      dir.normalize();
      quat.setFromUnitVectors(up, dir);
      const len = dist * p;
      g.position.copy(from).addScaledVector(dir, len / 2);
      g.quaternion.copy(quat);
      g.scale.set(1, len, 1);
    }
  });

  return (
    <group>
      {CRITERIA.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <mesh material={mats[i]}>
            <cylinderGeometry args={[0.018, 0.018, 1, 8, 1, true]} />
          </mesh>
          <mesh material={glowMats[i]}>
            <cylinderGeometry args={[0.075, 0.075, 1, 8, 1, true]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Projector — keeps the HTML progress ring locked to the glyph, whatever the
   viewport does. Writes straight to the DOM; never re-renders React.
   ═══════════════════════════════════════════════════════════════════════════ */
function RingProjector({
  sim,
  anchorRef,
}: {
  sim: SimState;
  anchorRef: RefObject<HTMLDivElement>;
}) {
  const { camera, size } = useThree();
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const last = useRef({ x: -1, y: -1, r: -1 });

  useFrame(() => {
    const el = anchorRef.current;
    if (!el) return;
    const f = sim.fit;
    a.copy(STAGE.glyphCenter).multiplyScalar(f);
    a.y += STAGE.rootY;
    a.project(camera);
    b.set(
      STAGE.glyphCenter.x + STAGE.glyphSize * 0.5,
      STAGE.glyphCenter.y,
      STAGE.glyphCenter.z
    ).multiplyScalar(f);
    b.y += STAGE.rootY;
    b.project(camera);

    const x = (a.x * 0.5 + 0.5) * size.width;
    const y = (-a.y * 0.5 + 0.5) * size.height;
    const bx = (b.x * 0.5 + 0.5) * size.width;
    const r = Math.abs(bx - x) * 1.06;

    const l = last.current;
    if (Math.abs(l.x - x) < 0.4 && Math.abs(l.y - y) < 0.4 && Math.abs(l.r - r) < 0.4) return;
    l.x = x;
    l.y = y;
    l.r = r;
    el.style.width = `${r * 2}px`;
    el.style.height = `${r * 2}px`;
    el.style.transform = `translate(${x - r}px, ${y - r}px)`;
  });

  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Scene root
   ═══════════════════════════════════════════════════════════════════════════ */
export default function JudgingScene({
  sim,
  colors,
  tier,
  onCoreClick,
  ringAnchorRef,
}: {
  sim: SimState;
  colors: LiveColors;
  tier: "high" | "mid" | "low";
  onCoreClick: () => void;
  ringAnchorRef: RefObject<HTMLDivElement>;
}) {
  const root = useRef<THREE.Group>(null);

  const glyphCount = tier === "high" ? 7000 : tier === "mid" ? 3800 : 2200;
  const rainCount = tier === "high" ? 140 : tier === "mid" ? 80 : 40;
  const dustCount = tier === "high" ? 260 : 150;

  useFrame(() => {
    if (root.current) {
      root.current.scale.setScalar(sim.fit);
      root.current.position.y = STAGE.rootY;
    }
  });

  return (
    <>
      <ColorDirector sim={sim} colors={colors} />
      <CameraRig sim={sim} />
      <RingProjector sim={sim} anchorRef={ringAnchorRef} />

      <ambientLight intensity={0.2} />
      <pointLight position={[0, STAGE.coreY, 0]} intensity={2.4} distance={9} decay={2} color="#ff8a2b" />

      <group ref={root}>
        <Dust sim={sim} count={dustCount} />
        <Platform sim={sim} colors={colors} />
        <Core sim={sim} />
        <Shell sim={sim} colors={colors} onCoreClick={onCoreClick} />
        <Shockwave sim={sim} />
        <Dome sim={sim} />
        <IdleRing sim={sim} />
        <FeaturedCard sim={sim} />
        <Beams sim={sim} colors={colors} />
        <FinaleBeams sim={sim} />
        <Glyph sim={sim} colors={colors} count={glyphCount} />
        <Rain sim={sim} colors={colors} count={rainCount} />
        <Waveform sim={sim} colors={colors} />
      </group>
    </>
  );
}
