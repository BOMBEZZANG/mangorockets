-- =============================================
-- 회차별 미리보기 기능 추가
-- =============================================

-- 1. lessons 테이블에 is_preview 컬럼 추가 (기본값: false)
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS is_preview BOOLEAN DEFAULT false;

-- 2. 기존 레슨은 미리보기 비활성화
UPDATE lessons SET is_preview = false WHERE is_preview IS NULL;

-- 3. NOT NULL 제약 추가
ALTER TABLE lessons
ALTER COLUMN is_preview SET NOT NULL;

-- 4. 검색 성능을 위한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_lessons_preview ON lessons(is_preview);
