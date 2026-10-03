"use client";

import * as React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mobileProgressRef, mobileStore } from "./useMobileStore";
import { rules, pad2 } from "../rulebook/rules.data";

// Precompute icosahedron vertices for the badges
const icosahedronGeometry = new THREE.IcosahedronGeometry(3, 0);
const vertices = icosahedronGeometry.attributes.position;
const vertexVectors: THREE.Vector3[] = [];
for (let i = 0; i < vertices.count; i++) {
   vertexVectors.push(new THREE.Vector3(vertices.getX(i), vertices.getY(i), vertices.getZ(i)));
}
// 12 unique vertices in an icosahedron. Geometry has 12 unique vertices.
// The geometry buffer has duplicate vertices for flat faces, so we need to deduplicate them.
const uniqueVertices: THREE.Vector3[] = [];
for (const v of vertexVectors) {
   if (!uniqueVertices.some(uv => uv.distanceTo(v) < 0.1)) {
      uniqueVertices.push(v);
   }
}

export function OrreryBadgesUpdater() {
  const { camera, size } = useThree();
  const v = new THREE.Vector3();
  const obj = new THREE.Object3D();

  useFrame(({ clock }) => {
    const p = mobileProgressRef.current;
    
    // We only care if we are near or in orrery
    // from config: mapProgress returns orreryP
    const TOTAL_SVH = 1040;
    const ORRERY = 100 / TOTAL_SVH;
    const orreryP = Math.max(0, Math.min(1, (p - (1 - ORRERY)) / ORRERY));

    // The key's rotation matches TheKey in MobileScene
    obj.rotation.y = clock.elapsedTime * 0.2;
    obj.rotation.x = clock.elapsedTime * 0.1;
    obj.position.set(0, 4, -14 * 11 - 30 - 9); // Z position matches TheKey's getGateZ(11) - 9
    
    // Actually wait, TheKey position is [0, 4, getGateZ(11) - 9].
    // Let's use getGateZ(11) from config. But we can just hardcode or import it.
    obj.position.z = -184 - 9; // getGateZ(11) = -14*11 - 30 = -154 - 30 = -184. -9 = -193.
    obj.updateMatrixWorld();

    for (let i = 0; i < 12; i++) {
       const el = document.getElementById(`rb-orrery-badge-${i}`);
       if (!el) continue;
       
       if (orreryP < 0.05) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
       }

       const uv = uniqueVertices[i % uniqueVertices.length];
       v.copy(uv);
       v.applyMatrix4(obj.matrixWorld);
       v.project(camera);

       const x = (v.x * 0.5 + 0.5) * size.width;
       const y = (-(v.y * 0.5) + 0.5) * size.height;
       
       // depth sorting and scaling
       const z = v.z; // -1 to 1. lower is closer.
       const scale = Math.max(0.3, 1 - (z + 1) * 0.5);
       
       // Only show front ones
       const opacity = z < 0.99 ? orreryP * scale : 0;
       
       el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
       el.style.opacity = `${opacity}`;
       el.style.zIndex = `${Math.round((1 - z) * 100)}`;
       el.style.pointerEvents = opacity > 0.3 ? 'auto' : 'none';
    }
  });

  return null;
}

export function OrreryBadgesDOM() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}>
      {rules.map((r, i) => (
         <button
            key={r.id}
            id={`rb-orrery-badge-${i}`}
            onClick={() => mobileStore.setOpenRule(r.id)}
            style={{
               position: 'absolute',
               left: 0,
               top: 0,
               width: '48px',
               height: '48px',
               borderRadius: '50%',
               background: 'rgba(242, 182, 50, 0.1)',
               border: '1px solid #F2B632',
               color: '#F2B632',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               fontFamily: 'var(--font-grotesk)',
               fontWeight: 'bold',
               fontSize: '1.2rem',
               backdropFilter: 'blur(4px)',
               cursor: 'pointer',
               opacity: 0,
               willChange: 'transform, opacity',
               padding: 0,
            }}
         >
            {pad2(r.id)}
         </button>
      ))}
    </div>
  );
}
