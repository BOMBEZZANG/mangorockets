-- 챕터 테이블 생성
CREATE TABLE IF NOT EXISTS chapters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- lessons 테이블에 chapter_id 컬럼 추가
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_chapters_course_id ON chapters(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_chapter_id ON lessons(chapter_id);

-- RLS 정책 설정
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 챕터를 볼 수 있음
CREATE POLICY "Anyone can view chapters" ON chapters
  FOR SELECT USING (true);

-- 강사만 자신의 강의에 챕터를 생성할 수 있음
CREATE POLICY "Instructors can create chapters" ON chapters
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = chapter_id
      AND courses.instructor = auth.uid()
    )
  );

-- 강사만 자신의 강의 챕터를 수정할 수 있음
CREATE POLICY "Instructors can update their chapters" ON chapters
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = chapters.course_id
      AND courses.instructor = auth.uid()
    )
  );

-- 강사만 자신의 강의 챕터를 삭제할 수 있음
CREATE POLICY "Instructors can delete their chapters" ON chapters
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = chapters.course_id
      AND courses.instructor = auth.uid()
    )
  );
