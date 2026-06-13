# 게임사이트

웹 기반 미니 게임 모음입니다. 배포 사이트: https://qorjiwon-games.vercel.app/

## 프로젝트 구조

```
Games/
├── src/       ← 프론트 (React + Vite)
├── api/       ← 백엔드 (Vercel 서버리스 함수)
├── public/
└── ...
```

## 온라인(렉시오) 아키텍처

게임 진행은 **PeerJS 기반 P2P**(호스트 ↔ 참가자 직접 통신)이고, `api/`가
**공개 방 목록**과 **전적/랭킹**만 담당합니다.

**push 한 번으로 프론트 + API가 Vercel에 함께 배포됩니다.**

- 호스트가 공개 방 생성 시 서버에 등록 → 20초마다 heartbeat로 TTL(45초) 갱신
- 게임 시작/퇴장 시 목록에서 제거
- 세션 종료 시 호스트가 결과를 기록해 랭킹 갱신

### 로컬 개발

프론트만 (로비/랭킹 비활성):

```bash
npm run dev
```

프론트 + API 함께:

```bash
npx vercel dev
# 또는: npm run dev:vercel
```

### Vercel 환경변수

Upstash Redis를 Vercel 프로젝트에 연결하거나, 직접 등록하세요.

```
UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-rest-token>
```

Vercel 대시보드 → Storage → **Upstash for Redis** 연동 시 자동 주입됩니다.

Redis 미설정 시 로비/랭킹 UI는 자동으로 숨겨지고, 방 코드·초대 링크 기반 P2P만
동작합니다.
