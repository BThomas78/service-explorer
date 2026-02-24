function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderServiceHeader(serviceJson) {
  const title =
    serviceJson.serviceDescription ||
    serviceJson.mapName ||
    serviceJson.name ||
    "Untitled Service";

  const description =
    serviceJson.description || "No service description provided.";

  const typeBits = [];
  if (serviceJson.currentVersion)
    typeBits.push(`REST v${serviceJson.currentVersion}`);
  if (serviceJson.capabilities)
    typeBits.push(`Capabilities: ${serviceJson.capabilities}`);
  if (serviceJson.supportedQueryFormats)
    typeBits.push(`Formats: ${serviceJson.supportedQueryFormats}`);

  return `
    <div>
      <p><strong>Title:</strong> ${escapeHtml(title)}</p>
      <p><strong>Description:</strong> ${escapeHtml(description)}</p>
      ${
        typeBits.length
          ? `<p><strong>Details:</strong> ${escapeHtml(typeBits.join(" | "))}</p>`
          : ""
      }
    </div>
  `;
}

export function renderLayerList(layers = [], tables = []) {
  const hasLayers = Array.isArray(layers) && layers.length > 0;
  const hasTables = Array.isArray(tables) && tables.length > 0;

  if (!hasLayers && !hasTables) {
    return `<p class="empty-state">No layers or tables found.</p>`;
  }

  const layerItems = (layers || [])
    .map(
      (layer) => `
      <button
        type="button"
        class="list-item layer-btn"
        data-layer-id="${escapeHtml(layer.id)}"
        data-layer-name="${escapeHtml(layer.name)}"
      >
        <span class="item-title">[Layer ${escapeHtml(layer.id)}] ${escapeHtml(layer.name)}</span>
      </button>
    `,
    )
    .join("");

  const tableItems = (tables || [])
    .map(
      (table) => `
      <button
        type="button"
        class="list-item layer-btn table-btn"
        data-layer-id="${escapeHtml(table.id)}"
        data-layer-name="${escapeHtml(table.name)}"
      >
        <span class="item-title">[Table ${escapeHtml(table.id)}] ${escapeHtml(table.name)}</span>
      </button>
    `,
    )
    .join("");

  return `
    ${hasLayers ? `<div><h3 class="subhead">Layers</h3>${layerItems}</div>` : ""}
    ${hasTables ? `<div><h3 class="subhead">Tables</h3>${tableItems}</div>` : ""}
  `;
}

export function renderLayerDetails(layerJson, fieldFilter = "") {
  const name = layerJson.name || "Unnamed layer";
  const geometryType = layerJson.geometryType || "N/A";
  const type = layerJson.type || "N/A";
  const objectIdField = layerJson.objectIdField || "N/A";
  const fields = Array.isArray(layerJson.fields) ? layerJson.fields : [];

  const filterText = String(fieldFilter || "")
    .trim()
    .toLowerCase();

  const filteredFields = filterText
    ? fields.filter((f) => {
        const nameText = String(f.name || "").toLowerCase();
        const aliasText = String(f.alias || "").toLowerCase();
        const typeText = String(f.type || "").toLowerCase();

        return (
          nameText.includes(filterText) ||
          aliasText.includes(filterText) ||
          typeText.includes(filterText)
        );
      })
    : fields;

  const fieldsHtml = filteredFields.length
    ? `
      <div class="table-wrap">
        <table class="fields-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Alias</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            ${filteredFields
              .map(
                (f) => `
                <tr>
                  <td>${escapeHtml(f.name)}</td>
                  <td>${escapeHtml(f.alias)}</td>
                  <td>${escapeHtml(f.type)}</td>
                </tr>
              `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : `<p class="empty-state">No fields match your filter.</p>`;

  return `
    <div>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Type:</strong> ${escapeHtml(type)}</p>
      <p><strong>Geometry:</strong> ${escapeHtml(geometryType)}</p>
      <p><strong>ObjectID Field:</strong> ${escapeHtml(objectIdField)}</p>

      <div class="field-filter-wrap">
        <label for="fieldFilterInput" class="sr-only">Filter fields</label>
        <input
          id="fieldFilterInput"
          class="field-filter-input"
          type="text"
          placeholder="Filter fields by name, alias, or type..."
          value="${escapeHtml(fieldFilter)}"
        />
      </div>

      <h3 class="subhead">Fields (${filteredFields.length} of ${fields.length})</h3>
      ${fieldsHtml}
    </div>
  `;
}
