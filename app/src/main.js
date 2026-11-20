/**
 * app/src/main.js
 * Vice Cover Studio — editor UI + shot entry point.
 * Wires every control to state and keeps the live preview rendering.
 */

import { createState, addPhoto, ensurePanels, getActivePanel, setActivePanel, updatePanelZoom, setPanelMode, setPanelPhoto, exportSizeForKey, LAYOUTS, GRADES, EXPORT_SIZES } from "./state.js";
import { renderCover } from "./render.js";
import { exportPNG, exportDataURL } from "./export.js";
import { parseQuery, runCoverShot } from "./shots.js";

const canvas = document.getElementById("preview");
const ctx = canvas.getContext("2d", { alpha: false });
const shotWrap = document.getElementById("shotwrap");
const shotCover = document.getElementById("cover");
const sidebar = document.querySelector(".sidebar");
const stageBadge = document.querySelector(".stage-badge");
const stageNote = document.querySelector(".stage-note");

const params = parseQuery(location.search);
const isShot = params.shot === "cover";
const isEditorShot = params.shot === "editor";

const state = createState();

let raf = 0;
let fontsReady = false;

function redraw() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(drawPreview);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "";
    img.onload = () => { img.loaded = true; resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

// ------------------------------------------------------------------ sizing
function sizeCanvas() {
  const stage = document.querySelector(".stage");
  const rect = stage.getBoundingClientRect();
  const W = Math.max(320, Math.floor(rect.width));
  const H = Math.max(240, Math.floor(rect.height));
  if (canvas.width === W && canvas.height === H) return;
  canvas.width = W;
  canvas.height = H;
  drawPreview();
}

function drawPreview() {
  if (!canvas.width || !canvas.height) return;
  renderCover(ctx, canvas.width, canvas.height, state);
}

// ------------------------------------------------------------------ photo loading
function addPhotoWithImg(name, img) {
  const id = "photo_" + name + "_" + Math.random().toString(36).slice(2, 6);
  state.photos.push({
    id, name, file: null, url: "/samples/" + name + ".jpg", img, loaded: true,
    w: img.naturalWidth || img.width, h: img.naturalHeight || img.height,
  });
  return id;
}

async function loadDefaultPhotos() {
  const ids = [];
  for (const name of ["boulevard", "pier"]) {
    try {
      const img = await loadImage("/samples/" + name + ".jpg");
      ids.push(addPhotoWithImg(name, img));
    } catch (e) {
      console.warn("failed to load sample", name, e);
    }
  }
  if (ids.length) state.activePhotoId = ids[0];
  return ids;
}

function panelCountForLayout(layout) {
  switch (layout) {
    case "hero4": return 5;
    case "grid3x3": return 9;
    case "hero2": return 3;
    case "split": return 2;
    case "fullbleed": return 1;
    default: return 1;
  }
}

function applyShotParams(state, p) {
  state.layout = p.layout || state.layout;
  state.grade = p.grade || state.grade;
  state.kicker = p.kicker || state.kicker;
  state.title1 = p.title1 || state.title1;
  state.title2 = p.title2 || state.title2;
  state.tagline = p.tagline || state.tagline;
  state.estBadge = p.est === "1";
  state.newBadge = p.new === "1";
  state.stars = p.stars !== "0";
  state.collector = p.collector === "1";
  state.exportSizeKey = p.size || "1920x1080";
}

// ------------------------------------------------------------------ UI build
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }

function buildUI() {
  const layoutBtns = LAYOUTS.map(l => {
    const label = { hero4:"Hero + 4", grid3x3:"Grid 3×3", hero2:"Hero + 2", split:"Split Duo", fullbleed:"Full Bleed" }[l];
    return `<button class="btn" data-layout="${l}" title="${label}"><span class="k">${label}</span><span>${label}</span></button>`;
  }).join("");

  const gradeBtns = GRADES.map(g => {
    const label = { vice:"Vice Sunset", neon:"Neon Night", palm:"Palm Gold", mono:"Mono Noir", halftone:"Halftone Pop", teal:"Teal Dawn" }[g];
    const color = { vice:"#ff1f6b", neon:"#3a1cff", palm:"#f7c948", mono:"#e5e5e5", halftone:"#ff2d78", teal:"#2bb3c4" }[g];
    return `<button class="btn grade-btn" data-grade="${g}" title="${label}"><span class="swatch" style="background:${color}"></span><span>${label}</span></button>`;
  }).join("");

  const html = `
    <div class="section">
      <h2>PHOTOS</h2>
      <div class="panel-list" id="panelList"></div>
      <div class="field" style="margin-top:8px;">
        <label>Add photo <b>▶</b></label>
        <input type="file" id="photoFile" accept="image/*" multiple style="width:100%;font-size:11px;padding:4px 6px;background:var(--card2);border:1px dashed var(--line);color:var(--text);border-radius:8px;">
      </div>
    </div>

    <div class="section">
      <h2>LAYOUT</h2>
      <div class="grid" id="layoutGrid">${layoutBtns}</div>
    </div>

    <div class="section">
      <h2>GRADE</h2>
      <div class="grid" id="gradeGrid">${gradeBtns}</div>
    </div>

    <div class="section">
      <h2>PER PANEL <span style="font-weight:500;font-size:10px;opacity:.7">(panel ${state.activePanelIndex+1})</span></h2>
      <div class="panel-controls">
        <div class="field">
          <label>Photo <b>drag to pan • slider zoom</b></label>
          <select id="panelPhoto" style="width:100%;background:var(--card2);border:1px solid var(--line);color:var(--text);padding:6px 8px;border-radius:8px;font-size:12px;"></select>
        </div>
        <div class="field">
          <label>Fit / Fill <b>mode</b></label>
          <div class="seg">
            <button class="seg-btn" data-mode="cover">Fill</button>
            <button class="seg-btn" data-mode="contain">Fit</button>
          </div>
        </div>
        <div class="field">
          <label>Zoom <b id="zoomVal">1.0×</b></label>
          <input type="range" id="panelZoom" min="1" max="4" step="0.1" value="1">
        </div>
        <p style="font-size:10px;color:var(--muted);margin-top:6px;">Click a panel in the preview to select it; drag to pan its photo.</p>
      </div>
    </div>

    <div class="section">
      <h2>LETTERING</h2>
      <div class="grid">
        <input class="text-input" id="inKicker" placeholder="kicker" maxlength="30">
        <input class="text-input" id="inTitle1" placeholder="title line 1" maxlength="24">
        <input class="text-input" id="inTitle2" placeholder="title line 2" maxlength="24">
        <input class="text-input" id="inTagline" placeholder="tagline" maxlength="40">
      </div>
      <div class="toggle-row" style="margin-top:8px;">
        <button class="pill" data-toggle="titleOutline">Outline</button>
        <button class="pill" data-toggle="titleGradient">Gradient</button>
        <button class="pill" data-toggle="titleShadow">Shadow</button>
      </div>
      <div class="toggle-row" style="margin-top:8px;">
        <button class="pill" data-toggle="estBadge">EST. starburst</button>
        <button class="pill" data-toggle="newBadge">NEW circle</button>
        <button class="pill" data-toggle="stars">Star row</button>
        <button class="pill" data-toggle="collector">Collectors sticker</button>
      </div>
    </div>

    <div class="section">
      <h2>EXPORT</h2>
      <div class="export-btns" id="exportGrid">
        ${EXPORT_SIZES.map(s => `<button class="export-btn" data-size="${s.key}"><span>${s.label}</span><span class="dim">${s.w}×${s.h}</span></button>`).join("")}
      </div>
      <button class="btn" id="doExport" style="width:100%;margin-top:8px;padding:12px;">Export PNG</button>
    </div>

    <div class="section">
      <h2>HOW IT WORKS</h2>
      <ul class="steps">
        <li><span class="n">1</span>Pick a layout and a grade.</li>
        <li><span class="n">2</span>Crop &amp; position each photo; edit the caption.</li>
        <li><span class="n">3</span>Export PNG at 1080×1080, 1080×1350 or 1920×1080.</li>
      </ul>
    </div>
  `;
  sidebar.innerHTML = html;
}

// ------------------------------------------------------------------ UI bind
function bindUI() {
  // layout
  sidebar.querySelectorAll("[data-layout]").forEach(b => {
    b.addEventListener("click", () => {
      state.layout = b.dataset.layout;
      ensurePanels(state, panelCountForLayout(state.layout));
      setActivePanel(state, 0);
      refreshAll();
    });
  });
  // grade
  sidebar.querySelectorAll("[data-grade]").forEach(b => {
    b.addEventListener("click", () => {
      state.grade = b.dataset.grade;
      refreshAll();
    });
  });
  // lettering inputs
  const inKicker = document.getElementById("inKicker");
  const inTitle1 = document.getElementById("inTitle1");
  const inTitle2 = document.getElementById("inTitle2");
  const inTagline = document.getElementById("inTagline");
  [inKicker, inTitle1, inTitle2, inTagline].forEach(el => {
    el.addEventListener("input", () => {
      if (el === inKicker) state.kicker = el.value;
      else if (el === inTitle1) state.title1 = el.value;
      else if (el === inTitle2) state.title2 = el.value;
      else state.tagline = el.value;
      redraw();
    });
  });
  // effect toggles
  sidebar.querySelectorAll("[data-toggle]").forEach(b => {
    b.addEventListener("click", () => {
      const key = b.dataset.toggle;
      state[key] = !state[key];
      refreshAll();
    });
  });
  // export sizes
  const exportGrid = document.getElementById("exportGrid");
  exportGrid.querySelectorAll("[data-size]").forEach(b => {
    b.addEventListener("click", () => {
      state.exportSizeKey = b.dataset.size;
      refreshAll();
    });
  });
  document.getElementById("doExport").addEventListener("click", () => {
    const dim = exportSizeForKey(state.exportSizeKey);
    exportPNG(state, `vice-cover-${dim.key}.png`);
  });
  // photo file
  document.getElementById("photoFile").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      const url = URL.createObjectURL(f);
      try {
        const img = await loadImage(url);
        addPhoto(state, f, url, f.name);
        const id = state.photos[state.photos.length - 1].id;
        addPhotoWithImgFromState(id, img);
      } catch (err) { console.warn("bad image", f.name, err); }
    }
    e.target.value = "";
    refreshAll();
  });
  // per-panel controls
  const panelPhoto = document.getElementById("panelPhoto");
  const panelZoom = document.getElementById("panelZoom");
  const zoomVal = document.getElementById("zoomVal");

  panelPhoto.addEventListener("change", () => {
    setPanelPhoto(state, state.activePanelIndex, panelPhoto.value);
    redraw();
  });
  panelZoom.addEventListener("input", () => {
    const z = parseFloat(panelZoom.value);
    zoomVal.textContent = z.toFixed(1) + "×";
    updatePanelZoom(state, state.activePanelIndex, z);
    redraw();
  });
  sidebar.querySelectorAll(".seg-btn").forEach(b => {
    b.addEventListener("click", () => {
      sidebar.querySelectorAll(".seg-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      setPanelMode(state, state.activePanelIndex, b.dataset.mode);
      redraw();
    });
  });

  // canvas interaction: click selects panel under pointer; drag pans active panel
  let dragging = false;
  let start = { x: 0, y: 0 };
  let startCrop = { sx: 0, sy: 0 };

  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * sx;
    const y = (e.clientY - rect.top) * sy;
    const rects = panelRectsFor(state.layout, canvas.width, canvas.height);
    let hit = -1;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) { hit = i; break; }
    }
    if (hit >= 0) {
      setActivePanel(state, hit);
      rebuildPanelSelect();
      refreshPanelUI();
    }
    dragging = true;
    start.x = x; start.y = y;
    startCrop = { sx: getActivePanel(state).crop.sx, sy: getActivePanel(state).crop.sy };
    canvas.classList.add("panning");
  });
  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * sx;
    const y = (e.clientY - rect.top) * sy;
    const panel = getActivePanel(state);
    const viewW = panel.crop.sw / Math.max(1, panel.zoom);
    const viewH = panel.crop.sh / Math.max(1, panel.zoom);
    // need panel rect to convert px -> normalized; recompute
    const rects = panelRectsFor(state.layout, canvas.width, canvas.height);
    const r = rects[state.activePanelIndex];
    if (r) {
      const dx = x - start.x;
      const dy = y - start.y;
      let nsx = startCrop.sx - (dx / r.w) * viewW;
      let nsy = startCrop.sy - (dy / r.h) * viewH;
      nsx = Math.max(0, Math.min(1 - viewW, nsx));
      nsy = Math.max(0, Math.min(1 - viewH, nsy));
      panel.crop.sx = nsx;
      panel.crop.sy = nsy;
    }
    redraw();
  });
  window.addEventListener("pointerup", () => {
    dragging = false;
    canvas.classList.remove("panning");
  });

  window.addEventListener("resize", () => { cancelAnimationFrame(raf); raf=requestAnimationFrame(sizeCanvas); });
}

function panelRectsFor(layout, W, H) {
  // inline copy of layout math (avoid import cycle) — same as layouts.js panelRects
  const bannerH = Math.round(H * 0.34);
  const contentH = H - bannerH;
  const gap = Math.max(2, Math.round(W * 0.006));
  const pad = Math.max(4, Math.round(W * 0.012));
  const r = [];
  if (layout === "hero4") {
    const heroW = Math.round(W * 0.55);
    const smallX = heroW + gap;
    const smallW = W - heroW - gap - pad;
    const smallH = (contentH - gap - pad) / 2;
    r.push({ x: pad, y: pad, w: heroW - pad, h: contentH - pad });
    r.push({ x: smallX, y: pad, w: smallW / 2, h: smallH });
    r.push({ x: smallX + smallW / 2 + gap / 2, y: pad, w: smallW / 2, h: smallH });
    r.push({ x: smallX, y: pad + smallH + gap, w: smallW / 2, h: smallH });
    r.push({ x: smallX + smallW / 2 + gap / 2, y: pad + smallH + gap, w: smallW / 2, h: smallH });
  } else if (layout === "grid3x3") {
    const cellW = (W - pad * 2 - gap * 2) / 3;
    const cellH = (contentH - pad * 2 - gap * 2) / 3;
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++)
        r.push({ x: pad + col * (cellW + gap), y: pad + row * (cellH + gap), w: cellW, h: cellH });
  } else if (layout === "hero2") {
    const heroH = Math.round(contentH * 0.65);
    const smallY = heroH + gap;
    const smallH = contentH - heroH - gap - pad;
    r.push({ x: pad, y: pad, w: W - pad * 2, h: heroH });
    const smallW = (W - pad * 2 - gap) / 2;
    r.push({ x: pad, y: smallY, w: smallW, h: smallH });
    r.push({ x: pad + smallW + gap, y: smallY, w: smallW, h: smallH });
  } else if (layout === "split") {
    const halfW = (W - pad * 2 - gap) / 2;
    r.push({ x: pad, y: pad, w: halfW, h: contentH - pad });
    r.push({ x: pad + halfW + gap, y: pad, w: halfW, h: contentH - pad });
  } else if (layout === "fullbleed") {
    r.push({ x: 0, y: 0, w: W, h: contentH });
  } else {
    r.push({ x: pad, y: pad, w: W - pad * 2, h: contentH - pad });
  }
  return r;
}

// ------------------------------------------------------------------ refresh helpers
function rebuildPanelSelect() {
  const sel = document.getElementById("panelPhoto");
  if (!sel) return;
  sel.innerHTML = "";
  state.photos.forEach((p) => {
    const o = document.createElement("option");
    o.value = p.id;
    const panel = getActivePanel(state);
    o.textContent = p.name + (p.id === state.activePhotoId ? "  (active)" : "");
    if (panel && p.id === panel.photoId) o.selected = true;
    sel.appendChild(o);
  });
}

function refreshAll() {
  rebuildPanelList();
  rebuildPanelSelect();
  refreshPanelUI();
  refreshGrade();
  refreshExport();
  letteringInputsSync();
  redraw();
}

function rebuildPanelList() {
  const list = document.getElementById("panelList");
  const rects = panelRectsFor(state.layout, canvas.width || 1280, canvas.height || 720);
  list.innerHTML = "";
  state.panels.forEach((panel, i) => {
    const photo = state.photos.find(p => p.id === panel.photoId);
    const chip = document.createElement("div");
    chip.className = "panel-chip" + (i === state.activePanelIndex ? " active" : "");
    const thumb = document.createElement("img");
    thumb.className = "thumb";
    thumb.src = photo ? photo.url : "";
    thumb.alt = "";
    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("b");
    name.textContent = "Panel " + (i + 1);
    const sub = document.createElement("span");
    sub.textContent = photo ? photo.name : "—";
    meta.appendChild(name); meta.appendChild(sub);
    chip.appendChild(thumb); chip.appendChild(meta);
    chip.addEventListener("click", () => {
      setActivePanel(state, i);
      rebuildPanelSelect();
      refreshPanelUI();
      redraw();
    });
    list.appendChild(chip);
  });
}

function refreshPanelUI() {
  const panel = getActivePanel(state);
  const sel = document.getElementById("panelPhoto");
  const zoom = document.getElementById("panelZoom");
  const zval = document.getElementById("zoomVal");
  if (!panel) return;
  zoom.value = panel.zoom;
  zval.textContent = panel.zoom.toFixed(1) + "×";
  // segment mode
  document.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === panel.mode));
}

function refreshGrade() {
  document.querySelectorAll("[data-grade]").forEach(b => b.classList.toggle("active", b.dataset.grade === state.grade));
  document.querySelectorAll("[data-layout]").forEach(b => b.classList.toggle("active", b.dataset.layout === state.layout));
}

function refreshExport() {
  document.querySelectorAll("[data-size]").forEach(b => b.classList.toggle("chosen", b.dataset.size === state.exportSizeKey));
}

function letteringInputsSync() {
  document.getElementById("inKicker").value = state.kicker;
  document.getElementById("inTitle1").value = state.title1;
  document.getElementById("inTitle2").value = state.title2;
  document.getElementById("inTagline").value = state.tagline;
  ["titleOutline","titleGradient","titleShadow","estBadge","newBadge","stars","collector"].forEach(k => {
    const b = document.querySelector(`[data-toggle="${k}"]`);
    if (b) b.classList.toggle("on", !!state[k]);
  });
}

function addPhotoWithImgFromState(id, img) {
  const p = state.photos.find(x => x.id === id);
  if (p) { p.img = img; p.w = img.naturalWidth || img.width; p.h = img.naturalHeight || img.height; }
}

// ------------------------------------------------------------------ entry
async function init() {
  buildUI();

  if (isShot) {
    // cover shot: hide editor chrome, compose a cover at the export size
    document.body.classList.add("shot");
    document.querySelector(".topbar").style.display = "none";
    shotWrap.style.display = "grid";

    const dim = exportSizeForKey(params.size || "1920x1080");
    shotCover.width = dim.w;
    shotCover.height = dim.h;

    await document.fonts.ready;
    await runCoverShot(shotCover, params);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    canvas.width = vw;
    canvas.height = vh;
    ctx.drawImage(shotCover, 0, 0, vw, vh);
    window.__shotReady = true;
    return;
  }

  // editor mode (also serves ?shot=editor): show the full editor UI
  await loadDefaultPhotos();
  if (isEditorShot) applyShotParams(state, params);
  ensurePanels(state, panelCountForLayout(state.layout));
  if (state.photos.length >= 1) {
    state.panels.forEach((p, i) => {
      p.photoId = state.photos[i % state.photos.length].id;
    });
  }
  letteringInputsSync();
  sizeCanvas();
  bindUI();
  refreshAll();

  await document.fonts.ready;
  drawPreview();
  if (isEditorShot) window.__shotReady = true;
}

document.fonts.ready.then(() => {
  fontsReady = true;
  drawPreview();
});

init().catch(err => { console.error("init failed", err); });
