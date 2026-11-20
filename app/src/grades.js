/**
 * app/src/grades.js
 * Color grades applied as overlay + vignette on the canvas.
 * Each grade produces a VISIBLY different look.
 * Vice Sunset (default): warm orange/magenta cast + strong vignette.
 * Neon Night: deep blue/purple with cyan neon glow.
 * Palm Gold: golden amber sunset.
 * Mono Noir: high-contrast B&W.
 * Halftone Pop: saturated color + halftone dot overlay.
 * Teal Dawn: cool teal/blue morning.
 */

export function applyGrade(ctx, W, H, grade) {
  const { tint, vignette, halftone } = gradeParams(grade);

  // 1) tint overlay (on top of photos)
  if (tint) {
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 2) vignette (always on top)
  if (vignette) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    const vg = ctx.createRadialGradient(
      W * 0.5, H * 0.45, Math.min(W, H) * 0.15,
      W * 0.5, H * 0.45, Math.max(W, H) * 0.75
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(0.55, vignette.mid);
    vg.addColorStop(1, vignette.edge);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 3) halftone dots (Halftone Pop only)
  if (halftone) {
    drawHalftone(ctx, W, H, halftone);
  }
}

function gradeParams(grade) {
  switch (grade) {
    case "vice": // Vice Sunset — DEFAULT, warm orange/magenta cast + strong vignette
      return {
        tint: "rgba(255, 60, 30, 0.28)", // warm orange
        // also add a magenta wash via a second soft-light pass
        extraTint: { color: "rgba(200, 20, 120, 0.18)", op: "soft-light" },
        vignette: { mid: "rgba(40, 10, 20, 0.35)", edge: "rgba(10, 2, 8, 0.95)" },
      };
    case "neon": // Neon Night — deep blue/purple with cyan neon
      return {
        tint: "rgba(30, 10, 80, 0.32)",
        extraTint: { color: "rgba(0, 200, 220, 0.12)", op: "screen" },
        vignette: { mid: "rgba(5, 0, 25, 0.4)", edge: "rgba(0, 0, 10, 0.98)" },
      };
    case "palm": // Palm Gold — golden amber
      return {
        tint: "rgba(255, 180, 20, 0.3)",
        extraTint: { color: "rgba(255, 120, 0, 0.15)", op: "soft-light" },
        vignette: { mid: "rgba(40, 30, 0, 0.3)", edge: "rgba(20, 10, 0, 0.9)" },
      };
    case "mono": // Mono Noir — high-contrast B&W
      return {
        tint: "none", // handled via globalCompositeOperation "luminosity" + contrast
        mono: true,
        vignette: { mid: "rgba(0,0,0,0.25)", edge: "rgba(0,0,0,0.9)" },
      };
    case "halftone": // Halftone Pop — saturated + halftone dots
      return {
        tint: "rgba(255, 40, 80, 0.22)",
        extraTint: { color: "rgba(0, 255, 180, 0.1)", op: "overlay" },
        vignette: { mid: "rgba(20, 5, 15, 0.25)", edge: "rgba(10, 0, 8, 0.85)" },
        halftone: { dotSize: 3, spacing: 6, opacity: 0.12 },
      };
    case "teal": // Teal Dawn — cool teal/blue
      return {
        tint: "rgba(10, 140, 160, 0.3)",
        extraTint: { color: "rgba(80, 200, 255, 0.1)", op: "soft-light" },
        vignette: { mid: "rgba(0, 25, 30, 0.3)", edge: "rgba(0, 10, 15, 0.9)" },
      };
    default:
      return { tint: "none", vignette: { mid: "rgba(0,0,0,0)", edge: "rgba(0,0,0,0)" } };
  }
}

// drawHalftone: simple ordered dither / dot screen
function drawHalftone(ctx, W, H, params) {
  const { dotSize, spacing, opacity } = params;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = "#000";
  for (let y = 0; y < H; y += spacing) {
    const offset = (y / spacing) % 2 === 0 ? 0 : spacing / 2;
    for (let x = offset; x < W; x += spacing) {
      // vary dot size slightly for organic feel
      const r = dotSize * (0.7 + 0.3 * Math.sin(x * 0.03 + y * 0.02));
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Mono Noir: convert canvas to high-contrast grayscale
export function applyMono(ctx, W, H) {
  const imgData = ctx.getImageData(0, 0, W, H);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    // boost contrast
    const c = Math.min(255, Math.max(0, (l - 128) * 1.4 + 128));
    d[i] = d[i + 1] = d[i + 2] = c;
  }
  ctx.putImageData(imgData, 0, 0);
}