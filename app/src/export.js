/**
 * app/src/export.js
 * Export the rendered cover as a PNG at an exact post size.
 */
import { renderCover } from "./render.js";
import { exportSizeForKey } from "./state.js";

export function exportPNG(state, filename) {
  const dim = exportSizeForKey(state.exportSizeKey);
  const W = dim.w;
  const H = dim.h;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  renderCover(ctx, W, H, state);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("could not encode PNG"));
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve({ w: W, h: H });
      },
      "image/png"
    );
  });
}

export function exportDataURL(state) {
  const dim = exportSizeForKey(state.exportSizeKey);
  const canvas = document.createElement("canvas");
  canvas.width = dim.w;
  canvas.height = dim.h;
  const ctx = canvas.getContext("2d");
  renderCover(ctx, dim.w, dim.h, state);
  return canvas.toDataURL("image/png");
}