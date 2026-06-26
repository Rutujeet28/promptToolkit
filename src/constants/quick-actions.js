// Pre-built quick action prompt templates.

const QUICK_ACTIONS = [
  {
    id: "summarize",
    label: "Summarize",
    prompt: "Summarize the following text concisely:\n\n",
  },
  {
    id: "simplify",
    label: "Simplify",
    prompt: "Explain the following in simpler terms:\n\n",
  },
  {
    id: "expand",
    label: "Expand",
    prompt: "Expand on the following ideas with more detail and examples:\n\n",
  },
  {
    id: "rewrite",
    label: "Rewrite",
    prompt: "Rewrite the following in a clear, professional tone:\n\n",
  },
  {
    id: "code",
    label: "Fix Code",
    prompt: "Generate or fix the following code. Explain any changes:\n\n",
  },
];

function getSelectedText() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return "";
  return selection.toString().trim();
}

function buildQuickActionPrompt(template, selectedText) {
  if (selectedText) {
    return `${template}${selectedText}`;
  }
  return template;
}

function getQuickAction(id) {
  return QUICK_ACTIONS.find((action) => action.id === id) ?? null;
}
