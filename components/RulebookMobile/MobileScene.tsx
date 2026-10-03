"use client";

import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, Environment } from "@react-three/drei";
import * as THREE from "three";
import { mobileProgressRef } from "./useMobileStore";
import { mapProgress, getGateZ, getGateX } from "./mobile.config";
import { OrreryBadgesUpdater } from "./MobileOrrery";
import { GateFX } from "./GateFX";

// The Key at the end of the corridor
function TheKey() {
  const ref = React.useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.2;
      ref.current.rotation.x = clock.elapsedTime * 0.1;
    }
  });

  return (
    <group position={[0, 4, getGateZ(11) - 9]}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[2, 0]} />
        <meshStandardMaterial
          color="#F2B632"
          metalness={0.8}
          roughness={0.2}
          flatShading
        />
        <lineSegments>
          <edgesGeometry args={[new THREE.IcosahedronGeometry(2, 0)]} />
          <lineBasicMaterial color="#FFD84D" />
        </lineSegments>
      </mesh>
      {/* Light pointing back */}
      <pointLight color="#FFD84D" intensity={10} distance={20} />
    </group>
  );
}

// 12 Gates
function Gates() {
  return (
    <group>
      {Array.from({ length: 12 }).map((_, i) => {
        const x = getGateX(i);
        const z = getGateZ(i);
        
        let shape;
        let args: any[];
        
        if (i < 3) {
           // Threshold: arch (half circle)
           shape = "ringGeometry";
           args = [3, 3.2, 16, 1, 0, Math.PI]; // Half ring
        } else if (i < 6) {
           // Circuit: octagon
           shape = "ringGeometry";
           args = [3, 3.2, 8];
        } else if (i < 9) {
           // Vault: hexagon
           shape = "ringGeometry";
           args = [3, 3.2, 6];
        } else {
           // Tribunal: tall double-pillar
           // we'll just use a plane or two boxes. For simplicity, two boxes.
           return (
             <group key={i} position={[x, 0, z]}>
                <mesh position={[-2, 3, 0]}>
                   <boxGeometry args={[0.5, 6, 0.5]} />
                   <meshBasicMaterial color="#F2B632" />
                </mesh>
                <mesh position={[2, 3, 0]}>
                   <boxGeometry args={[0.5, 6, 0.5]} />
                   <meshBasicMaterial color="#F2B632" />
                </mesh>
             </group>
           )
        }
        
        const Geom = shape as any;
        
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, i < 3 ? 0 : 2, 0]}>
              <Geom args={args} />
              <meshBasicMaterial color="#F2B632" side={THREE.DoubleSide} />
            </mesh>
            <GateFX index={i} />
          </group>
        );
      })}
    </group>
  );
}

function CameraController() {
  useFrame(({ camera }) => {
    const p = mobileProgressRef.current;
    const { gate, x, orreryP } = mapProgress(p);
    
    // Position camera based on "gate" smooth value
    // When gate=0, z = getGateZ(0), when gate=1, z = getGateZ(1)
    
    // Linear interpolation between gates
    const i = Math.floor(gate);
    const f = gate - i;
    const nextI = Math.min(i + 1, 11);
    
    const z1 = getGateZ(i);
    const z2 = getGateZ(nextI);
    let z = THREE.MathUtils.lerp(z1, z2, f) + 4; // Add 4 to keep camera slightly back

    const x1 = getGateX(i);
    const x2 = getGateX(nextI);
    let camX = THREE.MathUtils.lerp(x1, x2, f);

    // Orrery pull back
    if (orreryP > 0) {
      z += orreryP * 15; // Pull back by 15 units
      camX = THREE.MathUtils.lerp(camX, 0, orreryP); // Center X
    }

    camera.position.set(camX, 2 + orreryP * 2, z);
    
    // Look slightly forward and down
    camera.lookAt(camX, 2, z - 10 - orreryP * 5);
  });

  return null;
}

export default function MobileScene() {
  return (
    <Canvas
      className="rb-canvas"
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
    >
      <color attach="background" args={["#07080D"]} />
      <fogExp2 attach="fog" args={["#000000", 0.05]} />
      
      <PerspectiveCamera makeDefault fov={55} near={0.1} far={100} />
      
      <CameraController />

      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} color="#FFD84D" />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, -100]}>
        <planeGeometry args={[20, 300]} />
        <meshStandardMaterial color="#000000" metalness={0.9} roughness={0.1} />
        {/* Fake reflection with gradient/grid comes in refinement */}
      </mesh>

      <Gates />
      <TheKey />
      <OrreryBadgesUpdater />

    </Canvas>
  );
}
