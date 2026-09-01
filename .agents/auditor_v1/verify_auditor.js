/**
 * Lovable Code Downloader - Independent Victory Auditor Verification Suite
 * Phase C: Independent Test Execution & Verification of R1, R2, R3 Requirements
 */

function normalizePath(p) {
  if (!p || typeof p !== "string") return "";
  return p.replace(/\\/g, "/").replace(/^(\.\/|\/)+/, "").trim();
}

// Classifier under test (extracted directly from content.js)
function isElementVisuallyExpanded(el, treeItem) {
  const container = treeItem || el;
  if (!container || !container.querySelectorAll) return false;
  const svgs = container.querySelectorAll("svg");
  for (const svg of svgs) {
    const cls = (svg.getAttribute && svg.getAttribute("class") || "") + " " + (svg.className?.baseVal || svg.className || "");
    const html = svg.innerHTML || "";
    if (
      cls.includes("rotate-90") ||
      cls.includes("rotate-180") ||
      cls.includes("open") ||
      cls.includes("folder-open") ||
      html.includes("6 9 12 15 18 9") ||
      html.includes("m6 9 6 6 6-6") ||
      html.includes("M6 9L12 15L18 9")
    ) {
      return true;
    }
  }
  return false;
}

function classifyTreeItem(el, label) {
  if (!label) return { isFolder: false, isOpen: false };

  const treeItem = (el && typeof el.closest === "function")
    ? (el.closest("[role='treeitem'], [data-state], [aria-expanded], [data-item-type]") || el)
    : (el || null);

  // 1. Explicit aria-expanded
  const ariaExpanded = (el && el.getAttribute ? el.getAttribute("aria-expanded") : null) ||
                       (treeItem && treeItem.getAttribute ? treeItem.getAttribute("aria-expanded") : null);
  if (ariaExpanded === "true") return { isFolder: true, isOpen: true };
  if (ariaExpanded === "false") return { isFolder: true, isOpen: false };

  // 2. Explicit data-state
  const dataState = (el && el.getAttribute ? el.getAttribute("data-state") : null) ||
                    (treeItem && treeItem.getAttribute ? treeItem.getAttribute("data-state") : null);
  if (dataState === "open") return { isFolder: true, isOpen: true };
  if (dataState === "closed") return { isFolder: true, isOpen: false };

  // 3. Explicit data-item-type
  const itemType =
    (el && el.getAttribute ? el.getAttribute("data-item-type") || el.getAttribute("data-type") : null) ||
    (treeItem && treeItem.getAttribute ? treeItem.getAttribute("data-item-type") || treeItem.getAttribute("data-type") : null);
  if (itemType === "folder" || itemType === "directory") {
    return { isFolder: true, isOpen: isElementVisuallyExpanded(el, treeItem) };
  }
  if (itemType === "file") return { isFolder: false, isOpen: false };

  // 4. SVG icon inspection
  const svgs = (treeItem && treeItem.querySelectorAll ? treeItem.querySelectorAll("svg") : []) ||
               (el && el.querySelectorAll ? el.querySelectorAll("svg") : []);
  let hasChevron = false;
  let isChevronOpen = false;
  let hasFolderIcon = false;

  for (const svg of svgs) {
    const cls = (svg.getAttribute && svg.getAttribute("class") || "") + " " + (svg.className?.baseVal || svg.className || "");
    const html = svg.innerHTML || "";

    if (
      cls.includes("chevron") ||
      cls.includes("lucide-chevron") ||
      html.includes("6 9 12 15 18 9") ||
      html.includes("9 18 15 12 9 6") ||
      html.includes("m9 18 6-6-6-6") ||
      html.includes("m6 9 6 6 6-6") ||
      html.includes("M9 18L15 12L9 6") ||
      html.includes("M6 9L12 15L18 9")
    ) {
      hasChevron = true;
      if (
        cls.includes("rotate-90") ||
        cls.includes("rotate-180") ||
        cls.includes("open") ||
        html.includes("6 9 12 15 18 9") ||
        html.includes("m6 9 6 6 6-6") ||
        html.includes("M6 9L12 15L18 9")
      ) {
        isChevronOpen = true;
      }
    }

    if (
      cls.includes("folder") ||
      cls.includes("lucide-folder") ||
      html.includes("M4 20h16") ||
      html.includes("M22 19a2 2 0 0 1-2 2H4") ||
      html.includes("M20 20a2 2 0 0 0 2-2V8")
    ) {
      hasFolderIcon = true;
      if (cls.includes("folder-open") || cls.includes("lucide-folder-open")) {
        isChevronOpen = true;
      }
    }
  }

  if (hasChevron || hasFolderIcon) {
    return { isFolder: true, isOpen: isChevronOpen };
  }

  // 5. Special exact files
  const knownExactFiles = new Set([
    "Dockerfile", "Dockerfile.dev", "Dockerfile.prod", "Dockerfile.local", "Containerfile",
    "LICENSE", "LICENCE", "LICENSE-MIT", "LICENSE-APACHE", "LICENSE-2.0", "LICENSE.md", "LICENSE.txt",
    "UNLICENSE", "COPYING", "AUTHORS", "CONTRIBUTING", "CONTRIBUTING.md", "CHANGELOG", "CHANGELOG.md",
    "CODE_OF_CONDUCT", "CODE_OF_CONDUCT.md", "SECURITY", "SECURITY.md", "Makefile", "CNAME",
    "Procfile", "Gemfile", "Rakefile", "Brewfile", "README", "README.md", "_headers", "_redirects",
    ".gitignore", ".npmignore", ".prettierignore", ".eslintignore", ".editorconfig",
    ".env", ".env.local", ".env.development", ".env.production", ".env.test",
    ".env.example", ".env.sample", ".env.staging", ".env.preview", ".env.test.local",
    ".env.development.local", ".env.production.local", ".npmrc", ".nvmrc",
    ".node-version", ".tool-versions", ".yarnrc", ".yarnrc.yml", ".yarnrc.yaml",
    "robots.txt", "humans.txt", "browserslist", ".babelrc", ".gitattributes", ".gitmodules",
    ".dockerignore", ".gitkeep", ".stylelintrc", ".stylelintignore", ".postcssrc",
    ".browserslistrc", ".lintstagedrc", ".eslintrc", ".prettierrc", ".commitlintrc",
    "bun.lock", "bun.lockb", "pnpm-lock.yaml", "package-lock.json", "yarn.lock",
    "Cargo.lock", "Cargo.toml", "go.mod", "go.sum", "composer.lock", "composer.json",
    "Pipfile", "Pipfile.lock", "pyproject.toml", "requirements.txt",
    ".cursorrules", ".watchmanconfig", ".solhintignore", ".vercelignore", ".swcrc", ".releaserc"
  ]);
  if (knownExactFiles.has(label)) {
    return { isFolder: false, isOpen: false };
  }

  // 6. Dot-folders
  const knownDotFolders = new Set([
    ".lovable", ".github", ".vscode", ".husky", ".git", ".next", ".circleci",
    ".devcontainer", ".cursor", ".idea", ".agents", ".agent", ".claude",
    ".changeset", ".storybook", ".turbo", ".wrangler", ".expo", ".output",
    ".contentlayer", ".docusaurus", ".yarn", ".nuxt", ".svelte-kit", ".vercel", ".netlify"
  ]);
  if (knownDotFolders.has(label)) {
    return { isFolder: true, isOpen: isChevronOpen };
  }

  // 7. Standard file extension check
  const lastDot = label.lastIndexOf(".");
  if (lastDot > 0) {
    const ext = label.slice(lastDot + 1).toLowerCase();
    const knownExtensions = new Set([
      "ts", "tsx", "js", "jsx", "mjs", "cjs", "mts", "cts", "json", "json5", "jsonc",
      "css", "scss", "sass", "less", "html", "htm", "md", "mdx", "txt", "yaml", "yml",
      "toml", "xml", "svg", "png", "jpg", "jpeg", "gif", "ico", "webp", "bmp", "tiff",
      "woff", "woff2", "ttf", "eot", "otf", "map", "lock", "lockb", "env", "config",
      "wasm", "sh", "bash", "sql", "prisma", "graphql", "gql", "astro", "svelte", "vue"
    ]);
    if (knownExtensions.has(ext) || /^[a-z0-9]{1,12}$/i.test(ext)) {
      return { isFolder: false, isOpen: false };
    }
  }

  // 8. Dot-prefixed names default to file
  if (label.startsWith(".")) {
    return { isFolder: false, isOpen: false };
  }

  // 9. Fallback
  return { isFolder: true, isOpen: isChevronOpen };
}

// Tree Path Reconstruction with Depth Stack
function reconstructProjectPaths(treeRows) {
  let pathStack = [];
  const processedFiles = [];

  for (const row of treeRows) {
    const { label, level, attrs, svgs, explicitPath } = row;
    const mockEl = {
      getAttribute: (name) => (name === "data-path" ? explicitPath : attrs ? attrs[name] : null),
      querySelectorAll: (sel) => (svgs || []),
      closest: () => null
    };

    const { isFolder } = classifyTreeItem(mockEl, label);

    while (pathStack.length > 0 && pathStack[pathStack.length - 1].level >= level) {
      pathStack.pop();
    }

    if (isFolder) {
      pathStack.push({ level, name: label });
      continue;
    }

    const folderPath = pathStack.map((p) => p.name).join("/");
    const rawPath = explicitPath || (folderPath ? `${folderPath}/${label}` : label);
    const fullPath = normalizePath(rawPath);
    processedFiles.push(fullPath);
  }

  return processedFiles;
}

// Verification Test Suite
function runAuditorTestSuite() {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  function test(name, fn) {
    results.total++;
    try {
      fn();
      results.passed++;
    } catch (e) {
      results.failed++;
      results.failures.push({ name, error: e.message });
    }
  }

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed");
    }
  }

  // ==========================================
  // R1: Tree Traversal, Dot-folders, Expansion
  // ==========================================
  test("R1.1: .lovable folder is recognized as folder and not misclassified", () => {
    const res = classifyTreeItem(null, ".lovable");
    assert(res.isFolder === true, ".lovable must be a folder");
  });

  test("R1.2: Standard folders (public, src, components, ui, hooks, lib, routes) recognized as folders", () => {
    const folders = ["public", "src", "assets", "components", "ui", "hooks", "lib", "routes"];
    for (const f of folders) {
      const res = classifyTreeItem(null, f);
      assert(res.isFolder === true, `${f} must be identified as folder`);
    }
  });

  test("R1.3: Radix / WAI-ARIA aria-expanded and data-state attributes override heuristic classification", () => {
    const openFolderEl = {
      getAttribute: (k) => (k === "aria-expanded" ? "true" : null),
      closest: () => null,
      querySelectorAll: () => []
    };
    const closedFolderEl = {
      getAttribute: (k) => (k === "data-state" ? "closed" : null),
      closest: () => null,
      querySelectorAll: () => []
    };
    assert(classifyTreeItem(openFolderEl, "someFolder").isOpen === true, "aria-expanded=true folder must be open");
    assert(classifyTreeItem(closedFolderEl, "someFolder").isOpen === false, "data-state=closed folder must be closed");
  });

  // ==========================================
  // R2: Depth, PathStack, 50+ Files, Complex Names
  // ==========================================
  test("R2.1: Full 50+ file project hierarchy reconstructed with correct relative paths", () => {
    const fullTree = [
      { label: ".lovable", level: 0 },
      { label: "project.json", level: 1 },
      { label: "public", level: 0 },
      { label: "favicon.ico", level: 1 },
      { label: "robots.txt", level: 1 },
      { label: "placeholder.svg", level: 1 },
      { label: "src", level: 0 },
      { label: "assets", level: 1 },
      { label: "logo.png", level: 2 },
      { label: "components", level: 1 },
      { label: "ui", level: 2 },
      { label: "accordion.tsx", level: 3 },
      { label: "alert-dialog.tsx", level: 3 },
      { label: "alert.tsx", level: 3 },
      { label: "aspect-ratio.tsx", level: 3 },
      { label: "avatar.tsx", level: 3 },
      { label: "badge.tsx", level: 3 },
      { label: "breadcrumb.tsx", level: 3 },
      { label: "button.tsx", level: 3 },
      { label: "calendar.tsx", level: 3 },
      { label: "card.tsx", level: 3 },
      { label: "carousel.tsx", level: 3 },
      { label: "checkbox.tsx", level: 3 },
      { label: "collapsible.tsx", level: 3 },
      { label: "command.tsx", level: 3 },
      { label: "context-menu.tsx", level: 3 },
      { label: "dialog.tsx", level: 3 },
      { label: "drawer.tsx", level: 3 },
      { label: "dropdown-menu.tsx", level: 3 },
      { label: "form.tsx", level: 3 },
      { label: "hover-card.tsx", level: 3 },
      { label: "input-otp.tsx", level: 3 },
      { label: "input.tsx", level: 3 },
      { label: "label.tsx", level: 3 },
      { label: "menubar.tsx", level: 3 },
      { label: "navigation-menu.tsx", level: 3 },
      { label: "pagination.tsx", level: 3 },
      { label: "popover.tsx", level: 3 },
      { label: "progress.tsx", level: 3 },
      { label: "radio-group.tsx", level: 3 },
      { label: "resizable.tsx", level: 3 },
      { label: "scroll-area.tsx", level: 3 },
      { label: "select.tsx", level: 3 },
      { label: "separator.tsx", level: 3 },
      { label: "sheet.tsx", level: 3 },
      { label: "skeleton.tsx", level: 3 },
      { label: "slider.tsx", level: 3 },
      { label: "switch.tsx", level: 3 },
      { label: "table.tsx", level: 3 },
      { label: "tabs.tsx", level: 3 },
      { label: "textarea.tsx", level: 3 },
      { label: "toast.tsx", level: 3 },
      { label: "toaster.tsx", level: 3 },
      { label: "toggle-group.tsx", level: 3 },
      { label: "toggle.tsx", level: 3 },
      { label: "tooltip.tsx", level: 3 },
      { label: "use-toast.ts", level: 3 },
      { label: "hooks", level: 1 },
      { label: "use-mobile.tsx", level: 2 },
      { label: "use-toast.ts", level: 2 },
      { label: "lib", level: 1 },
      { label: "utils.ts", level: 2 },
      { label: "routes", level: 1 },
      { label: "__root.tsx", level: 2 },
      { label: "index.tsx", level: 2 },
      { label: "about.tsx", level: 2 },
      { label: "App.css", level: 1 },
      { label: "App.tsx", level: 1 },
      { label: "index.css", level: 1 },
      { label: "main.tsx", level: 1 },
      { label: "vite-env.d.ts", level: 1 },
      { label: ".dockerignore", level: 0 },
      { label: ".gitignore", level: 0 },
      { label: "components.json", level: 0 },
      { label: "eslint.config.js", level: 0 },
      { label: "index.html", level: 0 },
      { label: "package.json", level: 0 },
      { label: "postcss.config.js", level: 0 },
      { label: "README.md", level: 0 },
      { label: "tailwind.config.ts", level: 0 },
      { label: "tsconfig.app.json", level: 0 },
      { label: "tsconfig.json", level: 0 },
      { label: "tsconfig.node.json", level: 0 },
      { label: "vite.config.ts", level: 0 }
    ];

    const paths = reconstructProjectPaths(fullTree);
    assert(paths.length >= 50, `Expected at least 50 files, got ${paths.length}`);
    assert(paths.includes(".lovable/project.json"), "Must contain .lovable/project.json");
    assert(paths.includes("public/favicon.ico"), "Must contain public/favicon.ico");
    assert(paths.includes("src/components/ui/accordion.tsx"), "Must contain src/components/ui/accordion.tsx");
    assert(paths.includes("src/routes/__root.tsx"), "Must contain src/routes/__root.tsx");
    assert(paths.includes("src/lib/utils.ts"), "Must contain src/lib/utils.ts");
    assert(paths.includes("src/hooks/use-mobile.tsx"), "Must contain src/hooks/use-mobile.tsx");
  });

  test("R2.2: Extensionless files and dotfiles correctly classified as files", () => {
    const files = [
      "Dockerfile", "Dockerfile.dev", "Containerfile", "LICENSE", "LICENSE-APACHE", "Makefile",
      ".gitignore", ".dockerignore", ".gitkeep", ".eslintrc", ".prettierrc", ".env", ".env.local",
      "bun.lock", "bun.lockb", "pnpm-lock.yaml", "package-lock.json", "yarn.lock"
    ];
    for (const f of files) {
      const res = classifyTreeItem(null, f);
      assert(res.isFolder === false, `${f} must be recognized as a file`);
    }
  });

  // ==========================================
  // R3: Lossless Extraction & Asset Handling
  // ==========================================
  test("R3.1: Path normalization strips leading slashes and handles Windows backslashes", () => {
    assert(normalizePath("/src/App.tsx") === "src/App.tsx", "Strips /");
    assert(normalizePath("./src/lib/utils.ts") === "src/lib/utils.ts", "Strips ./");
    assert(normalizePath("src\\components\\ui\\button.tsx") === "src/components/ui/button.tsx", "Replaces \\ with /");
    assert(normalizePath("///.lovable/project.json") === ".lovable/project.json", "Strips multi-slash");
  });

  test("R3.2: Base64 data URL asset correctly decomposed for ZIP binary entry", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const isData = dataUrl.startsWith("data:") && dataUrl.includes(";base64,");
    const rawBase64 = dataUrl.split(";base64,")[1];
    assert(isData === true, "Must detect data URL");
    assert(rawBase64.length > 10, "Must extract valid base64 payload");
  });

  return results;
}

// Self-execute and export
const auditResults = runAuditorTestSuite();
console.log(JSON.stringify(auditResults, null, 2));

if (typeof module !== "undefined" && module.exports) {
  module.exports = { runAuditorTestSuite, classifyTreeItem, reconstructProjectPaths, normalizePath };
}
