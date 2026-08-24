(() => {
  "use strict";

  /*
   * Most posts can use ordinary $...$ and $$...$$ delimiters. These two
   * protected forms remain available when Markdown-sensitive TeX is needed:
   *
   *   Inline:  `\(a*b*c\)`
   *   Display: a fenced code block whose language is "math"
   *
   * Convert them before loading MathJax so its normal startup pass sees the
   * final DOM. This avoids depending on a custom MathJax startup hook.
   */
  const restoreProtectedMath = () => {
    document
      .querySelectorAll(
        'pre > code[data-lang="math"], pre > code.language-math',
      )
      .forEach((code) => {
        const source = code.textContent.trim();
        const isNumberedEnvironment =
          /^\\begin\{(?:equation|align|alignat|flalign|gather|multline)\*?\}/.test(
            source,
          );
        const math = document.createElement("div");
        math.className = "math-display";
        math.textContent = isNumberedEnvironment
          ? source
          : `\\[${source}\\]`;
        code.parentElement.replaceWith(math);
      });

    document.querySelectorAll("code").forEach((code) => {
      if (code.closest("pre")) return;

      const source = code.textContent.trim();
      if (!source.startsWith("\\(") || !source.endsWith("\\)")) return;

      const math = document.createElement("span");
      math.className = "math-inline";
      math.textContent = source;
      code.replaceWith(math);
    });
  };

  restoreProtectedMath();

  window.MathJax = {
    tex: {
      inlineMath: { "[+]": [["$", "$"]] },
      processEscapes: true,
      tags: "ams",
    },
  };

  const script = document.createElement("script");
  script.src =
    "https://cdn.jsdelivr.net/npm/mathjax@4.1.2/tex-chtml.js";
  script.defer = true;
  document.head.appendChild(script);
})();
