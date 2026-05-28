# Workflow Build: Enrollment Sync

## Workflow Name

- `Enrollment > Sync to LMS`

## Workflow Type

- Enrollment-based workflow

## Goal

Create the LMS enrollment after Contact and Course are ready, then trigger the welcome email only when the enrollment sync succeeds.

## Preconditions

Before building this workflow, confirm these Enrollment properties exist:

- `lms_enrollment_id`
- `sync_status`
- `last_attempt_at`
- `retry_count`
- `last_error`

Confirm associations exist:

- Enrollment -> Contact
- Enrollment -> Course

## Important Portal Note

In this HubSpot portal, `sync_status` labels do not fully match the internal values:

- `Pending` label uses internal value `true`
- `Synced` label uses internal value `false`
- `Error` uses `Error`
- `Needs Review` uses `Needs Review`
- `Needs Resync` uses `Needs Resync`

The current custom code already handles this.

## Enrollment Trigger

Enroll Enrollment when all are true:

- `sync_status` is one of:
  - `Pending`
  - `Error`
  - `Needs Resync`
- record has at least one associated Contact
- record has at least one associated Course

## Re-enrollment

Allow re-enrollment when any of these change:

- `sync_status`
- associated Contact changes
- associated Course changes

## Actions

### 1. Custom code action

Use:

- [hubspot-custom-code-action.js](../hubspot-custom-code-action.js)

Required inputs:

- `enrollment_id` -> Enrollment Record ID
- `retry_count` -> Enrollment `retry_count`

Required secrets:

- `LMS_BASE_URL`
- `HUBSPOT_ACCESS_TOKEN`
- `HUBSPOT_ENROLLMENT_OBJECT_TYPE`
- `HUBSPOT_COURSE_OBJECT_TYPE`

Required outputs:

- `success`
- `lms_user_id`
- `lms_enrollment_id`
- `error_message`

What the code does:

- resolves associated Contact by API
- resolves associated Course by API
- validates student/contact/course state
- creates or reuses LMS user
- creates or reuses LMS enrollment
- updates Contact and Enrollment statuses

### 2. Branch on `success`

If `success = true`:

- continue to welcome email

If `success = false`:

- stop
- let the custom code leave the Enrollment in queue with error details

### 3. Send welcome email

Use a HubSpot automated email after success only.

Recommended action:

- `Send email`

Optional audit step after send:

- create Enrollment property `welcome_email_sent`
- create Enrollment property `welcome_email_sent_at`

Then set:

- `welcome_email_sent = true`
- `welcome_email_sent_at = now`

## Error Handling

### `Needs Review`

Use for:

- missing Contact association
- missing Course association
- Contact is not a student
- missing email
- missing LMS course identifier
- inactive Course

### `Error`

Use for:

- LMS API timeout
- LMS API 5xx
- network failures
- authentication/configuration failures

### Retry rule

Recommended:

- if `retry_count >= 3`, create internal task or owner notification

## Recommended Optional Branches

### After failure

If `retry_count >= 3`:

- create task for operations owner
- or send internal notification

If `retry_count < 3`:

- leave in queue for manual or scheduled retry

## Test Cases

- New student + active course + pending enrollment creates LMS enrollment
- Existing LMS user is reused
- Existing LMS enrollment is reused
- Missing associated Contact moves to `Needs Review`
- Missing associated Course moves to `Needs Review`
- Missing `lms_course_id` moves to `Needs Review`
- Successful sync sends welcome email
