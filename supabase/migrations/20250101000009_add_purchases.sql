-- =============================================
-- 강의 구매 기록 테이블
-- =============================================

-- 1. purchases 테이블 생성
CREATE TABLE IF NOT EXISTS purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 동일 사용자가 동일 강의를 중복 구매 방지
  UNIQUE(user_id, course_id)
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_course_id ON purchases(course_id);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_id ON purchases(payment_id);

-- 3. RLS 활성화
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책
-- 사용자는 자신의 구매 기록만 조회 가능
DROP POLICY IF EXISTS "Users can view own purchases" ON purchases;
CREATE POLICY "Users can view own purchases" ON purchases
  FOR SELECT USING (auth.uid() = user_id);

-- 강사는 자신의 강의 구매 기록 조회 가능
DROP POLICY IF EXISTS "Instructors can view their course purchases" ON purchases;
CREATE POLICY "Instructors can view their course purchases" ON purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = purchases.course_id
      AND courses.instructor = auth.uid()::text
    )
  );

-- 서비스 역할만 구매 기록 생성 가능 (서버에서만)
DROP POLICY IF EXISTS "Service role can insert purchases" ON purchases;
CREATE POLICY "Service role can insert purchases" ON purchases
  FOR INSERT WITH CHECK (true);

-- 5. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_purchases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS purchases_updated_at ON purchases;
CREATE TRIGGER purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_purchases_updated_at();
