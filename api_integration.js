// api_integration.js — dùng trên Vercel
const API_BASE = "/api";
const API_MAX_BYTES = 4 * 1024 * 1024; // 4 MB body limit on Vercel functions
const API_TARGET_BYTES = API_MAX_BYTES - 200000; // keep a buffer below the hard limit

let uploadBtn, uploadInput, analysisBox, capturedWrap, capturedImgEl;

document.addEventListener("DOMContentLoaded", () => {
  uploadBtn     = document.getElementById("upload-photo");
  uploadInput   = document.getElementById("upload-input");
  analysisBox   = document.getElementById("analysis-result");
  capturedWrap  = document.getElementById("captured-image");
  capturedImgEl = document.getElementById("captured-img");

  if (uploadBtn && uploadInput) {
    uploadBtn.addEventListener("click", () => uploadInput.click());
    uploadInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      if (capturedImgEl && capturedWrap) {
        capturedImgEl.src = url;
        capturedWrap.classList.remove("hidden");
      }
      await predictViaApi(file);
    });
  }
});

async function predictViaApi(file) {
  try {
    showInfo("⏳ Đang phân tích trên máy chủ...");
    const preparedFile = await ensureApiSafeFile(file);
    const fd = new FormData();
    fd.append("file", preparedFile, preparedFile.name || "upload.jpg");
    const res = await fetch(`${API_BASE}/predict`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (res.status === 413) {
      throw new Error("Ảnh vượt quá giới hạn 4MB. Hãy chọn ảnh nhỏ hơn hoặc chụp lại ở độ phân giải thấp hơn.");
    }
    if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`);
    renderPredictResult(data);
  } catch (err) {
    console.error(err);
    showError(`❌ Lỗi: ${String(err.message || err)}`);
  }
}

async function ensureApiSafeFile(file) {
  if (typeof File === "undefined" || !(file instanceof File) || !file.type?.startsWith("image/")) return file;
  if (file.size <= API_TARGET_BYTES) return file;
  try {
    const compressed = await compressImageToTarget(file, API_TARGET_BYTES);
    if (compressed && compressed.size < file.size) return compressed;
  } catch (err) {
    console.warn("Image compression failed", err);
  }
  return file;
}

async function compressImageToTarget(file, targetBytes) {
  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  const maxDimension = 1600;
  const scaleForDimension = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const scaleForBytes = Math.min(1, Math.sqrt(targetBytes / file.size));
  const scale = Math.min(scaleForDimension, scaleForBytes);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.92;
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  while (blob && blob.size > targetBytes && quality > 0.5) {
    quality -= 0.08;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  }
  if (!blob) throw new Error("Failed to create compressed blob");
  if (blob.size > API_MAX_BYTES) return file;
  return new File([blob], ensureJpegName(file.name), { type: "image/jpeg" });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function ensureJpegName(name = "upload.jpg") {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base || "upload"}.jpg`;
}

function renderPredictResult(data) {
  const { meat_type, freshness_percent, label_vi, label_en, confidence } = data;
  const levelMap = { 100: "5", 50: "3", 0: "1" };
  const targetLevel = levelMap[freshness_percent] ?? "3";
  const state =
    freshness_percent === 100 ? "success" :
    freshness_percent === 50  ? "warning" : "error";
  const accentClass = `result-card--${state}`;
  const goDetailBtn = (meat_type === "pork")
    ? `<button class="btn btn--primary btn--sm" onclick="showMeatDetail('pork','${targetLevel}')">
         📗 Mở từ điển — Thịt Heo • Level ${targetLevel}
       </button>` : "";

  const imageUrl = capturedImgEl ? capturedImgEl.src : "";
  const resultData = { meat_type, freshness_percent, label_vi, label_en, confidence };
  const meatTypeLabel = getMeatTypeLabel(meat_type);

  const saveBtn = `
    <button class="btn btn--success btn--sm"
            onclick="handleSaveDetection('${meat_type}', ${targetLevel}, '${imageUrl}', ${JSON.stringify(resultData).replace(/"/g, '&quot;')})"
            style="background: var(--color-success); border-color: var(--color-success);">
      💾 Lưu kết quả
    </button>`;

  analysisBox.classList.remove("hidden");
  analysisBox.innerHTML = `
    <div class="result-card ${accentClass}">
      <span class="result-card__badge">Kết quả phân tích</span>
      <div class="result-card__header">
        <h3 class="result-card__title">${label_vi}</h3>
        <div class="result-card__stat">
          <span class="result-card__stat-value">${freshness_percent}%</span>
          <span class="result-card__stat-label">Độ tươi</span>
        </div>
      </div>
      <div class="result-card__body">
        <div class="result-card__details">
          <span class="meta-label">Loại thịt</span>
          <strong>${meatTypeLabel}</strong>
        </div>
        <div class="result-card__actions">
          ${goDetailBtn}
          ${saveBtn}
        </div>
      </div>
    </div>`;
}
function showInfo(text){
  analysisBox.classList.remove("hidden");
  analysisBox.innerHTML = `<div class="card"><div class="card__body">
    <div class="status status--info">${text}</div></div></div>`;
}
function showError(text){
  analysisBox.classList.remove("hidden");
  analysisBox.innerHTML = `<div class="card"><div class="card__body">
    <div class="status status--error">${text}</div></div></div>`;
}

function getMeatTypeLabel(meatType) {
  if (!meatType) return "Thịt Heo";
  const normalized = String(meatType).trim().toLowerCase();
  if (!normalized) return "Thịt Heo";
  if (normalized.includes("pork") || normalized.includes("heo")) return "Thịt Heo";
  if (normalized.includes("beef") || normalized.includes("bò") || normalized.includes("bo")) return "Thịt Bò";
  if (normalized.includes("chicken") || normalized.includes("ga") || normalized.includes("gà")) return "Thịt Gà";
  return "Thịt Heo";
}
window.predictViaApi = predictViaApi;

