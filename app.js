const STORAGE_KEY = 'elite_founder_execution_document_v1';

const docTitleInput = document.getElementById('docTitleInput');
const sectionListEl = document.getElementById('sectionList');
const sectionTemplate = document.getElementById('sectionTemplate');
const addSectionBtn = document.getElementById('addSectionBtn');
const exportBtn = document.getElementById('exportBtn');
const resetBtn = document.getElementById('resetBtn');
const statusText = document.getElementById('statusText');
const sectionCount = document.getElementById('sectionCount');

let state = {
  title: 'Elite Founder Execution System',
  sections: []
};

let defaultState = null;
let saveTimer = null;

function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `sec_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function setStatus(message) {
  statusText.textContent = message;
}

function updateCount() {
  const count = state.sections.length;
  sectionCount.textContent = `${count} section${count === 1 ? '' : 's'}`;
}

function queueSave() {
  setStatus('Saving...');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setStatus(`Saved at ${new Date().toLocaleTimeString()}`);
  }, 220);
}

function normalizeState(candidate) {
  const safeTitle = typeof candidate?.title === 'string' && candidate.title.trim()
    ? candidate.title
    : 'Elite Founder Execution System';

  const safeSections = Array.isArray(candidate?.sections)
    ? candidate.sections
      .map((item) => ({
        id: typeof item.id === 'string' && item.id ? item.id : uid(),
        title: typeof item.title === 'string' ? item.title : 'Untitled Section',
        body: typeof item.body === 'string' ? item.body : ''
      }))
      .filter((item) => item.title.trim() || item.body.trim())
    : [];

  if (safeSections.length === 0) {
    safeSections.push({ id: uid(), title: 'New Section', body: '' });
  }

  return {
    title: safeTitle,
    sections: safeSections
  };
}

function parseMarkdownDocument(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  const introLines = [];

  let title = 'Elite Founder Execution System';
  let titleSet = false;
  let current = null;

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);

    if (h1 && !titleSet) {
      title = h1[1].trim();
      titleSet = true;
      continue;
    }

    if (h2) {
      if (current) {
        current.body = current.bodyLines.join('\n').trim();
        delete current.bodyLines;
        sections.push(current);
      }

      current = {
        id: uid(),
        title: h2[1].trim(),
        bodyLines: []
      };
      continue;
    }

    if (current) {
      current.bodyLines.push(line);
    } else {
      introLines.push(line);
    }
  }

  if (current) {
    current.body = current.bodyLines.join('\n').trim();
    delete current.bodyLines;
    sections.push(current);
  }

  const introText = introLines.join('\n').trim();
  if (introText) {
    sections.unshift({
      id: uid(),
      title: 'Overview',
      body: introText
    });
  }

  return normalizeState({ title, sections });
}

function toMarkdown(doc) {
  const output = [];
  output.push(`# ${doc.title || 'Untitled Document'}`);
  output.push('');

  for (const section of doc.sections) {
    output.push(`## ${section.title || 'Untitled Section'}`);
    output.push(section.body || '');
    output.push('');
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function moveSection(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= state.sections.length) {
    return;
  }

  const [item] = state.sections.splice(fromIndex, 1);
  state.sections.splice(toIndex, 0, item);
  render();
  queueSave();
}

function duplicateSection(index) {
  const source = state.sections[index];
  if (!source) {
    return;
  }

  state.sections.splice(index + 1, 0, {
    id: uid(),
    title: `${source.title} (Copy)`,
    body: source.body
  });

  render();
  queueSave();
}

function deleteSection(index) {
  if (state.sections.length <= 1) {
    window.alert('At least one section is required.');
    return;
  }

  const section = state.sections[index];
  const ok = window.confirm(`Delete "${section.title || 'this section'}"? This can be undone by Reset Default.`);
  if (!ok) {
    return;
  }

  state.sections.splice(index, 1);
  render();
  queueSave();
}

function addSection() {
  state.sections.push({
    id: uid(),
    title: 'New Section',
    body: 'Write your notes here.'
  });

  render();
  queueSave();

  const cards = sectionListEl.querySelectorAll('.section-card');
  const lastCard = cards[cards.length - 1];
  if (lastCard) {
    lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const titleInput = lastCard.querySelector('.section-title-input');
    if (titleInput) {
      titleInput.focus();
      titleInput.select();
    }
  }
}

function render() {
  docTitleInput.value = state.title;
  sectionListEl.innerHTML = '';

  state.sections.forEach((section, index) => {
    const fragment = sectionTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.section-card');
    const number = fragment.querySelector('.section-number');
    const titleInput = fragment.querySelector('.section-title-input');
    const bodyInput = fragment.querySelector('.section-body-input');
    const moveUpBtn = fragment.querySelector('[data-action="move-up"]');
    const moveDownBtn = fragment.querySelector('[data-action="move-down"]');
    const duplicateBtn = fragment.querySelector('[data-action="duplicate"]');
    const deleteBtn = fragment.querySelector('[data-action="delete"]');

    card.dataset.id = section.id;
    number.textContent = `Section ${index + 1}`;

    titleInput.value = section.title;
    bodyInput.value = section.body;

    moveUpBtn.disabled = index === 0;
    moveDownBtn.disabled = index === state.sections.length - 1;

    titleInput.addEventListener('input', (event) => {
      state.sections[index].title = event.target.value;
      queueSave();
    });

    bodyInput.addEventListener('input', (event) => {
      state.sections[index].body = event.target.value;
      queueSave();
    });

    moveUpBtn.addEventListener('click', () => moveSection(index, index - 1));
    moveDownBtn.addEventListener('click', () => moveSection(index, index + 1));
    duplicateBtn.addEventListener('click', () => duplicateSection(index));
    deleteBtn.addEventListener('click', () => deleteSection(index));

    sectionListEl.appendChild(fragment);
  });

  updateCount();
}

function downloadMarkdown() {
  const markdown = toMarkdown(state);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'elite-founder-execution-system.md';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
  setStatus('Markdown exported.');
}

function resetToDefault() {
  const ok = window.confirm('Reset the page to the original founder system content? This removes your unsaved edits.');
  if (!ok) {
    return;
  }

  state = normalizeState(defaultState);
  render();
  queueSave();
  setStatus('Reset to default content.');
}

async function loadDefaultState() {
  try {
    const response = await fetch('/default-content.md', { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load default content: ${response.status}`);
    }

    const markdown = await response.text();
    return parseMarkdownDocument(markdown);
  } catch (error) {
    console.error(error);
    return normalizeState({
      title: 'Elite Founder Execution System',
      sections: [{ id: uid(), title: 'Overview', body: 'Default content could not be loaded. Start editing here.' }]
    });
  }
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.error('Saved state is invalid. Loading default.', error);
    return null;
  }
}

async function init() {
  defaultState = await loadDefaultState();

  const saved = loadSavedState();
  state = saved || normalizeState(defaultState);

  docTitleInput.addEventListener('input', (event) => {
    state.title = event.target.value;
    queueSave();
  });

  addSectionBtn.addEventListener('click', addSection);
  exportBtn.addEventListener('click', downloadMarkdown);
  resetBtn.addEventListener('click', resetToDefault);

  render();
  queueSave();
  setStatus('Ready. Edit any section and delete anything you do not need.');
}

init();
