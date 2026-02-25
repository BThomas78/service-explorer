import "./styles.css";
import { fetchLayer, fetchLayerPreview, fetchService } from "./api/arcgis.js";
import {
  renderLayerDetails,
  renderLayerList,
  renderRecordPreview,
  renderServiceHeader,
} from "./ui/render.js";

const DEFAULT_SERVICE_URL =
  "https://sampleserver6.arcgisonline.com/arcgis/rest/services/Census/MapServer";

document.querySelector("#app").innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <h1>Service Explorer</h1>
      <p>Load an ArcGIS Feature Service and inspect layers and fields.</p>
    </header>

    <section class="controls">
      <label for="serviceUrl" class="sr-only">Feature Service URL</label>
      <input
        id="serviceUrl"
        type="url"
        placeholder="Paste ArcGIS Feature Service URL here..."
        value="https://sampleserver6.arcgisonline.com/arcgis/rest/services/Census/MapServer"
      />
      <div class="control-buttons">
        <button id="loadBtn" type="button">Load</button>
        <button id="clearBtn" type="button" class="secondary-btn">Clear</button>
      </div>
    </section>

    <section id="status" class="status" aria-live="polite"></section>

    <main class="layout">
      <section class="panel">
        <h2>Service Info</h2>
        <div id="serviceInfo" class="panel-body empty-state">
          Enter a service URL and click <strong>Load</strong>.
        </div>
      </section>

      <section class="panel">
        <h2>Layers & Tables</h2>
        <div id="layerList" class="panel-body empty-state">
          No data loaded yet.
        </div>
      </section>

      <section class="panel">
        <h2>Layer Details</h2>
        <div id="layerDetails" class="panel-body empty-state">
          Select a layer to view fields and metadata.
        </div>
      </section>

      <section class="panel">
        <h2>Preview Records</h2>
        <div id="recordPreview" class="panel-body empty-state">
          Select a layer, then click <strong>Preview 5 Records</strong>.
        </div>
      </section>
    </main>
  </div>
`;

const loadBtn = document.querySelector("#loadBtn");
const clearBtn = document.querySelector("#clearBtn");
const serviceUrlInput = document.querySelector("#serviceUrl");
const statusEl = document.querySelector("#status");
const serviceInfoEl = document.querySelector("#serviceInfo");
const layerListEl = document.querySelector("#layerList");
const layerDetailsEl = document.querySelector("#layerDetails");
const recordPreviewEl = document.querySelector("#recordPreview");

serviceUrlInput.value = DEFAULT_SERVICE_URL;

let currentServiceUrl = "";
let currentLayerJson = null;
let currentFieldFilter = "";
let currentLayerUrl = "";
let currentLayerId = null;
let currentPreviewWhere = "1=1";
let currentPreviewRecordCount = 5;

loadBtn.addEventListener("click", handleLoadService);
clearBtn.addEventListener("click", handleClear);

serviceUrlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleLoadService();
  }
});

layerListEl.addEventListener("click", async (event) => {
  const btn = event.target.closest(".layer-btn");
  if (!btn || !currentServiceUrl) return;

  const layerId = btn.dataset.layerId;
  currentLayerId = layerId;
  const layerName = btn.dataset.layerName || `Layer ${layerId}`;

  setActiveLayerButton(btn);
  setStatus(`Loading details for ${layerName}...`, "info");
  layerDetailsEl.innerHTML = `<p> class="empty-state">Loading layer details...</p>`;
  recordPreviewEl.innerHTML = `<p class="empty-state">Click <strong>Preview Records</strong> to load sample attributes.</p>`;

  try {
    const layerJson = await fetchLayer(currentServiceUrl, layerId);
    currentLayerJson = layerJson;
    currentLayerUrl = `${currentServiceUrl}/${layerId}`;
    currentFieldFilter = "";
    currentPreviewWhere = "1=1";
    currentPreviewRecordCount = 5;
    layerDetailsEl.innerHTML = renderLayerDetails(
      currentLayerJson,
      currentFieldFilter,
      currentPreviewWhere,
      currentPreviewRecordCount,
    );
    setStatus(`Loaded details for ${layerName}.`, "success");
  } catch (err) {
    layerDetailsEl.innerHTML = `<p class="empty-state">Could not load layer details.</p>`;
    setStatus(err.message || "Failed to load layer details.", "error");
  }
});

layerDetailsEl.addEventListener("input", (event) => {
  const fieldInput = event.target.closest("#fieldFilterInput");
  const whereInput = event.target.closest("#previewWhereInput");
  const countInput = event.target.closest("#previewCountInput");

  if (!currentLayerJson) return;

  if (fieldInput) {
    currentFieldFilter = fieldInput.value;
  }

  if (whereInput) {
    currentPreviewWhere = whereInput.value;
  }

  if (countInput) {
    const nextCount = Number(countInput.value);
    if (Number.isFinite(nextCount)) {
      currentPreviewRecordCount = Math.max(
        1,
        Math.min(100, Math.floor(nextCount)),
      );
    }
  }

  if (!fieldInput && !whereInput && !countInput) return;

  layerDetailsEl.innerHTML = renderLayerDetails(
    currentLayerJson,
    currentFieldFilter,
    currentPreviewWhere,
    currentPreviewRecordCount,
  );

  // Restore focus to whichever input was edited
  const activeId = event.target.id;
  const newInput = layerDetailsEl.querySelector(`#${activeId}`);
  if (newInput) {
    newInput.focus();

    if (newInput.tagName === "INPUT" && newInput.type !== "number") {
      const valueLength = String(newInput.value ?? "").length;
      newInput.setSelectionRange(valueLength, valueLength);
    }
  }
});

layerDetailsEl.addEventListener("click", async (event) => {
  const copyBtn = event.target.closest(".copy-layer-url-btn");
  if (copyBtn) {
    if (!currentLayerUrl) {
      setStatus("No layer URL available to copy.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(currentLayerUrl);
      setStatus("Layer URL copied to clipboard.", "success");
    } catch (err) {
      setStatus("Clipboard copy failed. Try copying manually.", "error");
    }

    return;
  }

  const previewBtn = event.target.closest(".preview-records-btn");
  if (!previewBtn) return;

  if (!currentServiceUrl || currentLayerId == null) {
    setStatus("Select a layer before previewing records.", "error");
    return;
  }

  recordPreviewEl.innerHTML = `<p>Loading preview records...</p>`;
  setStatus("Loading preview records...", "info");

  try {
    const queryJson = await fetchLayerPreview(
      currentServiceUrl,
      currentLayerId,
      {
        where: currentPreviewWhere,
        recordCount: currentPreviewRecordCount,
      },
    );

    recordPreviewEl.innerHTML = renderRecordPreview(queryJson);
    setStatus("Preview records loaded.", "success");
  } catch (err) {
    recordPreviewEl.innerHTML = `<p class="empty-state">Could not load preview records.</p>`;
    const msg = err?.message || "Failed to load preview records.";
    const lower = msg.toLowerCase();
    const whereHint =
      lower.includes("where") ||
      lower.includes("sql") ||
      lower.includes("invalid") ||
      lower.includes("parse") ||
      lower.includes("execute query") ||
      lower.includes("code 400")
        ? " Check your WHERE clause syntax (field names, quotes, and operators)."
        : "";

    setStatus(`${msg}${whereHint}`, "error");
  }
});

async function handleLoadService() {
  const url = serviceUrlInput.value.trim();

  if (!url) {
    setStatus("Please paste a Feature Service URL first.", "error");
    return;
  }

  currentServiceUrl = "";
  currentLayerJson = null;
  currentFieldFilter = "";
  currentLayerUrl = "";
  currentLayerId = null;
  currentPreviewWhere = "1=1";
  currentPreviewRecordCount = 5;
  clearResults();
  setStatus("Loading service metadata...", "info");
  setLoadingState(true);

  try {
    const serviceJson = await fetchService(url);

    currentServiceUrl = stripQuery(url);
    serviceInfoEl.innerHTML = renderServiceHeader(serviceJson);
    layerListEl.innerHTML = renderLayerList(
      serviceJson.layers,
      serviceJson.tables,
    );
    layerDetailsEl.innerHTML = `
      <p class="empty-state">
        Service loaded. Click a layer or table to view fields and metadata.
      </p>
    `;
    setStatus("Service loaded successfully.", "success");
  } catch (err) {
    setStatus(err.message || "Failed to load service.", "error");
    serviceInfoEl.innerHTML = `<p class="empty-state">No service info loaded.</p>`;
    layerListEl.innerHTML = `<p class="empty-state">No layers loaded.</p>`;
    layerDetailsEl.innerHTML = `<p class="empty-state">No layer details loaded.</p>`;
  } finally {
    setLoadingState(false);
  }
}

function handleClear() {
  if (loadBtn.disabled) return;

  currentServiceUrl = "";
  currentLayerJson = null;
  currentFieldFilter = "";
  currentLayerUrl = "";
  currentLayerId = null;
  currentPreviewWhere = "1=1";
  currentPreviewRecordCount = 5;
  serviceUrlInput.value = DEFAULT_SERVICE_URL;
  statusEl.textContent = "";
  statusEl.className = "status";

  serviceInfoEl.innerHTML = `
    <div class="empty-state">
      Enter a service URL and click <strong>Load</strong>.
    </div>
  `;
  layerListEl.innerHTML = `<p class="empty-state">No data loaded yet.</p>`;
  layerDetailsEl.innerHTML = `
    <p class="empty-state">Select a layer to view fields and metadata.</p>
  `;
  recordPreviewEl.innerHTML = `
  <p class="empty-state">Select a layer, then click <strong>Preview Records</strong>.</p>
`;

  serviceUrlInput.focus();
}

function setLoadingState(isLoading) {
  loadBtn.disabled = isLoading;
  clearBtn.disabled = isLoading;
  loadBtn.textContent = isLoading ? "Loading..." : "Load";
}

function clearResults() {
  serviceInfoEl.innerHTML = `<p class="empty-state">Loading...</p>`;
  layerListEl.innerHTML = `<p class="empty-state">Loading...</p>`;
  layerDetailsEl.innerHTML = `<p class="empty-state">Waiting for service load...</p>`;
  recordPreviewEl.innerHTML = `<p class="empty-state">Waiting for service load...</p>`;
}

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function setActiveLayerButton(activeBtn) {
  layerListEl.querySelectorAll(".layer-btn").forEach((btn) => {
    btn.classList.toggle("active", btn === activeBtn);
  });
}

function stripQuery(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
  } catch {
    return url;
  }
}
