/* ═══════════════════════════════════════════
   AgenceBoard — app.js
   Données, logique, drag & drop, modaux, vues
   ═══════════════════════════════════════════ */

// ── DATA ──────────────────────────────────────────────────────────
const CLIENTS = ['American Express', 'AirPlus', 'HRS', 'AFTM'];

const STATUS_MAP = {
  'À faire':               's-afaire',
  'En cours':              's-encours',
  'Attente retour client': 's-attclient',
  'Attente retour tiers':  's-atttiers',
  'Devis envoyé':          's-devis',
  'À relancer':            's-relancer',
  'Bloqué':                's-bloque',
  'Terminé':               's-termine',
};

const PRIORITY_COLOR = {
  'Haute':       '#EB5A46',
  'Normale':     '#0079BF',
  'Basse':       '#61BD4F',
  'Non définie': '#B3BAC5',
};

const CLIENT_COLOR = {
  'American Express': '#0052cc',
  'AirPlus':          '#00838f',
  'HRS':              '#6a1b9a',
  'AFTM':             '#e65100',
};

let state = loadState();

function defaultState() {
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const add = n => { const d = new Date(today); d.setDate(d.getDate()+n); return fmt(d); };

  return {
    columns: [
      { id: 'c1', title: 'À faire' },
      { id: 'c2', title: 'En cours' },
      { id: 'c3', title: 'Attente retour' },
      { id: 'c4', title: 'Terminé' },
    ],
    projects: [
      { id: 'p1', title: 'Cocktail + PDJ American Express', client: 'American Express', type: 'Événement', due: add(10), notes: 'Cocktail mardi, PDJ mercredi' },
      { id: 'p2', title: 'Publication vidéo ISOS LinkedIn', client: 'AFTM', type: 'Réseaux sociaux', due: add(2), notes: 'Vidéo ISOS à publier' },
      { id: 'p3', title: 'Campagne print Q2', client: 'AirPlus', type: 'Print / Digital', due: add(30), notes: '' },
      { id: 'p4', title: 'Gestion compte RS', client: 'HRS', type: 'Réseaux sociaux', due: add(60), notes: '' },
    ],
    tasks: [
      { id: 't1', columnId: 'c3', title: 'Devis Foodelles pour cocktail + PDJ', desc: 'Devis pour cocktail mardi et PDJ mercredi', comment: 'En attente de réception du devis', client: 'American Express', project: 'Cocktail + PDJ American Express', type: 'Devis', status: 'Attente retour tiers', priority: 'Non définie', due: '' },
      { id: 't2', columnId: 'c1', title: 'Publier la vidéo ISOS sur LinkedIn', desc: 'Publication de la vidéo ISOS', comment: 'À publier impérativement le 7 avril', client: 'AFTM', project: 'Publication vidéo ISOS LinkedIn', type: 'Publication RS', status: 'À faire', priority: 'Haute', due: add(2) },
      { id: 't3', columnId: 'c2', title: 'Brief créatif à finaliser', desc: 'Finaliser le brief créatif pour la campagne', comment: '', client: 'AirPlus', project: 'Campagne print Q2', type: 'Création', status: 'En cours', priority: 'Normale', due: add(5) },
      { id: 't4', columnId: 'c1', title: 'Calendrier éditorial avril', desc: 'Planification du calendrier avril pour HRS', comment: '', client: 'HRS', project: 'Gestion compte RS', type: 'Planification', status: 'À faire', priority: 'Normale', due: add(-2) },
    ],
    nextId: 10,
  };
}

function loadState() {
  try {
    const s = localStorage.getItem('agenceboard_v2');
    return s ? JSON.parse(s) : defaultState();
  } catch { return defaultState(); }
}

function saveState() {
  localStorage.setItem('agenceboard_v2', JSON.stringify(state));
}

function uid() {
  return 'id' + (state.nextId++) + '_' + Math.random().toString(36).slice(2,6);
}

// ── FILTERS ───────────────────────────────────────────────────────
let filters = { client: '', type: '' };

function applyFilters() {
  filters.client = document.getElementById('filter-client').value;
  filters.type   = document.getElementById('filter-type').value;
  renderBoard();
  renderPlanning();
  renderDashboard();
}

function taskVisible(task) {
  if (filters.client && task.client !== filters.client) return false;
  if (filters.type) {
    const proj = state.projects.find(p => p.title === task.project);
    if (!proj || proj.type !== filters.type) return false;
  }
  return true;
}

// ── DATE HELPERS ──────────────────────────────────────────────────
function today0() {
  const d = new Date(); d.setHours(0,0,0,0); return d;
}

function parseDue(s) {
  if (!s) return null;
  const d = new Date(s); d.setHours(0,0,0,0); return d;
}

function dueDays(s) {
  const due = parseDue(s); if (!due) return null;
  return Math.round((due - today0()) / 86400000);
}

function dueFmt(s) {
  if (!s) return '—';
  const d = parseDue(s);
  return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
}

function dueStatus(s) {
  const n = dueDays(s);
  if (n === null) return 'aucun';
  if (n < 0)  return 'retard';
  if (n <= 3) return 'proche';
  return 'ok';
}

// ── RENDER BOARD ──────────────────────────────────────────────────
function renderBoard() {
  const container = document.getElementById('board-columns');
  container.innerHTML = '';

  let total = 0;
  state.columns.forEach(col => {
    const tasks = state.tasks.filter(t => t.columnId === col.id && taskVisible(t));
    total += tasks.length;
    container.appendChild(buildColumn(col, tasks));
  });

  document.getElementById('board-meta-count').textContent =
    `${total} carte${total > 1 ? 's' : ''} · ${state.columns.length} liste${state.columns.length > 1 ? 's' : ''}`;
}

function buildColumn(col, tasks) {
  const div = document.createElement('div');
  div.className = 'column';
  div.dataset.colId = col.id;

  div.innerHTML = `
    <div class="column-header">
      <span class="column-title" ondblclick="editColTitle(this,'${col.id}')">${escHtml(col.title)}</span>
      <span class="column-count">${tasks.length}</span>
      <button class="col-menu-btn" title="Options" onclick="colMenu('${col.id}')">···</button>
    </div>
    <div class="cards-list" id="list-${col.id}" 
         ondragover="onDragOver(event,'${col.id}')"
         ondragleave="onDragLeave(event,'${col.id}')"
         ondrop="onDrop(event,'${col.id}')">
    </div>
    <button class="add-card-btn" onclick="openModal('new-task','${col.id}')">
      + Ajouter une carte
    </button>
  `;

  const list = div.querySelector('.cards-list');
  tasks.forEach(t => list.appendChild(buildCard(t)));

  return div;
}

function buildCard(task) {
  const div = document.createElement('div');
  const ds = dueStatus(task.due);
  div.className = `card${ds === 'retard' ? ' retard' : ds === 'proche' ? ' proche' : ''}`;
  div.dataset.taskId = task.id;
  div.draggable = true;

  const statusClass = STATUS_MAP[task.status] || 's-afaire';
  const prioColor   = PRIORITY_COLOR[task.priority] || '#B3BAC5';
  const clientColor = CLIENT_COLOR[task.client] || '#888';

  // Due chip
  let dueHtml = '';
  if (task.due) {
    const label = ds === 'retard' ? '⚠ ' + dueFmt(task.due) : ds === 'proche' ? '⏰ ' + dueFmt(task.due) : dueFmt(task.due);
    dueHtml = `<span class="card-due ${ds}">${label}</span>`;
  }

  div.innerHTML = `
    <div class="card-labels">
      <span class="label" style="background:${clientColor}" title="${escHtml(task.client)}"></span>
      <span class="label" style="background:${prioColor}" title="Priorité : ${escHtml(task.priority)}"></span>
    </div>
    <div class="card-title">${escHtml(task.title)}</div>
    <div class="card-footer">
      ${dueHtml}
      <span class="card-status-badge ${statusClass}">${escHtml(task.status)}</span>
      <span class="card-priority" style="background:${prioColor}" title="${escHtml(task.priority)}"></span>
    </div>
  `;

  div.addEventListener('click', () => openModal('edit-task', null, task.id));
  div.addEventListener('dragstart', onDragStart);
  div.addEventListener('dragend', onDragEnd);

  return div;
}

// ── COLUMN ACTIONS ────────────────────────────────────────────────
function editColTitle(el, colId) {
  const col = state.columns.find(c => c.id === colId);
  const input = document.createElement('input');
  input.className = 'col-title-input';
  input.value = col.title;
  el.replaceWith(input);
  input.focus(); input.select();

  const finish = () => {
    col.title = input.value.trim() || col.title;
    saveState(); renderBoard();
  };
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') finish(); });
}

function colMenu(colId) {
  if (!confirm('Supprimer cette colonne et toutes ses cartes ?')) return;
  state.columns = state.columns.filter(c => c.id !== colId);
  state.tasks   = state.tasks.filter(t => t.columnId !== colId);
  saveState(); renderBoard();
}

function addColumn() {
  const title = prompt('Nom de la nouvelle liste :');
  if (!title) return;
  state.columns.push({ id: uid(), title: title.trim() });
  saveState(); renderBoard();
}

// ── DRAG & DROP ───────────────────────────────────────────────────
let dragId = null;

function onDragStart(e) {
  dragId = this.dataset.taskId;
  this.style.opacity = '.5';
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(e) {
  this.style.opacity = '';
  document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
  document.querySelectorAll('.drop-placeholder').forEach(p => p.remove());
}

function onDragOver(e, colId) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const col = document.querySelector(`.column[data-col-id="${colId}"]`);
  col.classList.add('drag-over');
}

function onDragLeave(e, colId) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    document.querySelector(`.column[data-col-id="${colId}"]`)?.classList.remove('drag-over');
  }
}

function onDrop(e, colId) {
  e.preventDefault();
  if (!dragId) return;
  const task = state.tasks.find(t => t.id === dragId);
  if (task) {
    task.columnId = colId;
    // Auto-update status to match column name if it matches a status
    const col = state.columns.find(c => c.id === colId);
    if (col && STATUS_MAP[col.title]) task.status = col.title;
    saveState();
  }
  document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
  renderBoard(); renderDashboard(); renderPlanning();
  dragId = null;
}

// ── MODAL ─────────────────────────────────────────────────────────
let editingTaskId = null;
let editingProjectId = null;
let targetColumnId = null;

function openModal(mode, colId, taskId) {
  targetColumnId = colId || state.columns[0]?.id || null;

  if (mode === 'new-task' || mode === 'edit-task') {
    editingTaskId = taskId || null;
    populateProjectDropdown();

    if (taskId) {
      const t = state.tasks.find(x => x.id === taskId);
      document.getElementById('modal-title').value   = t.title;
      document.getElementById('modal-desc').value    = t.desc || '';
      document.getElementById('modal-comment').value = t.comment || '';
      document.getElementById('modal-client').value  = t.client;
      document.getElementById('modal-project').value = t.project;
      document.getElementById('modal-type').value    = t.type;
      document.getElementById('modal-status').value  = t.status;
      document.getElementById('modal-priority').value= t.priority;
      document.getElementById('modal-due').value     = t.due || '';
      document.getElementById('modal-delete-btn').style.display = 'block';
    } else {
      document.getElementById('task-modal').querySelectorAll('input,select,textarea').forEach(el => {
        if (el.tagName === 'SELECT') el.selectedIndex = 0;
        else el.value = '';
      });
      document.getElementById('modal-delete-btn').style.display = 'none';
    }

    showModal('task-modal');
  }

  if (mode === 'new-project') {
    editingProjectId = null;
    document.getElementById('project-modal').querySelectorAll('input,select,textarea').forEach(el => {
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
    showModal('project-modal');
  }
}

function showModal(id) {
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
  editingTaskId = null; editingProjectId = null; targetColumnId = null;
}

function populateProjectDropdown() {
  const sel = document.getElementById('modal-project');
  sel.innerHTML = '<option value="">— Choisir —</option>';
  state.projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.title; opt.textContent = p.title;
    sel.appendChild(opt);
  });
}

function saveTask() {
  const title = document.getElementById('modal-title').value.trim();
  if (!title) { alert('Le titre est obligatoire.'); return; }

  const data = {
    title,
    desc:     document.getElementById('modal-desc').value.trim(),
    comment:  document.getElementById('modal-comment').value.trim(),
    client:   document.getElementById('modal-client').value,
    project:  document.getElementById('modal-project').value,
    type:     document.getElementById('modal-type').value,
    status:   document.getElementById('modal-status').value,
    priority: document.getElementById('modal-priority').value,
    due:      document.getElementById('modal-due').value,
  };

  if (editingTaskId) {
    const t = state.tasks.find(x => x.id === editingTaskId);
    Object.assign(t, data);
    // Move card to matching column if status = column title
    const matchCol = state.columns.find(c => c.title === data.status);
    if (matchCol) t.columnId = matchCol.id;
  } else {
    const colId = targetColumnId || state.columns[0]?.id;
    state.tasks.push({ id: uid(), columnId: colId, ...data });
  }

  saveState(); closeModal(); renderBoard(); renderDashboard(); renderPlanning();
}

function deleteTask() {
  if (!editingTaskId) return;
  if (!confirm('Supprimer cette tâche ?')) return;
  state.tasks = state.tasks.filter(t => t.id !== editingTaskId);
  saveState(); closeModal(); renderBoard(); renderDashboard(); renderPlanning();
}

function saveProject() {
  const title = document.getElementById('proj-title').value.trim();
  if (!title) { alert('Le nom est obligatoire.'); return; }

  const data = {
    title,
    client: document.getElementById('proj-client').value,
    type:   document.getElementById('proj-type').value,
    due:    document.getElementById('proj-due').value,
    notes:  document.getElementById('proj-notes').value.trim(),
  };

  if (editingProjectId) {
    const p = state.projects.find(x => x.id === editingProjectId);
    Object.assign(p, data);
  } else {
    state.projects.push({ id: uid(), ...data });
  }

  saveState(); closeModal(); renderBoard(); renderDashboard(); renderPlanning();
}

// ── VIEW SWITCHING ────────────────────────────────────────────────
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelector(`[data-view="${name}"]`).classList.add('active');

  if (name === 'dashboard') renderDashboard();
  if (name === 'planning')  renderPlanning();
}

// ── DASHBOARD ─────────────────────────────────────────────────────
function renderDashboard() {
  const tasks    = state.tasks.filter(taskVisible);
  const projects = state.projects;

  const actifs   = projects.length;
  const retard   = tasks.filter(t => dueStatus(t.due) === 'retard' && t.status !== 'Terminé').length;
  const semaine  = tasks.filter(t => { const n = dueDays(t.due); return n !== null && n >= 0 && n <= 7 && t.status !== 'Terminé'; }).length;
  const termine  = tasks.filter(t => t.status === 'Terminé').length;

  document.getElementById('kpi-actifs').textContent  = actifs;
  document.getElementById('kpi-retard').textContent  = retard;
  document.getElementById('kpi-semaine').textContent = semaine;
  document.getElementById('kpi-termine').textContent = termine;

  // Retard list
  const retardEl = document.getElementById('dash-retard');
  const retardTasks = tasks.filter(t => dueStatus(t.due) === 'retard' && t.status !== 'Terminé');
  retardEl.innerHTML = retardTasks.length ? retardTasks.map(t => `
    <div class="dash-row retard-row">
      <span class="dash-row-label">${escHtml(t.title)}</span>
      <span class="dash-row-sub">${dueFmt(t.due)}</span>
    </div>`).join('') : '<div class="empty-state">Aucune tâche en retard 🎉</div>';

  // Semaine list
  const semaineEl = document.getElementById('dash-semaine');
  const semaineTasks = tasks.filter(t => { const n = dueDays(t.due); return n !== null && n >= 0 && n <= 7 && t.status !== 'Terminé'; })
    .sort((a,b) => new Date(a.due) - new Date(b.due));
  semaineEl.innerHTML = semaineTasks.length ? semaineTasks.map(t => `
    <div class="dash-row proche-row">
      <span class="dash-row-label">${escHtml(t.title)}</span>
      <span class="dash-row-sub">${dueFmt(t.due)}</span>
    </div>`).join('') : '<div class="empty-state">Aucune échéance cette semaine</div>';

  // Clients
  const clientsEl = document.getElementById('dash-clients');
  clientsEl.innerHTML = CLIENTS.map(c => {
    const actif = projects.filter(p => p.client === c).length;
    const done  = tasks.filter(t => t.client === c && t.status === 'Terminé').length;
    const color = CLIENT_COLOR[c] || '#888';
    return `<div class="client-stat-row">
      <span class="client-name" style="color:${color};font-weight:600">${escHtml(c)}</span>
      <div class="client-chips">
        <span class="client-chip chip-actif">${actif} projet${actif>1?'s':''}</span>
        <span class="client-chip chip-termine">${done} terminée${done>1?'s':''}</span>
      </div>
    </div>`;
  }).join('');

  // Statuts
  const statutsEl = document.getElementById('dash-statuts');
  const allStatuts = Object.keys(STATUS_MAP);
  const max = Math.max(...allStatuts.map(s => tasks.filter(t => t.status === s).length), 1);
  statutsEl.innerHTML = `<div class="stat-bar-wrap">` +
    allStatuts.map(s => {
      const cls = STATUS_MAP[s];
      const count = tasks.filter(t => t.status === s).length;
      const pct = Math.round((count / max) * 100);
      // Derive fill color from CSS var (approximate)
      const fillMap = {
        's-afaire':'#aacce8','s-encours':'#f5c580','s-attclient':'#f0a8be',
        's-atttiers':'#b9a8e0','s-devis':'#8ecf95','s-relancer':'#ffc36b',
        's-bloque':'#f59898','s-termine':'#1E7E44'
      };
      return `<div class="stat-bar-row">
        <span class="stat-label card-status-badge ${cls}">${escHtml(s)}</span>
        <div class="stat-track"><div class="stat-fill" style="width:${pct}%;background:${fillMap[cls]||'#ccc'}"></div></div>
        <span class="stat-count">${count}</span>
      </div>`;
    }).join('') + '</div>';
}

// ── PLANNING ──────────────────────────────────────────────────────
function renderPlanning() {
  const tbody = document.getElementById('planning-body');
  const tasks = state.tasks
    .filter(taskVisible)
    .filter(t => t.status !== 'Terminé')
    .sort((a,b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due) - new Date(b.due);
    });

  if (!tasks.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="padding:20px">Aucune tâche active</td></tr>`;
    return;
  }

  tbody.innerHTML = tasks.map(t => {
    const ds = dueStatus(t.due);
    const rowClass = ds === 'retard' ? 'retard-row' : ds === 'proche' ? 'proche-row' : '';
    const prioColor = PRIORITY_COLOR[t.priority] || '#B3BAC5';
    const statusClass = STATUS_MAP[t.status] || 's-afaire';
    const proj = state.projects.find(p => p.title === t.project);
    const type = proj ? proj.type : '—';

    return `<tr class="${rowClass}" onclick="openModal('edit-task',null,'${t.id}')" style="cursor:pointer">
      <td style="font-weight:500">${escHtml(t.project || '—')}</td>
      <td style="color:${CLIENT_COLOR[t.client]||'#888'};font-weight:600">${escHtml(t.client || '—')}</td>
      <td>${escHtml(type)}</td>
      <td>${escHtml(t.title)}</td>
      <td><span class="due-chip ${ds}">${t.due ? dueFmt(t.due) : '—'}</span></td>
      <td><span class="card-status-badge ${statusClass}">${escHtml(t.status)}</span></td>
      <td><span class="priority-dot" style="background:${prioColor}"></span>${escHtml(t.priority)}</td>
    </tr>`;
  }).join('');
}

// ── UTILS ─────────────────────────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Close modal on Escape
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── INIT ──────────────────────────────────────────────────────────
renderBoard();
renderDashboard();
renderPlanning();
