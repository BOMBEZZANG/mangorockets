-- =============================================
-- 강의 발행 상태 컬럼 추가
-- =============================================

-- 1. courses 테이블에 published 컬럼 추가 (기본값: false = 미발행)
ALTER TABLE courses
ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT false;

-- 2. 기존 강의는 모두 발행 상태로 변경 (이미 공개된 강의들)
UPDATE courses SET published = true WHERE published IS NULL;

-- 3. published 컬럼에 NOT NULL 제약 추가
ALTER TABLE courses
ALTER COLUMN published SET NOT NULL;

-- 4. 검색 성능을 위한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(published);
