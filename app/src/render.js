/**
 * app/src/render.js
 * Renders the whole cover onto a 2D canvas at an exact export size.
 * Order: base → photo panels → grade → banner → lettering → badges.
 *
 * Per-panel crop model: crop = { sx, sy, sw, sh } is the VIEW window in
 * normalized image coordinates (0..1). Default whole image. zoom shrinks the
 * window around its centre; pan moves it. Cover mode fills the panel; contain
 * mode shows the whole window with letterbox bars.
 */
import { panelRects, bannerRect } from "./layouts.js";
import { applyGrade, applyMono } from "./grades.js";

const TITLE_FONT = '"Anton", Impact, "Arial Narrow", sans-serif';
const KICKER_FONT = '"Bebas Neue", "Anton", Impact, sans-serif';
const SCRIPT_FONT = '"Pacifico", cursive';

export function renderCover(ctx, W, H, state) {
  ctx.clearRect(0, 0, W, H);

  // ---- base fill (deep dusk) ----
  ctx.fillStyle = "#140910";
  ctx.fillRect(0, 0, W, H);

  const rects = panelRects(W, H, state.layout);
  const br = bannerRect(W, H, state.layout);

  // ---- photo panels ----
  for (let i = 0; i < rects.length; i++) {
    drawPanel(ctx, rects[i], state.panels[i], state);
  }

  // ---- grade over the photo area ----
  if (state.grade === "mono") {
    applyMono(ctx, W, H);
  }
  applyGrade(ctx, W, H, state.grade);

  // ---- banner + lettering ----
  drawBanner(ctx, br, state, W, H);

  // ---- badges / stickers ----
  drawBadges(ctx, W, H, state);
}

// ------------------------------------------------------------------ panels
function drawPanel(ctx, rect, panel, state) {
  const photo =
    state.photos.find((p) => p.id === panel?.photoId) || state.photos[0];

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  // panel backing so a missing photo still reads as a panel, not black
  const bg = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  bg.addColorStop(0, "#3a1a2a");
  bg.addColorStop(1, "#20101a");
  ctx.fillStyle = bg;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  if (photo && photo.img && photo.loaded) {
    const img = photo.img;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    // view window (normalized) — default whole image
    let c = panel.crop || { sx: 0, sy: 0, sw: 1, sh: 1 };
    const z = Math.max(1, panel.zoom || 1);
    // zoom: shrink view window around its own centre
    let sw = c.sw / z;
    let sh = c.sh / z;
    let sx = c.sx + c.sw / 2 - sw / 2;
    let sy = c.sy + c.sh / 2 - sh / 2;
    sx = clamp(sx, 0, 1 - sw);
    sy = clamp(sy, 0, 1 - sh);

    const srcX = sx * iw;
    const srcY = sy * ih;
    const srcW = sw * iw;
    const srcH = sh * ih;

    const mode = panel.mode === "contain" ? "contain" : "cover";
    const scale =
      mode === "contain"
        ? Math.min(rect.w / srcW, rect.h / srcH)
        : Math.max(rect.w / srcW, rect.h / srcH);

    const dw = srcW * scale;
    const dh = srcH * scale;
    // cover: centre, but bias toward the top for portrait-in-wide panels so a
    // subject's head stays in frame (never crop a face off the top edge).
    const dx = rect.x + (rect.w - dw) / 2;
    let dy;
    if (mode === "contain") {
      dy = rect.y + (rect.h - dh) / 2;
    } else {
      const overflow = dh - rect.h;
      dy = overflow > 0 ? rect.y + overflow * 0.18 : rect.y + (rect.h - dh) / 2;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, srcX, srcY, srcW, srcH, dx, dy, dw, dh);
  }

  ctx.restore();

  // hairline panel frame for a printed-poster feel
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = Math.max(1, rect.w * 0.006);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

// ------------------------------------------------------------------ banner
function drawBanner(ctx, br, state, W, H) {
  const pad = Math.round(W * 0.026);
  const maxW = br.w - pad * 2;

  // vivid full-width pink → orange sunset gradient
  const g = ctx.createLinearGradient(br.x, br.y, br.x, br.y + br.h);
  g.addColorStop(0, "#ff1f6b");
  g.addColorStop(0.45, "#ff5a1f");
  g.addColorStop(0.8, "#ff8a1a");
  g.addColorStop(1, "#ffb03a");
  ctx.fillStyle = g;
  ctx.fillRect(br.x, br.y, br.w, br.h);

  // sun-disc + light streaks for texture
  ctx.save();
  ctx.beginPath();
  ctx.rect(br.x, br.y, br.w, br.h);
  ctx.clip();
  const sun = ctx.createRadialGradient(
    br.x + br.w * 0.5, br.y + br.h * 0.06, 10,
    br.x + br.w * 0.5, br.y + br.h * 0.06, br.h * 1.1
  );
  sun.addColorStop(0, "rgba(255,240,180,0.55)");
  sun.addColorStop(0.4, "rgba(255,150,60,0.18)");
  sun.addColorStop(1, "rgba(255,60,120,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(br.x, br.y, br.w, br.h);

  // diagonal glossy streak
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(br.x + br.w * 0.0, br.y + br.h);
  ctx.lineTo(br.x + br.w * 0.28, br.y);
  ctx.lineTo(br.x + br.w * 0.42, br.y);
  ctx.lineTo(br.x + br.w * 0.14, br.y + br.h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // top edge highlight line
  ctx.save();
  ctx.fillStyle = "rgba(255,240,200,0.7)";
  ctx.fillRect(br.x, br.y, br.w, Math.max(1, H * 0.003));
  ctx.restore();

  // ---------- vertical text layout ----------
  const kicker = (state.kicker || "").toUpperCase();
  const lines = [state.title1, state.title2].filter((t) => t && t.trim());
  const tagline = (state.tagline || "").trim();

  const innerTop = br.y + pad * 0.7;
  const innerBottom = br.y + br.h - pad * 0.7;
  const innerH = innerBottom - innerTop;

  // sizes
  const kickerSize = Math.round(br.h * 0.085);
  const taglineSize = Math.round(br.h * 0.072);
  const starSize = Math.round(br.h * 0.075);
  const gapK = Math.round(br.h * 0.02);
  const gapT = Math.round(br.h * 0.03);

  // title: largest size that fits width for all lines AND fits the height budget
  const heightBudget =
    innerH -
    (kicker ? kickerSize * 1.15 + gapK : 0) -
    (tagline ? taglineSize * 1.5 + gapT : 0) -
    starSize * 1.1 -
    gapT;

  let titleSize = Math.floor(heightBudget / (lines.length || 1) / 1.02);
  // width constraint: shrink until every line fits
  const fitted = fitTitleSize(ctx, lines, titleSize, maxW);
  titleSize = fitted;

  const lineH = titleSize * 0.94;

  // total block height, then centre it
  let blockH = 0;
  if (kicker) blockH += kickerSize * 1.15 + gapK;
  blockH += lineH * Math.max(1, lines.length);
  if (tagline) blockH += gapT + taglineSize * 1.5;
  blockH += starSize * 1.1 + Math.round(br.h * 0.01);

  let y = innerTop + Math.max(0, (innerH - blockH) / 2);

  // ---- kicker ----
  if (kicker) {
    ctx.save();
    ctx.font = `600 ${kickerSize}px ${KICKER_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.letterSpacing = `${Math.round(kickerSize * 0.28)}px`;
    ctx.fillStyle = "rgba(20,4,10,0.85)";
    ctx.fillText(kicker, W / 2 + kickerSize * 0.14, y + kickerSize);
    ctx.fillStyle = "#fff3d6";
    ctx.fillText(kicker, W / 2 + kickerSize * 0.14, y + kickerSize - Math.max(1, kickerSize * 0.03));
    ctx.restore();
    y += kickerSize * 1.15 + gapK;
  }

  // ---- title lines (font re-assigned immediately before each draw) ----
  for (const line of lines) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `400 ${titleSize}px ${TITLE_FONT}`;
    const measured = ctx.measureText(line).width;
    const cx = W / 2;

    if (state.titleShadow) {
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = titleSize * 0.12;
      ctx.shadowOffsetY = titleSize * 0.06;
    }

    if (state.titleOutline) {
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeStyle = "#140207";
      ctx.lineWidth = titleSize * 0.16;
      ctx.strokeText(line, cx, y + titleSize * 0.86, maxW);
    }

    if (state.titleGradient) {
      const tg = ctx.createLinearGradient(0, y, 0, y + titleSize);
      tg.addColorStop(0, "#fffef2");
      tg.addColorStop(0.5, "#ffe25a");
      tg.addColorStop(1, "#ffb01f");
      ctx.fillStyle = tg;
    } else {
      ctx.fillStyle = "#fffef2";
    }
    ctx.fillText(line, cx, y + titleSize * 0.86, maxW);

    // if measured exceeds maxW (very long single token), scale down next pass
    if (measured > maxW && titleSize > 12) {
      // already handled by fitTitleSize; this is a safety net
    }
    ctx.restore();
    y += lineH;
  }

  // ---- tagline ----
  if (tagline) {
    y += gapT;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    let tSize = taglineSize;
    ctx.font = `400 ${tSize}px ${SCRIPT_FONT}`;
    while (ctx.measureText(tagline).width > maxW && tSize > 10) {
      tSize -= 1;
      ctx.font = `400 ${tSize}px ${SCRIPT_FONT}`;
    }
    ctx.shadowColor = "rgba(60,0,30,0.5)";
    ctx.shadowBlur = tSize * 0.18;
    ctx.fillStyle = "#fff2df";
    ctx.fillText(tagline, W / 2, y + tSize);
    ctx.restore();
    y += taglineSize * 1.5;
  }

  // ---- star row (always present when state.stars) ----
  if (state.stars) {
    y += Math.round(br.h * 0.01);
    drawStars(ctx, W / 2, y + starSize * 0.5, starSize, 5);
  }
}

function fitTitleSize(ctx, lines, startSize, maxW) {
  if (!lines.length) return Math.max(12, startSize);
  let size = Math.max(12, Math.floor(startSize));
  for (; size > 10; size -= Math.max(1, Math.round(size * 0.02))) {
    ctx.font = `400 ${size}px ${TITLE_FONT}`;
    let ok = true;
    for (const l of lines) {
      if (ctx.measureText(l).width > maxW) { ok = false; break; }
    }
    if (ok) return size;
  }
  return 12;
}

// ------------------------------------------------------------------ badges
function drawBadges(ctx, W, H, state) {
  const s = Math.min(W, H) / 1080;
  const margin = Math.round(Math.min(W, H) * 0.022);

  if (state.estBadge) {
    const R = Math.round(Math.min(W, H) * 0.072);
    const cx = W - R - margin;
    const cy = R + margin;
    drawStarburst(ctx, cx, cy, R, "EST.", "2026");
  }

  if (state.newBadge) {
    const R = Math.round(Math.min(W, H) * 0.052);
    const cx = margin + R;
    const cy = H - margin - R;
    drawNewCircle(ctx, cx, cy, R);
  }

  if (state.collector) {
    // COLLECTORS EDITION sticker — inset by its own half-diagonal + margin so
    // it can never cross an edge at any export size.
    const w = W * 0.275;
    const h = Math.min(W * 0.092, H * 0.075);
    const ang = (-8 * Math.PI) / 180;
    const halfDiag = 0.5 * Math.hypot(w, h);
    const cx = W - halfDiag - margin;
    const cy = H - halfDiag - margin;
    drawSticker(ctx, cx, cy, w, h, ang);
  }
}

function drawStarburst(ctx, cx, cy, R, topText, bottomText) {
  const points = 12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.12);
  // burst
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI / points) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? R : R * 0.62;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
  g.addColorStop(0, "#ffe680");
  g.addColorStop(1, "#ffab1f");
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = R * 0.18;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = R * 0.05;
  ctx.strokeStyle = "#14260a";
  ctx.stroke();

  // text
  ctx.rotate(0.12);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#14260a";
  ctx.font = `600 ${Math.round(R * 0.34)}px ${KICKER_FONT}`;
  ctx.fillText(topText, 0, -R * 0.22);
  ctx.font = `700 ${Math.round(R * 0.46)}px ${KICKER_FONT}`;
  ctx.fillText(bottomText, 0, R * 0.22);
  ctx.restore();
}

function drawNewCircle(ctx, cx, cy, R) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.14);
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fillStyle = "#e21b3c";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = R * 0.2;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = R * 0.09;
  ctx.strokeStyle = "#fff2e0";
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${Math.round(R * 0.52)}px ${KICKER_FONT}`;
  ctx.fillText("NEW", 0, R * 0.02);
  ctx.restore();
}

function drawSticker(ctx, cx, cy, w, h, ang) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  const r = h * 0.24;
  const x = -w / 2;
  const y = -h / 2;

  // rounded rect path
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);

  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#fff14d");
  g.addColorStop(1, "#ffc11f");
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = h * 0.35;
  ctx.shadowOffsetY = h * 0.12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.lineWidth = Math.max(2, h * 0.06);
  ctx.strokeStyle = "#2a1200";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#20140a";
  ctx.font = `700 ${Math.round(h * 0.34)}px ${KICKER_FONT}`;
  ctx.fillText("COLLECTORS", 0, -h * 0.16);
  ctx.fillText("EDITION", 0, h * 0.2);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawStars(ctx, cx, cy, size, count) {
  const total = count * size * 1.18;
  let x = cx - total / 2 + size * 0.59;
  ctx.save();
  ctx.fillStyle = "#ffe14d";
  ctx.strokeStyle = "rgba(30,10,4,0.7)";
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = size * 0.15;
  for (let i = 0; i < count; i++) {
    star(ctx, x, cy, size * 0.5, size * 0.22, 5);
    ctx.fill();
    ctx.stroke();
    x += size * 1.18;
  }
  ctx.restore();
}

function star(ctx, cx, cy, outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI / points) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? outer : inner;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
