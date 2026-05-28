# Workflow Build: Course Sync

## Workflow Name

- `Course > Sync Course to LMS`

## Workflow Type

- Course-based workflow

## Goal

Create or update the LMS course so that enrollments can rely on a valid LMS course identifier.

## Preconditions

Before building this workflow, confirm these Course properties exist:

- `course_code`
- `hs_course_name`
- `lms_course_id`
- `course_active`
- `lms_sync_status`
- `last_lms_sync_at`
- `last_lms_sync_error`

If the last three do not exist yet, create them to mirror Contact status handling.

## Enrollment Trigger

Enroll Course when all are true:

- `course_code` is known
- `hs_course_name` is known
- `course_active` is equal to `Yes` or `true`
- and at least one is true:
  - `lms_course_id` is unknown
  - `lms_sync_status` is equal to `Error`
  - `lms_sync_status` is equal to `Needs Review`

## Re-enrollment

Allow re-enrollment when any of these change:

- `course_code`
- `hs_course_name`
- `course_active`
- `lms_sync_status`

## Actions

### 1. Branch: Confirm course is active

If `course_active` is not true:

- end workflow

If yes:

- continue

### 2. Set status to pending

Set Course property values:

- `lms_sync_status = Pending`
- `last_lms_sync_error = ""`

### 3. Custom code action

Purpose:

- find LMS course by `course_code`
- create LMS course if missing
- return `lms_course_id`

Recommended outputs:

- `success`
- `lms_course_id`
- `error_message`

## Branch on custom code output

### If `success = true`

Set Course property values:

- `lms_course_id = custom code output lms_course_id`
- `lms_sync_status = Synced`
- `last_lms_sync_at = now`
- `last_lms_sync_error = ""`

### If `success = false`

Set Course property values:

- `lms_sync_status = Error`
- `last_lms_sync_at = now`
- `last_lms_sync_error = custom code output error_message`

Optional branch:

- if missing `course_code` or invalid course config is detected, use `Needs Review`

## Recommended Operational Notes

- This workflow should not create users.
- This workflow should not create enrollments.
- Use `course_code` as the stable operational identifier whenever possible.

## Test Cases

- Active Course creates LMS course
- Existing LMS course is reused
- Inactive Course does not sync
- Missing `course_code` blocks the sync
- Failed LMS call marks Course as `Error`
