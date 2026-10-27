/**
 * Botanical Confetti Engine
 * Renders an organic, celebratory shower of botanical emerald leaves,
 * champagne gold ribbons, and warm amber sparkles on a dedicated HTML5 canvas.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  shape: 'leaf' | 'ribbon' | 'sparkle' | 'circle';
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  opacity: number;
  decay: number;
  gravity: number;
  drag: number;
}

const BOTANICAL_PALETTE = [
  '#059669', // Emerald 600
  '#10B981', // Emerald 500
  '#047857', // Emerald 700
  '#34D399', // Mint 400
  '#F59E0B', // Amber 500
  '#D97706', // Amber 600
  '#FCD34D', // Gold 300
  '#A7F3D0', // Sage / Mint 200
  '#FEF3C7', // Champagne 100
];

let activeCanvas: HTMLCanvasElement | null = null;
let activeCtx: CanvasRenderingContext2D | null = null;
let animationFrameId: number | null = null;
let particles: Particle[] = [];

function ensureCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (activeCanvas && activeCtx) {
    return { canvas: activeCanvas, ctx: activeCtx };
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'botanical-confetti-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true })!;

  const handleResize = () => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
  };

  handleResize();
  window.addEventListener('resize', handleResize);

  activeCanvas = canvas;
  activeCtx = ctx;

  return { canvas, ctx };
}

function cleanupCanvas() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (activeCanvas && activeCanvas.parentNode) {
    activeCanvas.parentNode.removeChild(activeCanvas);
  }
  activeCanvas = null;
  activeCtx = null;
  particles = [];
}

/**
 * Creates particles bursting from specified coordinate or dual lower corners
 */
export function fireBotanicalConfetti(originX?: number, originY?: number, particleCount = 90) {
  const { canvas, ctx } = ensureCanvas();
  const width = window.innerWidth;
  const height = window.innerHeight;

  const shapes: Particle['shape'][] = ['leaf', 'leaf', 'ribbon', 'sparkle', 'circle'];

  const spawnFromOrigin = (startX: number, startY: number, angleDeg: number, spreadDeg: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = ((angleDeg + (Math.random() * spreadDeg - spreadDeg / 2)) * Math.PI) / 180;
      const speed = Math.random() * 14 + 10;
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const color = BOTANICAL_PALETTE[Math.floor(Math.random() * BOTANICAL_PALETTE.length)];

      particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        shape,
        size: shape === 'leaf' ? Math.random() * 8 + 8 : shape === 'ribbon' ? Math.random() * 6 + 6 : Math.random() * 5 + 4,
        color,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.12 + 0.05,
        opacity: 1,
        decay: Math.random() * 0.008 + 0.006,
        gravity: 0.35 + Math.random() * 0.15,
        drag: 0.982,
      });
    }
  };

  if (originX !== undefined && originY !== undefined) {
    // 360 degree omni-burst from custom point (e.g. badge tap)
    spawnFromOrigin(originX, originY, -90, 160, particleCount);
  } else {
    // Classic dual-cannon botanical celebration from bottom corners
    const leftX = width * 0.12;
    const rightX = width * 0.88;
    const bottomY = height * 0.92;

    spawnFromOrigin(leftX, bottomY, -65, 45, Math.floor(particleCount * 0.55));
    spawnFromOrigin(rightX, bottomY, -115, 45, Math.floor(particleCount * 0.55));
  }

  if (!animationFrameId) {
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 16.6, 2.5);
      lastTime = currentTime;

      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Physics update
        p.vx *= Math.pow(p.drag, dt);
        p.vy = p.vy * Math.pow(p.drag, dt) + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotationSpeed * dt;
        p.wobble += p.wobbleSpeed * dt;
        p.opacity -= p.decay * dt;

        if (p.opacity <= 0 || p.y > height + 50) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;

        // Render distinct organic shapes
        if (p.shape === 'leaf') {
          // Botanical curved leaf/petal shape
          const flutter = Math.sin(p.wobble);
          ctx.scale(1, flutter);
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.bezierCurveTo(p.size * 0.8, -p.size * 0.4, p.size * 0.8, p.size * 0.4, 0, p.size);
          ctx.bezierCurveTo(-p.size * 0.8, p.size * 0.4, -p.size * 0.8, -p.size * 0.4, 0, -p.size);
          ctx.fill();
        } else if (p.shape === 'ribbon') {
          // Twisting gold ribbon
          const flutter = Math.cos(p.wobble);
          ctx.scale(flutter, 1);
          ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
        } else if (p.shape === 'sparkle') {
          // 4-point diamond star
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.quadraticCurveTo(0, 0, p.size, 0);
          ctx.quadraticCurveTo(0, 0, 0, p.size);
          ctx.quadraticCurveTo(0, 0, -p.size, 0);
          ctx.quadraticCurveTo(0, 0, 0, -p.size);
          ctx.fill();
        } else {
          // Round glistening spore
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(loop);
      } else {
        cleanupCanvas();
      }
    };

    animationFrameId = requestAnimationFrame(loop);
  }
}
