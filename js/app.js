import { loadContent, invalidateContentCache } from "./content.js";
import * as store from "./store.js";
import * as rules from "./rules.js";
import * as exportUtils from "./exportUtils.js";
import { getPath, setPath, debounce } from "./utils.js";
import * as views from "./views.js";

const appEl = document.getElementById("app");
const privacyModal = document.getElementById("privacyModal");

let content = null;
const expandedKeys = new Set();

async function init() {
  content = await loadContent();
  window.addEventListener("hashchange", render);
  render();
}

function currentStudentId() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  return parts[0] === "student" ? parts[1] : null;
}

function ensureDomainActivity(student, domainId, activityId) {
  if (!student.domainData[domainId]) student.domainData[domainId] = { activities: {}, customActivities: [] };
  if (!student.domainData[domainId].activities[activityId]) student.domainData[domainId].activities[activityId] = { evidenceIds: [] };
  return student.domainData[domainId].activities[activityId];
}

function render() {
  const hash = location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);

  if (parts.length === 0) {
    appEl.innerHTML = views.renderDashboard(store.listStudents(), content);
    return;
  }
  if (parts[0] === "about") {
    appEl.innerHTML = views.renderAbout(content);
    return;
  }
  if (parts[0] === "admin") {
    appEl.innerHTML = views.renderAdmin(content, store.getSettings());
    return;
  }
  if (parts[0] === "student" && parts[1]) {
    const student = store.getStudent(parts[1]);
    const step = parts[2] || "profile";
    if (!student) {
      appEl.innerHTML = "<p>Student not found in this browser.</p>";
      return;
    }
    let inner = "";
    if (step === "profile") inner = views.renderProfileStep(student);
    else if (step === "voice") inner = views.renderVoiceStep(student);
    else if (step === "parent") inner = views.renderParentStep(student);
    else if (step === "specialists") inner = views.renderSpecialistsStep(student);
    else if (step === "needs") inner = views.renderNeedsStep(content, student, expandedKeys);
    else if (step === "evidence") inner = views.renderEvidenceStep(content, student);
    else if (step === "attendance") inner = views.renderAttendanceStep(content, student);
    else if (step === "draft") inner = views.renderDraftStep(content, student);
    else if (step === "check") inner = views.renderCheckStep(student);
    else if (step === "ssg") inner = views.renderSSGStep(content, student);
    else if (step === "export") inner = views.renderExportStep(student);
    appEl.innerHTML = views.renderStudentShell(student, step, inner);
    return;
  }
  appEl.innerHTML = "<p>Page not found.</p>";
}

function mutateCurrentStudent(fn) {
  const id = currentStudentId();
  if (!id) return;
  store.updateStudent(id, (s) => {
    fn(s);
    return s;
  });
}

const debouncedFieldSave = debounce((path, value) => {
  mutateCurrentStudent((s) => setPath(s, path, value));
}, 400);

const debouncedActivityFieldSave = debounce((domainId, activityId, field, value) => {
  mutateCurrentStudent((s) => {
    const a = ensureDomainActivity(s, domainId, activityId);
    a[field] = value;
  });
}, 400);

// ---- Privacy modal ----
function maybeShowPrivacyModal() {
  const settings = store.getSettings();
  if (!settings.privacyAcknowledged) privacyModal.hidden = false;
}

// ---- Event delegation ----
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.matches("[data-action-field='save-activity-field']") && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
    debouncedActivityFieldSave(el.dataset.domain, el.dataset.activity, el.dataset.field, el.value);
  } else if (el.matches("[data-bind]") && el.dataset.bind !== "__activity__") {
    debouncedFieldSave(el.dataset.bind, el.value);
  }
});

document.addEventListener("change", (e) => {
  const el = e.target;

  if (el.matches("[data-action-field='save-activity-field']") && el.tagName === "SELECT") {
    mutateCurrentStudent((s) => {
      const a = ensureDomainActivity(s, el.dataset.domain, el.dataset.activity);
      a[el.dataset.field] = el.value;
    });
    return;
  }
  if (el.matches("[data-bind]") && el.tagName === "SELECT") {
    mutateCurrentStudent((s) => setPath(s, el.dataset.bind, el.value));
    render();
    return;
  }
  if (el.matches("[data-bind-checkbox]")) {
    mutateCurrentStudent((s) => setPath(s, el.dataset.bindCheckbox, el.checked));
    render();
    return;
  }
  if (el.dataset.action === "toggle-activity-relevant") {
    mutateCurrentStudent((s) => {
      const a = ensureDomainActivity(s, el.dataset.domain, el.dataset.activity);
      a.relevant = el.checked;
    });
    render();
    return;
  }
  if (el.dataset.action === "toggle-evidence-link") {
    mutateCurrentStudent((s) => {
      const a = ensureDomainActivity(s, el.dataset.domain, el.dataset.activity);
      a.evidenceIds = a.evidenceIds || [];
      const id = el.dataset.evidence;
      if (el.checked && !a.evidenceIds.includes(id)) a.evidenceIds.push(id);
      if (!el.checked) a.evidenceIds = a.evidenceIds.filter((x) => x !== id);
    });
    render();
    return;
  }
  if (el.dataset.action === "set-role") {
    const settings = store.getSettings();
    settings.role = el.value;
    store.saveSettings(settings);
    return;
  }
  if (el.dataset.action === "import-student-file") {
    const file = el.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        store.importStudentJSON(reader.result);
        render();
      } catch (err) {
        alert("Could not read that file as a student export: " + err.message);
      }
    };
    reader.readAsText(file);
    return;
  }
});

document.addEventListener("submit", (e) => {
  const form = e.target;
  const action = form.dataset.action;
  if (!action) return;
  e.preventDefault();
  const fd = new FormData(form);

  if (action === "create-student") {
    const student = store.createStudent({
      name: fd.get("name"), yearLevel: fd.get("yearLevel"), school: fd.get("school"), classroom: fd.get("classroom"),
    });
    location.hash = `#/student/${student.id}/profile`;
    return;
  }
  if (action === "add-voice-response") {
    const question = fd.get("question") === "__custom__" ? fd.get("customQuestion") || "Custom question" : fd.get("question");
    mutateCurrentStudent((s) => {
      s.studentVoice.responses = s.studentVoice.responses || [];
      s.studentVoice.responses.push({ question, answer: fd.get("answer"), exact: fd.get("exact") === "on" });
    });
    form.reset();
    render();
    return;
  }
  if (action === "add-specialist") {
    mutateCurrentStudent((s) => {
      s.specialists = s.specialists || [];
      s.specialists.push({
        profession: fd.get("profession"), name: fd.get("name"), dateOfInfo: fd.get("dateOfInfo"),
        adjustmentImplemented: fd.get("adjustmentImplemented"), recommendation: fd.get("recommendation"), notes: fd.get("notes"),
      });
    });
    form.reset();
    render();
    return;
  }
  if (action === "add-evidence") {
    mutateCurrentStudent((s) => {
      s.evidence = s.evidence || [];
      s.evidence.push({ id: "ev_" + Date.now().toString(36), title: fd.get("title"), type: fd.get("type"), description: fd.get("description") });
    });
    form.reset();
    render();
    return;
  }
  if (action === "add-custom-activity") {
    const domainId = form.dataset.domain;
    const name = fd.get("activityName");
    if (!name || !name.trim()) return;
    mutateCurrentStudent((s) => {
      if (!s.domainData[domainId]) s.domainData[domainId] = { activities: {}, customActivities: [] };
      const id = "custom-" + domainId + "-" + Date.now().toString(36);
      s.domainData[domainId].customActivities = s.domainData[domainId].customActivities || [];
      s.domainData[domainId].customActivities.push({ id, name: name.trim() });
      s.domainData[domainId].activities[id] = { relevant: true, evidenceIds: [] };
    });
    render();
    return;
  }
});

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  if (action === "acknowledge-privacy") {
    const settings = store.getSettings();
    settings.privacyAcknowledged = true;
    store.saveSettings(settings);
    privacyModal.hidden = true;
    return;
  }
  if (action === "delete-student") {
    if (!confirm("Permanently delete this student's data from this browser? This cannot be undone.")) return;
    store.deleteStudent(el.dataset.id);
    render();
    return;
  }
  if (action === "export-student-json") {
    const json = store.exportStudentJSON(el.dataset.id || currentStudentId());
    if (json) exportUtils.exportJSON("student-backup.json", JSON.parse(json));
    return;
  }
  if (action === "remove-voice-response") {
    mutateCurrentStudent((s) => s.studentVoice.responses.splice(Number(el.dataset.index), 1));
    render();
    return;
  }
  if (action === "remove-specialist") {
    mutateCurrentStudent((s) => s.specialists.splice(Number(el.dataset.index), 1));
    render();
    return;
  }
  if (action === "remove-evidence") {
    mutateCurrentStudent((s) => {
      s.evidence = s.evidence.filter((ev) => ev.id !== el.dataset.id);
      Object.values(s.domainData || {}).forEach((d) => Object.values(d.activities || {}).forEach((a) => {
        if (a.evidenceIds) a.evidenceIds = a.evidenceIds.filter((id) => id !== el.dataset.id);
      }));
    });
    render();
    return;
  }
  if (action === "make-specific") {
    const student = store.getStudent(currentStudentId());
    const a = (student.domainData[el.dataset.domain] || { activities: {} }).activities[el.dataset.activity] || {};
    const domain = content.domains.find((d) => d.id === el.dataset.domain);
    const activity = domain ? (domain.activities.concat((student.domainData[el.dataset.domain] || {}).customActivities || [])).find((ac) => ac.id === el.dataset.activity) : null;
    const result = rules.makeMoreSpecific(a, activity ? activity.name : "");
    mutateCurrentStudent((s) => {
      const entry = ensureDomainActivity(s, el.dataset.domain, el.dataset.activity);
      entry.specificResult = result.ok ? result.text : result.message;
    });
    render();
    return;
  }
  if (action === "toggle-expand") {
    if (expandedKeys.has(el.dataset.key)) expandedKeys.delete(el.dataset.key);
    else expandedKeys.add(el.dataset.key);
    render();
    return;
  }
  if (action === "generate-draft") {
    const student = store.getStudent(currentStudentId());
    const draft = rules.buildDraft(student, content);
    mutateCurrentStudent((s) => {
      s.draft = { sections: draft, lastGenerated: new Date().toISOString() };
    });
    render();
    return;
  }
  if (action === "save-content-override") {
    try {
      const edited = JSON.parse(document.getElementById("content-json-editor").value);
      store.saveContentOverride(edited);
      invalidateContentCache();
      loadContent().then((c) => { content = c; render(); alert("Saved for this browser only."); });
    } catch (err) {
      alert("That JSON could not be parsed: " + err.message);
    }
    return;
  }
  if (action === "download-content-json") {
    try {
      const edited = JSON.parse(document.getElementById("content-json-editor").value);
      exportUtils.exportJSON("content.json", edited);
    } catch (err) {
      alert("That JSON could not be parsed: " + err.message);
    }
    return;
  }
  if (action === "reset-content-override") {
    store.clearContentOverride();
    invalidateContentCache();
    loadContent().then((c) => { content = c; render(); });
    return;
  }
  if (action === "export-draft-doc") {
    const student = store.getStudent(currentStudentId());
    const draft = rules.buildDraft(student, content);
    exportUtils.exportDoc(`${student.profile.name || "student"}-profile-draft.doc`, `Draft preparation document \u2013 not an official Disability Inclusion Profile`, renderDraftDocHtml(draft));
    return;
  }
  if (action === "export-ssg-doc") {
    const student = store.getStudent(currentStudentId());
    const draft = rules.buildDraft(student, content);
    exportUtils.exportDoc(`${student.profile.name || "student"}-ssg-prep.doc`, "SSG Meeting Preparation", renderSSGDocHtml(draft, content), { footer: false });
    return;
  }
  if (action === "export-parent-summary-doc") {
    const student = store.getStudent(currentStudentId());
    const draft = rules.buildDraft(student, content);
    exportUtils.exportDoc(`${student.profile.name || "student"}-parent-summary.doc`, "Discussion summary for parents/carers", renderParentSummaryHtml(draft));
    return;
  }
  if (action === "export-facilitator-doc") {
    const student = store.getStudent(currentStudentId());
    const draft = rules.buildDraft(student, content);
    exportUtils.exportDoc(`${student.profile.name || "student"}-facilitator-prep.doc`, "Facilitator meeting preparation", renderFacilitatorPrepHtml(draft));
    return;
  }
  if (action === "export-adjustment-summary-doc") {
    const student = store.getStudent(currentStudentId());
    const draft = rules.buildDraft(student, content);
    exportUtils.exportDoc(`${student.profile.name || "student"}-adjustment-summary.doc`, "Adjustment summary", renderAdjustmentSummaryHtml(draft));
    return;
  }
  if (action === "export-gap-report-csv") {
    const student = store.getStudent(currentStudentId());
    const draft = rules.buildDraft(student, content);
    const rows = [["Domain", "Activity", "Reason"]];
    draft.evidenceGaps.forEach((g) => rows.push([g.domainName, g.activityName, g.reason]));
    if (rows.length === 1) rows.push(["(none)", "(none)", "No evidence gaps detected among activities marked relevant."]);
    exportUtils.exportCSV(`${student.profile.name || "student"}-evidence-gap-report.csv`, rows);
    return;
  }
  if (action === "export-matrix-csv") {
    const student = store.getStudent(currentStudentId());
    const rows = [["Domain", "Activity", "Functional Need", "Adjustment", "Frequency", "Intensity", "Evidence", "Monitoring", "Gap"]];
    Object.entries(student.domainData || {}).forEach(([domainId, d]) => {
      const domain = content.domains.find((dm) => dm.id === domainId);
      Object.entries(d.activities || {}).forEach(([activityId, a]) => {
        if (!a.relevant) return;
        const activity = (domain.activities.concat(d.customActivities || [])).find((ac) => ac.id === activityId);
        const linked = (a.evidenceIds || []).map((id) => ((student.evidence || []).find((e) => e.id === id) || {}).title).filter(Boolean).join("; ");
        rows.push([domain.name, activity ? activity.name : activityId, a.functionalNeed, a.currentAdjustment, a.frequency, a.intensity, linked, a.monitoring, linked ? "" : "gap"]);
      });
    });
    exportUtils.exportCSV(`${student.profile.name || "student"}-evidence-matrix.csv`, rows);
    return;
  }
  if (action === "export-print-pdf") {
    const student = store.getStudent(currentStudentId());
    const draft = rules.buildDraft(student, content);
    exportUtils.printSection(renderDraftDocHtml(draft), "Student Profile Draft");
    return;
  }
});

function renderSSGDocHtml(draft, content) {
  const ss = draft.studentSummary;
  let html = `<p><strong>Student:</strong> ${ss.name} &nbsp; <strong>Year level:</strong> ${ss.yearLevel || ""} &nbsp; <strong>School:</strong> ${ss.school || ""}</p>`;
  html += `<h2>Department end-to-end process</h2><ol>${content.processSteps.map((s) => `<li>${s}</li>`).join("")}</ol>`;
  html += `<h2>Questions for the SSG</h2><ul>${draft.questionsForSSG.map((q) => `<li>${q}</li>`).join("") || "<li>None generated</li>"}</ul>`;
  html += `<h2>Evidence gaps</h2><ul>${draft.evidenceGaps.map((g) => `<li>${g.domainName} \u2192 ${g.activityName}</li>`).join("") || "<li>None detected</li>"}</ul>`;
  return html;
}

// Plain-language version for families - avoids jargon like "personalisation"/"intensity".
function renderParentSummaryHtml(draft) {
  const ss = draft.studentSummary;
  let html = `<p>This is a plain-language summary to support our discussion with you. It is based only on information already recorded by the school - please let us know if anything here doesn't match your own experience.</p>`;
  html += `<h2>About ${ss.name}</h2>
    <p><strong>Strengths:</strong> ${ss.strengths}</p>
    <p><strong>Interests and what motivates them:</strong> ${ss.interests} ${ss.motivations}</p>
    <p><strong>Goals/aspirations:</strong> ${ss.aspirations}</p>`;
  if (draft.studentVoice.length) {
    html += `<h2>In their own words</h2>`;
    draft.studentVoice.forEach((r) => { html += `<p><strong>${r.question}</strong><br>${r.answer}</p>`; });
  }
  html += `<h2>What we are currently doing to help at school</h2>`;
  draft.domainSections.forEach((d) => {
    d.activities.forEach((a) => {
      html += `<p><strong>${a.activityName}:</strong> ${a.currentAdjustment}</p>`;
    });
  });
  html += `<h2>What we'd like your input on</h2><ul>${draft.questionsForSSG.map((q) => `<li>${q}</li>`).join("") || "<li>None yet</li>"}</ul>`;
  return html;
}

// Key facts staff should be ready to explain to the facilitator during the meeting.
function renderFacilitatorPrepHtml(draft) {
  const ss = draft.studentSummary;
  let html = `<p><strong>Student:</strong> ${ss.name} &nbsp; <strong>Year level:</strong> ${ss.yearLevel || ""} &nbsp; <strong>School:</strong> ${ss.school || ""}</p>
    <p><strong>Strengths:</strong> ${ss.strengths}</p>`;
  draft.domainSections.forEach((d) => {
    html += `<h2>${d.domainName}</h2>`;
    d.activities.forEach((a) => {
      html += `<h3>${a.activityName}</h3>
        <p><strong>Functional need:</strong> ${a.functionalNeed}</p>
        <p><strong>Adjustment, frequency and intensity:</strong> ${a.currentAdjustment} &mdash; ${a.frequency}, ${a.intensity}</p>
        <p><strong>Monitoring:</strong> ${a.monitoring}</p>
        <p><strong>Evidence items linked:</strong> ${a.evidenceCount}</p>
        <p><strong>Possible level for discussion:</strong> ${a.possibleLevel && a.possibleLevel.message ? a.possibleLevel.message : "Not enough information yet."}</p>`;
    });
  });
  html += `<h2>Evidence gaps to be ready to discuss</h2><ul>${draft.evidenceGaps.map((g) => `<li>${g.domainName} \u2192 ${g.activityName}</li>`).join("") || "<li>None detected</li>"}</ul>`;
  return html;
}

// Concise adjustment-only view (no functional-need detail) for quick reference.
function renderAdjustmentSummaryHtml(draft) {
  let html = `<table border="1" cellpadding="4" style="border-collapse:collapse;"><tr><th>Domain</th><th>Activity</th><th>Current adjustment</th><th>Frequency</th><th>Intensity</th></tr>`;
  draft.domainSections.forEach((d) => {
    d.activities.forEach((a) => {
      html += `<tr><td>${d.domainName}</td><td>${a.activityName}</td><td>${a.currentAdjustment}</td><td>${a.frequency}</td><td>${a.intensity}</td></tr>`;
    });
  });
  html += `</table>`;
  return html;
}

function renderDraftDocHtml(draft) {
  const ss = draft.studentSummary;
  let html = `<h2>Student summary</h2>
    <p><strong>Name:</strong> ${ss.name} &nbsp; <strong>Year level:</strong> ${ss.yearLevel || ""} &nbsp; <strong>School:</strong> ${ss.school || ""}</p>
    <p><strong>Strengths:</strong> ${ss.strengths}</p>
    <p><strong>Interests and motivations:</strong> ${ss.interests} ${ss.motivations}</p>
    <p><strong>Aspirations:</strong> ${ss.aspirations}</p>`;
  html += `<h2>Student voice</h2>`;
  draft.studentVoice.forEach((r) => { html += `<p><strong>${r.question}</strong><br>${r.answer}</p>`; });
  draft.domainSections.forEach((d) => {
    html += `<h2>${d.domainName}</h2>`;
    d.activities.forEach((a) => {
      html += `<h3>${a.activityName}</h3>
        <p><strong>Functional need:</strong> ${a.functionalNeed}</p>
        <p><strong>Impact on participation:</strong> ${a.impactOnParticipation}</p>
        <p><strong>Current adjustment:</strong> ${a.currentAdjustment}</p>
        <p><strong>Personalisation:</strong> ${a.personalisation}</p>
        <p><strong>Frequency:</strong> ${a.frequency}</p>
        <p><strong>Intensity:</strong> ${a.intensity}</p>
        <p><strong>Monitoring:</strong> ${a.monitoring}</p>
        <p><strong>Possible level for SSG discussion:</strong> ${a.possibleLevel && a.possibleLevel.message ? a.possibleLevel.message : "Not enough information yet."}</p>`;
    });
  });
  html += `<h2>Evidence gaps</h2><ul>${draft.evidenceGaps.map((g) => `<li>${g.domainName} \u2192 ${g.activityName}</li>`).join("") || "<li>None detected</li>"}</ul>`;
  html += `<h2>Questions for the SSG</h2><ul>${draft.questionsForSSG.map((q) => `<li>${q}</li>`).join("") || "<li>None generated</li>"}</ul>`;
  return html;
}

init().then(maybeShowPrivacyModal);
