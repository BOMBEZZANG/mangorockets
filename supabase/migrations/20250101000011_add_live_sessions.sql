-- =============================================
-- 라이브 강의 세션 테이블
-- =============================================

-- 1. live_sessions 테이블 생성
CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 강사 정보
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 연결된 강의 (선택 - NULL이면 독립 라이브)
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,

  -- 세션 기본 정보
  title TEXT NOT NULL,
  description TEXT,
  thumbnail TEXT,

  -- 일정
  scheduled_at TIMESTAMP WITH TIME ZONE,  -- NULL이면 즉시 시작
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,

  -- 상태: 'scheduled' | 'live' | 'ended' | 'cancelled'
  status TEXT NOT NULL DEFAULT 'scheduled',

  -- 접근 권한: 'public' | 'paid'
  access_type TEXT NOT NULL DEFAULT 'public',

  -- Jitsi 룸 정보
  room_name TEXT NOT NULL UNIQUE,

  -- 통계
  max_participants INTEGER DEFAULT 0,

  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 제약 조건
  CONSTRAINT valid_status CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  CONSTRAINT valid_access_type CHECK (access_type IN ('public', 'paid'))
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_live_sessions_instructor_id ON live_sessions(instructor_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_course_id ON live_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_scheduled_at ON live_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_live_sessions_room_name ON live_sessions(room_name);

-- 3. RLS 활성화
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책

-- 조회: 누구나 예정/진행중 세션 조회 가능
DROP POLICY IF EXISTS "Anyone can view active sessions" ON live_sessions;
CREATE POLICY "Anyone can view active sessions" ON live_sessions
  FOR SELECT USING (status IN ('scheduled', 'live'));

-- 조회: 강사는 자신의 모든 세션 조회 가능 (종료된 것 포함)
DROP POLICY IF EXISTS "Instructors view own sessions" ON live_sessions;
CREATE POLICY "Instructors view own sessions" ON live_sessions
  FOR SELECT USING (auth.uid() = instructor_id);

-- 생성: 강사/관리자만 라이브 세션 생성 가능
DROP POLICY IF EXISTS "Instructors create sessions" ON live_sessions;
CREATE POLICY "Instructors create sessions" ON live_sessions
  FOR INSERT WITH CHECK (
    auth.uid() = instructor_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('instructor', 'admin')
    )
  );

-- 수정: 강사만 자신의 세션 수정 가능
DROP POLICY IF EXISTS "Instructors update own sessions" ON live_sessions;
CREATE POLICY "Instructors update own sessions" ON live_sessions
  FOR UPDATE USING (auth.uid() = instructor_id);

-- 삭제: 강사만 자신의 세션 삭제 가능
DROP POLICY IF EXISTS "Instructors delete own sessions" ON live_sessions;
CREATE POLICY "Instructors delete own sessions" ON live_sessions
  FOR DELETE USING (auth.uid() = instructor_id);

-- 5. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_live_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS live_sessions_updated_at ON live_sessions;
CREATE TRIGGER live_sessions_updated_at
  BEFORE UPDATE ON live_sessions
  FOR EACH ROW EXECUTE FUNCTION update_live_sessions_updated_at();
