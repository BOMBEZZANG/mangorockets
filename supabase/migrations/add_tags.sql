-- =============================================
-- 태그 시스템 데이터베이스 스키마
-- =============================================

-- 1. tags 테이블 생성
CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category, name)
);

-- 2. course_tags 매핑 테이블 생성 (다대다 관계)
CREATE TABLE IF NOT EXISTS course_tags (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (course_id, tag_id)
);

-- 3. 검색 성능 향상을 위한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_course_tags_tag_id ON course_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_course_tags_course_id ON course_tags(course_id);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);

-- 4. RLS 정책 설정
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_tags ENABLE ROW LEVEL SECURITY;

-- tags: 모든 사용자가 읽기 가능
CREATE POLICY "Anyone can view tags" ON tags
  FOR SELECT USING (true);

-- course_tags: 모든 사용자가 읽기 가능
CREATE POLICY "Anyone can view course_tags" ON course_tags
  FOR SELECT USING (true);

-- course_tags: 강사만 자신의 강의에 태그 추가 가능
CREATE POLICY "Instructors can add tags to their courses" ON course_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_id
      AND courses.instructor = auth.uid()::text
    )
  );

-- course_tags: 강사만 자신의 강의 태그 삭제 가능
CREATE POLICY "Instructors can remove tags from their courses" ON course_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_id
      AND courses.instructor = auth.uid()::text
    )
  );

-- =============================================
-- 초기 태그 데이터 삽입
-- =============================================

-- 메이크업 - 스타일
INSERT INTO tags (category, name) VALUES
  ('메이크업', '데일리메이크업'),
  ('메이크업', '아이돌메이크업'),
  ('메이크업', '웨딩메이크업'),
  ('메이크업', '면접/증명사진'),
  ('메이크업', '무대/분장'),
  ('메이크업', '글래머러스')
ON CONFLICT (category, name) DO NOTHING;

-- 메이크업 - 기술
INSERT INTO tags (category, name) VALUES
  ('메이크업', '베이스메이크업'),
  ('메이크업', '컨투어링'),
  ('메이크업', '아이메이크업'),
  ('메이크업', '속눈썹강조'),
  ('메이크업', '립포인트'),
  ('메이크업', '색조배합')
ON CONFLICT (category, name) DO NOTHING;

-- 스킨케어 - 대상
INSERT INTO tags (category, name) VALUES
  ('스킨케어', '홈케어'),
  ('스킨케어', '에스테틱실무'),
  ('스킨케어', '여드름/트러블케어'),
  ('스킨케어', '안티에이징'),
  ('스킨케어', '민감성피부'),
  ('스킨케어', '남성스킨케어')
ON CONFLICT (category, name) DO NOTHING;

-- 스킨케어 - 기술
INSERT INTO tags (category, name) VALUES
  ('스킨케어', '괄사마사지'),
  ('스킨케어', '림프순환'),
  ('스킨케어', '기기관리'),
  ('스킨케어', '화장품성분분석'),
  ('스킨케어', '팩/마스크활용')
ON CONFLICT (category, name) DO NOTHING;

-- 헤어 - 스타일
INSERT INTO tags (category, name) VALUES
  ('헤어', '셀프헤어'),
  ('헤어', '레이어드컷'),
  ('헤어', '단발스타일링'),
  ('헤어', '업스타일(번)'),
  ('헤어', '남자머리'),
  ('헤어', '웨이브펌')
ON CONFLICT (category, name) DO NOTHING;

-- 헤어 - 기술
INSERT INTO tags (category, name) VALUES
  ('헤어', '드라이/고데기'),
  ('헤어', '셀프염색'),
  ('헤어', '두피케어/탈모'),
  ('헤어', '가발/피스활용'),
  ('헤어', '헤어액세서리')
ON CONFLICT (category, name) DO NOTHING;

-- 네일
INSERT INTO tags (category, name) VALUES
  ('네일', '젤네일아트'),
  ('네일', '셀프네일'),
  ('네일', '네일케어'),
  ('네일', '연장/보수'),
  ('네일', '캐릭터아트'),
  ('네일', '계절네일')
ON CONFLICT (category, name) DO NOTHING;

-- 왁싱
INSERT INTO tags (category, name) VALUES
  ('왁싱', '페이스왁싱'),
  ('왁싱', '바디왁싱'),
  ('왁싱', '브라질리언'),
  ('왁싱', '슈가링'),
  ('왁싱', '사후관리(인그로운헤어)')
ON CONFLICT (category, name) DO NOTHING;

-- 퍼스널 컬러 - 진단
INSERT INTO tags (category, name) VALUES
  ('퍼스널 컬러', '톤진단(웜/쿨)'),
  ('퍼스널 컬러', '사계절컬러'),
  ('퍼스널 컬러', '이미지메이킹'),
  ('퍼스널 컬러', '골격진단'),
  ('퍼스널 컬러', '베스트컬러')
ON CONFLICT (category, name) DO NOTHING;

-- 퍼스널 컬러 - 활용
INSERT INTO tags (category, name) VALUES
  ('퍼스널 컬러', '퍼스널메이크업'),
  ('퍼스널 컬러', '톤온톤코디'),
  ('퍼스널 컬러', '퍼스널쇼퍼'),
  ('퍼스널 컬러', '파우치진단')
ON CONFLICT (category, name) DO NOTHING;

-- 뷰티 창업 - 운영
INSERT INTO tags (category, name) VALUES
  ('뷰티 창업', '1인샵창업'),
  ('뷰티 창업', '고객상대/CS'),
  ('뷰티 창업', '예약시스템'),
  ('뷰티 창업', '인테리어'),
  ('뷰티 창업', '직원관리'),
  ('뷰티 창업', '세무/법무')
ON CONFLICT (category, name) DO NOTHING;

-- 뷰티 창업 - 클래스
INSERT INTO tags (category, name) VALUES
  ('뷰티 창업', '원데이클래스운영'),
  ('뷰티 창업', '창업컨설팅'),
  ('뷰티 창업', '프랜차이즈')
ON CONFLICT (category, name) DO NOTHING;

-- 마케팅 - 채널
INSERT INTO tags (category, name) VALUES
  ('마케팅', '인스타그램공략'),
  ('마케팅', '유튜브성장'),
  ('마케팅', '블로그체험단'),
  ('마케팅', '틱톡/쇼츠'),
  ('마케팅', '광고집행')
ON CONFLICT (category, name) DO NOTHING;

-- 마케팅 - 콘텐츠
INSERT INTO tags (category, name) VALUES
  ('마케팅', '뷰티촬영법'),
  ('마케팅', '포토샵/보정'),
  ('마케팅', '비포애프터편집'),
  ('마케팅', '퍼스널브랜딩')
ON CONFLICT (category, name) DO NOTHING;

-- 기타
INSERT INTO tags (category, name) VALUES
  ('기타', '반영구'),
  ('기타', '뷰티건강식/이너뷰티'),
  ('기타', '아로마테라피'),
  ('기타', '속눈썹펌/연장')
ON CONFLICT (category, name) DO NOTHING;
