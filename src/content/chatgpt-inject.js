// ChatGPT DOM helpers — find the composer and insert text into it.

const ChatGPTInject = (() => {
  const INPUT_SELECTORS = [
    "#prompt-textarea",
    '[data-testid="prompt-textarea"]',
    'div#prompt-textarea[contenteditable="true"]',
    'div.ProseMirror[contenteditable="true"]',
    'div[contenteditable="true"][data-placeholder]',
    'div[contenteditable="true"][role="textbox"]',
    '[data-testid="message-input"]',
    'div[contenteditable="true"][data-id]',
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="message"]',
  ];

  const PT_ROOT_SELECTOR = "#pt-panel, #pt-toggle, .pt-toast";

  function isOurElement(el) {
    return Boolean(el?.closest(PT_ROOT_SELECTOR));
  }

  function isVisible(el) {
    if (!el || isOurElement(el)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 20 && rect.height > 10;
  }

  function findChatInput() {
    for (const selector of INPUT_SELECTORS) {
      const el = document.querySelector(selector);
      if (isVisible(el)) return el;
    }

    const fallback = [
      ...document.querySelectorAll(
        'main div[contenteditable="true"], form div[contenteditable="true"], div[contenteditable="true"], textarea'
      ),
    ]
      .filter(isVisible)
      .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height);

    return fallback[0] ?? null;
  }

  function dispatchInput(el, inputType, data) {
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType,
        data: data ?? null,
      })
    );
  }

  function setTextareaValue(textarea, text) {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    );
    if (descriptor?.set) {
      descriptor.set.call(textarea, text);
    } else {
      textarea.value = text;
    }
    dispatchInput(textarea, "insertText", text);
  }

  function insertIntoContentEditable(element, text) {
    element.focus();

    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    document.execCommand("delete", false, null);
    const inserted = document.execCommand("insertText", false, text);

    if (!inserted) {
      element.textContent = text;
      dispatchInput(element, "insertFromPaste", text);
      return;
    }

    dispatchInput(element, "insertText", text);
  }

  function insertText(element, text) {
    if (!element || typeof text !== "string") return false;

    if (element.tagName === "TEXTAREA") {
      setTextareaValue(element, text);
      element.focus();
      return true;
    }

    if (element.isContentEditable) {
      insertIntoContentEditable(element, text);
      return true;
    }

    return false;
  }

  function insertIntoChat(text) {
    const input = findChatInput();
    if (!input) {
      return { ok: false, error: "Could not find ChatGPT input box" };
    }

    const success = insertText(input, text);
    if (!success) {
      return { ok: false, error: "Could not insert text into input" };
    }

    input.focus();
    return { ok: true };
  }

  return {
    findChatInput,
    insertText,
    insertIntoChat,
  };
})();
