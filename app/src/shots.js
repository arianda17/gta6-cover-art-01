/**
 * app/src/shots.js
 * Reproducible ?shot= renders for screenshots.
 * ?shot=cover&size=...&layout=...&grade=...&title1=...&title2=...&tagline=...&kicker=...&photo=...&est=&new=&stars=&collector=
 * Renders a cover directly into an offscreen canvas at the export size,
 * then sets window.__shotReady so the capture harness can take the picture.
 */
import { createState } from "./state.js";
import { panelRects, bannerRect } from "./layouts.js";
import { renderCover } from "./render.js";

export function parseQuery(search) {
  const p = new URLSearchParams(search || location.search);
  const out = {};
  p.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "";
    img.onload = () => {
      img.loaded = true;
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function runCoverShot(canvas, params) {
  const state = createState();

  const layout = params.layout || "hero4";
  const grade = params.grade || "vice";
  const sizeKey = params.size || "1920x1080";

  state.layout = layout;
  state.grade = grade;
  state.exportSizeKey = sizeKey;

  state.kicker = params.kicker || "SOLMAR BAY";
  state.title1 = params.title1 || "VICE";
  state.title2 = params.title2 || "CITY";
  state.tagline = params.tagline || "where the tide keeps secrets";

  state.estBadge = params.est === "1";
  state.newBadge = params.new === "1";
  state.stars = params.stars !== "0";
  state.collector = params.collector === "1";

  const W = canvas.width;
  const H = canvas.height;

  // load the named default sample photo
  const photoUrl = "/samples/" + (params.photo || "boulevard") + ".jpg";
  const img = await loadImage(photoUrl);
  const photo = {
    id: "shot_photo_1",
    name: photoUrl,
    url: photoUrl,
    img,
    loaded: true,
    w: img.naturalWidth || img.width,
    h: img.naturalHeight || img.height,
  };
  state.photos.push(photo);

  const rects = panelRects(W, H, state.layout);
  state.panels = rects.map((_, i) => ({
    photoId: photo.id,
    crop: { sx: 0, sy: 0, sw: 1, sh: 1 },
    zoom: 1,
    mode: "cover",
  }));
  state.activePanelIndex = 0;

  const ctx = canvas.getContext("2d");
  renderCover(ctx, W, H, state);
  return state;
}