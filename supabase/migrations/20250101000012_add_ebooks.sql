-- =============================================
-- E-book 판매 시스템 테이블
-- =============================================

-- 1. ebooks 테이블 생성
CREATE TABLE IF NOT EXISTS ebooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT '기타',
  level TEXT CHECK (level IN ('입문', '중급', '고급')),
  price INTEGER NOT NULL DEFAULT 0,
  thumbnail TEXT,
  instructor UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- PDF 저장 경로 (Supabase Storage)
  full_pdf_path TEXT,
  preview_pdf_path TEXT,

  -- 메타데이터
  page_count INTEGER CHECK (page_count IS NULL OR page_count >= 20),
  file_size_bytes BIGINT,

  -- 상태
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ebooks_instructor ON ebooks(instructor);
CREATE INDEX IF NOT EXISTS idx_ebooks_category ON ebooks(category);
CREATE INDEX IF NOT EXISTS idx_ebooks_published ON ebooks(published);
CREATE INDEX IF NOT EXISTS idx_ebooks_created_at ON ebooks(created_at DESC);

-- RLS
ALTER TABLE ebooks ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 발행된 E-book 조회 가능
DROP POLICY IF EXISTS "Anyone can view published ebooks" ON ebooks;
CREATE POLICY "Anyone can view published ebooks" ON ebooks
  FOR SELECT USING (published = true);

-- 강사는 자신의 E-book 조회 가능 (미발행 포함)
DROP POLICY IF EXISTS "Instructors can view own ebooks" ON ebooks;
CREATE POLICY "Instructors can view own ebooks" ON ebooks
  FOR SELECT USING (instructor = auth.uid());

-- 강사/관리자만 E-book 생성 가능
DROP POLICY IF EXISTS "Instructors can insert own ebooks" ON ebooks;
CREATE POLICY "Instructors can insert own ebooks" ON ebooks
  FOR INSERT WITH CHECK (
    instructor = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('instructor', 'admin')
    )
  );

-- 강사는 자신의 E-book 수정 가능
DROP POLICY IF EXISTS "Instructors can update own ebooks" ON ebooks;
CREATE POLICY "Instructors can update own ebooks" ON ebooks
  FOR UPDATE USING (instructor = auth.uid());

-- 강사는 자신의 미발행 E-book 삭제 가능
DROP POLICY IF EXISTS "Instructors can delete own unpublished ebooks" ON ebooks;
CREATE POLICY "Instructors can delete own unpublished ebooks" ON ebooks
  FOR DELETE USING (instructor = auth.uid() AND published = false);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_ebooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ebooks_updated_at ON ebooks;
CREATE TRIGGER ebooks_updated_at
  BEFORE UPDATE ON ebooks
  FOR EACH ROW EXECUTE FUNCTION update_ebooks_updated_at();


-- =============================================
-- 2. ebook_purchases 테이블 (E-book 구매 기록)
-- =============================================

CREATE TABLE IF NOT EXISTS ebook_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ebook_id UUID NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 동일 사용자가 동일 E-book 중복 구매 방지
  UNIQUE(user_id, ebook_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ebook_purchases_user_id ON ebook_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_ebook_purchases_ebook_id ON ebook_purchases(ebook_id);
CREATE INDEX IF NOT EXISTS idx_ebook_purchases_payment_id ON ebook_purchases(payment_id);

-- RLS
ALTER TABLE ebook_purchases ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 구매 기록만 조회 가능
DROP POLICY IF EXISTS "Users can view own ebook purchases" ON ebook_purchases;
CREATE POLICY "Users can view own ebook purchases" ON ebook_purchases
  FOR SELECT USING (auth.uid() = user_id);

-- 강사는 자신의 E-book 구매 기록 조회 가능
DROP POLICY IF EXISTS "Instructors can view their ebook purchases" ON ebook_purchases;
CREATE POLICY "Instructors can view their ebook purchases" ON ebook_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ebooks
      WHERE ebooks.id = ebook_purchases.ebook_id
      AND ebooks.instructor = auth.uid()
    )
  );

-- 서비스 역할만 구매 기록 생성 가능 (서버에서만)
DROP POLICY IF EXISTS "Service role can insert ebook purchases" ON ebook_purchases;
CREATE POLICY "Service role can insert ebook purchases" ON ebook_purchases
  FOR INSERT WITH CHECK (true);

-- 서비스 역할만 구매 기록 업데이트 가능 (다운로드 카운트 등)
DROP POLICY IF EXISTS "Service role can update ebook purchases" ON ebook_purchases;
CREATE POLICY "Service role can update ebook purchases" ON ebook_purchases
  FOR UPDATE USING (true);

-- updated_at 트리거
CREATE OR REPLACE FUNCTION update_ebook_purchases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ebook_purchases_updated_at ON ebook_purchases;
CREATE TRIGGER ebook_purchases_updated_at
  BEFORE UPDATE ON ebook_purchases
  FOR EACH ROW EXECUTE FUNCTION update_ebook_purchases_updated_at();


-- =============================================
-- 3. ebook_tags 매핑 테이블 (기존 tags 테이블 재사용)
-- =============================================

CREATE TABLE IF NOT EXISTS ebook_tags (
  ebook_id UUID NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (ebook_id, tag_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ebook_tags_ebook_id ON ebook_tags(ebook_id);
CREATE INDEX IF NOT EXISTS idx_ebook_tags_tag_id ON ebook_tags(tag_id);

-- RLS
ALTER TABLE ebook_tags ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
DROP POLICY IF EXISTS "Anyone can view ebook_tags" ON ebook_tags;
CREATE POLICY "Anyone can view ebook_tags" ON ebook_tags
  FOR SELECT USING (true);

-- 강사만 자신의 E-book에 태그 추가 가능
DROP POLICY IF EXISTS "Instructors can add tags to their ebooks" ON ebook_tags;
CREATE POLICY "Instructors can add tags to their ebooks" ON ebook_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ebooks
      WHERE ebooks.id = ebook_id
      AND ebooks.instructor = auth.uid()
    )
  );

-- 강사만 자신의 E-book 태그 삭제 가능
DROP POLICY IF EXISTS "Instructors can remove tags from their ebooks" ON ebook_tags;
CREATE POLICY "Instructors can remove tags from their ebooks" ON ebook_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM ebooks
      WHERE ebooks.id = ebook_id
      AND ebooks.instructor = auth.uid()
    )
  );


-- =============================================
-- 4. ebook_cart 테이블 (E-book 장바구니)
-- =============================================

CREATE TABLE IF NOT EXISTS ebook_cart (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ebook_id UUID NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 동일 사용자가 동일 E-book 중복 담기 방지
  UNIQUE(user_id, ebook_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ebook_cart_user_id ON ebook_cart(user_id);
CREATE INDEX IF NOT EXISTS idx_ebook_cart_ebook_id ON ebook_cart(ebook_id);

-- RLS
ALTER TABLE ebook_cart ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ebook cart" ON ebook_cart;
CREATE POLICY "Users can view own ebook cart" ON ebook_cart
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add to ebook cart" ON ebook_cart;
CREATE POLICY "Users can add to ebook cart" ON ebook_cart
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove from ebook cart" ON ebook_cart;
CREATE POLICY "Users can remove from ebook cart" ON ebook_cart
  FOR DELETE USING (auth.uid() = user_id);


-- =============================================
-- 5. ebook_reviews 테이블 (E-book 리뷰)
-- =============================================

CREATE TABLE IF NOT EXISTS ebook_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ebook_id UUID NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 한 사용자가 한 E-book에 하나의 리뷰만 작성 가능
  UNIQUE(user_id, ebook_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ebook_reviews_ebook_id ON ebook_reviews(ebook_id);
CREATE INDEX IF NOT EXISTS idx_ebook_reviews_user_id ON ebook_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_ebook_reviews_rating ON ebook_reviews(rating);

-- RLS
ALTER TABLE ebook_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view ebook reviews" ON ebook_reviews;
CREATE POLICY "Anyone can view ebook reviews" ON ebook_reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Purchased users can create ebook review" ON ebook_reviews;
CREATE POLICY "Purchased users can create ebook review" ON ebook_reviews
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM ebook_purchases
      WHERE ebook_purchases.user_id = auth.uid()
      AND ebook_purchases.ebook_id = ebook_reviews.ebook_id
    )
  );

DROP POLICY IF EXISTS "Users can update own ebook review" ON ebook_reviews;
CREATE POLICY "Users can update own ebook review" ON ebook_reviews
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own ebook review" ON ebook_reviews;
CREATE POLICY "Users can delete own ebook review" ON ebook_reviews
  FOR DELETE USING (auth.uid() = user_id);


-- =============================================
-- 6. ebook_review_likes 테이블
-- =============================================

CREATE TABLE IF NOT EXISTS ebook_review_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES ebook_reviews(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, review_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ebook_review_likes_review_id ON ebook_review_likes(review_id);
CREATE INDEX IF NOT EXISTS idx_ebook_review_likes_user_id ON ebook_review_likes(user_id);

-- RLS
ALTER TABLE ebook_review_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view ebook review likes" ON ebook_review_likes;
CREATE POLICY "Anyone can view ebook review likes" ON ebook_review_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can like ebook reviews" ON ebook_review_likes;
CREATE POLICY "Authenticated users can like ebook reviews" ON ebook_review_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove own ebook review like" ON ebook_review_likes;
CREATE POLICY "Users can remove own ebook review like" ON ebook_review_likes
  FOR DELETE USING (auth.uid() = user_id);


-- =============================================
-- 7. ebook_review_replies 테이블 (강사 답글)
-- =============================================

CREATE TABLE IF NOT EXISTS ebook_review_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES ebook_reviews(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 한 리뷰에 하나의 강사 답글만 가능
  UNIQUE(review_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ebook_review_replies_review_id ON ebook_review_replies(review_id);

-- RLS
ALTER TABLE ebook_review_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view ebook review replies" ON ebook_review_replies;
CREATE POLICY "Anyone can view ebook review replies" ON ebook_review_replies
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Instructors can reply to their ebook reviews" ON ebook_review_replies;
CREATE POLICY "Instructors can reply to their ebook reviews" ON ebook_review_replies
  FOR INSERT WITH CHECK (
    auth.uid() = instructor_id
    AND EXISTS (
      SELECT 1 FROM ebook_reviews
      JOIN ebooks ON ebooks.id = ebook_reviews.ebook_id
      WHERE ebook_reviews.id = ebook_review_replies.review_id
      AND ebooks.instructor = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Instructors can update own ebook reply" ON ebook_review_replies;
CREATE POLICY "Instructors can update own ebook reply" ON ebook_review_replies
  FOR UPDATE USING (auth.uid() = instructor_id);

DROP POLICY IF EXISTS "Instructors can delete own ebook reply" ON ebook_review_replies;
CREATE POLICY "Instructors can delete own ebook reply" ON ebook_review_replies
  FOR DELETE USING (auth.uid() = instructor_id);


-- =============================================
-- 8. E-book 평균 평점 뷰
-- =============================================

CREATE OR REPLACE VIEW ebook_ratings AS
SELECT
  ebook_id,
  COUNT(*) as review_count,
  ROUND(AVG(rating)::numeric, 1) as average_rating
FROM ebook_reviews
GROUP BY ebook_id;
