# 클래스룸 마피아 Firebase 배포용 구조

## 폴더 구성
- `public/index.html`
- `public/style.css`
- `public/app.js`
- `firebase.json`
- `database.rules.json`

## 빠른 배포 순서
1. Firebase CLI 설치
2. 이 폴더로 이동
3. `firebase login`
4. `firebase use classroommafia`
5. `firebase deploy`

## 주의
현재 `database.rules.json` 은 테스트용으로 매우 느슨합니다.
실서비스 전에는 반드시 교사 권한 검증, 방장 권한 제한, 인증(Auth) 연동을 권장합니다.

## 이번 버전에 포함된 것
- 태블릿 최적화 UI
- 교사용 방 종료/재생성 가능
- 학생 자동 재접속 복구 강화
- 역할 공개 오버레이
- 사망 연출 오버레이
- Firebase Realtime Database 실시간 동기화

## 다음 확장 추천
- Firebase Auth 익명 로그인 추가
- 교사 전용 관리자 비밀번호
- 낮 투표 결과 자동 집계 고도화
- 역할별 세부 승리 조건 판정
