(() => {
  'use strict';

  const STORAGE_KEY = 'task-ledger-entries-v1';

  const form = document.getElementById('entry-form');
  const input = document.getElementById('task-input');
  const dateInput = document.getElementById('task-date');
  const timeInput = document.getElementById('task-time');
  const list = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  const nextIndexEl = document.getElementById('next-index');
  const tabs = document.querySelectorAll('.tab');
  const clearDoneBtn = document.getElementById('clear-done');
  const progressFill = document.getElementById('progress-fill');
  const statOpen = document.getElementById('stat-open');
  const statSummary = document.getElementById('stat-summary');
  const dateOpened = document.getElementById('date-opened');

  let entries = loadEntries();
  let filter = 'all';

  injectInkFilter();
  dateOpened.textContent = formatShortDate(new Date());
  render();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    const due = combineDueDateTime(dateInput.value, timeInput.value);

    entries.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
      text,
      due,
      done: false,
      createdAt: Date.now()
    });

    input.value = '';
    dateInput.value = '';
    timeInput.value = '';
    input.focus();

    saveAndRender();
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      filter = tab.dataset.filter;
      render();
    });
  });

  clearDoneBtn.addEventListener('click', () => {
    entries = entries.filter((entry) => !entry.done);
    saveAndRender();
  });

  list.addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (!row) return;
    const id = row.dataset.id;

    if (e.target.closest('.stamp-btn')) {
      toggleDone(id);
    } else if (e.target.closest('.icon-btn.edit')) {
      beginEdit(row, id);
    } else if (e.target.closest('.icon-btn.delete')) {
      deleteEntry(row, id);
    }
  });

  function toggleDone(id) {
    const entry = entries.find((t) => t.id === id);
    if (!entry) return;
    entry.done = !entry.done;
    saveAndRender();
  }

  function deleteEntry(row, id) {
    row.classList.add('is-leaving');
    row.addEventListener('animationend', () => {
      entries = entries.filter((t) => t.id !== id);
      saveAndRender();
    }, { once: true });
  }

  function beginEdit(row, id) {
    const line = row.querySelector('.entry-text-line');
    line.setAttribute('contenteditable', 'true');
    line.focus();
    placeCaretAtEnd(line);

    const commit = () => {
      line.removeAttribute('contenteditable');
      const newText = line.textContent.trim();
      const entry = entries.find((t) => t.id === id);
      if (entry && newText) {
        entry.text = newText;
        saveAndRender();
      } else {
        render();
      }
    };

    line.addEventListener('blur', commit, { once: true });
    line.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        line.blur();
      } else if (ev.key === 'Escape') {
        line.textContent = entries.find((t) => t.id === id).text;
        line.blur();
      }
    });
  }

  function saveAndRender() {
    saveEntries();
    render();
  }

  function render() {
    const visible = entries.filter((entry) => {
      if (filter === 'active') return !entry.done;
      if (filter === 'done') return entry.done;
      if (filter === 'overdue') return !entry.done && isOverdue(entry.due);
      return true;
    });

    list.innerHTML = '';
    list.classList.toggle('is-empty', visible.length === 0);

    visible
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((entry) => {
        list.appendChild(buildRow(entry));
      });

    const openCount = entries.filter((e) => !e.done).length;
    const doneCount = entries.length - openCount;

    statOpen.textContent = openCount;
    statSummary.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · ${doneCount} settled`;
    progressFill.style.width = entries.length ? `${Math.round((doneCount / entries.length) * 100)}%` : '0%';
    nextIndexEl.textContent = String(entries.length + 1).padStart(3, '0');
  }

  function buildRow(entry) {
    const li = document.createElement('li');
    li.className = 'row' + (entry.done ? ' is-done' : '');
    li.dataset.id = entry.id;

    const index = entries.findIndex((e) => e.id === entry.id) + 1;

    const overdue = !entry.done && isOverdue(entry.due);

    li.innerHTML = `
      <span class="row-num">${String(index).padStart(3, '0')}</span>
      <button class="stamp-btn" type="button" aria-label="${entry.done ? 'Mark as open' : 'Mark as settled'}">
        <span class="stamp-mark">Done</span>
      </button>
      <div class="entry-body">
        <div class="entry-text-line">${escapeHtml(entry.text)}</div>
        ${entry.due ? `<span class="due-badge${overdue ? ' is-overdue' : ''}"><i>${overdue ? 'overdue —' : 'due'}</i> ${formatDue(entry.due)}</span>` : ''}
      </div>
      <div class="row-actions">
        <button class="icon-btn edit" type="button" aria-label="Edit entry" title="Edit">✎</button>
        <button class="icon-btn delete" type="button" aria-label="Delete entry" title="Delete">✕</button>
      </div>
    `;

    return li;
  }

  function combineDueDateTime(dateStr, timeStr) {
    if (!dateStr) return null;
    return `${dateStr}T${timeStr || '23:59'}`;
  }

  function isOverdue(due) {
    if (!due) return false;
    return new Date(due).getTime() < Date.now();
  }

  function formatDue(due) {
    const d = new Date(due);
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${dateStr}, ${timeStr}`;
  }

  function formatShortDate(d) {
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function placeCaretAtEnd(el) {
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveEntries() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* storage unavailable — entries persist for this session only */
    }
  }

  function injectInkFilter() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = `
      <filter id="inkTexture">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2"/>
      </filter>
    `;
    document.body.appendChild(svg);
  }
})();
