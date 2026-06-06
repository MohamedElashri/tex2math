document.addEventListener("DOMContentLoaded", () => {
  const latexInput = document.getElementById("latexInput");
  const mathmlOutput = document.getElementById("mathmlOutput");
  const latexHighlight = document.getElementById("latexHighlight");
  const mathmlHighlight = document.getElementById("mathmlHighlight");
  const latexHighlightCode = document.getElementById("latexHighlightCode");
  const mathmlHighlightCode = document.getElementById("mathmlHighlightCode");
  const copyBtn = document.getElementById("copyBtn");
  const clearInputBtn = document.getElementById("clearInputBtn");
  const mathPreview = document.getElementById("mathPreview");
  const outputEditorWrapper = document.getElementById("outputEditorWrapper");
  const modeButtons = Array.from(document.querySelectorAll(".mode-button"));
  const statusText = document.getElementById("statusText");
  const themeToggle = document.getElementById("themeToggle");

  const TEMML_OPTIONS = {
    displayMode: true,
    throwOnError: true,
    trust: false
  };

  let currentLatex = "";
  let currentMathML = "";
  let currentMode = "math";
  let conversionTimer = null;

  function escapeHTML(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function highlightLatex(text) {
    return escapeHTML(text)
      .replace(/\\([a-zA-Z]+)/g, '<span class="latex-command">\\$1</span>')
      .replace(/([{}[\]()])/g, '<span class="latex-bracket">$1</span>')
      .replace(/([_^])/g, '<span class="latex-subscript">$1</span>');
  }

  function highlightXML(text) {
    return escapeHTML(text).replace(
      /&lt;(\/?)([a-zA-Z][\w:-]*)([\s\S]*?)&gt;/g,
      (match, slash, tagName, attrs) => {
        const highlightedAttrs = attrs.replace(
          /([\w:-]+)=(".*?"|'.*?'|[^\s>]+)/g,
          '<span class="xml-attribute">$1</span>=<span class="xml-attribute-value">$2</span>'
        );

        return [
          '<span class="xml-bracket">&lt;</span>',
          slash ? '<span class="xml-tag">/</span>' : "",
          '<span class="xml-tag-name">',
          tagName,
          "</span>",
          highlightedAttrs,
          '<span class="xml-bracket">&gt;</span>'
        ].join("");
      }
    );
  }

  function updateLatexHighlight() {
    latexHighlightCode.innerHTML = highlightLatex(latexInput.value);
  }

  function updateMathMLHighlight() {
    mathmlHighlightCode.innerHTML = highlightXML(mathmlOutput.value);
    syncScroll(mathmlOutput, mathmlHighlight);
  }

  function syncScroll(source, target) {
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
  }

  function setStatus(message, state = "") {
    statusText.textContent = message;
    statusText.classList.toggle("is-success", state === "success");
    statusText.classList.toggle("is-error", state === "error");
  }

  function formatMathML(mathml) {
    try {
      const lines = [];
      let indent = 0;

      mathml
        .replace(/></g, ">\n<")
        .split("\n")
        .forEach((part) => {
          const trimmed = part.trim();
          if (!trimmed) return;

          if (trimmed.startsWith("</")) {
            indent = Math.max(0, indent - 1);
          }

          lines.push(`${"  ".repeat(indent)}${trimmed}`);

          const tagName = trimmed.match(/^<([a-zA-Z][\w:-]*)/);
          const opensTag = Boolean(tagName);
          const closesSameTag = tagName && trimmed.includes(`</${tagName[1]}>`);
          const selfClosing = trimmed.endsWith("/>");

          if (opensTag && !selfClosing && !closesSameTag) {
            indent += 1;
          }
        });

      return lines.join("\n");
    } catch (error) {
      return mathml;
    }
  }

  function flattenMathML(mathml) {
    return mathml.replace(/>\s+</g, "><").replace(/\n/g, "").trim();
  }

  function getMathML(latex) {
    if (typeof temml === "undefined") {
      throw new Error("Temml library is not loaded");
    }

    return temml.renderToString(latex, { ...TEMML_OPTIONS });
  }

  function renderMathPreview() {
    mathPreview.innerHTML = "";

    if (!currentLatex) return;

    try {
      temml.render(currentLatex, mathPreview, { ...TEMML_OPTIONS });

      if (temml.postProcess) {
        temml.postProcess(mathPreview);
      }
    } catch (error) {
      mathPreview.innerHTML = `<span class="error-message">Error rendering math: ${escapeHTML(error.message)}</span>`;
    }
  }

  function updateDisplay() {
    if (currentMode === "math") {
      mathPreview.hidden = false;
      outputEditorWrapper.hidden = true;
      renderMathPreview();
      return;
    }

    mathPreview.hidden = true;
    outputEditorWrapper.hidden = false;
    mathmlOutput.value = currentMode === "flat" ? flattenMathML(currentMathML) : formatMathML(currentMathML);
    updateMathMLHighlight();
  }

  function clearOutput() {
    currentLatex = "";
    currentMathML = "";
    mathPreview.innerHTML = "";
    mathmlOutput.value = "";
    updateMathMLHighlight();
    updateDisplay();
    setStatus("Empty");
  }

  function performConversion() {
    const latex = latexInput.value.trim();
    updateLatexHighlight();

    if (!latex) {
      clearOutput();
      return;
    }

    try {
      currentLatex = latex;
      currentMathML = getMathML(latex);
      updateDisplay();
      setStatus("Converted", "success");
    } catch (error) {
      currentLatex = latex;
      currentMathML = "";
      mathmlOutput.value = "";
      updateMathMLHighlight();
      outputEditorWrapper.hidden = true;
      mathPreview.hidden = false;
      mathPreview.innerHTML = `<span class="error-message">Error: ${escapeHTML(error.message)}</span>`;
      setStatus("Error", "error");
    }
  }

  function scheduleConversion() {
    window.clearTimeout(conversionTimer);
    conversionTimer = window.setTimeout(performConversion, 300);
  }

  function setMode(mode) {
    currentMode = mode;

    modeButtons.forEach((button) => {
      const isActive = button.dataset.mode === mode;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    updateDisplay();
  }

  function getCopyContent() {
    if (!currentMathML) return "";
    return currentMode === "flat" ? flattenMathML(currentMathML) : formatMathML(currentMathML);
  }

  async function writeClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const temporaryTextarea = document.createElement("textarea");
    temporaryTextarea.value = text;
    temporaryTextarea.setAttribute("readonly", "");
    temporaryTextarea.style.position = "fixed";
    temporaryTextarea.style.top = "-9999px";
    document.body.appendChild(temporaryTextarea);
    temporaryTextarea.select();

    try {
      document.execCommand("copy");
    } finally {
      temporaryTextarea.remove();
    }
  }

  function flashCopyButton(state) {
    const iconClass = state === "success" ? "fas fa-check" : "fas fa-times";

    copyBtn.classList.toggle("is-success", state === "success");
    copyBtn.classList.toggle("is-error", state === "error");
    copyBtn.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i>`;

    window.setTimeout(() => {
      copyBtn.classList.remove("is-success", "is-error");
      copyBtn.innerHTML = '<i class="far fa-copy" aria-hidden="true"></i>';
    }, 1400);
  }

  function safeLocalStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeLocalStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Ignore storage failures in private or restricted browser contexts.
    }
  }

  function setTheme(theme) {
    const isLight = theme === "light";
    document.body.classList.toggle("light-theme", isLight);
    themeToggle.setAttribute("aria-pressed", String(isLight));
    themeToggle.innerHTML = isLight
      ? '<i class="fas fa-moon" aria-hidden="true"></i>'
      : '<i class="fas fa-sun" aria-hidden="true"></i>';
    safeLocalStorageSet("theme", theme);
  }

  latexInput.addEventListener("input", scheduleConversion);
  latexInput.addEventListener("scroll", () => syncScroll(latexInput, latexHighlight));
  mathmlOutput.addEventListener("scroll", () => syncScroll(mathmlOutput, mathmlHighlight));

  clearInputBtn.addEventListener("click", () => {
    latexInput.value = "";
    updateLatexHighlight();
    clearOutput();
    latexInput.focus();
  });

  modeButtons.forEach((button, index) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + direction + modeButtons.length) % modeButtons.length;
      modeButtons[nextIndex].focus();
      setMode(modeButtons[nextIndex].dataset.mode);
    });
  });

  copyBtn.addEventListener("click", async () => {
    const contentToCopy = getCopyContent();

    if (!contentToCopy) {
      flashCopyButton("error");
      setStatus("Empty");
      return;
    }

    try {
      await writeClipboard(contentToCopy);
      flashCopyButton("success");
      setStatus("Copied", "success");
    } catch (error) {
      flashCopyButton("error");
      setStatus("Copy failed", "error");
    }
  });

  themeToggle.addEventListener("click", () => {
    setTheme(document.body.classList.contains("light-theme") ? "dark" : "light");
  });

  setTheme(safeLocalStorageGet("theme") === "light" ? "light" : "dark");
  updateLatexHighlight();
  updateMathMLHighlight();
  performConversion();
});
