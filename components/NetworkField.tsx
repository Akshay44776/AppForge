"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Canvas = dynamic(() => import("./NetworkFieldCanvas"), { ssr: false });

function webglOK(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export default function NetworkField() {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const lowEnd =
      (navigator.hardwareConcurrency || 8) < 4 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setSupported(webglOK() && !lowEnd);
  }, []);

  if (supported === null) return null;
  if (!supported) return <div className="absolute inset-0 network-fallback" aria-hidden />;
  return <Canvas />;
}
