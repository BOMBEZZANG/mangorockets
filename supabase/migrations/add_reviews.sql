-- =============================================
-- 강의 리뷰 시스템 테이블
-- =============================================

-- 1. 리뷰 테이블
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 한 사용자가 한 강의에 하나의 리뷰만 작성 가능
  UNIQUE(user_id, course_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_reviews_course_id ON reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
CREATE POLICY "Anyone can view reviews" ON reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Purchased users can create review" ON reviews;
CREATE POLICY "Purchased users can create review" ON reviews
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.user_id = auth.uid()
      AND purchases.course_id = reviews.course_id
    )
  );

DROP POLICY IF EXISTS "Users can update own review" ON reviews;
CREATE POLICY "Users can update own review" ON reviews
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own review" ON reviews;
CREATE POLICY "Users can delete own review" ON reviews
  FOR DELETE USING (auth.uid() = user_id);


-- 2. 리뷰 좋아요 테이블
CREATE TABLE IF NOT EXISTS review_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 한 사용자가 한 리뷰에 하나의 좋아요만 가능
  UNIQUE(user_id, review_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_review_likes_review_id ON review_likes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_likes_user_id ON review_likes(user_id);

-- RLS
ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view review likes" ON review_likes;
CREATE POLICY "Anyone can view review likes" ON review_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can like reviews" ON review_likes;
CREATE POLICY "Authenticated users can like reviews" ON review_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove own like" ON review_likes;
CREATE POLICY "Users can remove own like" ON review_likes
  FOR DELETE USING (auth.uid() = user_id);


-- 3. 강사 답글 테이블
CREATE TABLE IF NOT EXISTS review_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 한 리뷰에 하나의 강사 답글만 가능
  UNIQUE(review_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_review_replies_review_id ON review_replies(review_id);

-- RLS
ALTER TABLE review_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view review replies" ON review_replies;
CREATE POLICY "Anyone can view review replies" ON review_replies
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Instructors can reply to their course reviews" ON review_replies;
CREATE POLICY "Instructors can reply to their course reviews" ON review_replies
  FOR INSERT WITH CHECK (
    auth.uid() = instructor_id
    AND EXISTS (
      SELECT 1 FROM reviews
      JOIN courses ON courses.id = reviews.course_id
      WHERE reviews.id = review_replies.review_id
      AND courses.instructor = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Instructors can update own reply" ON review_replies;
CREATE POLICY "Instructors can update own reply" ON review_replies
  FOR UPDATE USING (auth.uid() = instructor_id);

DROP POLICY IF EXISTS "Instructors can delete own reply" ON review_replies;
CREATE POLICY "Instructors can delete own reply" ON review_replies
  FOR DELETE USING (auth.uid() = instructor_id);


-- 4. 강의별 평균 평점을 빠르게 조회하기 위한 뷰 (선택사항)
CREATE OR REPLACE VIEW course_ratings AS
SELECT
  course_id,
  COUNT(*) as review_count,
  ROUND(AVG(rating)::numeric, 1) as average_rating
FROM reviews
GROUP BY course_id;
