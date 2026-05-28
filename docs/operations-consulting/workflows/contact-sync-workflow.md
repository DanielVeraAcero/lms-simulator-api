# Workflow Build: Contact Sync

## Workflow Name

- `Contact > Sync Student to LMS User`

## Workflow Type

- Contact-based workflow

## Goal

Create or update the LMS user when a Contact should exist as a student in the LMS.

## Preconditions

Before building this workflow, confirm these Contact properties exist:

- `user_type`
- `lms_user_id`
- `lms_sync_status`
- `last_lms_sync_at`
- `last_lms_sync_error`

## Enrollment Trigger

Enroll Contact when all are true:

- `user_type` is equal to `Student`
- `email` is known
- `firstname` is known
- `lastname` is known
- and at least one is true:
  - `lms_user_id` is unknown
  - `lms_sync_status` is equal to `Error`
  - `lms_sync_status` is equal to `Needs Review`

## Re-enrollment

Allow re-enrollment when any of these change:

- `email`
- `firstname`
- `lastname`
- `user_type`
- `lms_sync_status`

## Actions

### 1. Branch: Confirm student type

If `user_type` is not `Student`:

- end workflow

If yes:

- continue

### 2. Set status to pending

Set Contact property values:

- `lms_sync_status = Pending`
- `last_lms_sync_error = ""`

### 3. Custom code action

Purpose:

- find LMS user by email
- create LMS user if missing
- return `lms_user_id`

Recommended outputs:

- `success`
- `lms_user_id`
- `error_message`

## Branch on custom code output

### If `success = true`

Set Contact property values:

- `lms_user_id = custom code output lms_user_id`
- `lms_sync_status = Synced`
- `last_lms_sync_at = now`
- `last_lms_sync_error = ""`

### If `success = false`

Set Contact property values:

- `lms_sync_status = Error`
- `last_lms_sync_at = now`
- `last_lms_sync_error = custom code output error_message`

Optional branch:

- if the error message contains validation or missing-data language, set `lms_sync_status = Needs Review` instead of `Error`

## Recommended Operational Notes

- This workflow should never send the welcome email.
- This workflow should not create enrollments.
- This workflow prepares student identity ahead of enrollment sync.

## Test Cases

- Student Contact with valid email creates LMS user
- Existing LMS user is reused
- Non-student Contact does not sync
- Missing email does not proceed
- Failed LMS call marks Contact as `Error`
