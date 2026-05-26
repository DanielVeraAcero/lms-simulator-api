# HubSpot to LMS Enrollment Sync Plan

## Executive Summary

AltaClaro should use HubSpot as the operational source of truth for students, courses, and enrollments, then sync successful enrollments into the LMS through a HubSpot workflow with a small custom code action.

This approach is intentionally pragmatic:

- It avoids new servers and heavy integration platforms.
- It gives the operations team a HubSpot-native workflow they can understand and monitor.
- It is more maintainable than a collection of opaque Zapier zaps.
- It can be built quickly enough for the upcoming batch of 500 students.

My recommendation is to start with HubSpot Operations Hub / Data Hub custom code actions if available. If the HubSpot tier does not support custom code actions, the fallback would be Zapier Webhooks or a lightweight serverless function, but I would not make those the first choice unless required.

## Assumptions

- HubSpot remains the source of truth for v1.
- The LMS exposes a REST API for user lookup, user creation, enrollment lookup, and enrollment creation.
- HubSpot has workflow access and, ideally, custom code action support.
- Course data already exists in HubSpot as a custom object.
- The integration only needs to sync HubSpot to LMS for v1. LMS-to-HubSpot sync can be handled later if needed.
- Welcome email tracking should happen in HubSpot, not the LMS.
- Open tracking is useful but imperfect because some email clients block tracking pixels.

## Recommended Data Model

The existing model says a Contact associated with a Course represents an enrollment. That is workable, but operationally limited if we need per-enrollment status, retries, errors, and LMS enrollment IDs.

If HubSpot custom objects are available, I recommend creating an explicit `Enrollment` custom object. This makes the integration easier to monitor and avoids overloading a Contact-level error property when a student may have multiple courses.

### Contact Properties

- `user_type`: Dropdown with values such as `Student`, `Marketing Lead`, `Staff`, and `Other`.
- `lms_user_id`: The LMS user identifier after the user is created or matched.
- `lms_sync_status`: High-level contact sync state, such as `Pending`, `Synced`, `Error`, or `Needs Review`.
- `last_lms_sync_at`: Timestamp of the most recent sync attempt.
- `last_lms_sync_error`: Most recent contact-level LMS error.

### Course Properties

- `lms_course_id`: The corresponding course identifier in the LMS.
- `course_active`: Boolean used to prevent enrollment into retired or invalid courses.

### Enrollment Properties

- `contact_id`: Associated HubSpot Contact.
- `course_id`: Associated HubSpot Course.
- `lms_enrollment_id`: LMS enrollment identifier after successful sync.
- `sync_status`: `Pending`, `Synced`, `Error`, `Needs Review`, or `Needs Resync`.
- `last_attempt_at`: Timestamp of last sync attempt.
- `retry_count`: Number of failed sync attempts.
- `last_error`: Most recent enrollment-level error.

If an explicit Enrollment object is too much for the one-week deadline, we can start with the current Contact-Course association model and store status on the Contact and Course where possible. However, I would flag that as less maintainable for students with multiple enrollments.

## Workflow Design

### Trigger

The workflow should run when an enrollment is created or updated and all of the following are true:

- The associated Contact has `user_type = Student`.
- The associated Contact has a valid email address.
- The associated Course has an `lms_course_id`.
- The Enrollment `sync_status` is `Pending`, `Error`, or `Needs Resync`.

### Custom Code Action

The custom code action should:

1. Read the Contact, Course, and Enrollment context from HubSpot workflow inputs.
2. Validate required fields: email, first name, last name, and LMS course ID.
3. Search the LMS for an existing user by email.
4. Create the LMS user if no user exists.
5. Save the LMS user ID back to the HubSpot Contact.
6. Search the LMS for an existing enrollment for that user/course pair.
7. Create the LMS enrollment if it does not already exist.
8. Save the LMS enrollment ID and mark the Enrollment as `Synced`.
9. Return success or failure outputs to the workflow.

I included a sample implementation in [custom-code-action.js](./custom-code-action.js).

### Welcome Email

After the custom code action returns success:

- Send the welcome email using HubSpot marketing/workflow email.
- Use HubSpot's native email tracking to report opens and engagement.
- Store the welcome email send state on the Contact or Enrollment if the operations team needs an audit trail.

The welcome email should not send if LMS registration or enrollment fails.

## Error Handling and Monitoring

The main operational improvement is to move from unmanaged error emails to a queue-based model in HubSpot.

### Error Handling Rules

- Missing email: mark Enrollment as `Needs Review`.
- Missing LMS course ID: mark Enrollment as `Needs Review`.
- Duplicate HubSpot Contacts with the same email: mark as `Needs Review`.
- Existing LMS user: reuse the user and store `lms_user_id`.
- Existing LMS enrollment: treat as success and store `lms_enrollment_id`.
- LMS timeout or rate limit: mark as `Error`, increment retry count, and allow retry.
- Partial success: if user creation succeeds but enrollment fails, persist `lms_user_id` and retry only the enrollment step.
- API authentication failure: mark as `Error` and alert the operations owner because retries will not solve bad credentials.

### Monitoring

Create HubSpot operational views and dashboards:

- Enrollments with `sync_status = Error`.
- Enrollments with `sync_status = Needs Review`.
- Enrollments pending for more than 15 minutes.
- Sync volume by day.
- Error count by error type.

Alerts should go to the operations owner only when:

- An enrollment fails after the maximum retry count.
- There is an authentication/configuration failure.
- Pending or error volume exceeds an agreed threshold before the 500-student launch.

This is better than sending raw exception emails to management because the operations team gets a structured work queue they can triage and fix.

## Zapier and iPaaS Recommendation

AltaClaro already has Zapier, so it is reasonable to use it for simple notification or backup workflows. I would not use Zapier as the primary sync engine if HubSpot custom code actions are available, because the primary workflow needs idempotency, clear error state, and controlled retries.

More sophisticated iPaaS tools such as Workato, Tray, Make, or Celigo may be valuable later if AltaClaro expects many systems, complex transformations, bidirectional sync, or enterprise monitoring. For this immediate exercise and deadline, they are probably unnecessary overhead.

## Team Help Needed

- HubSpot admin: confirm HubSpot tier, workflow permissions, custom object availability, private app/API permissions, and email tracking settings.
- LMS admin or developer: provide API documentation, sandbox credentials, production credentials, rate limits, required fields, and error formats.
- Operations owner: define who owns the error queue and the acceptable sync SLA.
- Marketing or Student Success: approve welcome email copy, sender, suppression rules, and tracking expectations.
- Data owner: confirm how Contacts should be classified as students versus marketing contacts.

## Clarifying Questions for AltaClaro

- Does the current HubSpot subscription include Operations Hub / Data Hub custom code actions?
- Does the LMS support API lookup by email, or only by LMS-specific user ID?
- Should course unenrollment in HubSpot remove access in the LMS, or is v1 create-only?
- Are students ever enrolled in multiple courses at once?
- Do we need to support updates to names/emails after the LMS user is created?
- Are there compliance or consent requirements around welcome emails and tracking?
- What is the expected operational SLA for fixing failed enrollments during the 500-student launch?

## Related Project Suggestions

- Data cleanup before launch: identify duplicate Contacts, missing emails, missing course IDs, and invalid student classifications.
- Enrollment import checklist: validate all 500 incoming students before triggering LMS sync.
- HubSpot dashboard for student lifecycle operations.
- Sync audit log object or external sheet if HubSpot reporting is not enough.
- Phase 2 LMS-to-HubSpot reconciliation job to detect changes made directly in the LMS.
- Phase 2 unenrollment/deactivation workflow after business rules are approved.

## Tools Used

- HubSpot workflows and custom code actions.
- HubSpot custom properties and, preferably, an Enrollment custom object.
- HubSpot marketing/workflow email for welcome emails and open tracking.
- JavaScript sample code for expected LMS API calls.
- Optional fallback: Zapier Webhooks or a small serverless function if HubSpot custom code actions are unavailable.

## Test Plan

- New Student Contact plus new Course enrollment creates the LMS user and LMS enrollment.
- Existing LMS user plus new Course enrollment reuses the user and creates only the enrollment.
- Existing LMS enrollment is treated as success and does not create a duplicate.
- Missing email marks the Enrollment as `Needs Review`.
- Missing LMS course ID marks the Enrollment as `Needs Review`.
- LMS timeout or 429 marks the Enrollment as `Error` and allows retry.
- Invalid LMS credentials produce an operational alert.
- Partial success persists `lms_user_id` and retries only the failed enrollment step.
- Welcome email sends only after successful LMS sync.
- HubSpot dashboards correctly show pending, synced, failed, and needs-review records.
