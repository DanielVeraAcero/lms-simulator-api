

## Background:

(Note: this is based on a very early version of our infrastructure from years ago)

AltaClaro uses HubSpot as its source of truth for user and course enrollment data. We enroll
users as Contacts and associate them with custom objects of type Course. The association
between the two represents an enrollment.

We then have to manually create the users in the Learning Management System and enroll
them in courses there as well. The data should match.

We would like to create an automation/integration to manage users and course enrollments.
Since our team is more used to the HubSpot user interface, we would like them to be able to
create and update the data in HubSpot and have it sync it to the LMS.

We currently have a few automations created in Zapier, so we have a Zapier account. Other
consultants have proposed using more sophisticated integration tools, which we are open to,
but we haven’t looked at them yet, and we’re not sure why they would be better.

Having discussed it at the management level, we have the following concerns:

- If there is code involved, we want it to be developed quickly, and it should be easy to
maintain. We need the solution done before next week when we have 500 new students
enrolling.
- We don’t want an overly complex solution with new servers, technologies, subscriptions,
etc.
- We are concerned about being able to identify which Contacts are users versus which
Contacts are marketing contacts. We don’t want to confuse the two.
- Our last engineer left us a bunch of buggy automations that just send error emails to the
management team when things go wrong. We want a better way to handle errors,
logging, monitoring, and fixing issues.
- We would also like to send a welcome email to new users after they are successfully
registered, and we would like to know whether they have opened the email. The LMS
does not do this automatically.

## Exercise:

You are an operations consultant engaged to help with this project. Please do the following:

● Describe your approach to integrating the systems, including ay custom properties,
workflows, triggers, code, etc. Document any assumptions you make.
● Write some custom JavaScript or Python that would make any necessary API calls (if
API calls are needed). For the LMS, you can make up your own API endpoints based on
what you would expect to see.

● Document any edge cases or error states and whether you are handling them.
● Do you need anyone else from our team to help with any aspect of the project?
● Document any questions, suggestions for related projects, or anything else you can think
of as you do this exercise.

## Rules:
● Clearly document any assumptions you make, but also feel free to validate/explore those
assumptions with us as part of the exercise.
● Feel free to ask any clarifying questions via email.
● Please take no more than one week to complete the exercise (assuming we answer your
questions in a timely fashion; if there are any delays on our end, we can extend the
time). It is designed to take around an hour to complete.
● Present your findings and recommendations in a Google Docs report, but feel free to use
and link to Sheets or any other tools.
● Use any tools you like to complete the exercise, but please keep track of and identify
those tools in the report.