# 뷰티클래스 MVP V1 개발 완료 문서

> **문서 버전**: 1.0.0
> **작성일**: 2026-01-01
> **프로젝트**: 뷰티클래스 - 온라인 뷰티 교육 플랫폼

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [프로젝트 구조](#3-프로젝트-구조)
4. [데이터베이스 스키마](#4-데이터베이스-스키마)
5. [API 라우트](#5-api-라우트)
6. [페이지별 상세 설명](#6-페이지별-상세-설명)
7. [컴포넌트 상세 설명](#7-컴포넌트-상세-설명)
8. [환경 변수 설정](#8-환경-변수-설정)
9. [사용자 가이드](#9-사용자-가이드)
10. [배포 가이드](#10-배포-가이드)

---

## 1. 프로젝트 개요

### 1.1 서비스 소개
뷰티클래스는 메이크업, 헤어, 네일 등 뷰티 분야의 온라인 교육 플랫폼입니다. 강사가 동영상 강의를 업로드하고, 학생이 구매 후 수강할 수 있습니다. 또한 Jitsi Meet을 활용한 실시간 라이브 강의 기능도 제공합니다.

### 1.2 핵심 기능
- **회원 시스템**: 이메일/Google 소셜 로그인
- **강의 시스템**: 강의 등록, 구매, 수강
- **라이브 강의**: Jitsi Meet 기반 실시간 강의
- **결제 시스템**: PortOne 연동 결제
- **리뷰 시스템**: 강의 평점 및 리뷰
- **관리자 시스템**: 전체 플랫폼 관리

### 1.3 사용자 역할
| 역할 | 설명 |
|------|------|
| `student` | 일반 수강생 (기본 역할) |
| `instructor` | 강사 (강의 생성 가능) |
| `admin` | 관리자 (전체 관리 권한) |

---

## 2. 기술 스택

### 2.1 프론트엔드
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.1.1 | React 프레임워크 (App Router) |
| React | 19.2.3 | UI 라이브러리 |
| TypeScript | 5.x | 타입 안전성 |
| Tailwind CSS | 4.x | 스타일링 |

### 2.2 백엔드 & 인프라
| 기술 | 용도 |
|------|------|
| Supabase | 데이터베이스 (PostgreSQL), 인증, RLS |
| Cloudflare Stream | 동영상 호스팅 및 스트리밍 |
| Cloudflare Images | 이미지 호스팅 (썸네일) |
| PortOne | 결제 처리 |
| Jitsi Meet | 라이브 화상 강의 |
| Vercel | 배포 플랫폼 |

### 2.3 주요 라이브러리
```json
{
  "@jitsi/react-sdk": "라이브 화상 강의",
  "@portone/browser-sdk": "결제 처리",
  "@supabase/supabase-js": "Supabase 클라이언트",
  "jose": "JWT 토큰 처리 (비디오 서명)",
  "tus-js-client": "대용량 파일 업로드 (Cloudflare Stream)"
}
```

---

## 3. 프로젝트 구조

```
beautyclass/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # 루트 레이아웃
│   ├── page.tsx                 # 홈페이지 (강의 목록)
│   ├── login/                   # 로그인 페이지
│   ├── signup/                  # 회원가입 페이지
│   ├── courses/                 # 강의 관련
│   │   ├── page.tsx            # 강의 목록 (/ 로 리다이렉트)
│   │   └── [id]/               # 강의 상세
│   │       ├── page.tsx        # 강의 상세 페이지
│   │       └── lessons/[lessonId]/  # 레슨 수강 페이지
│   ├── live/                    # 라이브 강의 (학생용)
│   │   ├── page.tsx            # 라이브 목록
│   │   └── [id]/page.tsx       # 라이브 시청
│   ├── my-courses/              # 내 강의 (구매한 강의)
│   ├── mypage/                  # 마이페이지 (프로필)
│   ├── instructor/              # 강사 센터
│   │   ├── layout.tsx          # 강사 레이아웃 (사이드바)
│   │   ├── dashboard/          # 강사 대시보드
│   │   ├── courses/            # 강의 관리
│   │   ├── live/               # 라이브 관리
│   │   ├── revenue/            # 수익 관리
│   │   ├── reviews/            # 리뷰 관리
│   │   └── apply/              # 강사 신청
│   ├── admin/                   # 관리자
│   │   ├── layout.tsx          # 관리자 레이아웃
│   │   ├── page.tsx            # 관리자 대시보드
│   │   ├── users/              # 회원 관리
│   │   ├── courses/            # 강의 관리
│   │   ├── payments/           # 결제 관리
│   │   ├── revenue/            # 수익 관리
│   │   └── reviews/            # 리뷰 관리
│   ├── auth/                    # 인증
│   │   └── callback/route.ts   # OAuth 콜백
│   └── api/                     # API 라우트
│       ├── video/              # 비디오 관련 API
│       ├── image/              # 이미지 업로드 API
│       ├── live/               # 라이브 관련 API
│       └── payment/            # 결제 관련 API
├── components/                   # 재사용 컴포넌트
├── lib/                         # 유틸리티
│   └── supabase.ts             # Supabase 클라이언트
├── types/                       # TypeScript 타입 정의
├── supabase/                    # Supabase 마이그레이션
│   └── migrations/             # SQL 마이그레이션 파일
└── public/                      # 정적 파일
```

---

## 4. 데이터베이스 스키마

### 4.1 테이블 구조

#### profiles (사용자 프로필)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'student',  -- 'student' | 'instructor' | 'admin'
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### courses (강의)
```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail TEXT,
  instructor UUID REFERENCES auth.users(id),
  price INTEGER DEFAULT 0,
  category TEXT,
  level TEXT,  -- '입문' | '중급' | '고급'
  duration TEXT,
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### chapters (챕터)
```sql
CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### lessons (레슨/회차)
```sql
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  video_url TEXT,        -- Cloudflare Stream Video ID
  note TEXT,
  order_index INTEGER DEFAULT 0,
  is_preview BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### purchases (구매 내역)
```sql
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  course_id UUID REFERENCES courses(id),
  amount INTEGER DEFAULT 0,
  payment_id TEXT,       -- PortOne 결제 ID
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### reviews (리뷰)
```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  course_id UUID REFERENCES courses(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  content TEXT,
  instructor_reply TEXT,
  replied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### tags (태그)
```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,  -- 태그 카테고리 (메이크업, 스킨케어 등)
  name TEXT NOT NULL,      -- 태그 이름
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### course_tags (강의-태그 연결)
```sql
CREATE TABLE course_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE
);
```

#### live_sessions (라이브 세션)
```sql
CREATE TABLE live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES auth.users(id),
  course_id UUID REFERENCES courses(id),  -- NULL이면 독립 라이브
  title TEXT NOT NULL,
  description TEXT,
  thumbnail TEXT,
  scheduled_at TIMESTAMP,    -- NULL이면 즉시 시작
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  status TEXT DEFAULT 'scheduled',  -- 'scheduled' | 'live' | 'ended'
  access_type TEXT DEFAULT 'public',  -- 'public' | 'paid'
  room_name TEXT UNIQUE,     -- Jitsi 방 이름 (UUID)
  max_participants INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4.2 RLS 정책 요약

| 테이블 | 정책 |
|--------|------|
| profiles | 본인 프로필만 수정 가능, 조회는 누구나 |
| courses | published=true인 강의는 누구나 조회, 강사는 본인 강의만 수정 |
| lessons | 강의 소유자만 수정, 조회는 강의 접근 권한에 따름 |
| purchases | 본인 구매 내역만 조회 |
| reviews | 로그인 사용자만 작성, 강사는 본인 강의 리뷰에만 답글 |

---

## 5. API 라우트

### 5.1 비디오 API (`/api/video/`)

#### POST `/api/video/upload`
- **용도**: Cloudflare Stream에 비디오 업로드 URL 생성
- **인증**: 강사/관리자만
- **요청**: 없음
- **응답**: `{ uploadUrl, videoId }`

#### POST `/api/video/token`
- **용도**: 비디오 재생을 위한 서명된 토큰 생성
- **인증**: 구매자 또는 미리보기 레슨
- **요청**: `{ videoId, lessonId }`
- **응답**: `{ token }`

#### DELETE `/api/video/delete`
- **용도**: Cloudflare Stream에서 비디오 삭제
- **인증**: 강사/관리자만
- **요청**: `{ videoId }` 또는 `{ videoIds: [] }`

### 5.2 이미지 API (`/api/image/`)

#### POST `/api/image/upload`
- **용도**: Cloudflare Images에 썸네일 업로드
- **인증**: 강사/관리자만
- **요청**: FormData (file)
- **응답**: `{ imageId, imageUrl }`

### 5.3 라이브 API (`/api/live/`)

#### POST `/api/live/create`
- **용도**: 라이브 세션 생성
- **인증**: 강사/관리자만
- **요청**: `{ title, description?, course_id?, scheduled_at?, access_type }`

#### GET `/api/live/list`
- **용도**: 라이브 세션 목록 조회
- **쿼리**: `?status=live&instructor_id=...`

#### GET `/api/live/[id]`
- **용도**: 라이브 세션 상세 조회

#### POST `/api/live/[id]/start`
- **용도**: 라이브 시작 (status → 'live')

#### POST `/api/live/[id]/end`
- **용도**: 라이브 종료 (status → 'ended')

#### POST `/api/live/[id]/join`
- **용도**: 라이브 참여 권한 확인
- **응답**: `{ allowed, joinInfo?, reason? }`

### 5.4 결제 API (`/api/payment/`)

#### POST `/api/payment/verify`
- **용도**: PortOne 결제 검증 및 구매 처리
- **요청**: `{ paymentId, courseId }`

#### POST `/api/payment/free-enroll`
- **용도**: 무료 강의 등록
- **요청**: `{ courseId }`

### 5.5 인증 API (`/auth/`)

#### GET `/auth/callback`
- **용도**: OAuth 로그인 콜백 처리 (Google)
- Supabase → 프로필 생성 → 홈으로 리다이렉트

---

## 6. 페이지별 상세 설명

### 6.1 공개 페이지

#### `/` (홈페이지)
**파일**: `app/page.tsx`

- **기능**:
  - 강의 목록 표시 (published=true인 강의만)
  - 태그 기반 필터링
  - 검색 기능 (제목, 설명, 태그, 카테고리)
  - Hero 섹션, 통계, 기능 소개

- **주요 로직**:
  ```typescript
  // 강의 로드 (태그 필터 적용)
  if (selectedTagId) {
    // course_tags 조인으로 필터링
  } else {
    // 전체 강의 조회
  }
  // 검색어 필터링 (클라이언트 사이드)
  ```

#### `/courses/[id]` (강의 상세)
**파일**: `app/courses/[id]/page.tsx`

- **기능**:
  - 강의 정보 표시 (썸네일, 제목, 설명, 가격)
  - 강사 정보 (프로필에서 full_name 조회)
  - 커리큘럼 표시 (챕터, 레슨 목록)
  - 구매 버튼 또는 수강하기 버튼
  - 리뷰 섹션

#### `/courses/[id]/lessons/[lessonId]` (레슨 수강)
**파일**: `app/courses/[id]/lessons/[lessonId]/page.tsx`

- **기능**:
  - 비디오 플레이어 (LessonVideoPlayer 컴포넌트)
  - 레슨 노트 표시
  - 다음/이전 레슨 네비게이션
  - 커리큘럼 사이드바

- **접근 제한**:
  - 구매자만 접근 가능
  - is_preview=true인 레슨은 누구나 접근 가능

#### `/live` (라이브 목록)
**파일**: `app/live/page.tsx`

- **기능**:
  - 예정/진행중 라이브 목록
  - 라이브 카드 (LiveSessionCard 컴포넌트)

#### `/live/[id]` (라이브 시청)
**파일**: `app/live/[id]/page.tsx`

- **기능**:
  - Jitsi Meet 플레이어 (시청자 모드)
  - 접근 권한 확인 (LiveAccessGuard 컴포넌트)
  - 세션 정보 표시

### 6.2 인증 페이지

#### `/login` (로그인)
**파일**: `app/login/page.tsx`

- Google 로그인 버튼
- 이메일/비밀번호 로그인 폼
- 회원가입 링크

#### `/signup` (회원가입)
**파일**: `app/signup/page.tsx`

- Google 회원가입 버튼
- 이메일 회원가입 폼
  - 이름 (필수)
  - 이메일
  - 비밀번호
  - 비밀번호 확인

### 6.3 사용자 페이지

#### `/my-courses` (내 강의)
**파일**: `app/my-courses/page.tsx`

- **기능**: 구매한 강의 목록 표시
- purchases 테이블에서 user_id로 조회

#### `/mypage` (마이페이지)
**파일**: `app/mypage/page.tsx`

- **기능**:
  - 프로필 정보 수정 (이름, 프로필 사진)
  - 계정 정보 표시

### 6.4 강사 페이지 (`/instructor/`)

**레이아웃**: `app/instructor/layout.tsx`
- 사이드바 네비게이션
- 강사/관리자만 접근 가능 (student는 `/instructor/apply`로 리다이렉트)

#### `/instructor/dashboard` (대시보드)
- **통계**: 총 강의 수, 총 수강생, 총 수익
- **최근 강의 목록**
- **빠른 액션 버튼**

#### `/instructor/courses` (강의 관리)
- 본인 강의 목록 (발행/미발행 탭)
- 새 강의 만들기 버튼

#### `/instructor/courses/new` (강의 생성)
**5단계 위저드 폼**:
1. 기본 정보 (제목, 카테고리, 난이도, 태그)
2. 커리큘럼 (챕터, 레슨, 비디오 업로드)
3. 상세 소개 (설명)
4. 썸네일 (이미지 업로드)
5. 가격 설정

#### `/instructor/courses/[id]` (강의 편집)
- 자동 저장 기능
- 커리큘럼 수정 (챕터/레슨 추가/삭제/순서변경)
- 썸네일 업로드
- 발행/발행취소
- 강의 삭제

#### `/instructor/live` (라이브 관리)
- 라이브 세션 목록 (예정/진행중/종료 탭)
- 새 라이브 만들기

#### `/instructor/live/create` (라이브 생성)
- 제목, 설명
- 연결 강의 선택 (선택사항)
- 예약 시간 또는 즉시 시작
- 접근 권한 (전체공개/유료)

#### `/instructor/live/[id]` (라이브 호스트)
- Jitsi Meet 플레이어 (호스트 모드)
- 라이브 시작/종료 버튼
- 참여자 수 표시
- 공유 링크

#### `/instructor/revenue` (수익 관리)
- 수익 통계 및 내역

#### `/instructor/reviews` (리뷰 관리)
- 본인 강의 리뷰 목록
- 답글 작성

#### `/instructor/apply` (강사 신청)
- student → instructor 역할 신청 폼

### 6.5 관리자 페이지 (`/admin/`)

**레이아웃**: `app/admin/layout.tsx`
- 관리자 사이드바
- admin 역할만 접근 가능

#### `/admin` (대시보드)
- 전체 통계 (회원 수, 강의 수, 총 결제액)

#### `/admin/users` (회원 관리)
- 회원 목록
- 역할 변경 (student/instructor/admin)

#### `/admin/courses` (강의 관리)
- 전체 강의 목록
- 강의 삭제

#### `/admin/payments` (결제 관리)
- 결제 내역 목록

#### `/admin/revenue` (수익 관리)
- 전체 수익 통계

#### `/admin/reviews` (리뷰 관리)
- 전체 리뷰 목록
- 리뷰 삭제

---

## 7. 컴포넌트 상세 설명

### 7.1 레이아웃 컴포넌트

#### `Navbar.tsx`
- **위치**: 모든 페이지 상단
- **기능**:
  - 로고, 네비게이션 링크
  - 라이브 링크 (빨간 점 애니메이션)
  - 로그인/회원가입 버튼 또는 프로필 드롭다운
  - 강사 센터 링크 (로그인 시)
- **주요 상태**:
  - `mounted`: hydration 오류 방지
  - `user`, `userProfile`: 로그인 상태

### 7.2 인증 컴포넌트

#### `GoogleLoginButton.tsx`
- Supabase Google OAuth 로그인 버튼
- `redirectTo` prop으로 로그인 후 이동 경로 지정

### 7.3 강의 컴포넌트

#### `CurriculumSection.tsx`
- 강의 커리큘럼 표시 (아코디언)
- 레슨 클릭 시 수강 페이지로 이동 또는 구매 유도

#### `PurchaseButton.tsx`
- 구매 버튼 (가격에 따라 무료등록/결제)
- PortOne 결제 연동
- 이미 구매한 경우 "수강하기" 표시

#### `ReviewSection.tsx`
- 리뷰 목록 및 작성 폼
- 별점 (1-5)
- 강사 답글 표시

### 7.4 비디오 컴포넌트

#### `VideoUploader.tsx`
- Cloudflare Stream TUS 업로드
- 드래그 앤 드롭 지원
- 업로드 진행률 표시

#### `LessonVideoPlayer.tsx`
- Cloudflare Stream 비디오 재생
- 서명된 토큰으로 접근 제어
- 구매 확인 로직

#### `VideoPlayerWithAuth.tsx`
- 인증된 비디오 플레이어 (레거시)

### 7.5 이미지 컴포넌트

#### `ThumbnailUploader.tsx`
- Cloudflare Images 업로드
- 드래그 앤 드롭 지원
- 미리보기 표시
- 권장 크기: 1280x720px

### 7.6 라이브 컴포넌트

#### `JitsiMeetPlayer.tsx`
- Jitsi Meet 임베드
- 호스트/시청자 모드 구분
- 호스트: 전체 도구 (녹화, 음소거 등)
- 시청자: 기본 도구만

#### `LiveAccessGuard.tsx`
- 라이브 참여 권한 확인
- 로딩/허용/거부 상태 표시

#### `LiveSessionCard.tsx`
- 라이브 세션 카드 UI
- 상태 배지 (예정/진행중/종료)

### 7.7 기타 컴포넌트

#### `TagSelector.tsx`
- 태그 선택 UI (카테고리별 그룹)
- 최소/최대 선택 개수 제한

#### `DeleteConfirmModal.tsx`
- 삭제 확인 모달
- 아이템 이름 입력 확인

#### `DevRoleSwitcher.tsx`
- 개발용 역할 전환 UI
- 프로덕션에서는 숨김 처리 필요

---

## 8. 환경 변수 설정

### 8.1 필수 환경 변수

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=xxxxx
CLOUDFLARE_API_TOKEN=xxxxx
CLOUDFLARE_STREAM_SIGNING_KEY_ID=xxxxx
CLOUDFLARE_STREAM_SIGNING_KEY_PEM="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

# PortOne (결제)
NEXT_PUBLIC_PORTONE_STORE_ID=xxxxx
PORTONE_API_SECRET=xxxxx
```

### 8.2 환경별 설정

#### 로컬 개발
- `.env.local` 파일에 환경 변수 설정

#### Vercel 배포
- Vercel Dashboard → Settings → Environment Variables
- `NEXT_PUBLIC_` 접두사 변수는 클라이언트에서 사용 가능

### 8.3 외부 서비스 설정

#### Supabase
1. Authentication → URL Configuration
   - Site URL: `https://your-domain.vercel.app`
   - Redirect URLs: `https://your-domain.vercel.app/auth/callback`

2. Authentication → Providers → Google
   - Client ID, Client Secret 설정

#### Google Cloud Console
1. OAuth 2.0 Client IDs
   - Authorized JavaScript origins: `https://your-domain.vercel.app`
   - Authorized redirect URIs: `https://xxxxx.supabase.co/auth/v1/callback`

#### PortOne
1. 결제 연동 → 허용 도메인 추가

---

## 9. 사용자 가이드

### 9.1 학생 사용 흐름

```
1. 회원가입/로그인
   └─ Google 로그인 또는 이메일 가입

2. 강의 탐색
   └─ 홈페이지에서 강의 검색/필터링
   └─ 강의 상세 페이지에서 커리큘럼, 리뷰 확인

3. 강의 구매
   └─ 무료 강의: "무료로 시작하기" 클릭
   └─ 유료 강의: 결제 진행 (PortOne)

4. 강의 수강
   └─ "내 강의" 메뉴에서 구매한 강의 확인
   └─ 레슨별 비디오 시청

5. 라이브 참여
   └─ "라이브" 메뉴에서 진행중인 강의 확인
   └─ 공개 라이브 또는 구매한 강의의 라이브 참여

6. 리뷰 작성
   └─ 수강 완료 후 별점 및 리뷰 작성
```

### 9.2 강사 사용 흐름

```
1. 강사 신청
   └─ "강사 센터" → 강사 신청서 작성
   └─ 관리자 승인 대기 (또는 자동 승인)

2. 강의 생성
   └─ 강사 센터 → 강의 관리 → 새 강의 만들기
   └─ 5단계 위저드로 강의 정보 입력
   └─ 비디오 업로드 (Cloudflare Stream)
   └─ 썸네일 업로드 (Cloudflare Images)
   └─ 발행하기

3. 라이브 진행
   └─ 강사 센터 → 라이브 강의 → 새 라이브
   └─ 예약 또는 즉시 시작
   └─ Jitsi Meet으로 실시간 강의

4. 수익 확인
   └─ 강사 센터 → 수익 관리
   └─ 구매 내역 및 총 수익 확인

5. 리뷰 관리
   └─ 강사 센터 → 리뷰 관리
   └─ 학생 리뷰에 답글 작성
```

### 9.3 관리자 사용 흐름

```
1. 회원 관리
   └─ 관리자 → 회원 관리
   └─ 역할 변경 (student/instructor/admin)

2. 강의 관리
   └─ 관리자 → 강의 관리
   └─ 전체 강의 목록 확인 및 삭제

3. 결제 관리
   └─ 관리자 → 결제 관리
   └─ 결제 내역 확인

4. 리뷰 관리
   └─ 관리자 → 리뷰 관리
   └─ 부적절한 리뷰 삭제
```

---

## 10. 배포 가이드

### 10.1 Vercel 배포

```bash
# 1. Git 커밋
git add .
git commit -m "Deploy MVP V1"
git push

# 2. Vercel 연동
# Vercel Dashboard에서 GitHub 저장소 연결

# 3. 환경 변수 설정
# Vercel Dashboard → Settings → Environment Variables
```

### 10.2 배포 체크리스트

- [ ] Supabase Site URL 변경 (`https://your-domain.vercel.app`)
- [ ] Supabase Redirect URLs 추가
- [ ] Google Cloud Console 도메인 추가
- [ ] PortOne 허용 도메인 추가
- [ ] Vercel 환경 변수 모두 설정
- [ ] 재배포 (Redeploy)

### 10.3 주의사항

1. **환경 변수 적용**: `NEXT_PUBLIC_` 변수는 빌드 시점에 적용되므로, 변경 후 반드시 재배포 필요

2. **Site URL 공백 주의**: Supabase Site URL에 공백이 있으면 OAuth 오류 발생

3. **Cloudflare 인증**: Stream/Images API는 서버 사이드에서만 호출 (API 토큰 노출 방지)

---

## 부록: 파일별 빠른 참조

| 파일 경로 | 역할 |
|-----------|------|
| `app/page.tsx` | 홈페이지 (강의 목록, 검색) |
| `app/layout.tsx` | 루트 레이아웃 |
| `lib/supabase.ts` | Supabase 클라이언트 초기화 |
| `types/course.ts` | 강의 관련 타입 정의 |
| `types/live.ts` | 라이브 관련 타입 정의 |
| `components/Navbar.tsx` | 상단 네비게이션 바 |
| `components/PurchaseButton.tsx` | 구매/결제 버튼 |
| `components/LessonVideoPlayer.tsx` | 비디오 플레이어 |
| `components/JitsiMeetPlayer.tsx` | 라이브 화상 플레이어 |
| `app/api/video/token/route.ts` | 비디오 토큰 발급 API |
| `app/api/payment/verify/route.ts` | 결제 검증 API |

---

**문서 끝**

> 이 문서는 뷰티클래스 MVP V1의 전체 구조와 기능을 설명합니다.
> 추가 개발 시 이 문서를 먼저 참고하여 프로젝트 맥락을 이해한 후 진행하세요.
