const DEFAULT_BACKEND_URL = getDefaultBackendUrl();
const MAX_TRACE_STEPS = 256;

const state = {
  sourceCode: "",
  snapshots: [],
  currentIndex: 0,
  loading: false,
  error: "",
};

const refs = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  refs.codeView = document.getElementById("code-view");
  refs.currentLine = document.getElementById("current-line");
  refs.prevStep = document.getElementById("prev-step");
  refs.nextStep = document.getElementById("next-step");
  refs.variableCount = document.getElementById("variable-count");
  refs.variableDiagrams = document.getElementById("variable-diagrams");

  refs.prevStep.addEventListener("click", () => setCurrentIndex(state.currentIndex - 1));
  refs.nextStep.addEventListener("click", () => setCurrentIndex(state.currentIndex + 1));

  loadSession(true);
}

async function loadSession(includeSource) {
  state.loading = true;
  state.error = "";
  render();

  try {
    const snapshots = await collectSnapshots();
    const sourceCode = includeSource ? await fetchCode() : state.sourceCode;

    state.snapshots = snapshots.filter(hasVariables);
    state.currentIndex = 0;
    state.sourceCode = sourceCode || state.sourceCode;
    render();
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
    render();
  } finally {
    state.loading = false;
    render();
  }
}

async function fetchCode() {
  const response = await fetchJson("/code", { method: "GET" });
  return typeof response === "string" ? response : String(response ?? "");
}

async function collectSnapshots() {
  const collected = [];
  let current = await fetchJson("/current", { method: "GET" });
  collected.push(normalizeSnapshot(current));
  let signature = snapshotSignature(current);

  for (let step = 0; step < MAX_TRACE_STEPS; step += 1) {
    const next = await fetchJson("/next", { method: "POST" });
    const normalized = normalizeSnapshot(next);
    const nextSignature = snapshotSignature(normalized);
    if (nextSignature === signature) {
      break;
    }
    collected.push(normalized);
    signature = nextSignature;
  }

  try {
    await fetchJson("/jump/0", { method: "POST" });
  } catch (error) {
    console.warn("Unable to restore backend session", error);
  }

  return collected;
}

async function fetchJson(path, options) {
  const response = await fetch(`${DEFAULT_BACKEND_URL}${path}`, {
    headers: {
      Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Request failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function render() {
  refs.variableCount.textContent = `${currentSnapshot()?.variables?.length || 0} variable${(currentSnapshot()?.variables?.length || 0) === 1 ? "" : "s"}`;

  const snapshot = currentSnapshot();
  refs.prevStep.disabled = state.currentIndex <= 0 || !state.snapshots.length;
  refs.nextStep.disabled = state.currentIndex >= state.snapshots.length - 1 || !state.snapshots.length;

  renderCodeView(snapshot);
  renderSnapshotDetails(snapshot);
  renderVariables(snapshot);
}

function renderCodeView(snapshot) {
  const code = state.sourceCode || "";
  if (!code.trim()) {
    refs.codeView.innerHTML = `<span class="empty-state">No code loaded yet.</span>`;
    refs.currentLine.textContent = "Line -";
    return;
  }

  const lines = code.replace(/\r\n/g, "\n").split("\n");
  refs.currentLine.textContent = snapshot && snapshot.line ? `Line ${snapshot.line}` : "Line -";
  refs.codeView.innerHTML = lines
    .map((line, index) => {
      const lineNumber = index + 1;
      const currentClass = snapshot && snapshot.line === lineNumber ? " current-line" : "";
      return `<div class="code-line${currentClass}"><span class="line-no">${lineNumber}</span><span>${escapeHtml(line || " ")}</span></div>`;
    })
    .join("");
}

function renderSnapshotDetails(snapshot) {
  return snapshot;
}

function renderVariables(snapshot) {
  if (!snapshot || !snapshot.variables.length) {
    refs.variableDiagrams.innerHTML = `<div class="empty-state">This snapshot does not contain variables, so it is ignored in the stepper.</div>`;
    return;
  }

  refs.variableDiagrams.innerHTML = snapshot.variables.map((variable) => renderVariable(variable)).join("");
}

function renderVariable(variable, depth = 0) {
  const kind = classifyVariable(variable);
  const header = `
    <div class="var-card-header">
      <div class="var-title">
        <span class="var-name">${escapeHtml(variable.name || "value")}</span>
        <span class="var-type">${escapeHtml(variable.type || "unknown")}</span>
      </div>
      <span class="var-chip">${escapeHtml(kindLabel(kind))}</span>
    </div>
  `;
  const value = `<div class="var-value">${escapeHtml(variable.value || "")}</div>`;
  const body = renderBodyForKind(variable, kind, depth);
  return `<article class="var-card">${header}${value}${body}</article>`;
}

function renderBodyForKind(variable, kind, depth) {
  switch (kind) {
    case "array":
      return renderArray(variable);
    case "tree":
      return renderTree(variable);
    case "linked-list":
      return renderLinkedList(variable);
    case "matrix":
      return renderMatrix(variable);
    case "graph":
      return renderGraph(variable);
    default:
      return variable.children.length
        ? `<div class="nested-tree">${variable.children.map((child) => renderNestedField(child, depth + 1)).join("")}</div>`
        : "";
  }
}

function renderNestedField(variable, depth) {
  if (!variable.children.length) {
    return `
      <div class="nested-field">
        <span class="field-name">${escapeHtml(variable.name || `field ${depth}`)}</span>
        <span>${escapeHtml(shorten(variable.value || ""))}</span>
      </div>
    `;
  }

  return `
    <div class="nested-node">
      <div class="nested-field">
        <span class="field-name">${escapeHtml(variable.name || `field ${depth}`)}</span>
        <span>${escapeHtml(shorten(variable.value || variable.type || "struct"))}</span>
      </div>
      <div class="nested-tree">
        ${variable.children.map((child) => renderNestedField(child, depth + 1)).join("")}
      </div>
    </div>
  `;
}

function renderTree(variable) {
  const layout = buildTreeLayout(variable);
  if (!layout.nodes.length) {
    return "";
  }

  const width = Math.max(1, layout.leafCount) * 180 + 100;
  const height = Math.max(1, layout.maxDepth + 1) * 130 + 40;
  const nodes = layout.nodes
    .map((node) => {
      const cx = node.x * 180 + 80;
      const cy = node.depth * 130 + 40;
      const boxX = cx - 64;
      const boxY = cy - 26;
      const fill = node.depth === 0 ? "rgba(102, 227, 196, 0.2)" : node.children.length ? "rgba(122, 167, 255, 0.18)" : "rgba(8, 12, 20, 0.95)";
      return `
        <g class="tree-node" transform="translate(${boxX}, ${boxY})">
          <rect rx="16" ry="16" width="128" height="52" fill="${fill}"></rect>
          <text x="64" y="22" text-anchor="middle" fill="#edf2ff" font-size="13">${escapeXml(node.label)}</text>
          <text x="64" y="38" text-anchor="middle" fill="#95a0b8" font-size="11">${escapeXml(node.detail)}</text>
        </g>
      `;
    })
    .join("");

  const links = layout.edges
    .map((edge) => {
      const fromX = edge.parent.x * 180 + 80;
      const fromY = edge.parent.depth * 130 + 66;
      const toX = edge.child.x * 180 + 80;
      const toY = edge.child.depth * 130 + 14;
      return `<line class="tree-link" x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}"></line>`;
    })
    .join("");

  return `
    <svg class="tree-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tree diagram">
      ${links}
      ${nodes}
    </svg>
  `;
}

function renderLinkedList(variable) {
  const chain = collectLinkedListChain(variable);
  if (chain.length < 2) {
    return variable.children.length
      ? `<div class="nested-tree">${variable.children.map((child) => renderNestedField(child, 1)).join("")}</div>`
      : "";
  }

  const nodes = chain.map((node) => `
    <div class="list-node">
      <span class="node-name">${escapeHtml(node.label)}</span>
      <div>${escapeHtml(node.detail)}</div>
    </div>
  `);

  return `<div class="linked-list">${nodes.join('<div class="list-arrow">→</div>')}</div>`;
}

function renderArray(variable) {
  const items = collectArrayItems(variable);
  if (!items.length) {
    return variable.children.length
      ? `<div class="nested-tree">${variable.children.map((child) => renderNestedField(child, 1)).join("")}</div>`
      : "";
  }

  return `
    <div class="array-track">
      ${items
        .map(
          (item) => `
            <div class="array-cell">
              <span class="array-index">${escapeHtml(item.index)}</span>
              <span class="array-value">${escapeHtml(item.value)}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderMatrix(variable) {
  const rows = extractMatrixRows(variable);
  if (!rows.length) {
    return variable.children.length
      ? `<div class="nested-tree">${variable.children.map((child) => renderNestedField(child, 1)).join("")}</div>`
      : "";
  }

  return `
    <div class="matrix-grid">
      ${rows
        .map(
          (row, rowIndex) => `
            <div class="matrix-row">
              <div class="matrix-cells">
                ${row.map((cell, cellIndex) => `<div class="matrix-cell" title="r${rowIndex + 1} c${cellIndex + 1}">${escapeHtml(cell)}</div>`).join("")}
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderGraph(variable) {
  const graph = buildGraphModel(variable);
  if (!graph.nodes.length) {
    return variable.children.length
      ? `<div class="nested-tree">${variable.children.map((child) => renderNestedField(child, 1)).join("")}</div>`
      : "";
  }

  const width = 780;
  const height = 380;
  const positioned = layoutGraph(graph.nodes, graph.edges, width, height);
  const links = positioned.edges
    .map((edge) => {
      const source = positioned.nodes.find((node) => node.id === edge.source);
      const target = positioned.nodes.find((node) => node.id === edge.target);
      if (!source || !target) {
        return "";
      }
      return `<line class="graph-link" x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}"></line>`;
    })
    .join("");

  const nodes = positioned.nodes
    .map(
      (node) => `
        <g class="graph-node" transform="translate(${node.x}, ${node.y})">
          <circle r="20" fill="${node.depth === 0 ? "rgba(102, 227, 196, 0.22)" : "rgba(122, 167, 255, 0.18)"}"></circle>
          <text x="0" y="4" text-anchor="middle" fill="#edf2ff" font-size="11">${escapeXml(node.short)}</text>
        </g>
      `,
    )
    .join("");

  return `
    <svg class="graph-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Graph diagram">
      ${links}
      ${nodes}
    </svg>
  `;
}

function buildTreeLayout(variable) {
  const nodes = [];
  const edges = [];
  let leafCount = 0;
  let maxDepth = 0;

  function walk(node, depth, path) {
    maxDepth = Math.max(maxDepth, depth);
    const layoutNode = {
      id: path,
      label: node.name || `node ${path}`,
      detail: node.value ? shorten(node.value) : node.type || "",
      depth,
      x: 0,
      children: [],
    };
    nodes.push(layoutNode);

    const children = Array.isArray(node.children) ? node.children : [];
    if (!children.length) {
      layoutNode.x = leafCount;
      leafCount += 1;
      return layoutNode;
    }

    const childLayouts = children.map((child, index) => walk(child, depth + 1, `${path}.${index}`));
    layoutNode.children = childLayouts;
    layoutNode.x = childLayouts.reduce((sum, child) => sum + child.x, 0) / childLayouts.length;
    childLayouts.forEach((child) => {
      edges.push({ parent: layoutNode, child });
    });
    return layoutNode;
  }

  walk(variable, 0, "0");
  return { nodes, edges, leafCount, maxDepth };
}

function collectLinkedListChain(variable) {
  const chain = [];
  const visited = new Set();
  let current = variable;

  for (let steps = 0; current && steps < 16; steps += 1) {
    const key = `${current.name}|${current.type}|${current.value}`;
    if (visited.has(key)) {
      break;
    }
    visited.add(key);
    chain.push({
      label: current.name || `node ${steps + 1}`,
      detail: shorten(current.value || current.type || ""),
    });

    const nextChild = (current.children || []).find((child) => /next|tail|link/i.test(child.name));
    current = nextChild || null;
  }

  return chain;
}

function extractMatrixRows(variable) {
  if (!Array.isArray(variable.children) || !variable.children.length) {
    return [];
  }

  const rows = variable.children.map((row) => {
    if (Array.isArray(row.children) && row.children.length) {
      return row.children.map((cell) => cell.value || cell.name || cell.type || "");
    }
    if (row.value && /[\[{]/.test(row.value)) {
      return parseRowValues(row.value);
    }
    return [row.value || row.name || row.type || ""];
  });

  const normalized = rows.filter((row) => row.length > 1 || variable.children.length === 1 ? true : row.some(Boolean));
  const width = Math.max(...normalized.map((row) => row.length), 0);
  if (!width) {
    return [];
  }

  return normalized.map((row) => {
    const copy = row.slice();
    while (copy.length < width) {
      copy.push("");
    }
    return copy;
  });
}

function parseRowValues(value) {
  const trimmed = String(value).trim();
  const body = trimmed.replace(/^[\[{(]+/, "").replace(/[\]})]+$/, "");
  if (!body) {
    return [];
  }
  return body.split(/,\s*/).filter(Boolean);
}

function buildGraphModel(variable) {
  const nodes = [];
  const edges = [];
  let counter = 0;

  function walk(node, depth, parentId) {
    const id = `${counter += 1}`;
    nodes.push({
      id,
      label: node.name || `node ${id}`,
      short: shortGraphLabel(node),
      depth,
      x: 0,
      y: 0,
    });
    if (parentId) {
      edges.push({ source: parentId, target: id });
    }
    (node.children || []).forEach((child) => walk(child, depth + 1, id));
  }

  walk(variable, 0, null);
  return { nodes, edges };
}

function layoutGraph(nodes, edges, width, height) {
  const positioned = nodes.map((node, index) => ({
    ...node,
    x: width / 2 + Math.cos((index / Math.max(nodes.length, 1)) * Math.PI * 2) * 90,
    y: height / 2 + Math.sin((index / Math.max(nodes.length, 1)) * Math.PI * 2) * 60,
    vx: 0,
    vy: 0,
  }));

  const centerX = width / 2;
  const centerY = height / 2;

  for (let tick = 0; tick < 80; tick += 1) {
    for (let i = 0; i < positioned.length; i += 1) {
      for (let j = i + 1; j < positioned.length; j += 1) {
        const a = positioned[i];
        const b = positioned[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy) || 1;
        const force = 1600 / (distance * distance);
        dx /= distance;
        dy /= distance;
        a.vx -= dx * force;
        a.vy -= dy * force;
        b.vx += dx * force;
        b.vy += dy * force;
      }
    }

    for (const edge of edges) {
      const source = positioned.find((node) => node.id === edge.source);
      const target = positioned.find((node) => node.id === edge.target);
      if (!source || !target) {
        continue;
      }
      let dx = target.x - source.x;
      let dy = target.y - source.y;
      let distance = Math.hypot(dx, dy) || 1;
      const force = (distance - 95) * 0.01;
      dx /= distance;
      dy /= distance;
      source.vx += dx * force;
      source.vy += dy * force;
      target.vx -= dx * force;
      target.vy -= dy * force;
    }

    for (const node of positioned) {
      const toCenterX = centerX - node.x;
      const toCenterY = centerY - node.y;
      node.vx += toCenterX * 0.003;
      node.vy += toCenterY * 0.003;
      node.vx *= 0.86;
      node.vy *= 0.86;
      node.x = clamp(node.x + node.vx, 36, width - 36);
      node.y = clamp(node.y + node.vy, 36, height - 36);
    }
  }

  return { nodes: positioned, edges };
}

function classifyVariable(variable) {
  const blob = `${variable.name} ${variable.type} ${variable.value}`.toLowerCase();
  const childNames = (variable.children || []).map((child) => child.name.toLowerCase());

  if (/\[\]\[|matrix|grid|table/.test(blob)) {
    return "matrix";
  }

  if (/^\[\]|slice|array/.test(variable.type.toLowerCase()) || /\[[^\]]*\]/.test(variable.value) || /^\[\]/.test(variable.type)) {
    return "array";
  }

  if (/list|linked|node|next|prev|tail|head/.test(blob) || childNames.some((name) => /next|prev/.test(name))) {
    const nextChild = (variable.children || []).find((child) => /next|prev|tail|link/i.test(child.name));
    if (nextChild || /list|linked/.test(blob)) {
      return "linked-list";
    }
  }

  if (/tree|root|left|right|child/.test(blob) || childNames.some((name) => /left|right|child/.test(name))) {
    return "tree";
  }

  if (/graph|edge|vertex|adj|adjacency|map\[|set/.test(blob)) {
    return "graph";
  }

  if ((variable.children || []).length > 0) {
    return "tree";
  }

  return "scalar";
}

function kindLabel(kind) {
  switch (kind) {
    case "tree":
      return "tree";
    case "linked-list":
      return "linked list";
    case "matrix":
      return "matrix";
    case "graph":
      return "graph";
    default:
      return "scalar";
  }
}

function currentSnapshot() {
  return state.snapshots[state.currentIndex] || null;
}

function setCurrentIndex(nextIndex) {
  if (!state.snapshots.length) {
    return;
  }
  const clamped = clamp(Math.trunc(nextIndex), 0, state.snapshots.length - 1);
  state.currentIndex = clamped;
  render();
}

function snapshotSignature(snapshot) {
  return JSON.stringify({
    line: snapshot.line,
    variables: snapshot.variables,
    callstack: snapshot.callstack,
  });
}

function collectArrayItems(variable) {
  const children = Array.isArray(variable.children) ? variable.children : [];
  if (children.length) {
    return children.map((child, index) => ({
      index: String(index),
      value: child.children.length ? `${child.name || index}: ${shorten(child.value || child.type || "struct")}` : child.value || child.name || child.type || "",
    }));
  }

  const parsed = parseArrayValues(variable.value);
  return parsed.map((value, index) => ({ index: String(index), value }));
}

function parseArrayValues(value) {
  const text = String(value || "").trim();
  const body = text.replace(/^[\[({]+/, "").replace(/[\]})]+$/, "");
  if (!body) {
    return [];
  }

  return body.split(/,|\s+/).map((part) => part.trim()).filter(Boolean);
}

function normalizeSnapshot(snapshot) {
  return {
    line: Number(snapshot?.line) || 0,
    variables: Array.isArray(snapshot?.variables) ? snapshot.variables.map(normalizeVariable) : [],
    callstack: Array.isArray(snapshot?.callstack) ? snapshot.callstack.map((item) => String(item)) : [],
  };
}

function normalizeVariable(variable) {
  return {
    name: String(variable?.name || ""),
    type: String(variable?.type || ""),
    value: String(variable?.value || ""),
    children: Array.isArray(variable?.children) ? variable.children.map(normalizeVariable) : [],
  };
}

function hasVariables(snapshot) {
  return Array.isArray(snapshot?.variables) && snapshot.variables.length > 0;
}

function countLines(text) {
  return text ? text.replace(/\r\n/g, "\n").split("\n").length : 0;
}

function shorten(value, maxLength = 38) {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function shortGraphLabel(node) {
  return shorten(node.name || node.value || node.type || `n${node.id}`, 10).replace(/\s+/g, " ");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(value) {
  return escapeHtml(value).replace(/'/g, "&apos;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeBackendUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/$/, "");
  if (!trimmed) {
    return DEFAULT_BACKEND_URL;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

function getDefaultBackendUrl() {
  if (typeof window !== "undefined" && window.location && window.location.origin && window.location.origin !== "null") {
    return window.location.origin;
  }
  return "http://127.0.0.1:8080";
}
