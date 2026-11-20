/**
 * app/src/layouts.js
 * Layout panel rectangles for each layout at a given canvas size.
 * Returns array of { x, y, w, h, label } in canvas pixels.
 * Hero+4: large hero left, 4 small right (2×2). Banner at bottom.
 * Grid 3×3: 9 equal panels. Banner at bottom.
 * Hero+2: large hero top, 2 small bottom. Banner at bottom.
 * Split Duo: 2 equal vertical halves. Banner at bottom.
 * Full-Bleed Hero: single panel full canvas. Banner at bottom.
 */

export function panelRects(W, H, layout) {
  const bannerH = Math.round(H * 0.34); // ~34% of height for the gradient banner
  const contentH = H - bannerH;
  const gap = Math.max(2, Math.round(W * 0.006));
  const pad = Math.max(4, Math.round(W * 0.012));

  const r = [];

  switch (layout) {
    case "hero4": {
      // Hero: left ~55% of width, full contentH. 4 small: right 2×2.
      const heroW = Math.round(W * 0.55);
      const smallX = heroW + gap;
      const smallW = W - heroW - gap - pad;
      const smallH = (contentH - gap - pad) / 2;
      r.push({ x: pad, y: pad, w: heroW - pad, h: contentH - pad, label: "hero" });
      // 4 small: top-left, top-right, bottom-left, bottom-right
      r.push({ x: smallX, y: pad, w: smallW / 2, h: smallH, label: "sm1" });
      r.push({ x: smallX + smallW / 2 + gap / 2, y: pad, w: smallW / 2, h: smallH, label: "sm2" });
      r.push({ x: smallX, y: pad + smallH + gap, w: smallW / 2, h: smallH, label: "sm3" });
      r.push({ x: smallX + smallW / 2 + gap / 2, y: pad + smallH + gap, w: smallW / 2, h: smallH, label: "sm4" });
      break;
    }
    case "grid3x3": {
      const cellW = (W - pad * 2 - gap * 2) / 3;
      const cellH = (contentH - pad * 2 - gap * 2) / 3;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          r.push({
            x: pad + col * (cellW + gap),
            y: pad + row * (cellH + gap),
            w: cellW,
            h: cellH,
            label: `c${row}${col}`,
          });
        }
      }
      break;
    }
    case "hero2": {
      // Hero top ~65% of contentH, 2 small below
      const heroH = Math.round(contentH * 0.65);
      const smallY = heroH + gap;
      const smallH = contentH - heroH - gap - pad;
      r.push({ x: pad, y: pad, w: W - pad * 2, h: heroH, label: "hero" });
      const smallW = (W - pad * 2 - gap) / 2;
      r.push({ x: pad, y: smallY, w: smallW, h: smallH, label: "sm1" });
      r.push({ x: pad + smallW + gap, y: smallY, w: smallW, h: smallH, label: "sm2" });
      break;
    }
    case "split": {
      const halfW = (W - pad * 2 - gap) / 2;
      r.push({ x: pad, y: pad, w: halfW, h: contentH - pad, label: "left" });
      r.push({ x: pad + halfW + gap, y: pad, w: halfW, h: contentH - pad, label: "right" });
      break;
    }
    case "fullbleed": {
      r.push({ x: 0, y: 0, w: W, h: contentH, label: "full" });
      break;
    }
    default: {
      // fallback single
      r.push({ x: pad, y: pad, w: W - pad * 2, h: contentH - pad, label: "only" });
    }
  }

  return r;
}

export function bannerRect(W, H, layout) {
  const bannerH = Math.round(H * 0.34);
  return { x: 0, y: H - bannerH, w: W, h: bannerH };
}