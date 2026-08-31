# ⚡ Lovable Code Downloader (Chrome Extension)

<p align="center">
  <img src="icons/icon128.png" alt="Lovable Code Downloader Logo" width="96" height="96" />
</p>

<p align="center">
  <strong>Lovable(lovable.dev) 프로젝트의 전체 소스코드를 원클릭으로 ZIP 파일로 다운로드 (Unofficial Helper)</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Version-1.1.3-brightgreen?style=flat-square" alt="Version 1.1.3" />
  <img src="https://img.shields.io/badge/License-MIT-orange?style=flat-square" alt="License MIT" />
  <img src="https://img.shields.io/badge/Type-Unofficial%20Tool-lightgrey?style=flat-square" alt="Unofficial Tool" />
</p>

---

## ⚠️ 면책 조항 (Disclaimer)

> [!IMPORTANT]
> - **비공식 도구 (Unofficial Tool)**: 본 확장 프로그램은 개인이 개발한 비공식(Unofficial) 오픈소스 도구이며, **Lovable(`lovable.dev`) 또는 해당 운영사와 공식적인 제휴, 후원, 보증 관계가 없습니다.**
> - **코드 소유권**: Lovable의 서비스 약관에 따라, 플랫폼에서 생성된 프로젝트 소스 코드 및 AI Output의 소유권은 해당 프로젝트의 생성자(사용자)에게 있습니다.
> - **데이터 보안**: 본 프로그램은 외부 서버와 통신하지 않으며, 사용자가 정당하게 접근 권한을 가진 로컬 브라우저 화면의 데이터만을 클라이언트 메모리에서 즉시 ZIP으로 패키징합니다.
> - **상표권 안내**: 'Lovable' 및 관련 상표, 로고는 해당 권리자의 자산입니다.

---

## 📖 개요

**Lovable Code Downloader**는 [Lovable](https://lovable.dev)에서 생성된 웹 프로젝트의 디렉토리 구조와 전체 소스 코드를 클릭 한 번으로 `.zip` 압축 파일로 패키징하여 다운로드할 수 있는 크롬 확장 프로그램(Chrome Extension)입니다.

복잡한 중첩 폴더 구조부터 에디터 내 소스코드까지 빠짐없이 안전하게 추출합니다.

---

## ✨ 주요 기능

- ⚡ **하이브리드 다중 추출 엔진 (Multi-Tier Extraction)**:
  - **1차 (초고속 캐시 추출)**: React Query / TanStack Query 내부 캐시 상태를 직접 스캔하여 프로젝트 전체를 즉시 수집
  - **2차 (에디터 인스턴스 탐색)**: Monaco Editor 및 React Fiber 모델에 접근하여 실시간 버퍼 텍스트 추출
  - **3차 (DOM 지능형 탐색)**: 파일 트리 DOM을 순회하며 지연 로딩(Lazy loading)된 파일 및 폴더를 자동으로 펼치고 수집
- 📁 **완벽한 디렉토리 구조 보존**: `src/components/ui/button.tsx`, `public/favicon.ico` 등 중첩된 폴더 구조를 그대로 유지하여 ZIP 생성
- 🎯 **원클릭 UI 지원**:
  - Lovable 웹페이지 우측 하단 상시 플로팅 액션 버튼 (FAB)
  - 크롬 툴바 팝업 메뉴를 통한 간편 실행
- 📊 **실시간 진행률 및 로그 모달**: 현재 수집 중인 파일, 총 파일 수, 진행 바(ProgressBar) 및 실시간 로그 모니터링 제공
- 🔒 **100% 로컬 처리 & 개인정보 보호**: 추출된 코드는 외부 서버로 절대 전송되지 않으며, 사용자의 브라우저 로컬 메모리에서 즉시 ZIP으로 압축 후 다운로드
- 🧩 **Manifest V3 호환**: 최신 크롬 보안 정책을 준수하며 JSZip 라이브러리를 오프라인으로 번들링

---

## 🛠 설치 방법 (Chrome 개발자 모드)

1. **저장소 클론 또는 다운로드**
   ```bash
   git clone https://github.com/your-username/lovable-code-down.git
   ```
   *(또는 GitHub에서 ZIP으로 다운로드 후 압축 해제)*

2. **Chrome 브라우저 확장 프로그램 관리자 열기**
   - Chrome 주소창에 다음을 입력하고 이동합니다:
     ```text
     chrome://extensions
     ```
3. **개발자 모드 활성화**
   - 페이지 우측 상단의 **`개발자 모드` (Developer mode)** 토글 스위치를 켭니다.
4. **확장 프로그램 로드**
   - 좌측 상단의 **`압축해제된 확장 프로그램을 로드합니다.` (Load unpacked)** 버튼을 클릭합니다.
   - 다운로드/클론한 `lovable-code-down` 폴더를 선택합니다.
5. **설치 완료**
   - 상단 툴바 확장 프로그램 목록에 **Lovable Code Downloader** 아이콘이 추가됩니다.

---

## 🚀 사용 방법

1. **Lovable 프로젝트 접속**
   - [Lovable](https://lovable.dev)에서 작업 중인 프로젝트 페이지(`https://lovable.dev/projects/...`)로 이동합니다.
2. **코드(Code) 탭 활성화**
   - 화면 상단에서 **`</> 코드` (Code)** 탭을 클릭하여 좌측 파일 트리 뷰어가 표시되도록 합니다.
3. **다운로드 실행**
   - 화면 우측 하단의 **`[코드 전체 다운로드 (ZIP)]`** 플로팅 버튼을 클릭하거나,
   - 크롬 툴바의 **확장 프로그램 아이콘 클릭 -> `전체 소스코드 ZIP 다운로드`** 버튼을 클릭합니다.
4. **ZIP 파일 저장 완료**
   - 추출 진행 모달에서 진행 상황이 표시되며, 완료되면 `[프로젝트명].zip` 파일이 로컬 다운로드 폴더로 자동 저장됩니다.

---

## 📁 프로젝트 구조

```text
lovable-code-down/
├── manifest.json         # Chrome Extension Manifest V3 설정 파일
├── content.js            # 웹페이지 내 UI 주입, 파일 트리 순회 및 ZIP 패키징 엔진
├── content.css           # 플로팅 버튼 및 프로그레스 모달 스타일
├── injected.js           # 메인 월드(Page Context) 주입 스크립트 (React State/Monaco/인터셉트)
├── background.js         # 백그라운드 서비스 워커 (다운로드 및 탭 통신)
├── lib/
│   └── jszip.min.js      # JSZip 압축 라이브러리 (로컬 번들)
├── popup/
│   ├── popup.html        # 확장 프로그램 팝업 UI
│   ├── popup.css         # 팝업 스타일
│   └── popup.js          # 팝업 이벤트 핸들러
└── icons/
    ├── icon16.png        # 16x16 툴바 아이콘
    ├── icon48.png        # 48x48 확장 프로그램 목록 아이콘
    └── icon128.png       # 128x128 웹스토어/상세 아이콘
```

---

## 💡 문제 해결 & 팁 (FAQ)

- **Q. 파일이 일부만 다운로드되거나 수집이 멈추는 경우**
  - Lovable 페이지에서 **`</> 코드` (Code)** 탭이 열려 있는지 확인하세요. 파일 트리가 DOM에 렌더링되어 있어야 안정적으로 수집할 수 있습니다.
  - 모달의 `중지` 버튼을 누른 후 다시 다운로드를 시도해보세요.
- **Q. 다운로드 파일 이름은 어떻게 정해지나요?**
  - 페이지 상단의 Lovable 프로젝트 제목을 기반으로 생성되며, 제목을 찾을 수 없는 경우 `lovable_[프로젝트ID].zip`으로 저장됩니다.

---

## 📄 라이선스

This project is licensed under the [MIT License](LICENSE).