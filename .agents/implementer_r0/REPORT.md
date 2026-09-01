# Lovable Code Downloader - 구현 및 검증 보고서 (v1.2.1)

## 1. 개요 및 근본 원인 분석 (Root Cause Analysis)

기존 v1.2.0 버전에서 발생했던 **"루트 레벨 12개 파일만 다운로드되고 서브폴더(.lovable, public, src 및 모든 하위 디렉터리) 파일들이 누락되는 현상"**의 원인은 다음과 같이 3가지 복합적 요인에 의해 발생했습니다:

1. **React State 대량 추출 조기 종료 버그**:
   - Lovable 프로젝트 로드 시 TanStack Query / React State에는 초기 부트스트랩 템플릿 파일(루트 설정 파일 + App.tsx 등 약 12개)만 로드되어 있습니다.
   - 기존 코드에서는 이 12개 파일만으로 `validateProjectFiles` 검증을 통과하여, 파일 트리 순회를 즉시 중단하고 12개 파일만 ZIP으로 패키징했습니다.
2. **폴더 확장 중복 클릭(Double Toggle) 이슈**:
   - 트리 내 폴더 확장 시 `chevronOrSvg.dispatchEvent(...)`와 `btn.click()`이 동시에 호출되어, 폴더가 열리자마자 즉시 다시 닫히는 현상이 발생했습니다.
   - 또한 `getAllTreeElements`에서 `[role='treeitem']` 컨테이너와 내부 `<button>`이 중복 수집되어 같은 행에 2번 이상 클릭이 발생하는 문제가 있었습니다.
3. **`.lovable` 및 점(.) 시작 폴더의 파일 오판단**:
   - `/\.[a-zA-Z0-9_-]+$/.test(".lovable")` 정규식이 `true`를 반환하여 `.lovable` 폴더가 확장자 있는 일반 파일로 오판단되어 폴더 확장이 이루어지지 않았습니다.

---

## 2. 주요 개선 및 수정 사항

### R1. 파일 트리 전수 순회 및 폴더 확장 로직 수정
- **단일 결정론적 클릭(Single Deterministic Click)**:
  - `expandAllTreeFolders()`에서 중복 이벤트 발송을 제거하고, 닫힌 폴더 버튼(`btn.click()`)만 단일 실행 후 확장 여부(`classifyTreeItem`)를 재확인하도록 개선.
- **트리 요소 중복 제거(Deduplication)**:
  - `getAllTreeElements()`에서 상위 컨테이너와 하위 클릭 요소를 필터링하고, 동일한 Y 좌표(Visual Row)를 점유하는 중복 요소를 제거하여 각 행이 정확히 1회만 처리되도록 보장.
- **가상화 스크롤 컨테이너 전수 탐색**:
  - `getTreeScrollContainer()`를 통해 Radix Scroll Area 및 오버플로우 컨테이너를 정확히 감지하고, 상단부터 하단까지 부드러운 스텝 스크롤을 수행하여 화면 밖의 가상화 요소까지 빠짐없이 탐색.

### R2. 트리 레벨(Depth) 및 파일 경로(Path) 스택 재구성
- **정밀 Depth 계산 (`getItemLevel`)**:
  - `aria-level`, `data-depth`, `data-level`, CSS 변수(`--depth`, `--level`), Tailwind 들여쓰기 클래스(`pl-*`, `ml-*`), 텍스트 오프셋 버킷팅을 종합 적용하여 정확한 정수 깊이 레벨 계산.
- **경로 스택(`pathStack`) 관리 강화**:
  - `while (pathStack.length > 0 && pathStack[pathStack.length - 1].level >= level) pathStack.pop();`
  - `src/components/ui/accordion.tsx`, `src/routes/__root.tsx`, `.lovable/project.json`, `public/favicon.ico` 등 전체 계층형 상대 경로 완벽 복원.
- **파일/폴더 판별자(`classifyTreeItem`) 고도화**:
  - `Dockerfile`, `LICENSE`, `Makefile`, `.gitignore`, `.env.local` 등 확장자 없는 특수 파일과 `.lovable`, `.github` 등 점으로 시작하는 설정 폴더를 정확히 분류.

### R3. 무손실 코드 추출 및 다양한 파일 포맷 처리
- **하이브리드 캐시 + 전수 순회 구조**:
  - React State 사전 스캔 데이터를 파일 캐시로 활용하되, 파일 트리의 50개 이상 전체 파일을 누락 없이 전수 순회하여 캐시 미스 파일은 CodeMirror 6 버퍼/에디터에서 직접 추출.
- **에디터 렌더링 동기화 (`waitForEditorToLoadFile`)**:
  - 파일 클릭 후 활성 탭 및 브레드크럼이 해당 파일로 변경될 때까지 대기하여 이전 파일 내용이 복사되는 레이스 컨디션 차단.
- **바이너리 및 이미지 자산 처리**:
  - `.ico`, `.png`, `.jpg`, `.svg` 등 에셋 파일은 `Blob`/`ArrayBuffer`/SVG 문자열로 안전하게 추출하여 ZIP에 패키징.

---

## 3. 수정된 파일 목록

1. `content.js`: 트리 탐색, 폴더 확장, 경로 스택 관리, 에디터 동기화 및 ZIP 생성 엔진 전면 개편.
2. `injected.js`: CodeMirror 6 EditorView 버퍼 추출, Monaco 모델 스캔, React Query/Fiber 캐시 스캔 개선.
3. `manifest.json`: 버전 1.2.1 업데이트.
