(() => {
  "use strict";

  // Restore TeX protected from Markdown before MathJax's startup pass.
  const replaceMath = (element, tag, className, source) => {
    const math = document.createElement(tag);
    math.className = className;
    math.textContent = source;
    element.replaceWith(math);
  };

  for (const math of document.querySelectorAll("[data-math-tex]")) {
    math.textContent = decodeURIComponent(math.getAttribute("data-math-tex"));
    math.removeAttribute("data-math-tex");
  }

  for (const code of document.querySelectorAll(
    'pre > code[data-lang="math"], pre > code.language-math',
  )) {
    const source = code.textContent.trim();
    const isNumberedEnvironment =
      /^\\begin\{(?:equation|align|alignat|flalign|gather|multline)\*?\}/.test(source);
    replaceMath(
      code.parentElement, "div", "math-display",
      isNumberedEnvironment ? source : `\\[${source}\\]`,
    );
  }

  for (const code of document.querySelectorAll("code")) {
    if (code.closest("pre")) continue;

    const source = code.textContent.trim();
    if (!source.startsWith("\\(") || !source.endsWith("\\)")) continue;

    replaceMath(code, "span", "math-inline", source);
  }

  window.MathJax = {
    tex: {
      inlineMath: { "[+]": [["$", "$"]] },
      processEscapes: true,
      tags: "ams",
    },
    // Typeset the restored equations directly. Leave prices and code examples
    // outside these elements alone without a page-wide ignore rule.
    startup: {
      elements: [".math-inline, .math-display"],
    },
  };

  const script = document.createElement("script");
  script.src =
    "https://cdn.jsdelivr.net/npm/mathjax@4.1.2/tex-chtml.js";
  script.defer = true;
  document.head.appendChild(script);
})();
