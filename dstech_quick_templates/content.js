(() => {
  'use strict';

  // A extensão é instalada uma vez por documento/frame.
  const HOST_ID = 'dstech-quick-templates-host';
  if (document.getElementById(HOST_ID)) return;
  if (!document.documentElement) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('data-dstech-extension-ui', 'true');
  host.style.cssText = [
    'all: initial',
    'position: fixed',
    'top: 16px',
    'right: 16px',
    'z-index: 2147483647',
    'display: block',
    'width: 42px',
    'height: 42px',
    'overflow: visible',
    'pointer-events: none'
  ].join(';');
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = chrome.runtime.getURL('styles.css');
  shadow.appendChild(stylesheet);

  const root = document.createElement('div');
  root.className = 'dqt-root';
  root.innerHTML = `
    <button class="dqt-launcher" type="button" aria-label="Abrir modelos DSTech" aria-expanded="false" title="Modelos rápidos DSTech">
      <span class="dqt-launcher-mark">D</span>
      <span class="dqt-launcher-dot"></span>
    </button>
    <section class="dqt-panel" aria-label="Modelos rápidos" hidden>
      <header class="dqt-header">
        <div class="dqt-heading">
          <div class="dqt-eyebrow">DSTECH · SUPORTE</div>
          <div class="dqt-title">Modelos rápidos</div>
        </div>
        <button class="dqt-close" type="button" aria-label="Fechar painel" title="Fechar">×</button>
      </header>
      <nav class="dqt-tabs" aria-label="Categoria">
        <button class="dqt-tab is-active" type="button" data-category="ATENDIMENTO">OS</button>
        <button class="dqt-tab" type="button" data-category="OMINI">Omini</button>
      </nav>
      <div class="dqt-list-toolbar">
        <div class="dqt-list-heading">
          <span class="dqt-list-label"></span>
          <span class="dqt-count"></span>
        </div>
        <button class="dqt-manage-toggle" type="button">Gerenciar modelos</button>
      </div>
      <section class="dqt-manager" hidden aria-label="Gerenciar modelos">
        <div class="dqt-manager-title">Adicionar / editar modelo</div>
        <label class="dqt-field-label" for="dqt-template-title">Título</label>
        <input class="dqt-template-title" id="dqt-template-title" type="text" maxlength="90" placeholder="Ex.: CLIENTE SEM SINAL" autocomplete="off" />
        <label class="dqt-field-label" for="dqt-template-text">Texto da mensagem</label>
        <textarea class="dqt-template-text" id="dqt-template-text" rows="5" placeholder="Digite o texto que será inserido no atendimento..."></textarea>
        <div class="dqt-manager-actions">
          <button class="dqt-save" type="button">Salvar modelo</button>
          <button class="dqt-cancel" type="button">Cancelar</button>
        </div>
        <div class="dqt-manager-list-label">Modelos desta categoria</div>
        <div class="dqt-manage-list"></div>
      </section>
      <div class="dqt-note" hidden></div>
      <div class="dqt-list" role="listbox" aria-label="Modelos disponíveis"></div>
      <div class="dqt-empty" hidden>Nenhum modelo encontrado.</div>
      <footer class="dqt-search-wrap">
        <span class="dqt-search-icon" aria-hidden="true">⌕</span>
        <input class="dqt-search" type="search" placeholder="Pesquisar modelo..." autocomplete="off" spellcheck="false" aria-label="Pesquisar modelos" />
        <button class="dqt-clear" type="button" aria-label="Limpar pesquisa" title="Limpar pesquisa" hidden>×</button>
      </footer>
      <div class="dqt-toast" role="status" aria-live="polite"></div>
    </section>
  `;
  shadow.appendChild(root);

  const $ = (selector) => root.querySelector(selector);
  const launcher = $('.dqt-launcher');
  const panel = $('.dqt-panel');
  const closeButton = $('.dqt-close');
  const tabs = [...root.querySelectorAll('.dqt-tab')];
  const list = $('.dqt-list');
  const listLabel = $('.dqt-list-label');
  const count = $('.dqt-count');
  const note = $('.dqt-note');
  const empty = $('.dqt-empty');
  const search = $('.dqt-search');
  const clearSearch = $('.dqt-clear');
  const toast = $('.dqt-toast');
  const manageToggle = $('.dqt-manage-toggle');
  const manager = $('.dqt-manager');
  const titleInput = $('.dqt-template-title');
  const textInput = $('.dqt-template-text');
  const saveButton = $('.dqt-save');
  const cancelButton = $('.dqt-cancel');
  const manageList = $('.dqt-manage-list');

  let templates = { ATENDIMENTO: [], OMINI: [] };
  let currentCategory = 'ATENDIMENTO';
  let lastEditable = null;
  let savedControlSelection = null;
  let savedRange = null;
  let toastTimer = null;
  let editingIndex = null;
  let managerOpen = false;
  const STORAGE_KEY = 'dstechTemplates';

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

  const NON_TEXT_INPUT_TYPES = new Set([
    'button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image',
    'color', 'range', 'date', 'time', 'datetime-local', 'month', 'week',
    'hidden'
  ]);

  const EDITOR_SELECTOR = [
    '[contenteditable="true"]',
    '[contenteditable="plaintext-only"]',
    '.ProseMirror',
    '.ql-editor',
    '[data-lexical-editor="true"]',
    '[data-slate-editor="true"]',
    '.cm-content',
    '.CodeMirror textarea',
    '.monaco-editor textarea.inputarea',
    '[role="textbox"]',
    '[aria-multiline="true"]'
  ].join(',');

  function isHTMLElement(node) {
    return !!node && node.nodeType === Node.ELEMENT_NODE;
  }

  function isTextControl(element) {
    if (!isHTMLElement(element)) return false;
    if (element instanceof HTMLTextAreaElement) {
      return !element.disabled && !element.readOnly;
    }
    if (!(element instanceof HTMLInputElement)) return false;
    const type = (element.type || 'text').toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type) && !element.disabled && !element.readOnly;
  }

  function isUsableEditor(element) {
    if (!isHTMLElement(element)) return false;
    if (element === host || host.contains(element)) return false;
    if (isTextControl(element)) return true;
    if (element.isContentEditable) return true;
    if (element.matches('.ProseMirror, .ql-editor, [data-lexical-editor="true"], [data-slate-editor="true"], .cm-content')) return true;
    if (element.matches('[role="textbox"], [aria-multiline="true"]')) return true;
    if (element.ownerDocument && element.ownerDocument.designMode && element.ownerDocument.designMode.toLowerCase() === 'on' && element === element.ownerDocument.body) return true;
    return false;
  }

  // Sobe pela árvore DOM e, quando necessário, pela árvore de Shadow DOM.
  function composedParent(element) {
    if (!element) return null;
    if (element.parentElement) return element.parentElement;
    const tree = element.getRootNode && element.getRootNode();
    return tree && tree.host ? tree.host : null;
  }

  function getContentEditableRoot(element) {
    let current = element;
    while (current && current !== host) {
      if (current.getAttribute && ['true', 'plaintext-only'].includes((current.getAttribute('contenteditable') || '').toLowerCase())) {
        return current;
      }
      const parent = composedParent(current);
      if (!parent || !parent.isContentEditable) break;
      current = parent;
    }
    return element;
  }

  function findEditable(eventPath) {
    const path = Array.isArray(eventPath) ? eventPath : [];

    // Preferência 1: campos nativos, pois eles preservam melhor React/Vue/Angular.
    for (const node of path) {
      if (isHTMLElement(node) && isTextControl(node)) return node;
    }

    // Preferência 2: editores contenteditable e editores ricos conhecidos.
    for (const node of path) {
      if (!isHTMLElement(node) || node === host || host.contains(node)) continue;
      if (node.isContentEditable) return getContentEditableRoot(node);
      if (node.matches('.ProseMirror, .ql-editor, [data-lexical-editor="true"], [data-slate-editor="true"], .cm-content')) return node;
    }

    // Preferência 3: alguns sistemas usam um wrapper com role=textbox.
    for (const node of path) {
      if (!isHTMLElement(node) || node === host || host.contains(node)) continue;
      if (!node.matches('[role="textbox"], [aria-multiline="true"]')) continue;
      const innerEditor = node.querySelector('textarea, input:not([type="hidden"]), [contenteditable="true"], [contenteditable="plaintext-only"], .ProseMirror, .ql-editor, .cm-content');
      return innerEditor || node;
    }

    // Editores antigos (por exemplo, alguns modos de edição de iframe).
    if (document.designMode && document.designMode.toLowerCase() === 'on') return document.body;
    return null;
  }

  function getDocument(element) {
    return element && element.ownerDocument ? element.ownerDocument : document;
  }

  function rangeBelongsTo(element, range) {
    if (!element || !range) return false;
    const node = range.commonAncestorContainer;
    return node === element || element.contains(node);
  }

  function rememberCaret() {
    if (!lastEditable || !lastEditable.isConnected) return;

    if (isTextControl(lastEditable)) {
      try {
        const length = String(lastEditable.value || '').length;
        savedControlSelection = {
          target: lastEditable,
          start: lastEditable.selectionStart == null ? length : lastEditable.selectionStart,
          end: lastEditable.selectionEnd == null ? length : lastEditable.selectionEnd
        };
      } catch (_) {
        const length = String(lastEditable.value || '').length;
        savedControlSelection = { target: lastEditable, start: length, end: length };
      }
      savedRange = null;
      return;
    }

    const doc = getDocument(lastEditable);
    const selection = doc.defaultView && doc.defaultView.getSelection ? doc.defaultView.getSelection() : null;
    if (selection && selection.rangeCount) {
      const range = selection.getRangeAt(0);
      if (rangeBelongsTo(lastEditable, range)) {
        savedRange = { target: lastEditable, range: range.cloneRange() };
        savedControlSelection = null;
      }
    }
  }

  function setActiveEditable(element) {
    if (!element || !isUsableEditor(element)) return;
    lastEditable = element;
    rememberCaret();
  }

  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
  }

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    renderList();
    if (managerOpen) renderManagerList();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  function renderList() {
    const source = templates[currentCategory] || [];
    const query = normalize(search.value.trim());
    const filtered = source.filter((item) =>
      !query || normalize(item.title).includes(query) || normalize(item.text).includes(query)
    );

    list.replaceChildren();
    listLabel.textContent = currentCategory === 'ATENDIMENTO' ? 'REGISTRO DE ATENDIMENTO' : 'RESPOSTAS AO CLIENTE';
    count.textContent = `${filtered.length} / ${source.length}`;
    note.hidden = currentCategory !== 'ATENDIMENTO';
    note.textContent = currentCategory === 'ATENDIMENTO'
      ? 'Os modelos desta aba são os registros de atendimento disponíveis no manual. Descrições específicas de OS podem ser adicionadas depois.'
      : '';
    empty.hidden = filtered.length !== 0;
    list.hidden = filtered.length === 0;
    clearSearch.hidden = !search.value;

    for (const item of filtered) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dqt-item';
      button.setAttribute('role', 'option');
      button.title = `Inserir: ${item.title}`;

      const title = document.createElement('span');
      title.className = 'dqt-item-title';
      title.textContent = item.title;

      const plus = document.createElement('span');
      plus.className = 'dqt-item-plus';
      plus.textContent = '+';
      plus.setAttribute('aria-hidden', 'true');

      button.append(title, plus);
      button.addEventListener('click', () => insertTemplate(item));
      list.appendChild(button);
    }
  }

  function persistTemplates() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [STORAGE_KEY]: templates }, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(error);
        else resolve();
      });
    });
  }

  function resetEditor() {
    editingIndex = null;
    titleInput.value = '';
    textInput.value = '';
    saveButton.textContent = 'Salvar modelo';
  }

  function renderManagerList() {
    manageList.replaceChildren();
    const source = templates[currentCategory] || [];
    source.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'dqt-manage-row';
      const name = document.createElement('span');
      name.className = 'dqt-manage-name';
      name.textContent = item.title;
      const actions = document.createElement('div');
      actions.className = 'dqt-manage-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'dqt-edit';
      edit.textContent = 'Editar';
      edit.addEventListener('click', () => {
        editingIndex = index;
        titleInput.value = item.title;
        textInput.value = item.text;
        saveButton.textContent = 'Salvar alterações';
        titleInput.focus();
        manager.scrollTop = 0;
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'dqt-delete';
      remove.textContent = 'Excluir';
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Excluir o modelo "${item.title}"?`)) return;
        templates[currentCategory].splice(index, 1);
        try {
          await persistTemplates();
          if (editingIndex === index) resetEditor();
          renderList();
          renderManagerList();
          showToast('Modelo excluído.');
        } catch (error) {
          console.error('[DSTech] Erro ao salvar modelos:', error);
          showToast('Não foi possível salvar a alteração.');
        }
      });
      actions.append(edit, remove);
      row.append(name, actions);
      manageList.append(row);
    });
  }

  async function saveTemplate() {
    const title = titleInput.value.trim();
    const text = textInput.value.trim();
    if (!title || !text) {
      showToast('Preencha o título e o texto do modelo.');
      return;
    }
    const duplicate = templates[currentCategory].findIndex((item, index) =>
      normalize(item.title) === normalize(title) && index !== editingIndex
    );
    if (duplicate !== -1) {
      showToast('Já existe um modelo com esse título nesta categoria.');
      return;
    }
    const item = { title, text };
    if (editingIndex === null) templates[currentCategory].push(item);
    else templates[currentCategory][editingIndex] = item;
    try {
      await persistTemplates();
      resetEditor();
      renderList();
      renderManagerList();
      showToast('Modelo salvo com sucesso.');
    } catch (error) {
      console.error('[DSTech] Erro ao salvar modelos:', error);
      showToast('Não foi possível salvar. Verifique o armazenamento do Chrome.');
    }
  }

  function toggleManager(force) {
    managerOpen = typeof force === 'boolean' ? force : !managerOpen;
    manager.hidden = !managerOpen;
    manageToggle.textContent = managerOpen ? 'Voltar aos modelos' : 'Gerenciar modelos';
    list.hidden = managerOpen;
    empty.hidden = true;
    search.parentElement.hidden = managerOpen;
    if (managerOpen) {
      resetEditor();
      renderManagerList();
    } else {
      renderList();
    }
  }

  function dispatchInputEvents(element, text) {
    const doc = getDocument(element);
    const view = doc.defaultView || window;
    try {
      element.dispatchEvent(new view.InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertText',
        data: text
      }));
    } catch (_) {
      element.dispatchEvent(new view.Event('input', { bubbles: true, composed: true }));
    }
    element.dispatchEvent(new view.Event('change', { bubbles: true, composed: true }));
  }

  function insertIntoTextControl(element, text) {
    const value = String(element.value || '');
    const selection = savedControlSelection && savedControlSelection.target === element
      ? savedControlSelection
      : null;
    let start = selection ? selection.start : element.selectionStart;
    let end = selection ? selection.end : element.selectionEnd;
    if (start == null) start = value.length;
    if (end == null) end = start;

    const safeStart = Math.max(0, Math.min(start, value.length));
    const safeEnd = Math.max(safeStart, Math.min(end, value.length));
    const nextValue = value.slice(0, safeStart) + text + value.slice(safeEnd);

    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) descriptor.set.call(element, nextValue);
    else element.value = nextValue;

    const cursor = safeStart + text.length;
    element.focus({ preventScroll: true });
    try { element.setSelectionRange(cursor, cursor); } catch (_) { /* Nem todo input oferece seleção. */ }
    dispatchInputEvents(element, text);
    try { element.setSelectionRange(cursor, cursor); } catch (_) { /* Ignorado. */ }

    savedControlSelection = { target: element, start: cursor, end: cursor };
    return true;
  }

  function insertIntoRichEditor(element, text) {
    const doc = getDocument(element);
    const view = doc.defaultView || window;
    const selection = view.getSelection ? view.getSelection() : null;

    element.focus({ preventScroll: true });

    if (!selection) return false;

    let range = null;
    if (savedRange && savedRange.target === element && rangeBelongsTo(element, savedRange.range)) {
      range = savedRange.range.cloneRange();
    } else if (selection.rangeCount && rangeBelongsTo(element, selection.getRangeAt(0))) {
      range = selection.getRangeAt(0).cloneRange();
    } else {
      range = doc.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
    }

    selection.removeAllRanges();
    selection.addRange(range);

    const beforeHTML = element.innerHTML;
    let commandWorked = false;
    try {
      if (typeof doc.execCommand === 'function') {
        commandWorked = doc.execCommand('insertText', false, text);
      }
    } catch (_) {
      commandWorked = false;
    }

    // Alguns editores retornam true mesmo sem alterar o conteúdo; por isso conferimos o DOM.
    const changed = element.innerHTML !== beforeHTML;
    if (!commandWorked || !changed) {
      const currentSelection = view.getSelection ? view.getSelection() : selection;
      let fallbackRange = null;
      if (currentSelection && currentSelection.rangeCount && rangeBelongsTo(element, currentSelection.getRangeAt(0))) {
        fallbackRange = currentSelection.getRangeAt(0);
      } else {
        fallbackRange = range;
      }

      fallbackRange.deleteContents();
      const fragment = doc.createDocumentFragment();
      const lines = String(text).split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        if (i > 0) fragment.appendChild(doc.createElement('br'));
        if (lines[i]) fragment.appendChild(doc.createTextNode(lines[i]));
      }
      const lastNode = fragment.lastChild;
      fallbackRange.insertNode(fragment);
      if (lastNode) fallbackRange.setStartAfter(lastNode);
      fallbackRange.collapse(true);
      currentSelection.removeAllRanges();
      currentSelection.addRange(fallbackRange);
      dispatchInputEvents(element, text);
    }

    rememberCaret();
    savedRange = { target: element, range: selection.getRangeAt(0).cloneRange() };
    return true;
  }

  function insertIntoAriaEditor(element, text) {
    // Tentativa para editores que expõem role=textbox, mas não usam contenteditable.
    const doc = getDocument(element);
    const view = doc.defaultView || window;
    element.focus({ preventScroll: true });

    if (typeof element.value === 'string') {
      const current = element.value;
      const next = current + text;
      try {
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set?.call(element, next);
      } catch (_) {
        element.value = next;
      }
      dispatchInputEvents(element, text);
      return true;
    }

    const selection = view.getSelection ? view.getSelection() : null;
    if (!selection) return false;
    let range = null;
    if (savedRange && savedRange.target === element && rangeBelongsTo(element, savedRange.range)) {
      range = savedRange.range.cloneRange();
    } else if (selection.rangeCount && rangeBelongsTo(element, selection.getRangeAt(0))) {
      range = selection.getRangeAt(0).cloneRange();
    }
    if (!range) {
      range = doc.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    range.deleteContents();
    const textNode = doc.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    dispatchInputEvents(element, text);
    return true;
  }

  function insertTemplate(item) {
    const target = lastEditable && lastEditable.isConnected ? lastEditable : null;
    if (!target) {
      showToast('Clique primeiro no campo onde deseja inserir o texto.');
      return;
    }

    const cleanText = String(item.text || '').trim();
    if (!cleanText) {
      showToast('Este modelo está vazio.');
      return;
    }

    try {
      let inserted = false;
      if (isTextControl(target)) {
        inserted = insertIntoTextControl(target, cleanText);
      } else if (target.isContentEditable || target.matches('.ProseMirror, .ql-editor, [data-lexical-editor="true"], [data-slate-editor="true"], .cm-content') || (getDocument(target).designMode && getDocument(target).designMode.toLowerCase() === 'on')) {
        inserted = insertIntoRichEditor(target, cleanText);
      } else if (target.matches('[role="textbox"], [aria-multiline="true"]')) {
        inserted = insertIntoAriaEditor(target, cleanText);
      }

      if (!inserted) {
        showToast('Não consegui reconhecer esse editor. Tente clicar diretamente dentro do texto.');
        return;
      }
      showToast(`Inserido: ${item.title}`);
    } catch (error) {
      console.warn('[DSTech Respostas rápidas] Falha ao inserir modelo:', error);
      showToast('Não foi possível inserir neste campo.');
    }
  }

  function getEventPath(event) {
    return typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
  }

  function rememberFromEvent(event) {
    const path = getEventPath(event);
    if (path.includes(host) || path.some((node) => node === root || (isHTMLElement(node) && node.getAttribute('data-dstech-extension-ui') === 'true'))) return;

    const editable = findEditable(path);
    if (editable) {
      setActiveEditable(editable);
      // Deixa o navegador atualizar a posição do cursor antes de guardar a seleção.
      setTimeout(rememberCaret, 0);
      if (!panel.hidden) closePanel();
    } else if (!panel.hidden) {
      closePanel();
    }
  }

  document.addEventListener('pointerdown', rememberFromEvent, true);
  document.addEventListener('focusin', (event) => {
    const path = getEventPath(event);
    if (path.includes(host)) return;
    const editable = findEditable(path);
    if (editable) setActiveEditable(editable);
  }, true);

  for (const eventName of ['keyup', 'mouseup', 'select', 'input', 'beforeinput', 'compositionend']) {
    document.addEventListener(eventName, (event) => {
      const path = getEventPath(event);
      if (path.includes(host)) return;
      const editable = findEditable(path);
      if (editable) {
        lastEditable = editable;
        rememberCaret();
      }
    }, true);
  }

  document.addEventListener('selectionchange', () => {
    if (!lastEditable || !lastEditable.isConnected) return;
    const active = document.activeElement;
    if (active === lastEditable || lastEditable.contains(active)) rememberCaret();
  });

  // Mantém o cursor no editor ao clicar nos itens do painel.
  root.addEventListener('pointerdown', (event) => {
    rememberCaret();
    const path = event.composedPath();
    if (!path.includes(search) && !path.includes(titleInput) && !path.includes(textInput)) event.preventDefault();
  }, true);

  launcher.addEventListener('click', () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });
  closeButton.addEventListener('click', closePanel);

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      currentCategory = tab.dataset.category;
      if (managerOpen) resetEditor();
      tabs.forEach((candidate) => candidate.classList.toggle('is-active', candidate === tab));
      renderList();
    });
  });

  search.addEventListener('input', renderList);
  clearSearch.addEventListener('click', () => {
    search.value = '';
    renderList();
    search.focus();
  });
  manageToggle.addEventListener('click', () => toggleManager());
  saveButton.addEventListener('click', saveTemplate);
  cancelButton.addEventListener('click', resetEditor);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) closePanel();
  }, true);

  fetch(chrome.runtime.getURL('templates.json'))
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const defaults = {
        ATENDIMENTO: Array.isArray(data.ATENDIMENTO) ? data.ATENDIMENTO : [],
        OMINI: Array.isArray(data.OMINI) ? data.OMINI : []
      };
      chrome.storage.local.get(STORAGE_KEY, (stored) => {
        const saved = stored && stored[STORAGE_KEY];
        templates = saved && typeof saved === 'object'
          ? {
              ATENDIMENTO: Array.isArray(saved.ATENDIMENTO) ? saved.ATENDIMENTO : defaults.ATENDIMENTO,
              OMINI: Array.isArray(saved.OMINI) ? saved.OMINI : defaults.OMINI
            }
          : defaults;
        renderList();
      });
    })
    .catch((error) => {
      console.error('[DSTech Respostas rápidas] Não foi possível carregar templates.json:', error);
      showToast('Erro ao carregar os modelos da extensão.');
    });

  // O lançador fica sempre disponível em páginas comuns, mesmo antes de selecionar um campo.
  // O Chrome não permite content scripts em páginas internas/protegidas do próprio navegador.
})();
