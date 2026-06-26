// Content script — injects the Prompt Toolkit panel into ChatGPT.

(function () {
  if (window.__promptToolkitLoaded) return;
  window.__promptToolkitLoaded = true;

  const PANEL_ID = "pt-panel";
  const TOGGLE_ID = "pt-toggle";
  const PROMPT_LIST_ID = "pt-prompt-list";
  const SEARCH_ID = "pt-search";
  const QUICK_ACTIONS_ID = "pt-quick-actions";
  const ADD_FORM_ID = "pt-add-form";
  const BTN_SHOW_ADD_ID = "pt-btn-show-add";

  function createPanel() {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "pt-panel pt-panel--closed";
    panel.innerHTML = `
      <header class="pt-panel__header">
        <button class="pt-panel__close" type="button" aria-label="Close panel">&times;</button>
        <span class="pt-panel__title">Prompt Toolkit</span>
      </header>
      <div class="pt-panel__body">
        <section class="pt-section">
          <h3 class="pt-section__title">Quick Actions</h3>
          <p class="pt-section__hint">Select text on the page, then click an action</p>
          <div id="${QUICK_ACTIONS_ID}" class="pt-quick-actions"></div>
        </section>
        <section class="pt-section">
          <div class="pt-section__row">
            <h3 class="pt-section__title">Saved Prompts</h3>
            <button id="${BTN_SHOW_ADD_ID}" class="pt-btn-add" type="button">+ Add</button>
          </div>
          <div id="${ADD_FORM_ID}" class="pt-add-form hidden">
            <input id="pt-add-title" class="pt-input" type="text" placeholder="Title" maxlength="120" />
            <select id="pt-add-category" class="pt-input"></select>
            <textarea id="pt-add-content" class="pt-input pt-textarea" rows="3" placeholder="Prompt text..."></textarea>
            <div class="pt-add-form__actions">
              <button id="pt-add-cancel" class="pt-btn-secondary" type="button">Cancel</button>
              <button id="pt-add-save" class="pt-btn-primary" type="button">Save</button>
            </div>
          </div>
          <p class="pt-section__hint">Click a prompt to insert it into ChatGPT</p>
          <input
            id="${SEARCH_ID}"
            class="pt-search"
            type="search"
            placeholder="Search prompts..."
            autocomplete="off"
          />
          <ul id="${PROMPT_LIST_ID}" class="pt-prompt-list"></ul>
        </section>
      </div>
    `;
    return panel;
  }

  function createToggle() {
    const btn = document.createElement("button");
    btn.id = TOGGLE_ID;
    btn.className = "pt-toggle";
    btn.type = "button";
    btn.title = "Open Prompt Toolkit";
    btn.setAttribute("aria-label", "Open Prompt Toolkit");

    const icon = document.createElement("img");
    icon.className = "pt-toggle__icon";
    icon.src = chrome.runtime.getURL("icons/gear-icon.png");
    icon.alt = "";
    btn.appendChild(icon);

    return btn;
  }

  function openPanel() {
    document.getElementById(PANEL_ID)?.classList.remove("pt-panel--closed");
    document.getElementById(TOGGLE_ID)?.classList.add("pt-toggle--hidden");
    renderPrompts();
  }

  function closePanel() {
    document.getElementById(PANEL_ID)?.classList.add("pt-panel--closed");
    document.getElementById(TOGGLE_ID)?.classList.remove("pt-toggle--hidden");
  }

  function showToast(message, type = "success") {
    document.querySelector(".pt-toast")?.remove();

    const toast = document.createElement("div");
    toast.className = `pt-toast pt-toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("pt-toast--visible"));

    setTimeout(() => {
      toast.classList.remove("pt-toast--visible");
      setTimeout(() => toast.remove(), 200);
    }, 2200);
  }

  function insertIntoChat(text, label) {
    const result = ChatGPTInject.insertIntoChat(text);
    if (result.ok) {
      showToast(`Inserted "${label}"`);
      closePanel();
    } else {
      showToast(result.error ?? "Insert failed", "error");
    }
  }

  function handleQuickActionClick(id) {
    const action = getQuickAction(id);
    if (!action) {
      showToast("Action not found", "error");
      return;
    }

    const selectedText = getSelectedText();
    const text = buildQuickActionPrompt(action.prompt, selectedText);
    insertIntoChat(text, action.label);
  }

  async function handlePromptClick(id) {
    const prompt = await PromptStorage.getPrompt(id);
    if (!prompt) {
      showToast("Prompt not found", "error");
      return;
    }

    insertIntoChat(prompt.content, prompt.title);
  }

  function renderQuickActions() {
    const container = document.getElementById(QUICK_ACTIONS_ID);
    if (!container) return;

    container.innerHTML = QUICK_ACTIONS.map(
      (action) => `
        <button
          class="pt-quick-action"
          type="button"
          data-id="${action.id}"
          title="${escapeHtml(action.label)}"
        >
          ${escapeHtml(action.label)}
        </button>
      `
    ).join("");
  }

  async function populateAddCategories() {
    const select = document.getElementById("pt-add-category");
    if (!select) return;
    const categories = await PromptStorage.getCategories();
    select.innerHTML = categories
      .map((c) => `<option value="${c.replace(/"/g, "&quot;")}">${escapeHtml(c)}</option>`)
      .join("");
  }

  function toggleAddForm(show) {
    const form = document.getElementById(ADD_FORM_ID);
    const btn = document.getElementById(BTN_SHOW_ADD_ID);
    if (!form || !btn) return;

    if (show) {
      form.classList.remove("hidden");
      btn.classList.add("hidden");
      populateAddCategories();
      document.getElementById("pt-add-title")?.focus();
    } else {
      form.classList.add("hidden");
      btn.classList.remove("hidden");
      document.getElementById("pt-add-title").value = "";
      document.getElementById("pt-add-content").value = "";
    }
  }

  async function handleSaveNewPrompt() {
    const title = document.getElementById("pt-add-title")?.value.trim();
    const category = document.getElementById("pt-add-category")?.value.trim();
    const content = document.getElementById("pt-add-content")?.value.trim();

    if (!title || !category || !content) {
      showToast("Fill in all fields", "error");
      return;
    }

    try {
      await PromptStorage.addPrompt({ title, category, content });
      toggleAddForm(false);
      showToast(`Saved "${title}"`);
      renderPrompts();
    } catch (err) {
      showToast(err.message ?? "Could not save", "error");
    }
  }

  async function renderPrompts() {
    const list = document.getElementById(PROMPT_LIST_ID);
    const search = document.getElementById(SEARCH_ID);
    if (!list) return;

    list.innerHTML = `<li class="pt-prompt-list__loading">Loading...</li>`;

    try {
      const query = search?.value ?? "";
      const prompts = await PromptStorage.searchPrompts(query);

      if (prompts.length === 0) {
        list.innerHTML = `<li class="pt-prompt-list__empty">No prompts found</li>`;
        return;
      }

      list.innerHTML = prompts
        .map(
          (p) => `
          <li class="pt-prompt-item" data-id="${p.id}" title="Click to insert">
            <span class="pt-prompt-item__title">${escapeHtml(p.title)}</span>
            <span class="pt-prompt-item__category">${escapeHtml(p.category)}</span>
          </li>
        `
        )
        .join("");
    } catch {
      list.innerHTML = `<li class="pt-prompt-list__empty">Failed to load prompts</li>`;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function init() {
    if (document.getElementById(PANEL_ID)) return;

    const toggle = createToggle();
    const panel = createPanel();

    toggle.addEventListener("click", openPanel);
    panel.querySelector(".pt-panel__close")?.addEventListener("click", closePanel);
    panel.querySelector(`#${SEARCH_ID}`)?.addEventListener("input", renderPrompts);

    panel.querySelector(`#${BTN_SHOW_ADD_ID}`)?.addEventListener("click", () => toggleAddForm(true));
    panel.querySelector("#pt-add-cancel")?.addEventListener("click", () => toggleAddForm(false));
    panel.querySelector("#pt-add-save")?.addEventListener("click", handleSaveNewPrompt);

    panel.querySelector(`#${QUICK_ACTIONS_ID}`)?.addEventListener("click", (e) => {
      const btn = e.target.closest(".pt-quick-action");
      if (!btn?.dataset.id) return;
      handleQuickActionClick(btn.dataset.id);
    });

    panel.querySelector(`#${PROMPT_LIST_ID}`)?.addEventListener("click", (e) => {
      const item = e.target.closest(".pt-prompt-item");
      if (!item?.dataset.id) return;
      handlePromptClick(item.dataset.id);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.promptToolkit_data) {
        renderPrompts();
      }
    });

    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    renderQuickActions();
    PromptStorage.initializeDefaults().catch(() => {});
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
