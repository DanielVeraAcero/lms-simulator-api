# HubSpot Workflows Blueprint

This document describes the definitive HubSpot workflow design for the LMS integration. The goal is to keep HubSpot as the operational source of truth while making the sync observable, retryable, and maintainable.

## Guiding Principles

- Contacts, Courses, and Enrollments are each synchronized through their own workflow.
- Enrollment sync depends on Contact and Course being ready, but it can also self-heal by reusing existing LMS records.
- HubSpot remains the orchestration layer.
- The LMS API remains responsible for persistence and idempotent behavior.
- Welcome email is sent from HubSpot only after successful enrollment sync.

## Objects and Properties

### Contact

Required properties:

- `email`
- `firstname`
- `lastname`
- `user_type`
- `lms_user_id`
- `lms_sync_status`
- `last_lms_sync_at`
- `last_lms_sync_error`

Expected `user_type` values:

- `Student`
- `Marketing Lead`
- `Staff`
- `Other`

Expected `lms_sync_status` values:

- `Pending`
- `Synced`
- `Error`
- `Needs Review`

### Course

Required properties:

- `hs_course_name`
- `course_code`
- `lms_course_id`
- `course_active`

Recommended additional property:

- `lms_sync_status`
- `last_lms_sync_at`
- `last_lms_sync_error`

If you have not created them yet, the Course status properties should mirror the Contact pattern:

- `lms_sync_status`: `Pending`, `Synced`, `Error`, `Needs Review`
- `last_lms_sync_at`: date time
- `last_lms_sync_error`: multi-line text

### Enrollment

Required properties:

- `enrollment_name`
- `lms_enrollment_id`
- `sync_status`
- `last_attempt_at`
- `retry_count`
- `last_error`

Expected `sync_status` labels:

- `Pending`
- `Synced`
- `Error`
- `Needs Review`
- `Needs Resync`

Important implementation note for this portal:

- The current internal values of `Enrollment.sync_status` are not fully aligned with the labels.
- `Pending` currently maps to internal value `true`.
- `Synced` currently maps to internal value `false`.
- The current custom code already accounts for this.

## Workflow 1: Contact to LMS User

### Purpose

Create or refresh the LMS user when a Contact becomes a student or when critical student data changes.

### Workflow Type

- Contact-based workflow

### Recommended Name

- `Contact > Sync Student to LMS User`

### Enrollment Triggers

Enroll Contact when all of the following are true:

- `user_type` is `Student`
- `email` is known
- `firstname` is known
- `lastname` is known
- At least one of these is true:
  - `lms_user_id` is unknown
  - `lms_sync_status` is `Error`
  - `lms_sync_status` is `Needs Review`

Re-enrollment should be allowed when any of these change:

- `email`
- `firstname`
- `lastname`
- `user_type`
- `lms_sync_status`

### Actions

1. If/then branch:
   - if `user_type` is not `Student`, exit

2. Set Contact property:
   - `lms_sync_status = Pending`
   - `last_lms_sync_error = ""`

3. Custom code action:
   - purpose: create or locate LMS user by email
   - outputs:
     - `success`
     - `lms_user_id`
     - `error_message`

4. If/then branch on `success`

If `success = true`:

- Set Contact properties:
  - `lms_user_id = output.lms_user_id`
  - `lms_sync_status = Synced`
  - `last_lms_sync_at = now`
  - `last_lms_sync_error = ""`

If `success = false`:

- Set Contact properties:
  - `lms_sync_status = Error` or `Needs Review` depending on output strategy
  - `last_lms_sync_at = now`
  - `last_lms_sync_error = output.error_message`

### Operational Notes

- This workflow should not send welcome email.
- This workflow should not create enrollments.
- It prepares the student identity layer so Enrollment workflow can move faster.

## Workflow 2: Course to LMS Course

### Purpose

Create or refresh the LMS course so that Enrollment sync can rely on a valid LMS course identifier and code.

### Workflow Type

- Course-based workflow

### Recommended Name

- `Course > Sync Course to LMS`

### Enrollment Triggers

Enroll Course when all of the following are true:

- `course_code` is known
- `hs_course_name` is known
- `course_active` is `true`
- At least one of these is true:
  - `lms_course_id` is unknown
  - `lms_sync_status` is `Error`
  - `lms_sync_status` is `Needs Review`

Re-enrollment should be allowed when any of these change:

- `course_code`
- `hs_course_name`
- `course_active`
- `lms_sync_status`

### Actions

1. If/then branch:
   - if `course_active` is not `true`, exit

2. Set Course properties:
   - `lms_sync_status = Pending`
   - `last_lms_sync_error = ""`

3. Custom code action:
   - purpose: create or locate LMS course by `course_code`
   - outputs:
     - `success`
     - `lms_course_id`
     - `error_message`

4. If/then branch on `success`

If `success = true`:

- Set Course properties:
  - `lms_course_id = output.lms_course_id`
  - `lms_sync_status = Synced`
  - `last_lms_sync_at = now`
  - `last_lms_sync_error = ""`

If `success = false`:

- Set Course properties:
  - `lms_sync_status = Error` or `Needs Review`
  - `last_lms_sync_at = now`
  - `last_lms_sync_error = output.error_message`

### Operational Notes

- This workflow should keep `course_code` and `lms_course_id` aligned.
- If the LMS API uses `courseCode` as the stable lookup key, keep that pattern. It is more operations-friendly than relying on UUIDs only.

## Workflow 3: Enrollment to LMS Enrollment

### Purpose

Create the LMS enrollment after both the student and the course are in a valid sync state.

### Workflow Type

- Enrollment-based workflow

### Recommended Name

- `Enrollment > Sync to LMS`

### Enrollment Triggers

Enroll Enrollment when all of the following are true:

- `sync_status` is one of:
  - `Pending`
  - `Error`
  - `Needs Resync`
- Enrollment has an associated Contact
- Enrollment has an associated Course

Re-enrollment should be allowed when any of these change:

- `sync_status`
- associated Contact changes
- associated Course changes

### Actions

1. Custom code action:
   - purpose: resolve associated Contact and Course, create or locate LMS user, then create or locate LMS enrollment
   - required inputs:
     - `enrollment_id`
     - `retry_count`
   - outputs:
     - `success`
     - `lms_user_id`
     - `lms_enrollment_id`
     - `error_message`

2. If/then branch on `success`

If `success = true`:

- Send welcome email from HubSpot
- Optionally set a dedicated audit property like:
  - `welcome_email_sent = true`
  - `welcome_email_sent_at = now`

If `success = false`:

- Leave record in queue with the `sync_status` and `last_error` already written by custom code
- Optionally create internal task when `retry_count >= 3`

### Current Implementation Note

The current custom code file already follows this approach:

- [hubspot-custom-code-action.js](./hubspot-custom-code-action.js)

It resolves:

- associated Contact from Enrollment
- associated Course from Enrollment
- Contact fields from HubSpot API
- Course fields from HubSpot API
- LMS user by `email`
- LMS enrollment by `userId + courseCode`

## Recommended Custom Code Responsibilities

### Contact Sync Code

Responsibilities:

- validate student identity fields
- search LMS user by email
- create LMS user when missing
- return `lms_user_id`

Should not:

- create enrollment
- send email

### Course Sync Code

Responsibilities:

- validate course identity fields
- search LMS course by `courseCode`
- create LMS course when missing
- return `lms_course_id`

Should not:

- create users
- create enrollments
- send email

### Enrollment Sync Code

Responsibilities:

- validate associations
- validate Contact is a student
- validate Course is active and has LMS identifier
- create or locate LMS user
- create or locate LMS enrollment
- write back sync state to Contact and Enrollment

Should not:

- create course records if course sync is its own workflow
- send email directly from code

## Welcome Email Design

Welcome email belongs only in the Enrollment workflow.

Reason:

- it should only send after successful enrollment creation
- this is the business event that matters most
- HubSpot gives native open tracking and reporting

Recommended action sequence:

1. Enrollment custom code returns `success = true`
2. If/then branch
3. Send workflow email
4. Optionally stamp audit properties

## Retry and Error Strategy

### Contact

- `Needs Review` for missing email or invalid student classification
- `Error` for LMS API failures

### Course

- `Needs Review` for missing `course_code` or invalid configuration
- `Error` for LMS API failures

### Enrollment

- `Needs Review` for missing association, invalid student type, missing LMS course code
- `Error` for transport, timeout, or unexpected LMS failures
- `retry_count` increments on each failed attempt

Recommended operational rule:

- if `retry_count >= 3`, assign to operations owner or create an internal task

## Views and Dashboards

### Contacts

Recommended views:

- `Students Pending LMS Sync`
- `Students LMS Error`
- `Students Needs Review`

### Courses

Recommended views:

- `Courses Pending LMS Sync`
- `Courses LMS Error`
- `Courses Needs Review`

### Enrollments

Recommended views:

- `Enrollments Pending Sync`
- `Enrollments Synced`
- `Enrollments Error`
- `Enrollments Needs Review`

## Build Order

To avoid stepping on the backend and frontend work, build in this order:

1. Confirm Contact, Course, and Enrollment properties
2. Confirm object associations
3. Finish Contact workflow
4. Finish Course workflow
5. Finish Enrollment workflow
6. Add welcome email branch
7. Add views and dashboards
8. Run end-to-end test cases

## End-to-End Test Matrix

### Contact Workflow

- Student Contact with valid email creates LMS user
- Non-student Contact does not sync
- Missing email moves to review state

### Course Workflow

- Active Course with code creates LMS course
- Inactive Course does not sync
- Missing course code moves to review state

### Enrollment Workflow

- Student + active Course + Pending Enrollment creates LMS enrollment
- Existing LMS user is reused
- Existing LMS enrollment is reused
- Missing associated Contact moves to review state
- Missing associated Course moves to review state
- Missing course LMS identifier moves to review state

## Final Recommendation

The definitive design is:

- one workflow for Contact sync
- one workflow for Course sync
- one workflow for Enrollment sync
- welcome email sent only after Enrollment success

This gives clean separation of responsibility while keeping the actual student lifecycle fully automated.
