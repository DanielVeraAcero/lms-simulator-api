const state = {
  formatter: new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }),
};

function byId(id) {
  return document.getElementById(id);
}

function text(value, fallback = "-") {
  return value || fallback;
}

function escapeHtml(value) {
  return String(text(value))
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return state.formatter.format(new Date(value));
}

function setMetric(id, value) {
  byId(id).textContent = Number(value || 0).toLocaleString("es-CO");
}

function badge(value) {
  const status = text(value, "unknown");
  const statusClass = String(status).toLowerCase().replaceAll(/[^a-z0-9_-]/g, "-");
  return `<span class="badge ${escapeHtml(statusClass)}">${escapeHtml(status)}</span>`;
}

function userName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

function renderSummary(summary) {
  setMetric("metric-users", summary.users);
  setMetric("metric-courses", summary.courses);
  setMetric("metric-enrollments", summary.enrollments);
  setMetric("metric-active-enrollments", summary.activeEnrollments);
}

function renderEnrollments(enrollments) {
  const table = byId("enrollments-table");
  const empty = byId("enrollments-empty");
  empty.hidden = enrollments.length > 0;

  table.innerHTML = enrollments
    .map(
      (enrollment) => `
        <tr>
          <td>
            <div class="person">
              <strong>${escapeHtml(userName(enrollment.user))}</strong>
              <span class="secondary">${escapeHtml(enrollment.user.contactType)}</span>
            </div>
          </td>
          <td>${escapeHtml(enrollment.user.email)}</td>
          <td>
            <div class="course">
              <strong>${escapeHtml(enrollment.course.title)}</strong>
              <span class="secondary">${escapeHtml(enrollment.course.courseCode)}</span>
            </div>
          </td>
          <td>${badge(enrollment.status)}</td>
          <td>${escapeHtml(formatDate(enrollment.createdAt))}</td>
        </tr>
      `,
    )
    .join("");
}

function renderCourses(courses) {
  const list = byId("courses-list");
  const empty = byId("courses-empty");
  empty.hidden = courses.length > 0;

  list.innerHTML = courses
    .map(
      (course) => `
        <div class="list-row">
          <div>
            <strong>${escapeHtml(course.title)}</strong>
            <span class="secondary">${escapeHtml(course.courseCode)} · ${badge(course.status)}</span>
          </div>
          <div class="count">
            ${course.enrollmentCount}
            <span>total</span>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderUsers(users) {
  const list = byId("users-list");
  const empty = byId("users-empty");
  empty.hidden = users.length > 0;

  list.innerHTML = users
    .map(
      (user) => `
        <div class="list-row">
          <div>
            <strong>${escapeHtml(userName(user))}</strong>
            <span class="secondary">${escapeHtml(user.email)} · ${escapeHtml(user.contactType)}</span>
          </div>
          <div class="count">
            ${user.enrollmentCount}
            <span>cursos</span>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderAuditLogs(logs) {
  const list = byId("audit-list");
  const empty = byId("audit-empty");
  empty.hidden = logs.length > 0;

  list.innerHTML = logs
    .map(
      (log) => `
        <li>
          <span class="timeline-marker"></span>
          <div>
            <strong>${escapeHtml(log.message)}</strong>
            <div class="secondary">${escapeHtml(log.entityType)} · ${escapeHtml(log.action)}</div>
          </div>
          ${badge(log.level)}
        </li>
      `,
    )
    .join("");
}

function renderEmptyDashboard() {
  renderSummary({
    users: 0,
    courses: 0,
    enrollments: 0,
    activeEnrollments: 0,
  });
  renderEnrollments([]);
  renderCourses([]);
  renderUsers([]);
  renderAuditLogs([]);
}

function setHealth(ok, label) {
  const dot = document.querySelector(".health-dot");
  dot.classList.toggle("ok", ok);
  byId("health-status").textContent = label;
}

async function loadDashboard() {
  setHealth(false, "Loading...");

  const [healthResponse, dashboardResponse] = await Promise.all([
    fetch("/health"),
    fetch("/api/dashboard"),
  ]);

  if (!healthResponse.ok || !dashboardResponse.ok) {
    throw new Error("Dashboard request failed");
  }

  const dashboardPayload = await dashboardResponse.json();
  const dashboard = dashboardPayload.data;

  renderSummary(dashboard.summary);
  renderEnrollments(dashboard.enrollments);
  renderCourses(dashboard.courses);
  renderUsers(dashboard.users);
  renderAuditLogs(dashboard.auditLogs);
  setHealth(true, "Online");
}

byId("refresh-button").addEventListener("click", () => {
  loadDashboard().catch((error) => {
    console.error(error);
    renderEmptyDashboard();
    setHealth(false, "Error");
  });
});

loadDashboard().catch((error) => {
  console.error(error);
  renderEmptyDashboard();
  setHealth(false, "Error");
});
