# Original User Request

## 2026-09-01T16:27:27Z

This is a single self-contained fix; keep it small and focused.

Lovable 소스 코드 추출기(Lovable Code Downloader) Chrome 확장 프로그램에서 루트 레벨의 12개 파일만 다운로드되고 폴더 하위(.lovable, public, src 및 모든 하위 디렉터리)의 파일들이 누락되는 버그를 완벽하게 수정합니다.

Working directory: c:\Users\dandycode\Documents\GitHub\lovable-code-down
Integrity mode: development

## Requirements

### R1. 파일 트리 전수 순회 및 폴더 확장 로직 수정
- 트리 내에 존재하는 모든 폴더(`.lovable`, `public`, `src`, `src/assets`, `src/components/ui`, `src/hooks`, `src/lib`, `src/routes` 등)를 누락 없이 순회하고 확장해야 합니다.
- 폴더 확장 시 chevron SVG와 버튼에 중복 클릭 이벤트가 발생하여 열렸던 폴더가 즉시 닫히는 현상(Double toggle issue)을 방지하고, 단일한 확실한 방식으로 폴더를 열도록 개선합니다.
- 가상화 스크롤(virtualized scroll) 컨테이너 및 섀도우 DOM / Radix Tree 구조를 정확히 감지하여 스크롤 시 화면 밖의 요소까지 빠짐없이 탐색하도록 수정합니다.

### R2. 트리 레벨(Depth) 및 파일 경로(Path) 스택 재구성
- 각 트리 아이템의 들여쓰기(padding, margin, depth 속성 등)를 기반으로 부모-자식 관계를 정확히 판별하여 `pathStack`을 관리합니다.
- `src/components/ui/accordion.tsx`, `src/routes/__root.tsx`, `.lovable/project.json`, `public/favicon.ico` 등 모든 파일이 온전한 계층형 상대 경로로 ZIP 파일에 저장되도록 수정합니다.
- 파일 및 폴더 구분(classifier) 시 확장자가 없는 파일(예: Dockerfile, .gitignore 등)과 폴더를 오판하지 않도록 판별 알고리즘을 강화합니다.

### R3. 무손실 코드 추출 및 다양한 파일 포맷 처리
- 파일 클릭 후 에디터(CodeMirror 6, Monaco, React 상태 등)가 해당 파일의 내용을 로드할 때까지 대기하는 동기화 로직을 보강하여 이전 파일 내용이 복사되는 레이스 컨디션을 방지합니다.
- 텍스트 파일(TSX, TS, CSS, JSON, MD 등)뿐만 아니라 이미지 및 바이너리 자산(.ico, .jpg, .png 등)도 적절히 처리하여 ZIP 파일에 누락 없이 패키징합니다.

## Acceptance Criteria

### 트리 수집 및 ZIP 다운로드 검증
- [ ] 모든 디렉터리 및 하위 파일(총 50개 이상의 전체 프로젝트 파일)이 누락 없이 모두 수집됨
- [ ] 수집된 파일들이 올바른 디렉터리 경로 구조(`src/components/ui/...` 등)를 유지하며 ZIP 압축 파일에 포함됨
- [ ] 폴더 확장 및 탐색 중 루프에 빠지거나 중복 토글로 닫히는 현상이 발생하지 않음
- [ ] 에디터 버퍼 동기화 대기가 정상 작동하여 파일별 고유 소스코드가 온전하게 수집됨
- [ ] 자바스크립트 문법 오류 및 확장 프로그램 런타임 에러가 없음
