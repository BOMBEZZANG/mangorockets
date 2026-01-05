-- =============================================
-- 프로필 이미지 저장을 위한 Storage 버킷 설정
-- =============================================

-- 1. profiles 버킷 생성 (Supabase Dashboard에서 수동으로 생성해야 함)
-- Storage > New bucket > Name: profiles > Public bucket: ON

-- 2. Storage 정책 설정 (SQL Editor에서 실행)

-- 모든 사용자가 avatars 폴더의 이미지를 볼 수 있음
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles' AND (storage.foldername(name))[1] = 'avatars');

-- 인증된 사용자만 자신의 아바타 업로드 가능
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profiles'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- 인증된 사용자만 자신의 아바타 업데이트 가능
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profiles'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- 인증된 사용자만 자신의 아바타 삭제 가능
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profiles'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'avatars'
);
