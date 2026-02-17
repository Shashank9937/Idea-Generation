const STORAGE_KEY = 'elite_founder_execution_document_v2';
const DEFAULT_DOC_URL = '/default-content.md';
const KNOWLEDGE_DOC_URL = '/founder-knowledge-content.md';

const docTitleInput = document.getElementById('docTitleInput');
const sectionListEl = document.getElementById('sectionList');
const sectionTemplate = document.getElementById('sectionTemplate');
const subsectionTemplate = document.getElementById('subsectionTemplate');
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
  return `id_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function setStatus(message) {
  statusText.textContent = message;
}

function updateCount() {
  const sectionTotal = state.sections.length;
  const subsectionTotal = state.sections.reduce((sum, section) => sum + section.subsections.length, 0);
  sectionCount.textContent = `${sectionTotal} sections | ${subsectionTotal} subsections`;
}

function queueSave() {
  setStatus('Saving...');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setStatus(`Saved at ${new Date().toLocaleTimeString()}`);
  }, 220);
}

function normalizeSubsection(item) {
  return {
    id: typeof item?.id === 'string' && item.id ? item.id : uid(),
    title: typeof item?.title === 'string' ? item.title : 'Untitled Subsection',
    body: typeof item?.body === 'string' ? item.body : ''
  };
}

function normalizeSection(item) {
  const subsections = Array.isArray(item?.subsections)
    ? item.subsections.map(normalizeSubsection).filter((sub) => sub.title.trim() || sub.body.trim())
    : [];

  return {
    id: typeof item?.id === 'string' && item.id ? item.id : uid(),
    title: typeof item?.title === 'string' ? item.title : 'Untitled Section',
    body: typeof item?.body === 'string' ? item.body : '',
    subsections
  };
}

function normalizeState(candidate) {
  const safeTitle = typeof candidate?.title === 'string' && candidate.title.trim()
    ? candidate.title
    : 'Elite Founder Execution System';

  const safeSections = Array.isArray(candidate?.sections)
    ? candidate.sections.map(normalizeSection).filter((section) => section.title.trim() || section.body.trim() || section.subsections.length)
    : [];

  if (safeSections.length === 0) {
    safeSections.push({
      id: uid(),
      title: 'New Section',
      body: '',
      subsections: []
    });
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

  let currentSection = null;
  let currentSubsection = null;

  function flushSubsection() {
    if (!currentSubsection || !currentSection) {
      currentSubsection = null;
      return;
    }

    currentSubsection.body = currentSubsection._bodyLines.join('\n').trim();
    delete currentSubsection._bodyLines;
    currentSection.subsections.push(currentSubsection);
    currentSubsection = null;
  }

  function flushSection() {
    if (!currentSection) {
      return;
    }

    flushSubsection();
    currentSection.body = currentSection._bodyLines.join('\n').trim();
    delete currentSection._bodyLines;
    delete currentSection._fromH1;

    if (currentSection.title.trim() || currentSection.body.trim() || currentSection.subsections.length) {
      sections.push(currentSection);
    }

    currentSection = null;
  }

  function createSection(sectionTitle, fromH1 = false) {
    return {
      id: uid(),
      title: sectionTitle,
      body: '',
      subsections: [],
      _bodyLines: [],
      _fromH1: fromH1
    };
  }

  function createSubsection(subsectionTitle) {
    return {
      id: uid(),
      title: subsectionTitle,
      body: '',
      _bodyLines: []
    };
  }

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);

    if (h1) {
      if (!titleSet) {
        title = h1[1].trim();
        titleSet = true;
      } else {
        flushSection();
        currentSection = createSection(h1[1].trim(), true);
      }
      continue;
    }

    if (h2) {
      if (currentSection && currentSection._fromH1) {
        flushSubsection();
        currentSubsection = createSubsection(h2[1].trim());
      } else {
        flushSection();
        currentSection = createSection(h2[1].trim(), false);
      }
      continue;
    }

    if (h3) {
      if (!currentSection) {
        currentSection = createSection('New Section', false);
      }

      flushSubsection();
      currentSubsection = createSubsection(h3[1].trim());
      continue;
    }

    if (currentSubsection) {
      currentSubsection._bodyLines.push(line);
    } else if (currentSection) {
      currentSection._bodyLines.push(line);
    } else {
      introLines.push(line);
    }
  }

  flushSection();

  const introText = introLines.join('\n').trim();
  if (introText) {
    sections.unshift({
      id: uid(),
      title: 'Overview',
      body: introText,
      subsections: []
    });
  }

  return normalizeState({ title, sections });
}

function flattenNestedSubsections(section) {
  const bodyParts = [];

  if (section.body && section.body.trim()) {
    bodyParts.push(section.body.trim());
  }

  if (Array.isArray(section.subsections) && section.subsections.length) {
    const nestedMarkdown = section.subsections
      .map((sub) => `#### ${sub.title || 'Untitled'}\n${sub.body || ''}`.trim())
      .join('\n\n');
    bodyParts.push(nestedMarkdown);
  }

  return bodyParts.join('\n\n').trim();
}

function mergeDocuments(primaryDoc, knowledgeDoc) {
  const merged = normalizeState(primaryDoc);

  const knowledgeSection = {
    id: uid(),
    title: knowledgeDoc.title || 'Founder Knowledge & AI Leverage System',
    body: '',
    subsections: (knowledgeDoc.sections || []).map((section) => ({
      id: uid(),
      title: section.title || 'Untitled Subsection',
      body: flattenNestedSubsections(section)
    }))
  };

  if (!knowledgeSection.subsections.length) {
    knowledgeSection.subsections.push({
      id: uid(),
      title: 'Overview',
      body: 'Knowledge content could not be parsed. Paste it manually here.'
    });
  }

  merged.sections.push(normalizeSection(knowledgeSection));
  return normalizeState(merged);
}

function toMarkdown(doc) {
  const output = [];
  output.push(`# ${doc.title || 'Untitled Document'}`);
  output.push('');

  for (const section of doc.sections) {
    output.push(`## ${section.title || 'Untitled Section'}`);
    if (section.body) {
      output.push(section.body);
    }

    for (const subsection of section.subsections) {
      output.push(`### ${subsection.title || 'Untitled Subsection'}`);
      output.push(subsection.body || '');
    }

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

  const sectionCopy = {
    id: uid(),
    title: `${source.title} (Copy)`,
    body: source.body,
    subsections: source.subsections.map((sub) => ({
      id: uid(),
      title: sub.title,
      body: sub.body
    }))
  };

  state.sections.splice(index + 1, 0, sectionCopy);
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
    body: 'Write your section notes here.',
    subsections: []
  });

  render();
  queueSave();
}

function addSubsection(sectionIndex) {
  state.sections[sectionIndex].subsections.push({
    id: uid(),
    title: 'New Subsection',
    body: 'Write subsection notes here.'
  });

  render();
  queueSave();
}

function moveSubsection(sectionIndex, fromIndex, toIndex) {
  const targetSection = state.sections[sectionIndex];
  if (!targetSection || toIndex < 0 || toIndex >= targetSection.subsections.length) {
    return;
  }

  const [item] = targetSection.subsections.splice(fromIndex, 1);
  targetSection.subsections.splice(toIndex, 0, item);
  render();
  queueSave();
}

function duplicateSubsection(sectionIndex, subsectionIndex) {
  const targetSection = state.sections[sectionIndex];
  const source = targetSection?.subsections[subsectionIndex];
  if (!targetSection || !source) {
    return;
  }

  targetSection.subsections.splice(subsectionIndex + 1, 0, {
    id: uid(),
    title: `${source.title} (Copy)`,
    body: source.body
  });

  render();
  queueSave();
}

function deleteSubsection(sectionIndex, subsectionIndex) {
  const targetSection = state.sections[sectionIndex];
  if (!targetSection) {
    return;
  }

  const subsection = targetSection.subsections[subsectionIndex];
  const ok = window.confirm(`Delete subsection "${subsection?.title || 'Untitled'}"?`);
  if (!ok) {
    return;
  }

  targetSection.subsections.splice(subsectionIndex, 1);
  render();
  queueSave();
}

function render() {
  docTitleInput.value = state.title;
  sectionListEl.innerHTML = '';

  state.sections.forEach((section, sectionIndex) => {
    const fragment = sectionTemplate.content.cloneNode(true);

    const card = fragment.querySelector('.section-card');
    const number = fragment.querySelector('.section-number');
    const titleInput = fragment.querySelector('.section-title-input');
    const bodyInput = fragment.querySelector('.section-body-input');
    const moveUpBtn = fragment.querySelector('[data-action="move-up"]');
    const moveDownBtn = fragment.querySelector('[data-action="move-down"]');
    const duplicateBtn = fragment.querySelector('[data-action="duplicate"]');
    const deleteBtn = fragment.querySelector('[data-action="delete"]');
    const addSubsectionBtn = fragment.querySelector('.add-subsection-btn');
    const subsectionList = fragment.querySelector('.subsection-list');

    card.dataset.id = section.id;
    number.textContent = `Section ${sectionIndex + 1}`;
    titleInput.value = section.title;
    bodyInput.value = section.body;

    moveUpBtn.disabled = sectionIndex === 0;
    moveDownBtn.disabled = sectionIndex === state.sections.length - 1;

    titleInput.addEventListener('input', (event) => {
      state.sections[sectionIndex].title = event.target.value;
      queueSave();
    });

    bodyInput.addEventListener('input', (event) => {
      state.sections[sectionIndex].body = event.target.value;
      queueSave();
    });

    moveUpBtn.addEventListener('click', () => moveSection(sectionIndex, sectionIndex - 1));
    moveDownBtn.addEventListener('click', () => moveSection(sectionIndex, sectionIndex + 1));
    duplicateBtn.addEventListener('click', () => duplicateSection(sectionIndex));
    deleteBtn.addEventListener('click', () => deleteSection(sectionIndex));
    addSubsectionBtn.addEventListener('click', () => addSubsection(sectionIndex));

    section.subsections.forEach((subsection, subsectionIndex) => {
      const subFragment = subsectionTemplate.content.cloneNode(true);

      const subNumber = subFragment.querySelector('.subsection-number');
      const subTitleInput = subFragment.querySelector('.subsection-title-input');
      const subBodyInput = subFragment.querySelector('.subsection-body-input');
      const subMoveUpBtn = subFragment.querySelector('[data-sub-action="move-up"]');
      const subMoveDownBtn = subFragment.querySelector('[data-sub-action="move-down"]');
      const subDuplicateBtn = subFragment.querySelector('[data-sub-action="duplicate"]');
      const subDeleteBtn = subFragment.querySelector('[data-sub-action="delete"]');

      subNumber.textContent = `Subsection ${sectionIndex + 1}.${subsectionIndex + 1}`;
      subTitleInput.value = subsection.title;
      subBodyInput.value = subsection.body;

      subMoveUpBtn.disabled = subsectionIndex === 0;
      subMoveDownBtn.disabled = subsectionIndex === section.subsections.length - 1;

      subTitleInput.addEventListener('input', (event) => {
        state.sections[sectionIndex].subsections[subsectionIndex].title = event.target.value;
        queueSave();
      });

      subBodyInput.addEventListener('input', (event) => {
        state.sections[sectionIndex].subsections[subsectionIndex].body = event.target.value;
        queueSave();
      });

      subMoveUpBtn.addEventListener('click', () => moveSubsection(sectionIndex, subsectionIndex, subsectionIndex - 1));
      subMoveDownBtn.addEventListener('click', () => moveSubsection(sectionIndex, subsectionIndex, subsectionIndex + 1));
      subDuplicateBtn.addEventListener('click', () => duplicateSubsection(sectionIndex, subsectionIndex));
      subDeleteBtn.addEventListener('click', () => deleteSubsection(sectionIndex, subsectionIndex));

      subsectionList.appendChild(subFragment);
    });

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
  anchor.download = 'founder-systems.md';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
  setStatus('Markdown exported.');
}

function resetToDefault() {
  const ok = window.confirm('Reset the page to the original founder-system content? This removes local edits.');
  if (!ok) {
    return;
  }

  state = normalizeState(defaultState);
  render();
  queueSave();
  setStatus('Reset to default content.');
}

async function loadMarkdown(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.text();
}

async function loadDefaultState() {
  try {
    const [defaultMarkdown, knowledgeMarkdown] = await Promise.all([
      loadMarkdown(DEFAULT_DOC_URL),
      loadMarkdown(KNOWLEDGE_DOC_URL)
    ]);

    const primaryDoc = parseMarkdownDocument(await defaultMarkdown);
    const knowledgeDoc = parseMarkdownDocument(await knowledgeMarkdown);
    return mergeDocuments(primaryDoc, knowledgeDoc);
  } catch (error) {
    console.error(error);

    try {
      const fallbackMarkdown = await loadMarkdown(DEFAULT_DOC_URL);
      return parseMarkdownDocument(await fallbackMarkdown);
    } catch (fallbackError) {
      console.error(fallbackError);
      return normalizeState({
        title: 'Elite Founder Systems',
        sections: [{ id: uid(), title: 'Overview', body: 'Default content could not be loaded.', subsections: [] }]
      });
    }
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
  setStatus('Ready. Add, edit, delete, and reorder sections and subsections.');
}

init();
