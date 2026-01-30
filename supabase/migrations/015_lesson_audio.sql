-- Replace content (JSON) with audio_url, add lesson-audios storage bucket

-- ============= LESSONS: drop content, add audio_url =============
ALTER TABLE lessons DROP COLUMN IF EXISTS content;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS audio_url text;

-- ============= STORAGE: lesson-audios bucket =============
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lesson-audios',
  'lesson-audios',
  true,
  52428800,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/m4a', 'audio/x-m4a']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============= STORAGE POLICIES =============
DROP POLICY IF EXISTS "super_admin_upload_lesson_audios" ON storage.objects;
DROP POLICY IF EXISTS "public_read_lesson_audios" ON storage.objects;
DROP POLICY IF EXISTS "super_admin_update_lesson_audios" ON storage.objects;
DROP POLICY IF EXISTS "super_admin_delete_lesson_audios" ON storage.objects;

-- Super admin can upload lesson audios
CREATE POLICY "super_admin_upload_lesson_audios"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lesson-audios' AND public.is_super_admin()
);

-- Public read (bucket is public; this allows SELECT for URL generation if needed)
CREATE POLICY "public_read_lesson_audios"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lesson-audios');

-- Super admin can update/delete lesson audios
CREATE POLICY "super_admin_update_lesson_audios"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lesson-audios' AND public.is_super_admin());

CREATE POLICY "super_admin_delete_lesson_audios"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lesson-audios' AND public.is_super_admin());
