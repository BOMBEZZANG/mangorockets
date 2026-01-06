-- =============================================
-- E-book Storage 정책
-- 버킷은 Supabase 대시보드에서 수동 생성 필요:
-- 1. ebook-files (Private) - 전체 PDF 저장
-- 2. ebook-previews (Public) - 미리보기 PDF 저장
-- =============================================

-- ebook-files 버킷 정책 (Private - 구매자만 다운로드)
-- 이 정책은 버킷 생성 후 대시보드에서 설정하거나 아래 SQL 실행

-- 강사만 업로드 가능
INSERT INTO storage.policies (bucket_id, name, definition, check_expression)
SELECT
  'ebook-files',
  'Instructors can upload ebook files',
  '(bucket_id = ''ebook-files''::text)',
  '(EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN (''instructor'', ''admin'')))'
WHERE EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'ebook-files')
ON CONFLICT DO NOTHING;

-- 구매자만 다운로드 가능
INSERT INTO storage.policies (bucket_id, name, definition, check_expression)
SELECT
  'ebook-files',
  'Purchasers can download ebook files',
  '(bucket_id = ''ebook-files''::text)',
  '(EXISTS (
    SELECT 1 FROM ebook_purchases ep
    JOIN ebooks e ON e.id = ep.ebook_id
    WHERE ep.user_id = auth.uid()
    AND e.full_pdf_path = storage.filename(name)
  ))'
WHERE EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'ebook-files')
ON CONFLICT DO NOTHING;


-- ebook-previews 버킷 정책 (Public - 누구나 읽기 가능)
-- 강사만 업로드 가능
INSERT INTO storage.policies (bucket_id, name, definition, check_expression)
SELECT
  'ebook-previews',
  'Instructors can upload preview files',
  '(bucket_id = ''ebook-previews''::text)',
  '(EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN (''instructor'', ''admin'')))'
WHERE EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'ebook-previews')
ON CONFLICT DO NOTHING;

-- 누구나 읽기 가능
INSERT INTO storage.policies (bucket_id, name, definition, check_expression)
SELECT
  'ebook-previews',
  'Anyone can read preview files',
  '(bucket_id = ''ebook-previews''::text)',
  'true'
WHERE EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'ebook-previews')
ON CONFLICT DO NOTHING;
