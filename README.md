# Notion Review Board

Notion 데이터베이스의 페이지를 문서 단위로 복습하는 Electron 데스크톱 앱입니다.

## 기술 구성

- Electron
- Vue 3
- TypeScript
- Vite / electron-vite
- SQLite, Notion API, FSRS는 다음 구현 단계에서 연결

## 시작하기

```bash
npm install
npm run dev
```

## 주요 명령어

```bash
npm run dev          # 개발 모드 실행
npm run typecheck    # TypeScript 검사
npm run lint         # ESLint 검사
npm run format       # Prettier 포맷
npm run build        # 배포용 빌드
```

## 디렉터리

```text
docs/                       제품 문서
src/main/                   Electron 메인 프로세스
src/main/services/          SQLite, Notion, FSRS 서비스
src/preload/                안전한 IPC 브리지
src/renderer/               Vue 사용자 화면
```

제품 요구사항은 [PRD v0.1](./docs/PRD-v0.1.md)을 참고하세요.

## 보안 원칙

- Notion 토큰과 SQLite 접근은 메인 프로세스에서만 처리합니다.
- 렌더러에서는 Node.js API를 직접 사용하지 않습니다.
- 메인 프로세스 기능은 preload의 제한된 API를 통해서만 노출합니다.
- 실제 비밀값이 들어간 `.env` 파일은 Git에 포함하지 않습니다.
