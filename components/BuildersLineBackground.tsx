"use client";

import React, { useEffect, useRef } from "react";

export default function BuildersLineBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrameId: number;

    const NUM_LINES = 15;
    const NUM_EMBERS = 30;

    const lines = Array.from({ length: NUM_LINES }).map(() => ({
      y: 0,
      pulseX: 0,
      pulseSpeed: 0,
      opacity: 0,
    }));

    const embers = Array.from({ length: NUM_EMBERS }).map(() => ({
      x: 0,
      y: 0,
      size: 0,
      speedY: 0,
      swayOffset: 0,
      swaySpeed: 0,
    }));

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Re-initialize entity positions on resize
      lines.forEach((line) => {
        line.y = height * 0.15 + Math.random() * height * 0.7;
        line.pulseX = Math.random() * width;
        line.pulseSpeed = 0.5 + Math.random() * 1.5;
        line.opacity = 0.03 + Math.random() * 0.07;
      });

      embers.forEach((ember) => {
        ember.x = Math.random() * width;
        ember.y = Math.random() * height;
        ember.size = Math.random() * 1.2 + 0.3;
        ember.speedY = 0.2 + Math.random() * 0.4;
        ember.swayOffset = Math.random() * Math.PI * 2;
        ember.swaySpeed = 0.005 + Math.random() * 0.015;
      });
    };

    window.addEventListener("resize", resize);
    resize();

    // Faint Silhouettes (Laptop & Phone in deep background)
    const drawSilhouettes = (ctx: CanvasRenderingContext2D) => {
      ctx.save();
      // Very faint fill and stroke
      ctx.fillStyle = "rgba(23, 28, 36, 0.4)"; // --surface-2 equivalent with low opacity
      ctx.strokeStyle = "rgba(236, 232, 222, 0.02)";
      ctx.lineWidth = 1;

      const centerX = width / 2;
      const centerY = height / 2;

      // Laptop
      const lw = Math.min(width * 0.35, 500);
      const lh = lw * 0.6;
      const lx = centerX - lw / 2;
      const ly = centerY - lh / 2 - 20;

      // Screen
      ctx.beginPath();
      ctx.roundRect(lx, ly, lw, lh, 6);
      ctx.fill();
      ctx.stroke();

      // Base
      ctx.beginPath();
      ctx.roundRect(lx - 20, ly + lh, lw + 40, 8, 4);
      ctx.fill();
      ctx.stroke();

      // Phone (standing to the right)
      const pw = lw * 0.2;
      const ph = pw * 2;
      const px = lx + lw + 40;
      const py = ly + lh - ph + 8;

      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 10);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    };

    const render = () => {
      // Deep navy void background
      ctx.fillStyle = "#07090d";
      ctx.fillRect(0, 0, width, height);

      // Draw faint silhouettes in deep background
      drawSilhouettes(ctx);

      // Render Circuit Lines
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      lines.forEach((line) => {
        // Base thin line
        ctx.beginPath();
        ctx.moveTo(0, line.y);
        ctx.lineTo(width, line.y);
        ctx.strokeStyle = `rgba(217, 169, 74, ${line.opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Traveling pulse
        line.pulseX += line.pulseSpeed;
        if (line.pulseX > width + 200) {
          line.pulseX = -200; // reset to left
        }

        const gradient = ctx.createLinearGradient(
          line.pulseX - 100,
          line.y,
          line.pulseX + 100,
          line.y
        );
        gradient.addColorStop(0, "rgba(217, 169, 74, 0)");
        gradient.addColorStop(0.5, "rgba(217, 169, 74, 0.5)");
        gradient.addColorStop(1, "rgba(217, 169, 74, 0)");

        ctx.beginPath();
        ctx.moveTo(line.pulseX - 100, line.y);
        ctx.lineTo(line.pulseX + 100, line.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#d9a94a";
        ctx.stroke();
      });
      ctx.restore();

      // Render Embers
      ctx.save();
      ctx.fillStyle = "#d9a94a";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#d9a94a";
      
      embers.forEach((ember) => {
        ember.y -= ember.speedY;
        ember.swayOffset += ember.swaySpeed;
        const x = ember.x + Math.sin(ember.swayOffset) * 15;

        if (ember.y < -10) {
          ember.y = height + 10;
          ember.x = Math.random() * width;
        }

        ctx.beginPath();
        ctx.arc(x, ember.y, ember.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
