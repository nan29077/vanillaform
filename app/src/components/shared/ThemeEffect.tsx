"use client";

import { useEffect, useRef } from "react";
import { FeatureFlags } from "@/lib/featureFlags";

interface ThemeEffectProps {
  flags: FeatureFlags;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  emoji?: string;
  life: number;
  maxLife: number;
}

export default function ThemeEffect({ flags }: ThemeEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  // 활성 테마 감지
  const activeTheme = flags.themSnow ? "snow"
    : flags.themCherry ? "cherry"
    : flags.themHalloween ? "halloween"
    : flags.themChristmas ? "christmas"
    : flags.themValentine ? "valentine"
    : flags.themRainy ? "rainy"
    : flags.themSummer ? "summer"
    : flags.themAutumn ? "autumn"
    : null;

  useEffect(() => {
    if (!activeTheme) return;

    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "9999";
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d")!;
    particlesRef.current = [];

    const CONFIGS: Record<string, {
      spawnRate: number;
      create: () => Particle;
    }> = {
      snow: {
        spawnRate: 0.3,
        create: () => ({
          x: Math.random() * canvas.width,
          y: -10,
          size: Math.random() * 4 + 2,
          speedX: (Math.random() - 0.5) * 1,
          speedY: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.7 + 0.3,
          rotation: 0,
          rotationSpeed: 0,
          color: "255,255,255",
          life: 0,
          maxLife: 9999,
        }),
      },
      cherry: {
        spawnRate: 0.2,
        create: () => ({
          x: Math.random() * canvas.width,
          y: -10,
          size: Math.random() * 6 + 4,
          speedX: (Math.random() - 0.5) * 1.5,
          speedY: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.6 + 0.4,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.05,
          color: "255,182,193",
          life: 0,
          maxLife: 9999,
        }),
      },
      halloween: {
        spawnRate: 0.05,
        create: () => ({
          x: Math.random() * canvas.width,
          y: canvas.height + 10,
          size: Math.random() * 10 + 16,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: -(Math.random() * 1 + 0.5),
          opacity: Math.random() * 0.6 + 0.4,
          rotation: 0,
          rotationSpeed: 0,
          color: "255,140,0",
          emoji: Math.random() > 0.5 ? "🎃" : "🦇",
          life: 0,
          maxLife: 200,
        }),
      },
      christmas: {
        spawnRate: 0.25,
        create: () => ({
          x: Math.random() * canvas.width,
          y: -10,
          size: Math.random() * 5 + 3,
          speedX: (Math.random() - 0.5) * 1,
          speedY: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.7 + 0.3,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.03,
          color: Math.random() > 0.5 ? "255,50,50" : "50,200,50",
          life: 0,
          maxLife: 9999,
        }),
      },
      valentine: {
        spawnRate: 0.08,
        create: () => ({
          x: Math.random() * canvas.width,
          y: canvas.height + 10,
          size: Math.random() * 12 + 10,
          speedX: (Math.random() - 0.5) * 0.8,
          speedY: -(Math.random() * 1.5 + 0.5),
          opacity: Math.random() * 0.6 + 0.4,
          rotation: 0,
          rotationSpeed: 0,
          color: "255,80,120",
          emoji: "❤️",
          life: 0,
          maxLife: 180,
        }),
      },
      rainy: {
        spawnRate: 1.5,
        create: () => ({
          x: Math.random() * canvas.width,
          y: -10,
          size: Math.random() * 1 + 0.5,
          speedX: 2,
          speedY: Math.random() * 10 + 8,
          opacity: Math.random() * 0.4 + 0.2,
          rotation: 0,
          rotationSpeed: 0,
          color: "100,150,255",
          life: 0,
          maxLife: 9999,
        }),
      },
      summer: {
        spawnRate: 0.1,
        create: () => {
          const colors = ["255,200,0", "255,100,50", "255,50,150", "100,200,255", "150,255,100"];
          return {
            x: Math.random() * canvas.width,
            y: -10,
            size: Math.random() * 5 + 3,
            speedX: (Math.random() - 0.5) * 2,
            speedY: Math.random() * 2 + 1,
            opacity: Math.random() * 0.8 + 0.2,
            rotation: 0,
            rotationSpeed: 0,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 0,
            maxLife: 120,
          };
        },
      },
      autumn: {
        spawnRate: 0.15,
        create: () => {
          const colors = ["200,80,20", "220,120,0", "180,40,0", "230,160,0"];
          return {
            x: Math.random() * canvas.width,
            y: -10,
            size: Math.random() * 7 + 4,
            speedX: (Math.random() - 0.5) * 1.5,
            speedY: Math.random() * 1.5 + 0.5,
            opacity: Math.random() * 0.7 + 0.3,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.04,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 0,
            maxLife: 9999,
          };
        },
      },
    };

    const config = CONFIGS[activeTheme];

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 스폰
      if (Math.random() < config.spawnRate) {
        particlesRef.current.push(config.create());
      }

      // 업데이트 & 그리기
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;
        p.life++;

        const lifeRatio = p.life / p.maxLife;
        const opacity = p.maxLife < 9999 ? p.opacity * (1 - lifeRatio) : p.opacity;

        if (
          p.y > canvas.height + 20 ||
          p.x < -20 ||
          p.x > canvas.width + 20 ||
          p.life >= p.maxLife
        ) return false;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.emoji) {
          ctx.font = `${p.size * 2}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(p.emoji, 0, 0);
        } else if (activeTheme === "rainy") {
          ctx.strokeStyle = `rgba(${p.color},${opacity})`;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-6, 12);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${p.color},${opacity})`;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
        return true;
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [activeTheme]);

  return null;
}
