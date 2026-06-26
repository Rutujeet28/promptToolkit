// chrome.storage.local wrapper — shared across popup, content script, and service worker.

const PromptStorage = (() => {
  const STORAGE_KEY = "promptToolkit_data";

  const DEFAULT_CATEGORIES = ["General", "Writing", "Development"];

  const DEFAULT_PROMPTS = [
    {
      title: "Explain simply",
      content:
        "Explain the following in simple terms that anyone can understand:\n\n",
      category: "General",
    },
    {
      title: "Code review",
      content:
        "Review the following code for bugs, security issues, and improvements:\n\n",
      category: "Development",
    },
    {
      title: "Professional rewrite",
      content: "Rewrite the following in a clear, professional tone:\n\n",
      category: "Writing",
    },
  ];

  function generateId() {
    return crypto.randomUUID();
  }

  function getFromStorage() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(result[STORAGE_KEY] ?? null);
      });
    });
  }

  function saveToStorage(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    });
  }

  function normalizeCategory(name) {
    return name.trim();
  }

  async function getData() {
    const data = await getFromStorage();
    if (!data) {
      return { categories: [...DEFAULT_CATEGORIES], prompts: [] };
    }
    return data;
  }

  async function initializeDefaults() {
    const existing = await getFromStorage();
    if (existing) return existing;

    const now = Date.now();
    const data = {
      categories: [...DEFAULT_CATEGORIES],
      prompts: DEFAULT_PROMPTS.map((prompt) => ({
        id: generateId(),
        title: prompt.title,
        content: prompt.content,
        category: prompt.category,
        createdAt: now,
        updatedAt: now,
      })),
    };

    await saveToStorage(data);
    return data;
  }

  async function getPrompts() {
    const data = await getData();
    return data.prompts.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async function getPrompt(id) {
    const data = await getData();
    return data.prompts.find((p) => p.id === id) ?? null;
  }

  async function addPrompt({ title, content, category }) {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const trimmedCategory = normalizeCategory(category);

    if (!trimmedTitle || !trimmedContent) {
      throw new Error("Title and content are required");
    }

    const data = await getData();
    const now = Date.now();

    if (!data.categories.includes(trimmedCategory)) {
      data.categories.push(trimmedCategory);
    }

    const prompt = {
      id: generateId(),
      title: trimmedTitle,
      content: trimmedContent,
      category: trimmedCategory,
      createdAt: now,
      updatedAt: now,
    };

    data.prompts.push(prompt);
    await saveToStorage(data);
    return prompt;
  }

  async function updatePrompt(id, updates) {
    const data = await getData();
    const index = data.prompts.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error("Prompt not found");
    }

    const current = data.prompts[index];
    const title = updates.title !== undefined ? updates.title.trim() : current.title;
    const content =
      updates.content !== undefined ? updates.content.trim() : current.content;
    const category =
      updates.category !== undefined
        ? normalizeCategory(updates.category)
        : current.category;

    if (!title || !content) {
      throw new Error("Title and content are required");
    }

    if (!data.categories.includes(category)) {
      data.categories.push(category);
    }

    const updated = {
      ...current,
      title,
      content,
      category,
      updatedAt: Date.now(),
    };

    data.prompts[index] = updated;
    await saveToStorage(data);
    return updated;
  }

  async function deletePrompt(id) {
    const data = await getData();
    const before = data.prompts.length;
    data.prompts = data.prompts.filter((p) => p.id !== id);

    if (data.prompts.length === before) {
      throw new Error("Prompt not found");
    }

    await saveToStorage(data);
  }

  async function getCategories() {
    const data = await getData();
    return [...data.categories];
  }

  async function addCategory(name) {
    const trimmed = normalizeCategory(name);
    if (!trimmed) {
      throw new Error("Category name is required");
    }

    const data = await getData();
    const exists = data.categories.some(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );

    if (exists) {
      throw new Error("Category already exists");
    }

    data.categories.push(trimmed);
    await saveToStorage(data);
    return trimmed;
  }

  async function deleteCategory(name) {
    const trimmed = normalizeCategory(name);
    const data = await getData();
    const index = data.categories.findIndex(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );

    if (index === -1) {
      throw new Error("Category not found");
    }

    const fallback = data.categories.find((c) => c !== trimmed) ?? "General";

    data.categories.splice(index, 1);
    data.prompts = data.prompts.map((p) =>
      p.category.toLowerCase() === trimmed.toLowerCase()
        ? { ...p, category: fallback, updatedAt: Date.now() }
        : p
    );

    if (!data.categories.includes(fallback)) {
      data.categories.unshift(fallback);
    }

    await saveToStorage(data);
  }

  async function searchPrompts(query) {
    const prompts = await getPrompts();
    const q = query.trim().toLowerCase();
    if (!q) return prompts;

    return prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  return {
    initializeDefaults,
    getPrompts,
    getPrompt,
    addPrompt,
    updatePrompt,
    deletePrompt,
    getCategories,
    addCategory,
    deleteCategory,
    searchPrompts,
  };
})();
