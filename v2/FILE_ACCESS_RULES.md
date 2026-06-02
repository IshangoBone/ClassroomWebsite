# V2 File Access Rules

## Purpose

This document defines the Version 2 file access model for GitHub issue #42.
Database file metadata lives in `public.files`; binary objects live in Supabase
Storage buckets. Private object reads must line up with an active metadata row
and the same course, classroom, submission, or admin permissions used by RLS.

## Buckets

| Bucket | Public | Intended use |
| --- | --- | --- |
| `profile-photos` | No | Uploaded profile photos and avatar-like user media. |
| `course-public-assets` | Yes | Course thumbnails and other assets intentionally safe for public course discovery. |
| `lesson-resources` | No | Lesson resources, classroom-only resources, audio, documents, slides, and embedded file assets. |
| `submission-uploads` | No | Student submission attachments and draft-work uploads. |

Default avatars can stay as app-bundled static assets unless they later need
user-upload behavior.

## Path Convention

All uploads should start with the uploader profile id:

```text
{profile_id}/{category}/{generated_file_name}
```

Examples:

```text
8f4.../profile/photo.webp
8f4.../courses/58d.../thumbnail.webp
8f4.../lessons/8c1.../resource.pdf
8f4.../submissions/754.../answer-upload.pdf
```

Storage insert policy allows authenticated users to upload only into folders
whose first path segment matches their active profile id.

## Metadata Rule

Private files should not be readable just because the object exists. The app
must create or update a matching `public.files` row with:

- `storage_bucket`
- `storage_path`
- `owner_user_id`
- `file_type`
- `visibility`
- `status = 'active'`

Private object reads are allowed only when `public.files` says the file is
active and one of these is true:

- the current user owns the file
- the file is linked to lesson content the current user can view
- the file is linked to a submission the current user can access
- the current user is an active platform admin

Files marked `status = 'deleted'` are hidden immediately by metadata RLS and by
storage object read policy.

## Category Rules

| Category | Rule |
| --- | --- |
| Profile photos | Private bucket. Visible inside the platform only through profile/file metadata rules; not public by default. |
| Course thumbnails | Use `course-public-assets` only when the asset is intentionally safe for public discovery. Use private metadata-backed access otherwise. |
| Public lesson resources | Use `lesson-resources` plus `content_file_links`; public-course viewers can read visible, unarchived resources for published discoverable courses. |
| Classroom resources | Use `lesson-resources` plus a classroom-scoped `content_file_links` row; only classroom members, assigned teachers, and admins can read. |
| Submission uploads | Use `submission-uploads` plus `submission_file_links`; only the submitting student, authorized teacher/reviewer, and admins can read. |
| Audio/video/document uploads | Treat by context: lesson resource or submission upload. Do not put sensitive classroom/student media in a public bucket. |
| External links/embeds | Store as metadata/content rows. Do not proxy private access through public URLs. |

## URL Rules

Use public URLs only for objects in `course-public-assets`.

Use signed/private URL flows for:

- profile photos
- private course thumbnails
- lesson resources in `lesson-resources`
- classroom-only resources
- submission uploads
- any user, classroom, or student-sensitive file

## Deletion Rule

Soft-delete metadata first by setting `public.files.status = 'deleted'` and
`deleted_at`. That immediately blocks app reads. The owner or an active platform
admin can still delete the physical storage object afterward.
