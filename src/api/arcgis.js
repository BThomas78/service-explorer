export async function getJson(url) {
  const finalUrl = withPjson(url);

  let response;
  try {
    response = await fetch(finalUrl);
  } catch (err) {
    throw new Error(`Network error while requesting URL: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // ArcGIS REST often returns JSON with an "error" object instead of HTTP error
  if (data?.error) {
    const message = data.error.message || "ArcGIS REST error";
    throw new Error(message);
  }

  return data;
}

export async function fetchService(serviceUrl) {
  return getJson(serviceUrl);
}

export async function fetchLayer(serviceUrl, layerId) {
  const cleanBase = serviceUrl.replace(/\/+$/, "");
  return getJson(`${cleanBase}/${layerId}`);
}

export async function fetchLayerPreview(serviceUrl, layerId, options = {}) {
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

  return getJson(url.toString());
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
