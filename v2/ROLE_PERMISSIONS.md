# V2 Roles And Permissions

## Purpose

This document defines the Version 2 authorization model for the core app and
the row-level security pass in GitHub issues #39/#40.
Permissions are contextual: a normal platform user may teach in a course they
own or manage and may be a student in a different course or classroom.

## Platform Roles

| Role | Meaning | Current enforcement |
| --- | --- | --- |
| `user` | Standard authenticated account. Teaching and student access are granted through ownership, collaboration, or enrollment. | Stored on `profiles`; implemented for the schema foundations listed below. |
| `admin` | Active platform operator who may review users, content, activity, analytics, and managed records. | Stored on `profiles`; active admins pass admin route guards, admin RPC checks, activity log policies, and the core RLS helper override. |
| `supreme_admin` | Highest-trust platform operator who can moderate other admins and assign platform roles. | Stored on `profiles`; enforced through admin/supreme-admin RPC checks and the shared admin route guard. |

`teacher` and `student` are not platform roles. A user becomes a teacher for a
specific resource by owning a course or being added as a course/classroom
teacher. A user becomes a student by enrollment in a course or classroom.

## Implemented Permission Foundation

The current database migrations establish these permission boundaries:

| Context | Access represented now |
| --- | --- |
| Profile | Authenticated users can view and update their own profile fields. Active platform admins can view profiles through admin tools and table policy; role/status changes remain behind moderation RPCs. |
| Course owner | A user creating a course owns it permanently in the schema and can manage its current editable fields. |
| Course collaborator | An owner can add or remove collaborators; teacher/editor/co-owner collaborators can manage course content. |
| Classroom teacher | A course manager can create a classroom; its owner can grant classroom teaching access. |
| Published public course | Authenticated users can read published, publicly discoverable course metadata plus visible, unarchived course content. Collaborators, classroom data, submissions, progress, and student records are not exposed by public course access. |
| Enrolled student | Enrollment grants visibility into the relevant non-deleted course/classroom and visible lesson content. Active students can save/submit only their own lesson work in active, allowed contexts. |
| Submissions and progress | Students can read their own records and save their own draft answers; authorized teachers can read managed student work. |
| Files and references | Private file metadata can be referenced only through authorized lesson content or a student's editable draft submission. Storage objects are protected by bucket policy and the metadata-backed rules in `FILE_ACCESS_RULES.md`. |
| Activity logs | Active platform admins can read activity history through policy-backed admin views/RPCs. |
| Admin override | Active platform admins pass shared course, classroom, submission-review, profile, and file metadata helpers. This is a backend complement to the frontend route guard work in #41. |

## Deferred Permission Work

These behaviors are intentionally not enabled by the current foundation:

| Capability | Follow-up issue or dependency |
| --- | --- |
| Course and classroom join operations | Student join flow (#22) |
| Publish, unpublish, archive, and deletion actions | Teacher publish/archive controls (#20) and admin controls (#52) |
| Student-safe assessment delivery without exposing answer keys | Assessment and lesson experience work (#24, #34) |
| Final submission, scoring, and progress mutation | Submission flow (#36-#38) |
| Upload UI and signed URL plumbing | File upload/attachment work (#32, #47). Bucket/object access rules are defined for #42, but the frontend upload flows are still future work. |
| Monetization data or payments | Non-MVP planning only (#12) |

## Implementation Rule

New UI and migrations should check the user's relationship to the target
resource instead of introducing a global `teacher` or `student` account role.
Admin behavior must go through active `admin` or `supreme_admin` checks, and
public course access must never be used as a shortcut to expose collaborators,
classrooms, enrollments, submissions, progress, activity logs, or student data.
