/* ═══════════════════════════════════════════════════════════
   CodVis — Frontend Logic
   ═══════════════════════════════════════════════════════════ */

// ── State ────────────────────────────────────────────────
const state = {
  currentIndex: 0,
  snapshot: null,
  prevSnapshot: null,
  maxDiscoveredIndex: 0,
  isLoading: false,
};

// ── DOM References ───────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const dom = {
  stepValue:     () => $('#step-value'),
  lineValue:     () => $('#line-value'),
  lineBadge:     () => $('#line-badge'),
  varCount:      () => $('#var-count'),
  variablesBody: () => $('#variables-body'),
  callstackBody: () => $('#callstack-body'),
  btnPrev:       () => $('#btn-prev'),
  btnNext:       () => $('#btn-next'),
  btnFirst:      () => $('#btn-first'),
  btnLast:       () => $('#btn-last'),
  btnJump:       () => $('#btn-jump'),
  jumpInput:     () => $('#jump-input'),
  loadingOverlay:() => $('#loading-overlay'),
  toastContainer:() => $('#toast-container'),
};

// ── API Client ───────────────────────────────────────────
async function api(method, path) {
  const res = await fetch(path, { method });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

const API = {
  getCurrent: () => api('GET',  '/current'),
  next:       () => api('POST', '/next'),
  prev:       () => api('POST', '/prev'),
  jump:       (i) => api('POST', `/jump/${i}`),
};

// ── Type Detection ───────────────────────────────────────
const INT_TYPES = new Set([
  'int','int8','int16','int32','int64',
  'uint','uint8','uint16','uint32','uint64',
  'byte','rune','uintptr',
]);
const FLOAT_TYPES = new Set(['float32','float64']);

function getTypeCategory(type) {
  if (!type) return 'unknown';
  if (type === 'bool') return 'bool';
  if (type === 'string') return 'string';
  if (INT_TYPES.has(type)) return 'int';
  if (FLOAT_TYPES.has(type)) return 'float';
  if (/^\[\d*\]/.test(type) || type.startsWith('[]')) return 'array';
  if (type.startsWith('map[')) return 'map';
  if (type.startsWith('*')) return 'pointer';
  // anything else: struct or custom
  return 'struct';
}

// ── Value Parsers ────────────────────────────────────────

/** Attempt to parse array elements from children or value string */
function parseArrayElements(variable) {
  // If children are available use them (from Delve)
  if (variable.children && variable.children.length > 0) {
    return variable.children.map((c, i) => ({
      index: c.name || String(i),
      value: c.value || '',
      type: c.type || '',
    }));
  }
  // Try parsing value string like "[1,2,3]" or "[1 2 3]"
  const val = variable.value || '';
  const bracketMatch = val.match(/\[([^\[\]]*)\]\s*$/);
  if (bracketMatch) {
    const inner = bracketMatch[1].trim();
    if (!inner) return [];
    // split on comma or whitespace
    const parts = inner.includes(',')
      ? inner.split(',').map(s => s.trim())
      : inner.split(/\s+/);
    return parts.map((v, i) => ({ index: String(i), value: v, type: '' }));
  }
  return null; // couldn't parse
}

/** Attempt to parse struct fields from children or value string */
function parseStructFields(variable) {
  if (variable.children && variable.children.length > 0) {
    return variable.children.map(c => ({
      name: c.name || '',
      value: c.value || '',
      type: c.type || '',
    }));
  }
  // Try parsing "{Field1: val1, Field2: val2}"
  const val = variable.value || '';
  const braceMatch = val.match(/\{(.+)\}/);
  if (braceMatch) {
    const inner = braceMatch[1].trim();
    const fields = [];
    // Simple split on ", " — won't handle nested structs perfectly
    for (const part of inner.split(/,\s*/)) {
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0) {
        fields.push({
          name: part.slice(0, colonIdx).trim(),
          value: part.slice(colonIdx + 1).trim(),
          type: '',
        });
      }
    }
    if (fields.length > 0) return fields;
  }
  return null;
}

/** Detect tree-like structs (has Left/Right or left/right children) */
function isTreeLike(fields) {
  if (!fields || fields.length < 2) return false;
  const names = fields.map(f => f.name.toLowerCase());
  return (names.includes('left') && names.includes('right'));
}

/** Build a tree object from struct fields recursively */
function buildTreeNode(variable) {
  const fields = parseStructFields(variable);
  if (!fields) return null;

  const valField = fields.find(f =>
    ['val','value','data','key','v'].includes(f.name.toLowerCase())
  );
  const leftField = fields.find(f => f.name.toLowerCase() === 'left');
  const rightField = fields.find(f => f.name.toLowerCase() === 'right');

  if (!leftField && !rightField) return null;

  const nodeVal = valField ? valField.value : '?';
  const isLeftNil = !leftField || leftField.value === '' ||
    leftField.value.includes('nil') || leftField.value === '<nil>';
  const isRightNil = !rightField || rightField.value === '' ||
    rightField.value.includes('nil') || rightField.value === '<nil>';

  return {
    value: nodeVal,
    left: isLeftNil ? null : { value: '…', left: null, right: null },
    right: isRightNil ? null : { value: '…', left: null, right: null },
  };
}

/** Parse map entries from children or value */
function parseMapEntries(variable) {
  if (variable.children && variable.children.length > 0) {
    const entries = [];
    // Delve stores map children as alternating key/value pairs
    for (let i = 0; i + 1 < variable.children.length; i += 2) {
      entries.push({
        key: variable.children[i].value || variable.children[i].name || '',
        value: variable.children[i + 1].value || '',
      });
    }
    if (entries.length > 0) return entries;
    // Fallback: just show each child as key
    return variable.children.map(c => ({
      key: c.name || '',
      value: c.value || '',
    }));
  }
  return null;
}

// ── Renderers ────────────────────────────────────────────

function renderVariableCard(v) {
  const cat = getTypeCategory(v.type);
  const card = document.createElement('div');
  card.className = 'var-card';
  card.dataset.type = cat;
  card.dataset.name = v.name;

  let valueHTML = '';

  switch (cat) {
    case 'bool':
      valueHTML = renderBool(v.value);
      break;
    case 'string':
      valueHTML = renderString(v.value);
      break;
    case 'int':
    case 'float':
      valueHTML = renderPrimitive(v.value);
      break;
    case 'array':
      valueHTML = renderArray(v);
      break;
    case 'map':
      valueHTML = renderMap(v);
      break;
    case 'struct':
      valueHTML = renderStruct(v);
      break;
    case 'pointer':
      valueHTML = renderPointer(v);
      break;
    default:
      valueHTML = renderRaw(v.value);
  }

  card.innerHTML = `
    <div class="var-card-inner">
      <div class="var-header">
        <span class="var-name">${esc(v.name)}</span>
        <span class="var-type-badge" title="${esc(v.type)}">${esc(v.type)}</span>
      </div>
      ${valueHTML}
    </div>
  `;
  return card;
}

function renderPrimitive(value) {
  return `<div class="var-value">${esc(value || '0')}</div>`;
}

function renderBool(value) {
  const isTrue = value === 'true';
  return `
    <div class="var-value">
      <div class="bool-indicator ${isTrue ? 'is-true' : 'is-false'}">
        <div class="bool-dot"></div>
        <span>${isTrue ? 'true' : 'false'}</span>
      </div>
    </div>
  `;
}

function renderString(value) {
  // Delve wraps string values in quotes
  let display = value || '""';
  // If already quoted, show as-is; otherwise wrap
  if (!display.startsWith('"')) display = `"${display}"`;
  return `
    <div class="var-value">
      <div class="string-value">${esc(display)}</div>
    </div>
  `;
}

function renderArray(variable) {
  const elements = parseArrayElements(variable);
  if (!elements || elements.length === 0) {
    // Show raw value with any metadata
    const rawVal = variable.value || '[]';
    return `
      <div class="array-meta">empty or unparsed</div>
      <div class="var-value raw">${esc(rawVal)}</div>
    `;
  }
  const cellsHTML = elements.map((el, i) => `
    <div class="array-cell">
      <div class="array-index">${i}</div>
      <div class="array-val">${esc(el.value)}</div>
    </div>
  `).join('');

  return `
    <div class="var-value">
      <div class="array-meta">len <span>${elements.length}</span></div>
      <div class="array-container">${cellsHTML}</div>
    </div>
  `;
}

function renderMap(variable) {
  const entries = parseMapEntries(variable);
  if (!entries || entries.length === 0) {
    return `<div class="var-value raw">${esc(variable.value || 'map[]')}</div>`;
  }
  const entriesHTML = entries.map(e => `
    <div class="map-entry">
      <span class="map-key">${esc(e.key)}</span>
      <span class="map-arrow">→</span>
      <span class="map-val">${esc(e.value)}</span>
    </div>
  `).join('');

  return `
    <div class="var-value">
      <div class="map-container">${entriesHTML}</div>
    </div>
  `;
}

function renderStruct(variable) {
  const fields = parseStructFields(variable);

  // Check for tree-like structures
  if (fields && isTreeLike(fields)) {
    const tree = buildTreeNode(variable);
    if (tree) return renderTree(tree);
  }

  if (!fields || fields.length === 0) {
    return `<div class="var-value raw">${esc(variable.value || '{}')}</div>`;
  }

  const fieldsHTML = fields.map(f => `
    <div class="struct-field">
      <span class="struct-field-name">${esc(f.name)}</span>
      ${f.type ? `<span class="struct-field-type">${esc(f.type)}</span>` : ''}
      <span class="struct-field-value">${esc(f.value)}</span>
    </div>
  `).join('');

  return `
    <div class="var-value">
      <div class="struct-container">${fieldsHTML}</div>
    </div>
  `;
}

function renderTree(node) {
  if (!node) return `<div class="tree-node-nil">nil</div>`;
  return `
    <div class="var-value">
      <div class="tree-container">
        ${renderTreeNode(node)}
      </div>
    </div>
  `;
}

function renderTreeNode(node) {
  if (!node) return `<div class="tree-node-nil">nil</div>`;
  const hasChildren = node.left || node.right;
  return `
    <div class="tree-node">
      <div class="tree-node-value">${esc(String(node.value))}</div>
      ${hasChildren ? `
        <div class="tree-children">
          <div class="tree-branch">
            ${node.left ? renderTreeNode(node.left) : '<div class="tree-node-nil">nil</div>'}
          </div>
          <div class="tree-branch">
            ${node.right ? renderTreeNode(node.right) : '<div class="tree-node-nil">nil</div>'}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderPointer(variable) {
  // Pointers might have children (dereferenced value)
  if (variable.children && variable.children.length > 0) {
    const child = variable.children[0];
    const innerCat = getTypeCategory(child.type);
    return `
      <div class="var-value">
        <div class="struct-container">
          <div class="struct-field">
            <span class="struct-field-name">*</span>
            <span class="struct-field-type">${esc(child.type || '')}</span>
            <span class="struct-field-value">${esc(child.value || 'nil')}</span>
          </div>
        </div>
      </div>
    `;
  }
  return renderRaw(variable.value);
}

function renderRaw(value) {
  return `<div class="var-value raw">${esc(value || '—')}</div>`;
}

// ── Callstack Renderer ───────────────────────────────────
function renderCallstack(frames) {
  const container = dom.callstackBody();
  if (!frames || frames.length === 0) {
    container.innerHTML = '<div class="empty-state"><span class="empty-icon">⌀</span><span>No frames</span></div>';
    return;
  }
  container.innerHTML = frames.map((name, i) => {
    const shortName = name.replace(/^main\./, '');
    return `
      <div class="callstack-frame ${i === 0 ? 'is-current' : ''}">
        <div class="frame-icon"></div>
        <span title="${esc(name)}">${esc(shortName)}</span>
      </div>
    `;
  }).join('');
}

// ── Full Render ──────────────────────────────────────────
function render() {
  const snap = state.snapshot;
  if (!snap) return;

  // Step counter
  dom.stepValue().textContent = state.currentIndex;

  // Line number
  dom.lineValue().textContent = snap.line ?? '—';

  // Variables
  const vars = snap.variables || [];
  dom.varCount().textContent = vars.length;

  const varBody = dom.variablesBody();
  if (vars.length === 0) {
    varBody.innerHTML = `
      <div class="empty-state full">
        <span class="empty-icon large">◇</span>
        <span class="empty-text">No variables in current scope</span>
        <span class="empty-sub">Navigate to a step with local variables</span>
      </div>
    `;
  } else {
    // Build new cards
    const fragment = document.createDocumentFragment();
    const prevVarMap = buildVarMap(state.prevSnapshot);

    vars.forEach((v, i) => {
      const card = renderVariableCard(v);
      card.style.animationDelay = `${i * 40}ms`;

      // Detect changes
      if (prevVarMap) {
        const prevVal = prevVarMap.get(v.name);
        if (prevVal === undefined) {
          card.classList.add('is-new');
        } else if (prevVal !== v.value) {
          card.classList.add('is-changed');
        }
      }
      fragment.appendChild(card);
    });

    varBody.innerHTML = '';
    varBody.appendChild(fragment);
  }

  // Callstack
  renderCallstack(snap.callstack);
}

/** Build a Map<name, value> from a snapshot for diffing */
function buildVarMap(snapshot) {
  if (!snapshot || !snapshot.variables) return null;
  const m = new Map();
  snapshot.variables.forEach(v => m.set(v.name, v.value));
  return m;
}

// ── Navigation Actions ───────────────────────────────────
function setLoading(on) {
  state.isLoading = on;
  dom.loadingOverlay().classList.toggle('hidden', !on);
  dom.btnPrev().disabled = on;
  dom.btnNext().disabled = on;
  dom.btnFirst().disabled = on;
  dom.btnLast().disabled = on;
}

function snapshotsEqual(a, b) {
  if (!a || !b) return false;
  return a.line === b.line &&
    JSON.stringify(a.variables) === JSON.stringify(b.variables) &&
    JSON.stringify(a.callstack) === JSON.stringify(b.callstack);
}

async function goNext() {
  if (state.isLoading) return;
  setLoading(true);
  try {
    const data = await API.next();
    if (snapshotsEqual(data, state.snapshot)) {
      toast('Already at the last step', 'info');
    } else {
      state.prevSnapshot = state.snapshot;
      state.snapshot = data;
      state.currentIndex++;
      if (state.currentIndex > state.maxDiscoveredIndex) {
        state.maxDiscoveredIndex = state.currentIndex;
      }
    }
    render();
  } catch (e) {
    toast(`Error: ${e.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

async function goPrev() {
  if (state.isLoading) return;
  setLoading(true);
  try {
    const data = await API.prev();
    if (snapshotsEqual(data, state.snapshot)) {
      toast('Already at the first step', 'info');
    } else {
      state.prevSnapshot = state.snapshot;
      state.snapshot = data;
      state.currentIndex--;
    }
    render();
  } catch (e) {
    toast(`Error: ${e.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

async function goFirst() {
  if (state.isLoading) return;
  setLoading(true);
  try {
    const data = await API.jump(0);
    state.prevSnapshot = state.snapshot;
    state.snapshot = data;
    state.currentIndex = 0;
    render();
  } catch (e) {
    toast(`Error: ${e.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

async function goLast() {
  if (state.isLoading || state.maxDiscoveredIndex === 0) return;
  setLoading(true);
  try {
    // Jump to last known index, then try going further
    const data = await API.jump(state.maxDiscoveredIndex);
    state.prevSnapshot = state.snapshot;
    state.snapshot = data;
    state.currentIndex = state.maxDiscoveredIndex;

    // Try to advance beyond to discover more
    let keepGoing = true;
    while (keepGoing) {
      const nextData = await API.next();
      if (snapshotsEqual(nextData, state.snapshot)) {
        keepGoing = false;
      } else {
        state.prevSnapshot = state.snapshot;
        state.snapshot = nextData;
        state.currentIndex++;
        state.maxDiscoveredIndex = state.currentIndex;
      }
    }
    render();
  } catch (e) {
    toast(`Error: ${e.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

async function goJump() {
  const input = dom.jumpInput();
  const idx = parseInt(input.value, 10);
  if (isNaN(idx) || idx < 0) {
    toast('Enter a valid step number (≥ 0)', 'warn');
    return;
  }
  if (state.isLoading) return;
  setLoading(true);
  try {
    const data = await API.jump(idx);
    state.prevSnapshot = state.snapshot;
    state.snapshot = data;
    state.currentIndex = idx;
    if (idx > state.maxDiscoveredIndex) {
      state.maxDiscoveredIndex = idx;
    }
    render();
    input.value = '';
  } catch (e) {
    toast(`Error: ${e.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

// ── Toast Notifications ──────────────────────────────────
function toast(message, type = 'info') {
  const container = dom.toastContainer();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  }, 3000);
}

// ── Utility ──────────────────────────────────────────────
function esc(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

// ── Keyboard Shortcuts ───────────────────────────────────
function handleKeyboard(e) {
  // Don't capture if typing in input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch (e.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      e.preventDefault();
      goPrev();
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      e.preventDefault();
      goNext();
      break;
    case 'Home':
      e.preventDefault();
      goFirst();
      break;
    case 'End':
      e.preventDefault();
      goLast();
      break;
  }
}

// ── Initialization ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Bind events
  dom.btnNext().addEventListener('click', goNext);
  dom.btnPrev().addEventListener('click', goPrev);
  dom.btnFirst().addEventListener('click', goFirst);
  dom.btnLast().addEventListener('click', goLast);
  dom.btnJump().addEventListener('click', goJump);
  dom.jumpInput().addEventListener('keydown', (e) => {
    if (e.key === 'Enter') goJump();
  });
  document.addEventListener('keydown', handleKeyboard);

  // Initial load
  setLoading(true);
  try {
    const data = await API.getCurrent();
    state.snapshot = data;
    state.currentIndex = 0;
    render();
    toast('Connected to CodVis server', 'success');
  } catch (e) {
    toast('Could not connect to server. Is the backend running?', 'error');
    dom.variablesBody().innerHTML = `
      <div class="empty-state full">
        <span class="empty-icon large">⚠</span>
        <span class="empty-text">Unable to connect</span>
        <span class="empty-sub">Make sure the Go server is running on port 8080</span>
      </div>
    `;
  } finally {
    setLoading(false);
  }
});
