# V2 Roles And Permissions

## Purpose

This document defines the Version 2 authorization model for GitHub issue #2.
Permissions are contextual: a normal platform user may teach in a course they
own or manage and may be a student in a different course or classroom.

## Platform Roles

| Role | Meaning | Current enforcement |
| --- | --- | --- |
| `user` | Standard authenticated account. Teaching and student access are granted through ownership, collaboration, or enrollment. | Stored on `profiles`; implemented for the schema foundations listed below. |
| `admin` | Platform operator who may manage users and all content. | Reserved on `profiles`; no admin policies or UI are implemented yet. |

`teacher` and `student` are not platform roles. A user becomes a teacher for a
specific resource by owning a course or being added as a course/classroom
teacher. A user becomes a student by enrollment in a course or classroom.

## Implemented Permission Foundation

The current database migrations establish these permission boundaries:

| Context | Access represented now |
| --- | --- |
| Profile | Authenticated users can view and update only their own profile. |
| Course owner | A user creating a course owns it permanently in the schema and can manage its current editable fields. |
| Course collaborator | An owner can add or remove collaborators; teacher/editor/co-owner collaborators can manage course content. |
| Classroom teacher | A course manager can create a classroom; its owner can grant classroom teaching access. |
| Enrolled student | Enrollment grants visibility into the relevant course/classroom and visible lesson content. |
| Submissions and progress | Students can read their own records and save their own draft answers; authorized teachers can read managed student work. |
| Files and references | Private file metadata can be referenced only through authorized lesson content or a student's editable draft submission. |

## Deferred Permission Work

These behaviors are intentionally not enabled by the current foundation:

| Capability | Follow-up issue or dependency |
| --- | --- |
| Course and classroom join operations | Student join flow (#22) |
| Publish, unpublish, archive, and deletion actions | Teacher publish/archive controls (#20) and admin controls (#52) |
| Student-safe assessment delivery without exposing answer keys | Assessment and lesson experience work (#24, #34) |
| Final submission, scoring, and progress mutation | Submission flow (#36-#38) |
| Storage buckets, actual uploads, and object policies | File upload/access work (#32, #42, #47) |
| Protected teacher and admin page routing | Route security (#41) |
| Administrator access to users, analytics, content removal, or audit logs | Admin work (#51-#53) before audit log visibility (#11) |
| Monetization data or payments | Non-MVP planning only (#12) |

## Implementation Rule

New UI and migrations should check the user's relationship to the target
resource instead of introducing a global `teacher` or `student` account role.
Admin behavior must stay disabled until explicit admin authorization and route
protection are implemented.
