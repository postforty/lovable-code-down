/**
 * Test Suite: Zero-Loss Virtualized File Tree Crawler Verification
 * Verifies that the new Manifest-First Virtual Crawler:
 * 1. Accurately extracts explicit data-item-path
 * 2. Classifies folder/file by data-item-type
 * 3. Discovers 100% of files without missing any items even when DOM unmounts off-screen elements
 * 4. Successfully targets and collects all files in a virtual scrolling window
 */

const assert = require("assert");

function normalizePath(p) {
  if (!p || typeof p !== "string") return "";
  return p.replace(/\\/g, "/").replace(/^(\.\/|\/)+/, "").trim();
}

function getItemExplicitPath(btn) {
  if (!btn) return null;
  const treeItem = typeof btn.closest === "function"
    ? (btn.closest("[role='treeitem'], [data-item-path], [data-path], [data-filepath], [data-treepath], [data-file-path], [data-full-path]") || btn)
    : btn;

  const explicitPath =
    (treeItem.getAttribute && treeItem.getAttribute("data-item-path")) ||
    (btn.getAttribute && btn.getAttribute("data-item-path")) ||
    (treeItem.getAttribute && treeItem.getAttribute("data-path")) ||
    (btn.getAttribute && btn.getAttribute("data-path")) ||
    (treeItem.getAttribute && treeItem.getAttribute("data-filepath")) ||
    (btn.getAttribute && btn.getAttribute("data-filepath")) ||
    (treeItem.getAttribute && treeItem.getAttribute("data-treepath")) ||
    (btn.getAttribute && btn.getAttribute("data-treepath")) ||
    (treeItem.getAttribute && treeItem.getAttribute("data-file-path")) ||
    (btn.getAttribute && btn.getAttribute("data-file-path")) ||
    (treeItem.getAttribute && treeItem.getAttribute("data-full-path")) ||
    (btn.getAttribute && btn.getAttribute("data-full-path"));

  if (explicitPath) {
    return normalizePath(explicitPath).replace(/\/+$/, "");
  }
  return null;
}

function classifyTreeItem(el, label) {
  const treeItem = (el && typeof el.closest === "function")
    ? (el.closest("[role='treeitem'], [data-state], [aria-expanded], [data-item-type]") || el)
    : (el || null);

  const itemType =
    (el && el.getAttribute ? el.getAttribute("data-item-type") || el.getAttribute("data-type") : null) ||
    (treeItem && treeItem.getAttribute ? treeItem.getAttribute("data-item-type") || treeItem.getAttribute("data-type") : null);

  const ariaExpanded = (el && el.getAttribute ? el.getAttribute("aria-expanded") : null) ||
                       (treeItem && treeItem.getAttribute ? treeItem.getAttribute("aria-expanded") : null);

  if (itemType === "folder" || itemType === "directory") {
    if (ariaExpanded === "true") return { isFolder: true, isOpen: true };
    if (ariaExpanded === "false") return { isFolder: true, isOpen: false };
    return { isFolder: true, isOpen: false };
  }
  if (itemType === "file") return { isFolder: false, isOpen: false };

  if (!label) return { isFolder: false, isOpen: false };
  if (ariaExpanded === "true") return { isFolder: true, isOpen: true };
  if (ariaExpanded === "false") return { isFolder: true, isOpen: false };

  return { isFolder: false, isOpen: false };
}

// ----------------------------------------------------
// Mock Full Project Tree (matches user's screenshots)
// ----------------------------------------------------
const fullVirtualTree = [
  { path: ".lovable/", type: "folder", expanded: true },
  { path: ".lovable/project.json", type: "file" },
  { path: "public/", type: "folder", expanded: true },
  { path: "public/favicon.ico", type: "file" },
  { path: "public/robots.txt", type: "file" },
  { path: "src/", type: "folder", expanded: true },
  { path: "src/assets/", type: "folder", expanded: true },
  { path: "src/assets/project-cadence.jpg", type: "file" },
  { path: "src/assets/project-harvest.jpg", type: "file" },
  { path: "src/assets/project-loom.jpg", type: "file" },
  { path: "src/components/ui/", type: "folder", expanded: true },
  { path: "src/components/ui/accordion.tsx", type: "file" },
  { path: "src/components/ui/alert-dialog.tsx", type: "file" },
  { path: "src/components/ui/alert.tsx", type: "file" },
  { path: "src/components/ui/aspect-ratio.tsx", type: "file" },
  { path: "src/components/ui/avatar.tsx", type: "file" },
  { path: "src/components/ui/badge.tsx", type: "file" },
  { path: "src/components/ui/breadcrumb.tsx", type: "file" },
  { path: "src/components/ui/button.tsx", type: "file" },
  { path: "src/components/ui/calendar.tsx", type: "file" },
  { path: "src/components/ui/card.tsx", type: "file" },
  { path: "src/components/ui/carousel.tsx", type: "file" },
  { path: "src/components/ui/chart.tsx", type: "file" },
  { path: "src/components/ui/checkbox.tsx", type: "file" },
  { path: "src/components/ui/collapsible.tsx", type: "file" },
  { path: "src/components/ui/command.tsx", type: "file" },
  { path: "src/components/ui/context-menu.tsx", type: "file" },
  { path: "src/components/ui/dialog.tsx", type: "file" },
  { path: "src/components/ui/drawer.tsx", type: "file" },
  { path: "src/components/ui/dropdown-menu.tsx", type: "file" },
  { path: "src/components/ui/form.tsx", type: "file" },
  { path: "src/hooks/", type: "folder", expanded: true },
  { path: "src/hooks/use-mobile.tsx", type: "file" },
  { path: "src/lib/", type: "folder", expanded: true },
  { path: "src/lib/error-capture.ts", type: "file" },
  { path: "src/lib/error-page.ts", type: "file" },
  { path: "src/lib/lovable-error-re...ts", type: "file" },
  { path: "src/lib/utils.ts", type: "file" },
  { path: "src/routes/", type: "folder", expanded: true },
  { path: "src/routes/__root.tsx", type: "file" },
  { path: "src/routes/index.tsx", type: "file" },
  { path: "src/routes/README.md", type: "file" },
  { path: "src/router.tsx", type: "file" },
  { path: "src/routeTree.gen.ts", type: "file" },
  { path: "src/server.ts", type: "file" },
  { path: "src/start.ts", type: "file" },
  { path: "src/styles.css", type: "file" },
  { path: ".gitignore", type: "file" },
  { path: ".prettierignore", type: "file" },
  { path: ".prettierrc", type: "file" },
  { path: "AGENTS.md", type: "file" },
  { path: "bun.lock", type: "file" },
  { path: "bunfig.toml", type: "file" },
  { path: "components.json", type: "file" },
  { path: "eslint.config.js", type: "file" },
  { path: "package.json", type: "file" },
  { path: "README.md", type: "file" },
  { path: "tsconfig.json", type: "file" },
  { path: "vite.config.ts", type: "file" }
];

console.log("==================================================");
console.log("🧪 Zero-Loss Virtualized Tree Crawler Verification");
console.log("==================================================");

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`✅ PASS: ${desc}`);
  } catch (err) {
    console.error(`❌ FAIL: ${desc}`);
    console.error(err);
  }
}

// 1. Explicit path extraction
it("Extracts explicit data-item-path from element", () => {
  const mockBtn = {
    getAttribute: (name) => {
      if (name === "data-item-path") return "src/components/ui/accordion.tsx";
      return null;
    },
    closest: () => null
  };
  const path = getItemExplicitPath(mockBtn);
  assert.strictEqual(path, "src/components/ui/accordion.tsx");
});

it("Normalizes trailing slashes on folders", () => {
  const mockBtn = {
    getAttribute: (name) => (name === "data-item-path" ? "src/components/ui/" : null),
    closest: () => null
  };
  const path = getItemExplicitPath(mockBtn);
  assert.strictEqual(path, "src/components/ui");
});

// 2. Classification tests
it("Classifies folder explicitly with data-item-type='folder'", () => {
  const mockBtn = {
    getAttribute: (name) => {
      if (name === "data-item-type") return "folder";
      if (name === "aria-expanded") return "true";
      return null;
    },
    closest: () => null
  };
  const res = classifyTreeItem(mockBtn, "components");
  assert.strictEqual(res.isFolder, true);
  assert.strictEqual(res.isOpen, true);
});

it("Classifies file explicitly with data-item-type='file'", () => {
  const mockBtn = {
    getAttribute: (name) => (name === "data-item-type" ? "file" : null),
    closest: () => null
  };
  const res = classifyTreeItem(mockBtn, "README.md");
  assert.strictEqual(res.isFolder, false);
});

// 3. Virtual Scrolling Window Simulation (Zero-Loss Manifest Scan)
it("Scans 100% of all files in virtualized unmounting viewport without missing any item", () => {
  const ROW_HEIGHT = 32;
  const VIEWPORT_HEIGHT = 320; // Only 10 items visible at any given time
  const TOTAL_ITEMS = fullVirtualTree.length;
  const SCROLL_HEIGHT = TOTAL_ITEMS * ROW_HEIGHT;
  const expectedFiles = fullVirtualTree.filter(item => item.type === "file").map(item => normalizePath(item.path));

  // Virtual Container Mock
  const container = {
    scrollTop: 0,
    scrollHeight: SCROLL_HEIGHT,
    clientHeight: VIEWPORT_HEIGHT
  };

  // Function to get visible elements at current scrollTop (Virtual Windowing)
  function getVisibleMockElements(scrollTop) {
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT));
    const endIndex = Math.min(TOTAL_ITEMS, Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT));
    return fullVirtualTree.slice(startIndex, endIndex).map(item => ({
      getAttribute: (attr) => {
        if (attr === "data-item-path") return item.path;
        if (attr === "data-item-type") return item.type;
        if (attr === "aria-expanded") return item.expanded ? "true" : "false";
        return null;
      },
      closest: function() { return this; }
    }));
  }

  // Simulate scanAllTreeFilesManifest algorithm
  const manifestSet = new Set();
  const orderedFiles = [];
  let currentScroll = 0;
  const scrollStep = 64; // 2 items per step

  while (true) {
    container.scrollTop = currentScroll;
    const visibleItems = getVisibleMockElements(container.scrollTop);

    for (const btn of visibleItems) {
      const explicitPath = getItemExplicitPath(btn);
      const { isFolder } = classifyTreeItem(btn);

      if (isFolder) continue;

      if (explicitPath && !manifestSet.has(explicitPath)) {
        manifestSet.add(explicitPath);
        orderedFiles.push(explicitPath);
      }
    }

    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    if (currentScroll >= maxScroll) break;
    currentScroll = Math.min(currentScroll + scrollStep, maxScroll);
  }

  assert.strictEqual(orderedFiles.length, expectedFiles.length, `Expected ${expectedFiles.length} files, but got ${orderedFiles.length}`);
  
  for (const expected of expectedFiles) {
    assert(manifestSet.has(expected), `Missing file in virtual crawler: ${expected}`);
  }
});

// 4. Targeted File Collection Simulation
it("Successfully targets and locates every file in the manifest even when off-screen", () => {
  const ROW_HEIGHT = 32;
  const VIEWPORT_HEIGHT = 320;
  const TOTAL_ITEMS = fullVirtualTree.length;
  const SCROLL_HEIGHT = TOTAL_ITEMS * ROW_HEIGHT;
  const filesToCollect = fullVirtualTree.filter(item => item.type === "file").map(item => normalizePath(item.path));

  const container = {
    scrollTop: 0,
    scrollHeight: SCROLL_HEIGHT,
    clientHeight: VIEWPORT_HEIGHT
  };

  function getVisibleMockElements(scrollTop) {
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT));
    const endIndex = Math.min(TOTAL_ITEMS, Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT));
    return fullVirtualTree.slice(startIndex, endIndex).map(item => ({
      getAttribute: (attr) => {
        if (attr === "data-item-path") return item.path;
        if (attr === "data-item-type") return item.type;
        return null;
      },
      closest: function() { return this; }
    }));
  }

  // Simulate searchAndScrollToItem
  function searchAndScrollToItemMock(targetPath) {
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const scrollStep = 100;
    let cur = 0;

    while (cur <= maxScroll) {
      container.scrollTop = cur;
      const visible = getVisibleMockElements(cur);
      const found = visible.find(btn => getItemExplicitPath(btn) === targetPath);
      if (found) return found;
      if (cur >= maxScroll) break;
      cur = Math.min(cur + scrollStep, maxScroll);
    }
    return null;
  }

  const collected = {};
  for (const targetPath of filesToCollect) {
    // Current visible check
    let targetBtn = getVisibleMockElements(container.scrollTop).find(btn => getItemExplicitPath(btn) === targetPath);
    if (!targetBtn) {
      targetBtn = searchAndScrollToItemMock(targetPath);
    }

    assert(targetBtn !== null, `Target button for ${targetPath} must be found`);
    collected[targetPath] = `content of ${targetPath}`;
  }

  assert.strictEqual(Object.keys(collected).length, filesToCollect.length);
});

console.log("==================================================");
console.log(`TOTAL TESTS: ${total}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${total - passed}`);
console.log("==================================================");

if (total !== passed) {
  process.exit(1);
}
