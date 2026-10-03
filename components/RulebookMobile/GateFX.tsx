import * as React from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mobileProgressRef } from "./useMobileStore";
import { mapProgress } from "./mobile.config";

interface Props {
  index: number;
}

function useLocalT(index: number, cb: (localT: number) => void) {
  useFrame(() => {
    const p = mobileProgressRef.current;
    const { gate } = mapProgress(p);
    const dist = gate - index;
    if (Math.abs(dist) > 1.5) {
       cb(0);
       return;
    }
    const localT = Math.max(0, 1 - Math.abs(dist));
    cb(localT);
  });
}

// 1. Scan & Unlock
function Fx01({ index }: Props) {
  const ref = React.useRef<THREE.Group>(null);
  const matRef = React.useRef<THREE.MeshBasicMaterial>(null);
  useLocalT(index, (t) => {
    if (!ref.current || !matRef.current) return;
    ref.current.position.y = t * 2 - 1;
    matRef.current.opacity = Math.max(0, 0.8 - Math.abs(t - 0.5) * 1.5);
    ref.current.visible = t > 0;
  });
  return (
    <group ref={ref}>
      <mesh>
        <boxGeometry args={[1, 0.05, 1]} />
        <meshBasicMaterial ref={matRef} color="#FFD84D" transparent />
      </mesh>
    </group>
  );
}

// 2. Nodes Join
function Fx02({ index }: Props) {
  const ref = React.useRef<THREE.Group>(null);
  const n1 = React.useRef<THREE.Mesh>(null);
  const n2 = React.useRef<THREE.Mesh>(null);
  useLocalT(index, (t) => {
    if (!ref.current || !n1.current || !n2.current) return;
    ref.current.rotation.y = t * Math.PI * 4;
    n1.current.position.x = 1 - t;
    n2.current.position.x = -1 + t;
    ref.current.visible = t > 0;
  });
  return (
    <group ref={ref}>
      <mesh ref={n1}><sphereGeometry args={[0.2, 8, 8]} /><meshBasicMaterial color="#F2B632" /></mesh>
      <mesh ref={n2}><sphereGeometry args={[0.2, 8, 8]} /><meshBasicMaterial color="#F2B632" /></mesh>
    </group>
  );
}

// 3. Coin Slot
function Fx03({ index }: Props) {
  const ref = React.useRef<THREE.Mesh>(null);
  useLocalT(index, (t) => {
    if (!ref.current) return;
    ref.current.position.y = 2 - t * 2;
    ref.current.rotation.y = t * Math.PI * 8;
    ref.current.visible = t > 0;
  });
  return (
    <group>
      <mesh ref={ref}>
        <cylinderGeometry args={[0.4, 0.4, 0.05, 16]} />
        <meshBasicMaterial color="#F2B632" />
      </mesh>
    </group>
  );
}

// 4. Path Split
function Fx04({ index }: Props) {
  const ref = React.useRef<THREE.Group>(null);
  const line1 = React.useRef<THREE.Mesh>(null);
  const splitGroup = React.useRef<THREE.Group>(null);
  const l2 = React.useRef<THREE.Mesh>(null);
  const l3 = React.useRef<THREE.Mesh>(null);
  useLocalT(index, (t) => {
    if (!ref.current || !line1.current || !splitGroup.current || !l2.current || !l3.current) return;
    line1.current.position.y = t;
    line1.current.scale.y = t * 2 + 0.001;
    
    if (t > 0.5) {
       splitGroup.current.visible = true;
       l2.current.position.y = t + 0.5;
       l2.current.scale.y = (t - 0.5) * 2 + 0.001;
       l3.current.position.y = t + 0.5;
       l3.current.scale.y = (t - 0.5) * 2 + 0.001;
    } else {
       splitGroup.current.visible = false;
    }
    ref.current.visible = t > 0;
  });
  return (
    <group ref={ref} position={[0, -1, 0]}>
      <mesh ref={line1}><boxGeometry args={[0.05, 1, 0.05]} /><meshBasicMaterial color="#FFD84D" /></mesh>
      <group ref={splitGroup}>
         <mesh ref={l2} position={[-0.5, 0, 0]} rotation={[0, 0, 0.5]}><boxGeometry args={[0.05, 1, 0.05]} /><meshBasicMaterial color="#FFD84D" /></mesh>
         <mesh ref={l3} position={[0.5, 0, 0]} rotation={[0, 0, -0.5]}><boxGeometry args={[0.05, 1, 0.05]} /><meshBasicMaterial color="#FFD84D" /></mesh>
      </group>
    </group>
  );
}

// 5. Stairs of Light
function Fx05({ index }: Props) {
  const ref = React.useRef<THREE.Group>(null);
  const meshes = React.useRef<THREE.Mesh[]>([]);
  const mats = React.useRef<THREE.MeshBasicMaterial[]>([]);
  useLocalT(index, (t) => {
    if (!ref.current) return;
    meshes.current.forEach((m, i) => {
       if (m) m.position.y = (i * 0.5) * Math.min(1, t * 2);
    });
    mats.current.forEach((mat) => {
       if (mat) mat.opacity = t * 1.5;
    });
    ref.current.visible = t > 0;
  });
  return (
    <group ref={ref} position={[-1, -1, 0]}>
      {Array.from({ length: 3 }).map((_, i) => (
        <mesh key={i} position={[i * 0.8, 0, 0]} ref={(el) => { if (el) meshes.current[i] = el; }}>
          <boxGeometry args={[0.6, 0.1, 0.6]} />
          <meshBasicMaterial ref={(el) => { if (el) mats.current[i] = el; }} color="#F2B632" transparent />
        </mesh>
      ))}
    </group>
  );
}

// 6. Card Flip
function Fx06({ index }: Props) {
  const ref = React.useRef<THREE.Group>(null);
  const mat = React.useRef<THREE.MeshBasicMaterial>(null);
  useLocalT(index, (t) => {
    if (!ref.current || !mat.current) return;
    ref.current.rotation.y = t * Math.PI;
    mat.current.color.set(t > 0.5 ? "#FFD84D" : "#111111");
    ref.current.visible = t > 0;
  });
  return (
    <group ref={ref}>
      <mesh><boxGeometry args={[1.2, 1.8, 0.05]} /><meshBasicMaterial ref={mat} color="#111" /></mesh>
    </group>
  );
}

// 7. Forge Sparks
function Fx07({ index }: Props) {
  const ref = React.useRef<THREE.Mesh>(null);
  useLocalT(index, (t) => {
    if (!ref.current) return;
    ref.current.scale.setScalar(t + 0.001);
    ref.current.visible = t > 0;
  });
  return (
    <group>
      <mesh ref={ref}>
        <wireframeGeometry args={[new THREE.BoxGeometry(1.5, 2.5, 0.1)]} />
        <lineBasicMaterial color="#FFD84D" />
      </mesh>
    </group>
  );
}

// 8. Circuit Pulse
function Fx08({ index }: Props) {
  const ref = React.useRef<THREE.Mesh>(null);
  useLocalT(index, (t) => {
    if (!ref.current) return;
    ref.current.scale.setScalar(1 + Math.sin(t * Math.PI * 4) * 0.2);
    ref.current.visible = t > 0;
  });
  return (
    <group>
      <mesh ref={ref}><boxGeometry args={[0.6, 0.6, 0.1]} /><meshBasicMaterial color="#FFD84D" /></mesh>
    </group>
  );
}

// 9. Streams Meet
function Fx09({ index }: Props) {
  const ref = React.useRef<THREE.Group>(null);
  const m1 = React.useRef<THREE.Mesh>(null);
  const m2 = React.useRef<THREE.Mesh>(null);
  useLocalT(index, (t) => {
    if (!ref.current || !m1.current || !m2.current) return;
    m1.current.position.x = -2 + t * 2;
    m1.current.scale.x = t * 2 + 0.001;
    m2.current.position.x = 2 - t * 2;
    m2.current.scale.x = t * 2 + 0.001;
    ref.current.visible = t > 0;
  });
  return (
    <group ref={ref}>
      <mesh ref={m1}><boxGeometry args={[1, 0.05, 0.05]} /><meshBasicMaterial color="#F2B632" /></mesh>
      <mesh ref={m2}><boxGeometry args={[1, 0.05, 0.05]} /><meshBasicMaterial color="#F2B632" /></mesh>
    </group>
  );
}

// 10. Six-Spoke Chart
function Fx10({ index }: Props) {
  const ref = React.useRef<THREE.Group>(null);
  const meshes = React.useRef<THREE.Mesh[]>([]);
  useLocalT(index, (t) => {
    if (!ref.current) return;
    meshes.current.forEach(m => {
       if (m) {
          m.position.y = t * 1.5;
          m.scale.y = t * 1.5 + 0.001;
       }
    });
    ref.current.visible = t > 0;
  });
  return (
    <group ref={ref}>
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={i} rotation={[0, 0, (i / 6) * Math.PI * 2]}>
          <mesh ref={(el) => { if (el) meshes.current[i] = el; }}>
             <boxGeometry args={[0.05, 1, 0.05]} />
             <meshBasicMaterial color="#F2B632" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 11. Red Flag Pulse
function Fx11({ index }: Props) {
  const ref = React.useRef<THREE.Group>(null);
  const flag = React.useRef<THREE.Mesh>(null);
  const mat = React.useRef<THREE.MeshBasicMaterial>(null);
  useLocalT(index, (t) => {
    if (!ref.current || !flag.current || !mat.current) return;
    ref.current.position.y = t * 2 - 1;
    flag.current.position.y = t * 2 + 1;
    mat.current.opacity = t > 0.2 ? 1 : 0;
    ref.current.visible = t > 0;
  });
  return (
    <group ref={ref}>
      <mesh><boxGeometry args={[0.1, 2, 0.1]} /><meshBasicMaterial color="#F2B632" /></mesh>
      <mesh ref={flag} position={[0.5, 0, 0]}>
        <planeGeometry args={[1, 0.6]} />
        <meshBasicMaterial ref={mat} color="#c0392b" side={THREE.DoubleSide} transparent />
      </mesh>
    </group>
  );
}

// 12. Gavel Shockwave
function Fx12({ index }: Props) {
  const ref = React.useRef<THREE.Group>(null);
  const gavel = React.useRef<THREE.Mesh>(null);
  const wave = React.useRef<THREE.Mesh>(null);
  const mat = React.useRef<THREE.MeshBasicMaterial>(null);
  useLocalT(index, (t) => {
    if (!ref.current || !gavel.current || !wave.current || !mat.current) return;
    gavel.current.rotation.z = -Math.PI / 4 + t * Math.PI / 4;
    gavel.current.position.y = Math.sin(t * Math.PI) * 1;
    
    if (t > 0.9) {
       wave.current.visible = true;
       wave.current.scale.setScalar((t - 0.9) * 50 + 0.001);
       mat.current.opacity = Math.max(0, 1 - (t - 0.9) * 10);
    } else {
       wave.current.visible = false;
    }
    ref.current.visible = t > 0;
  });
  return (
    <group ref={ref}>
      <mesh ref={gavel} position={[-0.5, 0, 0]}>
         <boxGeometry args={[0.2, 1.5, 0.2]} />
         <meshBasicMaterial color="#F2B632" />
      </mesh>
      <mesh ref={wave} rotation={[-Math.PI / 2, 0, 0]}>
         <ringGeometry args={[0.9, 1, 32]} />
         <meshBasicMaterial ref={mat} color="#FFD84D" transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

const FX_MAP = [Fx01, Fx02, Fx03, Fx04, Fx05, Fx06, Fx07, Fx08, Fx09, Fx10, Fx11, Fx12];

export function GateFX({ index }: Props) {
  const FxComponent = FX_MAP[index];
  if (!FxComponent) return null;
  return <FxComponent index={index} />;
}
