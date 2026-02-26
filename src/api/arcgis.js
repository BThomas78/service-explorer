export async function getJson(url, options = {}) {
  const finalUrl = withPjson(url);

  const timeoutMsRaw = Number(options.timeoutMs ?? 15000);
  const timeoutMs = Number.isFinite(timeoutMsRaw)
    ? Math.max(1000, Math.min(60000, Math.floor(timeoutMsRaw)))
    : 15000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(finalUrl, { signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s.`);
    }
    throw new Error(`Network error while requesting URL: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // ArcGIS REST often returns JSON with an "error" object instead of HTTP error
  if (data?.error) {
    throw new Error(formatArcGisError(data.error));
  }

  return data;
}

function formatArcGisError(errorObj) {
  const code = errorObj.code != null ? ` (code ${errorObj.code})` : "";
  const message = errorObj.message || "ArcGIS REST error";

  const details = Array.isArray(errorObj.details) ? errorObj.details : [];
  const detailText = details.length ? ` Details: ${details.join(" | ")}` : "";

  return `${message}${code}.${detailText}`.replace(/\.\./g, ".");
}

export async function fetchService(serviceUrl) {
  return getJson(serviceUrl);
}

export async function fetchLayer(serviceUrl, layerId) {
  const cleanBase = serviceUrl.replace(/\/+$/, "");
  return getJson(`${cleanBase}/${layerId}`);
}

export function buildLayerPreviewQueryUrl(serviceUrl, layerId, options = {}) {
  const cleanBase = serviceUrl.replace(/\/+$/, "");
  const layerUrl = `${cleanBase}/${layerId}`;

  const where = String(options.where ?? "1=1").trim() || "1=1";
  const recordCountRaw = Number(options.recordCount ?? 5);
  const recordCount = Number.isFinite(recordCountRaw)
    ? Math.max(1, Math.min(100, Math.floor(recordCountRaw)))
    : 5;

  const url = new URL(layerUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/query`;
  url.searchParams.set("where", where);
  url.searchParams.set("outFields", "*");
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("resultRecordCount", String(recordCount));
  url.searchParams.set("f", "pjson");

  return url.toString();
}

export async function fetchLayerPreview(serviceUrl, layerId, options = {}) {
  const queryUrl = buildLayerPreviewQueryUrl(serviceUrl, layerId, options);
  return getJson(queryUrl, { timeoutMs: 15000 });
}

function withPjson(url) {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  // Use URL API so we safely add/replace f=pjson
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      "Invalid URL. Paste a full URL starting with http:// or https://",
    );
  }

  parsed.searchParams.set("f", "pjson");
  return parsed.toString();
}
