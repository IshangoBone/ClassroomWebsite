# BrainKernl V2 UI Patterns

This file captures the shared UI direction for Version 2. New teacher, student, and admin screens should reuse these patterns before creating page-specific styles.

## App Shell

- Protected pages use `loadProtectedProfile`, which renders the shared collapsible sidebar from `scripts/utils/app-sidebar.js`.
- The sidebar is role-aware:
  - all active users see workspace and learning links
  - teachers see teaching links when they own active courses
  - admins see admin links
  - supreme admins see moderation
- Avoid duplicate page-level navigation cards when a sidebar link already covers the same destination.
- `back-link` anchors are hidden when the app shell is active.

## Layouts

- Auth pages use `auth-layout`.
- Dashboard pages use `dashboard-layout` plus `dashboard-section--panel` for distinct work areas.
- Admin, course, classroom, analytics, and submission pages use `management-layout` and `management-section`.
- Student lesson pages use `lesson-view-shell`; new lesson-like experiences can use `split-learning-layout`.
- The split learning pattern keeps lesson/content on the left and objective/checkpoints/actions on the right.

## Components

Reusable helpers live in `scripts/utils/ui-components.js`:

- `createBadge(text, { quiet })`
- `createButton(label, { variant, destructive, type, disabled, ariaLabel })`
- `createButtonLink(label, href, { variant, destructive, ariaLabel })`
- `setStatusMessage(element, message, tone)`
- `createStatusAlert(message, { tone })`
- `createActionRow(actions, { align })`
- `createPageHeader({ eyebrow, title, copy, actions })`
- `createSectionHeader({ title, copy, actions })`
- `createCard({ title, copy, actions, badges, className })`
- `createEmptyState(message, { compact })`
- `createFormField({ label, input, hint, className })`
- `createDataTable({ columns, rows, emptyMessage })`
- `setFieldError(field, message)`
- `clearFieldError(field)`
- `createModalShell({ title, body, actions })`
- `createTabs(tabs)`

Prefer these helpers for new pages so buttons, cards, tables, badges, alerts, forms, action rows, modals, and tabs stay consistent.

## Forms And Validation

- Wrap controls in `form-field`.
- Use `createFormField` when building forms from JavaScript.
- Use shared status regions with `auth-status` for page-level feedback.
- Use `setFieldError` for field-level errors; it sets `aria-invalid` and renders `field-error`.
- Use `data-tone="error"` and `data-tone="success"` for page status messages.
- Use `createStatusAlert` for inline warning/error/success blocks that need an accessible role.

## Cards And Lists

- Use `dashboard-section--panel` for major dashboard work areas.
- Use `course-card` for course records and keep each course visually distinct.
- Use `submission-list` and `submission-item` for work queues.
- Use `badge` and `badge--quiet` for state, counts, and metadata.
- Use `ui-card` or `createCard` for new generic record cards before adding page-specific card styles.
- Use `ui-empty-state` or `createEmptyState` when a list/table has no rows.

## Tables

- Use `createDataTable` or `ui-data-table-shell` plus `ui-data-table` for new read-only data lists.
- Keep columns scannable: short headings, important identifiers first, metadata later.
- Prefer table filters above the table in a `management-filters` or `dashboard-section--panel` area.

## Action Patterns

- Use `primary-button` for the main action on a page or card.
- Use `secondary-button` for normal navigation/actions.
- Use `destructive-button` only for archive, delete, leave, unenroll, reset, or suspend actions.
- Use `ui-action-row` or `course-actions` to group related controls.
- Use `createButton` and `createButtonLink` for JavaScript-rendered controls so variants stay consistent.

## Page Checklist

- Start with the role-aware app shell for protected pages.
- Choose the closest layout shell before adding new page-level layout CSS.
- Use shared helpers for status, validation, cards, tables, modals, tabs, and action rows.
- Add page-specific classes only when the shared pattern does not cover the behavior or density.
