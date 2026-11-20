/**
 * app/src/state.js
 * Central app state — photos, layout, grade, lettering, badges, per-panel crops/positions.
 * Single source of truth; UI and render read from here.
 */

// ---------- constants ----------
export const LAYOUTS = ["hero4", "grid3x3", "hero2", "split", "fullbleed"];
export const GRADES = ["vice", "neon", "palm", "mono", "halftone", "teal"];
export const EXPORT_SIZES = [
  { key: "1920x1080", w: 1920, h: 1080, label: "1920 × 1080" },
  { key: "1080x1080", w: 1080, h: 1080, label: "1080 × 1080" },
  { key: "1080x1350", w: 1080, h: 1350, label: "1080 × 1350" },
];

// ---------- default state ----------
export function createState() {
  return {
    // photos array: { id, name, file, url, img, w, h, loaded }
    photos: [],
    activePhotoId: null,
    // layout
    layout: "hero4",
    // grade
    grade: "vice",
    // lettering
    kicker: "SOLMAR BAY",
    title1: "VICE",
    title2: "CITY",
    tagline: "where the tide keeps secrets",
    // title effects
    titleOutline: true,
    titleGradient: true,
    titleShadow: true,
    // badges
    estBadge: true,
    newBadge: false,
    stars: true,
    collector: false,
    // per-panel settings: array of { photoId, crop, zoom, mode }
    // crop = { sx, sy, sw, sh } in source image coords (0..1)
    // zoom = multiplier on crop (1 = whole image)
    // mode = "cover" | "contain"
    panels: [],
    // active panel index for per-panel controls
    activePanelIndex: 0,
    // export
    exportSizeKey: "1920x1080",
    // drag/pan state (used by render for interaction)
    _drag: null,
  };
}

// ---------- helpers ----------
export function addPhoto(state, file, url, name) {
  const id = "photo_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  state.photos.push({ id, name, file, url, img: null, w: 0, h: 0, loaded: false });
  if (state.photos.length === 1) state.activePhotoId = id;
  return id;
}

export function setActivePhoto(state, id) {
  state.activePhotoId = id;
}

export function removePhoto(state, id) {
  state.photos = state.photos.filter(p => p.id !== id);
  if (state.activePhotoId === id) state.activePhotoId = state.photos[0]?.id ?? null;
  // also clean panels referencing it
  state.panels.forEach(p => { if (p.photoId === id) p.photoId = state.activePhotoId; });
}

export function ensurePanels(state, count) {
  while (state.panels.length < count) {
    state.panels.push({
      photoId: state.activePhotoId,
      crop: { sx: 0, sy: 0, sw: 1, sh: 1 },
      zoom: 1,
      mode: "cover",
    });
  }
  if (state.panels.length > count) state.panels.length = count;
  state.activePanelIndex = Math.min(state.activePanelIndex, count - 1);
}

export function getActivePanel(state) {
  return state.panels[state.activePanelIndex];
}

export function setActivePanel(state, idx) {
  if (idx >= 0 && idx < state.panels.length) state.activePanelIndex = idx;
}

export function setPanelPhoto(state, panelIdx, photoId) {
  if (panelIdx >= 0 && panelIdx < state.panels.length) state.panels[panelIdx].photoId = photoId;
}

export function updatePanelCrop(state, panelIdx, crop) {
  if (panelIdx >= 0 && panelIdx < state.panels.length) state.panels[panelIdx].crop = crop;
}

export function updatePanelZoom(state, panelIdx, zoom) {
  if (panelIdx >= 0 && panelIdx < state.panels.length) state.panels[panelIdx].zoom = Math.max(1, Math.min(4, zoom));
}

export function setPanelMode(state, panelIdx, mode) {
  if (panelIdx >= 0 && panelIdx < state.panels.length) state.panels[panelIdx].mode = mode;
}

export function exportSizeForKey(key) {
  return EXPORT_SIZES.find(s => s.key === key) ?? EXPORT_SIZES[0];
}