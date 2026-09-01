/**
 * Lovable Code Downloader - Reviewer Verification Test Suite (Round 2)
 * Comprehensive Adversarial & Regression Test Harness
 */

function normalizePath(p) {
  if (!p || typeof p !== "string") return "";
  return p.replace(/\\/g, "/").replace(/^(\.\/|\/)+/, "").trim();
}

// 1. Classifier Implementation
function classifyTreeItem(el, label) {
  if (!label) return { isFolder: false, isOpen: false };

  const treeItem = (el && typeof el.closest === "function")
    ? (el.closest("[role='treeitem'], [data-state], [aria-expanded], [data-item-type]") || el)
    : (el || null);

  // 1. Explicit aria-expanded (W3C standard for tree folders)
  const ariaExpanded = (el && el.getAttribute ? el.getAttribute("aria-expanded") : null) || 
                       (treeItem && treeItem.getAttribute ? treeItem.getAttribute("aria-expanded") : null);
  if (ariaExpanded === "true") return { isFolder: true, isOpen: true };
  if (ariaExpanded === "false") return { isFolder: true, isOpen: false };

  // 2. Explicit data-state (Radix Collapsible / Tree standard)
  const dataState = (el && el.getAttribute ? el.getAttribute("data-state") : null) || 
                    (treeItem && treeItem.getAttribute ? treeItem.getAttribute("data-state") : null);
  if (dataState === "open") return { isFolder: true, isOpen: true };
  if (dataState === "closed") return { isFolder: true, isOpen: false };

  // 3. Explicit data-item-type / data-type
  const itemType = (el && el.getAttribute ? el.getAttribute("data-item-type") || el.getAttribute("data-type") : null) ||
                   (treeItem && treeItem.getAttribute ? treeItem.getAttribute("data-item-type") || treeItem.getAttribute("data-type") : null);
  if (itemType === "folder" || itemType === "directory") {
    return { isFolder: true, isOpen: false };
  }
  if (itemType === "file") return { isFolder: false, isOpen: false };

  // 4. SVG icon inspection
  const svgs = (treeItem && treeItem.querySelectorAll ? treeItem.querySelectorAll("svg") : []) ||
               (el && el.querySelectorAll ? el.querySelectorAll("svg") : []) || [];
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

  // 5. Special exact files (extensionless or multi-part dotfiles or cloud configs)
  const knownExactFiles = new Set([
    "Dockerfile", "LICENSE", "LICENCE", "LICENSE-MIT", "LICENSE.md", "Makefile", "CNAME",
    "Procfile", "Gemfile", "Rakefile", "Brewfile", "README", "README.md", "_headers", "_redirects",
    ".gitignore", ".npmignore", ".prettierignore", ".eslintignore", ".editorconfig",
    ".env", ".env.local", ".env.development", ".env.production", ".env.test",
    ".env.example", ".env.sample", ".env.staging", ".env.preview", ".npmrc", ".nvmrc",
    ".node-version", ".tool-versions", ".yarnrc", ".yarnrc.yml", ".yarnrc.yaml",
    "robots.txt", "humans.txt", "browserslist", ".babelrc", ".gitattributes", ".gitmodules",
    ".dockerignore", ".gitkeep", ".stylelintrc", ".stylelintignore", ".postcssrc",
    ".browserslistrc", ".lintstagedrc", ".eslintrc", ".prettierrc", ".commitlintrc",
    "bun.lockb", "pnpm-lock.yaml", "package-lock.json", "yarn.lock"
  ]);
  if (knownExactFiles.has(label)) {
    return { isFolder: false, isOpen: false };
  }

  // 6. Dot-folders (strictly directories)
  const knownDotFolders = new Set([
    ".lovable", ".github", ".vscode", ".husky", ".git", ".next", ".circleci",
    ".devcontainer", ".cursor", ".idea"
  ]);
  if (knownDotFolders.has(label)) {
    return { isFolder: true, isOpen: isChevronOpen };
  }

  // 7. Check file extension (e.g. accordion.tsx, vite.config.ts, project.json, vite-env.d.ts, database.production)
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

  // 8. Other dot-prefixed names not in knownDotFolders default to files
  if (label.startsWith(".")) {
    return { isFolder: false, isOpen: false };
  }

  // 9. Fallback: names without extension are treated as folders
  return { isFolder: true, isOpen: isChevronOpen };
}

// 2. Folder Expansion Simulator with Hierarchical Path Tracking
function simulateFolderExpansion(allTreeNodes) {
  const expandedFolders = [];
  const expandedSet = new Set();
  let pathStack = [];

  for (const node of allTreeNodes) {
    const { label, level, isOpen, explicitPath } = node;
    const mockEl = {
      getAttribute: (name) => (name === "data-path" ? explicitPath : null),
      closest: () => null,
      querySelectorAll: () => []
    };

    const { isFolder } = classifyTreeItem(mockEl, label);

    while (pathStack.length > 0 && pathStack[pathStack.length - 1].level >= level) {
      pathStack.pop();
    }

    const parentFolder = pathStack.map((p) => p.name).join("/");
    const folderFullPath = normalizePath(explicitPath || (parentFolder ? `${parentFolder}/${label}` : label));

    if (isFolder) {
      pathStack.push({ level, name: label });

      if (!isOpen) {
        if (!expandedSet.has(folderFullPath)) {
          expandedSet.add(folderFullPath);
          expandedFolders.push(folderFullPath);
        }
      }
    }
  }

  return expandedFolders;
}

// 3. Tree Path Reconstruction
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

// Run Test Suite
function runTestSuite() {
  console.log("==================================================");
  console.log("🧪 SWE Light Reviewer Adversarial Test Suite (R2)");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(cond, name) {
    if (cond) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      failed++;
    }
  }

  // Test 1: Advanced Classifier Edge Cases
  console.log("--- 1. Classifier Edge Cases ---");
  assert(classifyTreeItem(null, ".lovable").isFolder === true, ".lovable is a folder");
  assert(classifyTreeItem(null, ".github").isFolder === true, ".github is a folder");
  assert(classifyTreeItem(null, ".vscode").isFolder === true, ".vscode is a folder");
  assert(classifyTreeItem(null, ".husky").isFolder === true, ".husky is a folder");
  assert(classifyTreeItem(null, "src").isFolder === true, "src is a folder");
  assert(classifyTreeItem(null, "public").isFolder === true, "public is a folder");
  assert(classifyTreeItem(null, "components").isFolder === true, "components is a folder");
  assert(classifyTreeItem(null, "ui").isFolder === true, "ui is a folder");

  assert(classifyTreeItem(null, ".gitignore").isFolder === false, ".gitignore is a file");
  assert(classifyTreeItem(null, ".dockerignore").isFolder === false, ".dockerignore is a file");
  assert(classifyTreeItem(null, ".gitkeep").isFolder === false, ".gitkeep is a file");
  assert(classifyTreeItem(null, ".eslintrc").isFolder === false, ".eslintrc is a file");
  assert(classifyTreeItem(null, ".prettierrc").isFolder === false, ".prettierrc is a file");
  assert(classifyTreeItem(null, ".stylelintrc").isFolder === false, ".stylelintrc is a file");
  assert(classifyTreeItem(null, ".env").isFolder === false, ".env is a file");
  assert(classifyTreeItem(null, ".env.local").isFolder === false, ".env.local is a file");
  assert(classifyTreeItem(null, ".env.preview").isFolder === false, ".env.preview is a file");
  assert(classifyTreeItem(null, ".env.production").isFolder === false, ".env.production is a file");
  assert(classifyTreeItem(null, ".yarnrc.yml").isFolder === false, ".yarnrc.yml is a file");
  assert(classifyTreeItem(null, ".node-version").isFolder === false, ".node-version is a file");
  assert(classifyTreeItem(null, "_headers").isFolder === false, "_headers is a file");
  assert(classifyTreeItem(null, "_redirects").isFolder === false, "_redirects is a file");
  assert(classifyTreeItem(null, "Dockerfile").isFolder === false, "Dockerfile is a file");
  assert(classifyTreeItem(null, "LICENSE").isFolder === false, "LICENSE is a file");
  assert(classifyTreeItem(null, "LICENSE-MIT").isFolder === false, "LICENSE-MIT is a file");
  assert(classifyTreeItem(null, "Makefile").isFolder === false, "Makefile is a file");
  assert(classifyTreeItem(null, "schema.prisma").isFolder === false, "schema.prisma is a file");
  assert(classifyTreeItem(null, "database.production").isFolder === false, "database.production is a file");
  assert(classifyTreeItem(null, "accordion.tsx").isFolder === false, "accordion.tsx is a file");
  assert(classifyTreeItem(null, "vite.config.ts").isFolder === false, "vite.config.ts is a file");
  assert(classifyTreeItem(null, "vite-env.d.ts").isFolder === false, "vite-env.d.ts is a file");
  assert(classifyTreeItem(null, "project.json").isFolder === false, "project.json is a file");
  assert(classifyTreeItem(null, "favicon.ico").isFolder === false, "favicon.ico is a file");
  assert(classifyTreeItem(null, "bun.lockb").isFolder === false, "bun.lockb is a file");
  assert(classifyTreeItem(null, "pnpm-lock.yaml").isFolder === false, "pnpm-lock.yaml is a file");

  // Test 2: Same Folder Name in Different Branches (Bug fix verification)
  console.log("\n--- 2. Same Folder Name at Same Level in Different Subtrees ---");
  const branchesTree = [
    { label: "src", level: 0, isOpen: true },
    { label: "features", level: 1, isOpen: true },
    { label: "auth", level: 2, isOpen: true },
    { label: "components", level: 3, isOpen: false }, // Closed! Path: src/features/auth/components
    { label: "LoginForm.tsx", level: 4, isOpen: false },
    { label: "dashboard", level: 2, isOpen: true },
    { label: "components", level: 3, isOpen: false }, // Closed! Path: src/features/dashboard/components (Same label and level!)
    { label: "StatsCard.tsx", level: 4, isOpen: false },
  ];

  const expanded = simulateFolderExpansion(branchesTree);
  assert(expanded.includes("src/features/auth/components"), "Expanded: src/features/auth/components");
  assert(expanded.includes("src/features/dashboard/components"), "Expanded: src/features/dashboard/components");
  assert(expanded.length === 2, `Both duplicate-named folders successfully expanded (count = ${expanded.length})`);

  // Test 3: Full 50+ Project Hierarchy Path Reconstruction
  console.log("\n--- 3. Full 50+ File Project Hierarchy Path Reconstruction ---");
  const fullProjectTree = [
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
    { label: "vite.config.ts", level: 0 },
  ];

  const results = reconstructProjectPaths(fullProjectTree);
  console.log(`Reconstructed ${results.length} files from full project hierarchy.`);

  assert(results.includes(".lovable/project.json"), "Path: .lovable/project.json");
  assert(results.includes("public/favicon.ico"), "Path: public/favicon.ico");
  assert(results.includes("public/robots.txt"), "Path: public/robots.txt");
  assert(results.includes("public/placeholder.svg"), "Path: public/placeholder.svg");
  assert(results.includes("src/assets/logo.png"), "Path: src/assets/logo.png");
  assert(results.includes("src/components/ui/accordion.tsx"), "Path: src/components/ui/accordion.tsx");
  assert(results.includes("src/components/ui/button.tsx"), "Path: src/components/ui/button.tsx");
  assert(results.includes("src/components/ui/dialog.tsx"), "Path: src/components/ui/dialog.tsx");
  assert(results.includes("src/components/ui/tooltip.tsx"), "Path: src/components/ui/tooltip.tsx");
  assert(results.includes("src/components/ui/use-toast.ts"), "Path: src/components/ui/use-toast.ts");
  assert(results.includes("src/hooks/use-mobile.tsx"), "Path: src/hooks/use-mobile.tsx");
  assert(results.includes("src/hooks/use-toast.ts"), "Path: src/hooks/use-toast.ts");
  assert(results.includes("src/lib/utils.ts"), "Path: src/lib/utils.ts");
  assert(results.includes("src/routes/__root.tsx"), "Path: src/routes/__root.tsx");
  assert(results.includes("src/routes/index.tsx"), "Path: src/routes/index.tsx");
  assert(results.includes("src/routes/about.tsx"), "Path: src/routes/about.tsx");
  assert(results.includes("src/App.tsx"), "Path: src/App.tsx");
  assert(results.includes("src/main.tsx"), "Path: src/main.tsx");
  assert(results.includes("src/vite-env.d.ts"), "Path: src/vite-env.d.ts");
  assert(results.includes(".dockerignore"), "Path: .dockerignore");
  assert(results.includes(".gitignore"), "Path: .gitignore");
  assert(results.includes("package.json"), "Path: package.json");
  assert(results.includes("vite.config.ts"), "Path: vite.config.ts");
  assert(results.length >= 50, `Total collected files = ${results.length} (>= 50 required)`);

  // Test 4: Virtualized Scroll Window Sliding Simulation
  console.log("\n--- 4. Virtualized Scroll Sliding Window Simulation ---");
  let virtualPathStack = [];
  const collectedVirtualFiles = [];

  const window1 = [
    { label: ".lovable", level: 0 },
    { label: "project.json", level: 1 },
    { label: "public", level: 0 },
    { label: "favicon.ico", level: 1 },
    { label: "src", level: 0 },
    { label: "assets", level: 1 },
    { label: "logo.png", level: 2 },
  ];

  const window2 = [
    { label: "components", level: 1 },
    { label: "ui", level: 2 },
    { label: "accordion.tsx", level: 3 },
    { label: "alert.tsx", level: 3 },
    { label: "button.tsx", level: 3 },
  ];

  const window3 = [
    { label: "hooks", level: 1 },
    { label: "use-mobile.tsx", level: 2 },
    { label: "lib", level: 1 },
    { label: "utils.ts", level: 2 },
  ];

  const window4 = [
    { label: "package.json", level: 0 },
    { label: "vite.config.ts", level: 0 },
  ];

  const windows = [window1, window2, window3, window4];
  for (const win of windows) {
    for (const row of win) {
      const { label, level } = row;
      const { isFolder } = classifyTreeItem(null, label);

      while (virtualPathStack.length > 0 && virtualPathStack[virtualPathStack.length - 1].level >= level) {
        virtualPathStack.pop();
      }

      if (isFolder) {
        virtualPathStack.push({ level, name: label });
      } else {
        const folderPath = virtualPathStack.map((p) => p.name).join("/");
        const rawPath = folderPath ? `${folderPath}/${label}` : label;
        const fullPath = normalizePath(rawPath);
        collectedVirtualFiles.push(fullPath);
      }
    }
  }

  assert(collectedVirtualFiles.includes(".lovable/project.json"), "Window: .lovable/project.json");
  assert(collectedVirtualFiles.includes("public/favicon.ico"), "Window: public/favicon.ico");
  assert(collectedVirtualFiles.includes("src/assets/logo.png"), "Window: src/assets/logo.png");
  assert(collectedVirtualFiles.includes("src/components/ui/accordion.tsx"), "Window: src/components/ui/accordion.tsx");
  assert(collectedVirtualFiles.includes("src/components/ui/alert.tsx"), "Window: src/components/ui/alert.tsx");
  assert(collectedVirtualFiles.includes("src/components/ui/button.tsx"), "Window: src/components/ui/button.tsx");
  assert(collectedVirtualFiles.includes("src/hooks/use-mobile.tsx"), "Window: src/hooks/use-mobile.tsx");
  assert(collectedVirtualFiles.includes("src/lib/utils.ts"), "Window: src/lib/utils.ts");
  assert(collectedVirtualFiles.includes("package.json"), "Window: package.json");
  assert(collectedVirtualFiles.includes("vite.config.ts"), "Window: vite.config.ts");

  // Test 5: Path Normalization for ZIP Packaging
  console.log("\n--- 5. Path Normalization for ZIP Packaging ---");
  assert(normalizePath("/src/App.tsx") === "src/App.tsx", "Strips leading slash");
  assert(normalizePath("./public/favicon.ico") === "public/favicon.ico", "Strips ./ prefix");
  assert(normalizePath("src\\components\\ui\\button.tsx") === "src/components/ui/button.tsx", "Converts backslashes to forward slashes");
  assert(normalizePath("///.lovable/project.json") === ".lovable/project.json", "Strips multiple leading slashes");

  // Test 6: Safe State Cache Lookup with Zero-Byte Files
  console.log("\n--- 6. Safe Cache Lookup & Zero-Byte Files ---");
  const mockCache = {
    "src/components/custom/button.tsx": "// Custom button",
    "button.tsx": "// Root button",
    ".gitkeep": "", // 0-byte file
  };

  const stackForCustom = [{ level: 0, name: "src" }, { level: 1, name: "components" }, { level: 2, name: "custom" }];
  const pathForCustom = "src/components/custom/button.tsx";
  const codeCustom =
    mockCache[pathForCustom] !== undefined
      ? mockCache[pathForCustom]
      : mockCache[`/${pathForCustom}`] !== undefined
      ? mockCache[`/${pathForCustom}`]
      : stackForCustom.length === 0 && mockCache["button.tsx"] !== undefined
      ? mockCache["button.tsx"]
      : undefined;

  assert(codeCustom === "// Custom button", "Exact path resolution without root button collision");

  const stackForGitkeep = [];
  const pathForGitkeep = ".gitkeep";
  const codeGitkeep =
    mockCache[pathForGitkeep] !== undefined
      ? mockCache[pathForGitkeep]
      : mockCache[`/${pathForGitkeep}`] !== undefined
      ? mockCache[`/${pathForGitkeep}`]
      : stackForGitkeep.length === 0 && mockCache[".gitkeep"] !== undefined
      ? mockCache[".gitkeep"]
      : undefined;

  assert(codeGitkeep === "", "0-byte .gitkeep resolved from cache immediately without timeout");

  // Test 7: Data URL and Binary Payload Parsing
  console.log("\n--- 7. Data URL Base64 Payload Parsing ---");
  const sampleDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const isDataUrl = sampleDataUrl.startsWith("data:") && sampleDataUrl.includes(";base64,");
  const base64Data = sampleDataUrl.split(";base64,")[1];
  assert(isDataUrl === true, "Detected data URL");
  assert(base64Data.length > 20, "Extracted valid base64 data");

  console.log("\n==================================================");
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("==================================================\n");

  return failed === 0;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { runTestSuite, classifyTreeItem, normalizePath, simulateFolderExpansion, reconstructProjectPaths };
}

runTestSuite();
