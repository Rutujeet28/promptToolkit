function loadScript(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL(path);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${path}`));
    document.head.appendChild(script);
  });
}

loadScript("src/storage/storage.js")
  .then(() => {
    if (typeof PromptStorage === "undefined") {
      throw new Error("PromptStorage not available");
    }
    startApp();
  })
  .catch((err) => {
    document.body.innerHTML = `
      <main class="main" style="padding:16px">
        <p class="message message--error">Failed to load extension storage: ${err.message}</p>
        <p class="hint">Reload the extension at chrome://extensions</p>
      </main>`;
  });

function startApp() {
  const statusEl = document.getElementById("status");
  const messageEl = document.getElementById("message");
  const screenList = document.getElementById("screen-list");
  const screenForm = document.getElementById("screen-form");
  const formTitle = document.getElementById("form-title");
  const promptForm = document.getElementById("prompt-form");
  const categoryForm = document.getElementById("category-form");
  const searchInput = document.getElementById("search");
  const categoryFilter = document.getElementById("category-filter");
  const promptList = document.getElementById("prompt-list");
  const categoryList = document.getElementById("category-list");
  const fieldTitle = document.getElementById("field-title");
  const fieldCategory = document.getElementById("field-category");
  const fieldContent = document.getElementById("field-content");
  const newCategoryInput = document.getElementById("new-category");

  let editingId = null;

  init();

  async function init() {
    bindEvents();
    setupTabStatus();

    try {
      await PromptStorage.initializeDefaults();
      await refreshAll();
      statusEl.textContent = "Ready";
    } catch (err) {
      statusEl.textContent = "Storage error";
      statusEl.classList.add("status--muted");
      showMessage(err.message ?? "Could not load prompts", "error");
      promptList.innerHTML =
        `<li class="prompt-list__empty">Storage error — reload the extension</li>`;
    }
  }

  function setupTabStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.url) return;

      const onChatGPT =
        tab.url.includes("chatgpt.com") || tab.url.includes("chat.openai.com");

      statusEl.textContent = onChatGPT ? "Active on ChatGPT" : "Open ChatGPT to insert prompts";
      if (!onChatGPT) statusEl.classList.add("status--muted");
    });
  }

  function bindEvents() {
    document.getElementById("btn-add").addEventListener("click", () => showForm());
    document.getElementById("btn-cancel").addEventListener("click", showList);
    promptForm.addEventListener("submit", handleFormSubmit);
    categoryForm.addEventListener("submit", handleAddCategory);
    searchInput.addEventListener("input", () => renderPromptList().catch(() => {}));
    categoryFilter.addEventListener("change", () => renderPromptList().catch(() => {}));

    promptList.addEventListener("click", (e) => {
      const editBtn = e.target.closest("[data-action='edit']");
      const deleteBtn = e.target.closest("[data-action='delete']");

      if (editBtn?.dataset.id) showForm(editBtn.dataset.id);
      else if (deleteBtn?.dataset.id) handleDeletePrompt(deleteBtn.dataset.id);
    });

    categoryList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action='delete-category']");
      if (btn?.dataset.name) handleDeleteCategory(btn.dataset.name);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.promptToolkit_data) {
        refreshAll().catch(() => {});
      }
    });
  }

  function showList() {
    editingId = null;
    promptForm.reset();
    screenForm.classList.add("hidden");
    screenList.classList.remove("hidden");
  }

  async function showForm(id = null) {
    editingId = id;
    screenList.classList.add("hidden");
    screenForm.classList.remove("hidden");

    await populateCategorySelect();

    if (id) {
      const prompt = await PromptStorage.getPrompt(id);
      if (!prompt) {
        showMessage("Prompt not found", "error");
        showList();
        return;
      }
      formTitle.textContent = "Edit Prompt";
      fieldTitle.value = prompt.title;
      fieldCategory.value = prompt.category;
      fieldContent.value = prompt.content;
    } else {
      formTitle.textContent = "Add Prompt";
      fieldTitle.value = "";
      fieldContent.value = "";
      fieldCategory.selectedIndex = 0;
    }

    fieldTitle.focus();
  }

  async function populateCategorySelect() {
    const categories = await PromptStorage.getCategories();
    fieldCategory.innerHTML = categories
      .map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`)
      .join("");
  }

  async function refreshAll() {
    await populateCategoryFilter();
    await renderPromptList();
    await renderCategoryList();
  }

  async function populateCategoryFilter() {
    const categories = await PromptStorage.getCategories();
    const current = categoryFilter.value;

    categoryFilter.innerHTML =
      `<option value="">All categories</option>` +
      categories.map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");

    if ([...categoryFilter.options].some((o) => o.value === current)) {
      categoryFilter.value = current;
    }
  }

  async function renderPromptList() {
    promptList.innerHTML = `<li class="prompt-list__loading">Loading...</li>`;

    const query = searchInput.value.trim();
    let prompts = await PromptStorage.searchPrompts(query);
    const filter = categoryFilter.value;

    if (filter) prompts = prompts.filter((p) => p.category === filter);

    if (prompts.length === 0) {
      promptList.innerHTML = `<li class="prompt-list__empty">No prompts — click "+ Add Prompt"</li>`;
      return;
    }

    promptList.innerHTML = prompts
      .map(
        (p) => `
        <li class="prompt-card">
          <div class="prompt-card__header">
            <span class="prompt-card__title">${escapeHtml(p.title)}</span>
            <span class="prompt-card__category">${escapeHtml(p.category)}</span>
          </div>
          <p class="prompt-card__preview">${escapeHtml(p.content)}</p>
          <div class="prompt-card__actions">
            <button class="btn btn--icon" type="button" data-action="edit" data-id="${escapeAttr(p.id)}">Edit</button>
            <button class="btn btn--icon btn--danger" type="button" data-action="delete" data-id="${escapeAttr(p.id)}">Delete</button>
          </div>
        </li>`
      )
      .join("");
  }

  async function renderCategoryList() {
    const categories = await PromptStorage.getCategories();

    if (categories.length === 0) {
      categoryList.innerHTML = `<li class="category-list__empty">No categories</li>`;
      return;
    }

    categoryList.innerHTML = categories
      .map(
        (name) => `
        <li class="category-item">
          <span>${escapeHtml(name)}</span>
          <button class="btn btn--small btn--danger" type="button" data-action="delete-category" data-name="${escapeAttr(name)}">Delete</button>
        </li>`
      )
      .join("");
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    const title = fieldTitle.value.trim();
    const category = fieldCategory.value.trim();
    const content = fieldContent.value.trim();

    if (!title || !category || !content) {
      showMessage("Please fill in all fields", "error");
      return;
    }

    const saveBtn = document.getElementById("btn-save");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      if (editingId) {
        await PromptStorage.updatePrompt(editingId, { title, category, content });
        showMessage("Prompt updated!", "success");
      } else {
        await PromptStorage.addPrompt({ title, category, content });
        showMessage("Prompt added!", "success");
      }
      showList();
      await refreshAll();
    } catch (err) {
      showMessage(err.message ?? "Could not save", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Prompt";
    }
  }

  async function handleDeletePrompt(id) {
    const prompt = await PromptStorage.getPrompt(id);
    if (!prompt || !confirm(`Delete "${prompt.title}"?`)) return;

    try {
      await PromptStorage.deletePrompt(id);
      showMessage("Prompt deleted", "success");
      await refreshAll();
    } catch (err) {
      showMessage(err.message ?? "Could not delete", "error");
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    const name = newCategoryInput.value.trim();
    if (!name) return;

    try {
      await PromptStorage.addCategory(name);
      newCategoryInput.value = "";
      showMessage(`Category "${name}" added`, "success");
      await refreshAll();
    } catch (err) {
      showMessage(err.message ?? "Could not add category", "error");
    }
  }

  async function handleDeleteCategory(name) {
    if (!confirm(`Delete category "${name}"?`)) return;

    try {
      await PromptStorage.deleteCategory(name);
      showMessage("Category deleted", "success");
      await refreshAll();
    } catch (err) {
      showMessage(err.message ?? "Could not delete category", "error");
    }
  }

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = `message message--${type}`;
    clearTimeout(showMessage._timer);
    showMessage._timer = setTimeout(() => {
      messageEl.className = "message hidden";
    }, 3500);
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, "&quot;");
  }
}
