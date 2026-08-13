import { findSource } from "./content.js";
import { escapeHtml, nl2br } from "./utils.js";
import {
  scanRedFlags, activityCompleteness, makeMoreSpecific, suggestPossibleLevel,
  qualityChecklist, overallProgress, evidenceGaps, findDuplicateEvidence, buildDraft,
} from "./rules.js";

export const STEPS = [
  { id: "profile", label: "1. Profile & Strengths" },
  { id: "voice", label: "2. Student Voice" },
  { id: "parent", label: "3. Parent/Carer" },
  { id: "specialists", label: "4. Specialist Evidence" },
  { id: "needs", label: "5. Functional Needs" },
  { id: "evidence", label: "6. Evidence" },
  { id: "attendance", label: "7. Attendance / NCCD" },
  { id: "draft", label: "8. AI Draft" },
  { id: "check", label: "9. Evidence Check" },
  { id: "ssg", label: "10. SSG Prep" },
  { id: "export", label: "11. Export" },
];

const EVIDENCE_TYPES = [
  "IEP / ILP", "SSG records", "Teacher observation", "Adjustment record",
  "Behaviour support documentation", "Learning data", "Work sample",
  "Attendance / re-engagement information", "Specialist report", "Allied health information",
  "NCCD evidence", "Communication record", "Curriculum adjustment", "Transition information",
  "Other existing school-based documentation",
];

const SPECIALIST_PROFESSIONS = [
  "Psychologist", "Speech Pathologist", "Occupational Therapist", "Physiotherapist",
  "Paediatrician", "Mental health practitioner", "Other allied health / medical professional",
];

const YOUNGER_QUESTIONS = [
  "What do you enjoy at school?", "What are you really good at?", "What helps you learn?",
  "What makes school harder?", "What would you like adults to understand about you?",
];
const OLDER_QUESTIONS = [
  "What helps you participate?", "What gets in the way?", "What adjustments do you find useful?",
  "What would you like changed?", "What are your goals?",
];

function sourceNote(content, sourceId, extra) {
  const src = findSource(content, sourceId);
  if (!src) return "";
  return `<p class="source-note">Source: <a href="${src.url}" target="_blank" rel="noopener">${escapeHtml(src.title)}</a>${extra ? " &mdash; " + escapeHtml(extra) : ""}</p>`;
}

function bind(path, value, type, extraAttrs) {
  const v = escapeHtml(value || "");
  if (type === "textarea") {
    return `<textarea data-bind="${path}" ${extraAttrs || ""}>${v}</textarea>`;
  }
  return `<input type="text" data-bind="${path}" value="${v}" ${extraAttrs || ""}>`;
}

// ---------- Dashboard ----------
export function renderDashboard(students) {
  const cards = students.length
    ? students.map((s) => {
        const pct = overallProgress(s);
        return `<div class="card">
          <h3>${escapeHtml(s.profile.name || "(unnamed student)")}</h3>
          <p class="small-muted">${escapeHtml(s.profile.yearLevel || "")} ${s.profile.school ? "&middot; " + escapeHtml(s.profile.school) : ""}</p>
          <div class="progress-bar-outer"><div class="progress-bar-inner" style="width:${pct}%">${pct}% prepared</div></div>
          <p class="hint">This is a preparation-completeness indicator only. It does not imply Profile eligibility or funding.</p>
          <div class="button-grid">
            <a class="btn btn-primary btn-big" href="#/student/${s.id}/profile">Open</a>
            <button class="btn btn-secondary" data-action="export-student-json" data-id="${s.id}">Export backup (JSON)</button>
            <button class="btn btn-danger" data-action="delete-student" data-id="${s.id}">Delete</button>
          </div>
        </div>`;
      }).join("")
    : `<p>No students yet. Use fictional/test data if you're just trying the tool out.</p>`;

  return `
    <h1>Dashboard</h1>
    <div class="card">
      <h2>Add a student</h2>
      <p class="hint">Use this for a real student only once your school has approved this tool and its privacy requirements are met. For testing, use a made-up name.</p>
      <form data-action="create-student" class="grid grid-2">
        <div class="field"><label for="ns-name">Student name / identifier</label><input type="text" id="ns-name" name="name" required></div>
        <div class="field"><label for="ns-year">Year level</label>
          <select id="ns-year" name="yearLevel">
            <option value="">Select year level</option>
            <option>Kindergarten/Prep</option><option>Foundation</option>
            ${[...Array(12)].map((_, i) => `<option>Year ${i + 1}</option>`).join("")}
            <option>Ungraded / Specialist setting</option>
          </select>
        </div>
        <div class="field"><label for="ns-school">School</label><input type="text" id="ns-school" name="school"></div>
        <div class="field"><label for="ns-class">Classroom / homeroom</label><input type="text" id="ns-class" name="classroom"></div>
        <div class="field" style="grid-column:1/-1;"><button type="submit" class="btn btn-primary btn-big btn-block">+ Add student and start preparation</button></div>
      </form>
    </div>
    <div class="card">
      <h2>Import a previously exported student file</h2>
      <input type="file" accept="application/json" data-action="import-student-file">
    </div>
    <h2>Students in this browser</h2>
    <div class="grid grid-2">${cards}</div>
  `;
}

// ---------- About ----------
export function renderAbout(content) {
  const sources = content.meta.sourceUrls.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a></li>`).join("");
  return `
    <h1>About this tool</h1>
    <div class="card">
      <p><strong>${escapeHtml(content.meta.shortDisclaimer)}</strong></p>
      <p>It helps Victorian government school staff prepare strengths-based, functional-needs-focused, student-specific information for the Disability Inclusion Profile (DIP) process, and organise existing evidence before a profile meeting.</p>
      <h3>What this tool does NOT do</h3>
      <ul>
        <li>It does not determine a student's official Disability Inclusion Profile outcome.</li>
        <li>It does not guarantee Tier 3 funding or automatically classify a student as eligible.</li>
        <li>It does not replace the official DIFS Portal, professional judgement, or the Student Support Group process.</li>
        <li>It never invents diagnoses, assessments, evidence, quotes or specialist recommendations &mdash; every statement it produces comes only from information you typed in.</li>
      </ul>
      <h3>How it is hosted (important limitations)</h3>
      <p>This is a static website hosted on GitHub Pages. There is <strong>no server or database</strong>. All student data is stored only in your browser's local storage on this device &mdash; it is never uploaded anywhere by this tool. There is no real login/authentication; any "role" selector is for tailoring the interface only and is not a security boundary. Because of this, real students' identifiable information should only be entered once your school has approved the tool and confirmed privacy/records-management requirements are met.</p>
      <h3>Department Knowledge Base &mdash; sources used</h3>
      <p>Domain names, the 6-domain/31-activity structure, the personalisation/frequency/intensity dimensions, the four adjustment-level names, and the supporting-information rules in this tool are drawn from the Department's current published pages below (last checked ${escapeHtml(content.meta.lastReviewed)}).</p>
      <ul>${sources}</ul>
      <p class="hint">${escapeHtml(content.meta.verificationNote)}</p>
      <h3>"Why am I seeing this?"</h3>
      <p>Wherever this tool references Department requirements, look for a source note box like the ones on the Functional Needs and Evidence pages &mdash; it links directly to the Department page or resource behind that guidance.</p>
    </div>
  `;
}

// ---------- Admin ----------
export function renderAdmin(content, settings) {
  return `
    <h1>Admin / Content</h1>
    <div class="card">
      <h2>Role (interface only &mdash; not a security control)</h2>
      <div class="field">
        <label for="role-select">Choose a role to tailor labels shown in this browser</label>
        <select id="role-select" data-action="set-role">
          <option value="">Not set</option>
          <option value="coordinator" ${settings.role === "coordinator" ? "selected" : ""}>Disability Inclusion Coordinator</option>
          <option value="teacher" ${settings.role === "teacher" ? "selected" : ""}>Teacher</option>
          <option value="ess" ${settings.role === "ess" ? "selected" : ""}>Education Support Staff</option>
          <option value="leadership" ${settings.role === "leadership" ? "selected" : ""}>School Leadership</option>
          <option value="admin" ${settings.role === "admin" ? "selected" : ""}>School Administrator</option>
        </select>
        <p class="hint">There is no server, so this cannot enforce real permissions. It only remembers a label in this browser.</p>
      </div>
    </div>
    <div class="card">
      <h2>Department content layer</h2>
      <p>Domains, activities and adjustment-level wording live in <code>data/content.json</code>. Edit the JSON below to try changes in this browser only, or download the file and replace it in the GitHub repository so the change applies for everyone.</p>
      <div class="field">
        <textarea id="content-json-editor" style="min-height:320px; font-family:monospace; font-size:0.85rem;">${escapeHtml(JSON.stringify(content, null, 2))}</textarea>
      </div>
      <div class="button-grid">
        <button class="btn btn-primary" data-action="save-content-override">Save override (this browser only)</button>
        <button class="btn btn-secondary" data-action="download-content-json">Download content.json (for the repo)</button>
        <button class="btn btn-danger" data-action="reset-content-override">Reset to shipped defaults</button>
      </div>
      <p class="hint">Automated monitoring: a scheduled GitHub Action checks the Department's policy page for changes and opens a GitHub Issue for a maintainer to review. It never edits this content automatically.</p>
    </div>
  `;
}

// ---------- Student shell ----------
export function renderStudentShell(student, activeStep, innerHtml) {
  const pct = overallProgress(student);
  const steps = STEPS.map((s) => `<a href="#/student/${student.id}/${s.id}" class="${s.id === activeStep ? "active" : ""}">${s.label}</a>`).join("");
  return `
    <a href="#/" class="btn btn-secondary" style="margin-bottom:1rem;">&larr; Back to dashboard</a>
    <h1>${escapeHtml(student.profile.name || "(unnamed student)")}</h1>
    <div class="progress-bar-outer"><div class="progress-bar-inner" style="width:${pct}%">Profile preparation ${pct}% complete</div></div>
    <p class="hint">This shows how much preparation information has been entered. It does not indicate Profile eligibility or funding likelihood.</p>
    <nav class="stepper">${steps}</nav>
    ${innerHtml}
  `;
}

// ---------- Step: profile ----------
export function renderProfileStep(student) {
  const p = student.profile;
  return `
    <div class="card">
      <h2>Student profile</h2>
      <div class="grid grid-2">
        <div class="field"><label>Student name / identifier</label>${bind("profile.name", p.name)}</div>
        <div class="field"><label>Year level</label>
          <select data-bind="profile.yearLevel">
            <option value="">Select year level</option>
            <option ${p.yearLevel === "Kindergarten/Prep" ? "selected" : ""}>Kindergarten/Prep</option>
            <option ${p.yearLevel === "Foundation" ? "selected" : ""}>Foundation</option>
            ${[...Array(12)].map((_, i) => `<option ${p.yearLevel === `Year ${i + 1}` ? "selected" : ""}>Year ${i + 1}</option>`).join("")}
            <option ${p.yearLevel === "Ungraded / Specialist setting" ? "selected" : ""}>Ungraded / Specialist setting</option>
          </select>
        </div>
        <div class="field"><label>Age</label><input type="number" min="3" max="21" data-bind="profile.age" value="${escapeHtml(p.age)}"></div>
        <div class="field"><label>School</label>${bind("profile.school", p.school)}</div>
        <div class="field"><label>Classroom</label>${bind("profile.classroom", p.classroom)}</div>
        <div class="field"><label>Communication preferences</label>${bind("profile.communicationPreferences", p.communicationPreferences, "textarea")}</div>
      </div>
    </div>
    <div class="card">
      <h2>Strengths-based information</h2>
      <p class="hint">Focus on strengths, interests, motivations and aspirations first &mdash; this is the Department's recommended starting point.</p>
      <div class="field"><label>Strengths</label>${bind("profile.strengths", p.strengths, "textarea")}</div>
      <div class="field"><label>Interests</label>${bind("profile.interests", p.interests, "textarea")}</div>
      <div class="field"><label>Motivations</label>${bind("profile.motivations", p.motivations, "textarea")}</div>
      <div class="field"><label>Aspirations</label>${bind("profile.aspirations", p.aspirations, "textarea")}</div>
      <div class="field"><label>Relevant background information</label>${bind("profile.background", p.background, "textarea")}</div>
    </div>
    <a class="btn btn-primary btn-big" href="#/student/${student.id}/voice">Save &amp; continue &rarr; Student Voice</a>
  `;
}

// ---------- Step: voice ----------
export function renderVoiceStep(student) {
  const sv = student.studentVoice;
  const bank = sv.ageBand === "older" ? OLDER_QUESTIONS : YOUNGER_QUESTIONS;
  const responses = (sv.responses || []).map((r, i) => `
    <div class="activity-block">
      <p><strong>${escapeHtml(r.question)}</strong></p>
      <div class="${r.exact ? "quote-block" : ""}">${nl2br(r.answer)}</div>
      <p class="small-muted">${r.exact ? "Recorded as the student's exact words (direct quote)." : "Staff summary (not a direct quote)."}</p>
      <button class="btn btn-danger" data-action="remove-voice-response" data-index="${i}">Remove</button>
    </div>`).join("");

  return `
    <div class="card">
      <h2>Student voice</h2>
      <p class="hint">Questions adapt to the student's age/communication needs. Only mark a response as an "exact quote" if it is genuinely the student's own words.</p>
      <div class="field"><label>Age band</label>
        <select data-bind="studentVoice.ageBand">
          <option value="">Select</option>
          <option value="younger" ${sv.ageBand === "younger" ? "selected" : ""}>Younger student</option>
          <option value="older" ${sv.ageBand === "older" ? "selected" : ""}>Older student</option>
        </select>
      </div>
      <form data-action="add-voice-response" class="grid">
        <div class="field"><label>Question</label>
          <select name="question">
            ${bank.map((q) => `<option>${escapeHtml(q)}</option>`).join("")}
            <option value="__custom__">Other (type your own)</option>
          </select>
        </div>
        <div class="field"><label>Custom question (if selected above)</label><input type="text" name="customQuestion"></div>
        <div class="field"><label>Student's response</label><textarea name="answer" required></textarea></div>
        <div class="field"><label><input type="checkbox" name="exact" style="width:auto;display:inline-block;"> These are the student's exact words (direct quote)</label></div>
        <button type="submit" class="btn btn-primary btn-big">+ Add response</button>
      </form>
    </div>
    <div class="card"><h3>Recorded responses</h3>${responses || "<p>No responses recorded yet.</p>"}</div>
    <a class="btn btn-primary btn-big" href="#/student/${student.id}/parent">Continue &rarr; Parent/Carer</a>
  `;
}

// ---------- Step: parent ----------
export function renderParentStep(student) {
  const pc = student.parentCarer;
  return `
    <div class="card">
      <h2>Parent/carer input <span class="small-muted">("Parent/carer report" &mdash; kept separate from school observations and specialist evidence)</span></h2>
      <div class="field"><label>Observations</label>${bind("parentCarer.observations", pc.observations, "textarea")}</div>
      <div class="field"><label>Priorities</label>${bind("parentCarer.priorities", pc.priorities, "textarea")}</div>
      <div class="field"><label>Goals</label>${bind("parentCarer.goals", pc.goals, "textarea")}</div>
      <div class="field"><label>Concerns</label>${bind("parentCarer.concerns", pc.concerns, "textarea")}</div>
      <div class="field"><label>Strategies that work at home</label>${bind("parentCarer.strategies", pc.strategies, "textarea")}</div>
      <div class="field"><label>Relevant specialist information shared by the family</label>${bind("parentCarer.specialistInfoFromParent", pc.specialistInfoFromParent, "textarea")}</div>
    </div>
    <a class="btn btn-primary btn-big" href="#/student/${student.id}/specialists">Continue &rarr; Specialist Evidence</a>
  `;
}

// ---------- Step: specialists ----------
export function renderSpecialistsStep(student) {
  const rows = (student.specialists || []).map((sp, i) => `
    <div class="activity-block">
      <p><strong>${escapeHtml(sp.profession)}</strong> ${sp.name ? "&mdash; " + escapeHtml(sp.name) : ""} <span class="small-muted">${sp.dateOfInfo ? escapeHtml(sp.dateOfInfo) : ""}</span></p>
      <p><em>Specialist recommendation:</em> ${nl2br(sp.recommendation)}</p>
      <p><em>Adjustment actually implemented by the school:</em> ${escapeHtml(sp.adjustmentImplemented || "Not yet confirmed")}</p>
      ${sp.notes ? `<p>${nl2br(sp.notes)}</p>` : ""}
      <button class="btn btn-danger" data-action="remove-specialist" data-index="${i}">Remove</button>
    </div>`).join("");

  return `
    <div class="card">
      <h2>Specialist evidence</h2>
      <p class="hint">A specialist recommendation does not automatically mean the school is providing that adjustment &mdash; record both separately.</p>
      <form data-action="add-specialist" class="grid grid-2">
        <div class="field"><label>Profession</label><select name="profession">${SPECIALIST_PROFESSIONS.map((p) => `<option>${p}</option>`).join("")}</select></div>
        <div class="field"><label>Name (optional)</label><input type="text" name="name"></div>
        <div class="field"><label>Date of information</label><input type="date" name="dateOfInfo"></div>
        <div class="field"><label>Adjustment actually implemented by school?</label>
          <select name="adjustmentImplemented"><option>Not yet confirmed</option><option>Yes</option><option>Partially</option><option>No</option></select>
        </div>
        <div class="field" style="grid-column:1/-1;"><label>Specialist recommendation</label><textarea name="recommendation" required></textarea></div>
        <div class="field" style="grid-column:1/-1;"><label>Notes</label><textarea name="notes"></textarea></div>
        <div class="field" style="grid-column:1/-1;"><button type="submit" class="btn btn-primary btn-big">+ Add specialist entry</button></div>
      </form>
    </div>
    <div class="card"><h3>Recorded specialist entries</h3>${rows || "<p>None recorded yet.</p>"}</div>
    <a class="btn btn-primary btn-big" href="#/student/${student.id}/needs">Continue &rarr; Functional Needs</a>
  `;
}

// ---------- Step: needs (domains/activities) ----------
export function renderNeedsStep(content, student, expandedKeys) {
  const domainCards = content.domains.map((domain) => {
    const domainState = student.domainData[domain.id] || { activities: {}, customActivities: [] };
    const customActivities = domainState.customActivities || [];
    const allActivities = domain.activities.concat(customActivities.map((c) => Object.assign({ verified: "custom" }, c)));

    const activityBlocks = allActivities.map((activity) => {
      const key = `${domain.id}::${activity.id}`;
      const a = domainState.activities[activity.id] || {};
      const expanded = a.relevant && expandedKeys.has(key);
      const evidenceChips = (student.evidence || []).map((ev) => {
        const linked = (a.evidenceIds || []).includes(ev.id);
        return `<label class="evidence-chip"><input type="checkbox" data-action="toggle-evidence-link" data-domain="${domain.id}" data-activity="${activity.id}" data-evidence="${ev.id}" ${linked ? "checked" : ""} style="width:auto;"> ${escapeHtml(ev.title)}</label>`;
      }).join("") || "<span class='small-muted'>No evidence entered yet &mdash; add it on the Evidence step.</span>";

      const completeness = activityCompleteness(a);
      const levelSuggestion = a.relevant ? suggestPossibleLevel(a) : null;

      return `
        <div class="activity-block">
          <label><input type="checkbox" data-action="toggle-activity-relevant" data-domain="${domain.id}" data-activity="${activity.id}" ${a.relevant ? "checked" : ""} style="width:auto;display:inline-block;">
            <strong>${escapeHtml(activity.name)}</strong> ${activity.verified === "custom" ? '<span class="tag tag-partial">custom</span>' : activity.verified ? "" : '<span class="tag tag-partial">unverified example</span>'}
          </label>
          ${a.relevant ? `
            <div class="grid grid-2" style="margin-top:0.75rem;">
              <div class="field"><label>Functional need (what the student finds difficult, and where)</label>${bind(`__activity__`, a.functionalNeed, "textarea", `data-action-field="save-activity-field" data-domain="${domain.id}" data-activity="${activity.id}" data-field="functionalNeed"`)}</div>
              <div class="field"><label>Impact on participation/learning</label>${bind(`__activity__`, a.impactOnParticipation, "textarea", `data-action-field="save-activity-field" data-domain="${domain.id}" data-activity="${activity.id}" data-field="impactOnParticipation"`)}</div>
              <div class="field"><label>Current adjustment (what/who)</label>${bind(`__activity__`, a.currentAdjustment, "textarea", `data-action-field="save-activity-field" data-domain="${domain.id}" data-activity="${activity.id}" data-field="currentAdjustment"`)}</div>
              <div class="field"><label>Personalisation (how it's tailored to this student)</label>${bind(`__activity__`, a.personalisation, "textarea", `data-action-field="save-activity-field" data-domain="${domain.id}" data-activity="${activity.id}" data-field="personalisation"`)}</div>
              <div class="field"><label>Frequency</label>${bind(`__activity__`, a.frequency, "textarea", `data-action-field="save-activity-field" data-domain="${domain.id}" data-activity="${activity.id}" data-field="frequency"`)}</div>
              <div class="field"><label>Intensity</label>${bind(`__activity__`, a.intensity, "textarea", `data-action-field="save-activity-field" data-domain="${domain.id}" data-activity="${activity.id}" data-field="intensity"`)}</div>
              <div class="field"><label>Monitoring (how the school knows it's working)</label>${bind(`__activity__`, a.monitoring, "textarea", `data-action-field="save-activity-field" data-domain="${domain.id}" data-activity="${activity.id}" data-field="monitoring"`)}</div>
              <div class="field"><label>Student voice (where relevant)</label>${bind(`__activity__`, a.studentVoiceNote, "textarea", `data-action-field="save-activity-field" data-domain="${domain.id}" data-activity="${activity.id}" data-field="studentVoiceNote"`)}</div>
              <div class="field"><label>Family/carer input (where relevant)</label>${bind(`__activity__`, a.familyInput, "textarea", `data-action-field="save-activity-field" data-domain="${domain.id}" data-activity="${activity.id}" data-field="familyInput"`)}</div>
              <div class="field"><label>Specialist input (where relevant)</label>${bind(`__activity__`, a.specialistInput, "textarea", `data-action-field="save-activity-field" data-domain="${domain.id}" data-activity="${activity.id}" data-field="specialistInput"`)}</div>
            </div>
            <div class="field"><label>Evidence linked to this activity</label>${evidenceChips}</div>
            <div class="button-grid">
              <button class="btn btn-secondary" data-action="make-specific" data-domain="${domain.id}" data-activity="${activity.id}">Make this more specific</button>
              <button class="btn btn-secondary" data-action="toggle-expand" data-key="${key}">${expanded ? "Hide" : "Show"} suggested adjustment level</button>
            </div>
            ${!completeness.complete ? `<p class="hint">Still needed before a specific draft can be produced: ${completeness.missing.join(", ")}</p>` : ""}
            ${a.specificResult ? `<div class="source-note">${escapeHtml(a.specificResult)}</div>` : ""}
            ${expanded && levelSuggestion ? `
              <div class="source-note">${escapeHtml(levelSuggestion.message)}</div>
              <div class="grid grid-2">
                <div class="field"><label>Team-agreed "possible level" for SSG discussion</label>
                  <select data-action-field="save-activity-field" data-domain="${domain.id}" data-activity="${activity.id}" data-field="possibleLevelUserSelected">
                    <option value="">Not yet determined</option>
                    ${content.adjustmentLevels.map((l) => `<option value="${l.id}" ${a.possibleLevelUserSelected === l.id ? "selected" : ""}>${l.name}</option>`).join("")}
                  </select>
                </div>
                <div class="field"><label>Evidence supporting this interpretation</label>${bind(`__activity__`, a.levelNotes, "textarea", `data-action-field="save-activity-field" data-domain="${domain.id}" data-activity="${activity.id}" data-field="levelNotes"`)}</div>
              </div>` : ""}
          ` : ""}
        </div>`;
    }).join("");

    return `
      <div class="card domain-card">
        <h2>${escapeHtml(domain.name)} <span class="small-muted">${escapeHtml(domain.tagline)}</span></h2>
        ${sourceNote(content, domain.sourceId)}
        ${activityBlocks}
        <form data-action="add-custom-activity" data-domain="${domain.id}" style="margin-top:0.75rem;">
          <div class="field"><label>Add another activity in this domain (not in the starter list)</label>
            <input type="text" name="activityName" placeholder="e.g. specific classroom task">
          </div>
          <button type="submit" class="btn btn-secondary">+ Add activity</button>
        </form>
      </div>`;
  }).join("");

  return `
    <div class="card">
      <h2>Functional needs, not diagnosis</h2>
      <p>A diagnosis never automatically produces an adjustment level. For each relevant activity, describe what the student finds difficult in the school environment and what adjustment is required to participate on the same basis as peers.</p>
      ${sourceNote(content, "policy", "What is a reasonable adjustment / levels of adjustment")}
    </div>
    ${domainCards}
    <a class="btn btn-primary btn-big" href="#/student/${student.id}/evidence">Continue &rarr; Evidence</a>
  `;
}

// ---------- Step: evidence ----------
export function renderEvidenceStep(content, student) {
  const evidenceList = student.evidence || [];
  const dup = findDuplicateEvidence(evidenceList);
  const gaps = evidenceGaps(student, content);
  const max = content.supportingInformation.maxRecommendedDocuments;

  const rows = evidenceList.map((ev) => `
    <div class="activity-block">
      <p><strong>${escapeHtml(ev.title)}</strong> <span class="tag tag-partial">${escapeHtml(ev.type)}</span></p>
      ${ev.description ? `<p>${nl2br(ev.description)}</p>` : ""}
      <button class="btn btn-danger" data-action="remove-evidence" data-id="${ev.id}">Remove</button>
    </div>`).join("");

  const matrixRows = [];
  Object.entries(student.domainData || {}).forEach(([domainId, d]) => {
    const domain = content.domains.find((dm) => dm.id === domainId);
    Object.entries(d.activities || {}).forEach(([activityId, a]) => {
      if (!a.relevant) return;
      const activity = (domain.activities.concat(d.customActivities || [])).find((ac) => ac.id === activityId);
      const linked = (a.evidenceIds || []).map((id) => (evidenceList.find((e) => e.id === id) || {}).title).filter(Boolean);
      matrixRows.push(`<tr>
        <td>${escapeHtml(activity ? activity.name : activityId)}</td>
        <td>${escapeHtml(a.functionalNeed || "")}</td>
        <td>${escapeHtml(a.currentAdjustment || "")}</td>
        <td>${escapeHtml(a.frequency || "")}</td>
        <td>${escapeHtml(a.intensity || "")}</td>
        <td>${linked.length ? linked.map(escapeHtml).join(", ") : "<span class='tag tag-none'>none</span>"}</td>
        <td>${escapeHtml(a.monitoring || "")}</td>
        <td>${linked.length ? "" : "<span class='tag tag-none'>gap</span>"}</td>
      </tr>`);
    });
  });

  return `
    <div class="card">
      <h2>Evidence organiser</h2>
      ${sourceNote(content, "guidance-supporting-info", content.supportingInformation.principle)}
      <p>${evidenceList.length} document(s) entered. Department guidance recommends a maximum of ${max} high-quality, relevant documents. ${evidenceList.length > max ? `<span class="tag tag-none">Over recommended limit &mdash; prioritise the most relevant.</span>` : ""}</p>
      ${dup.length ? `<div class="flag-box">Possible duplicate evidence detected: ${dup.map((d) => escapeHtml(d.title)).join(", ")}</div>` : ""}
      <form data-action="add-evidence" class="grid grid-2">
        <div class="field"><label>Title</label><input type="text" name="title" placeholder="e.g. Student name - Term 1 IEP" required></div>
        <div class="field"><label>Type</label><select name="type">${EVIDENCE_TYPES.map((t) => `<option>${t}</option>`).join("")}</select></div>
        <div class="field" style="grid-column:1/-1;"><label>Description / what it shows</label><textarea name="description"></textarea></div>
        <div class="field" style="grid-column:1/-1;"><button type="submit" class="btn btn-primary btn-big">+ Add evidence</button></div>
      </form>
    </div>
    <div class="card"><h3>Evidence list</h3>${rows || "<p>No evidence entered yet.</p>"}</div>
    <div class="card">
      <h3>Evidence gaps</h3>
      ${gaps.length ? `<ul>${gaps.map((g) => `<li>${escapeHtml(g.domainName)} &rarr; ${escapeHtml(g.activityName)}: ${escapeHtml(g.reason)}</li>`).join("")}</ul>` : "<p>No gaps detected among activities marked relevant.</p>"}
    </div>
    <div class="card">
      <h3>Evidence matrix</h3>
      <table class="matrix">
        <thead><tr><th>Activity</th><th>Functional need</th><th>Adjustment</th><th>Frequency</th><th>Intensity</th><th>Evidence</th><th>Monitoring</th><th>Gap</th></tr></thead>
        <tbody>${matrixRows.join("") || "<tr><td colspan='8'>No relevant activities recorded yet.</td></tr>"}</tbody>
      </table>
    </div>
    <a class="btn btn-primary btn-big" href="#/student/${student.id}/attendance">Continue &rarr; Attendance / NCCD</a>
  `;
}

// ---------- Step: attendance/NCCD ----------
export function renderAttendanceStep(content, student) {
  const at = student.attendance;
  const nc = student.nccd;
  return `
    <div class="card">
      <h2>NCCD (optional)</h2>
      ${sourceNote(content, "guidance-supporting-info", content.nccd.note)}
      <label><input type="checkbox" data-bind-checkbox="nccd.include" ${nc.include ? "checked" : ""} style="width:auto;display:inline-block;"> Include NCCD-related notes for this student</label>
      ${nc.include ? `<div class="field"><label>NCCD notes</label>${bind("nccd.notes", nc.notes, "textarea")}</div>` : ""}
    </div>
    <div class="card">
      <h2>Low-attendance pathway (optional)</h2>
      ${sourceNote(content, "guidance-supporting-info", content.lowAttendancePathway.note)}
      <label><input type="checkbox" data-bind-checkbox="attendance.lowAttendance" ${at.lowAttendance ? "checked" : ""} style="width:auto;display:inline-block;"> This student has low/irregular attendance</label>
      ${at.lowAttendance ? `
        <div class="grid grid-2">
          <div class="field"><label>Attendance patterns</label>${bind("attendance.patterns", at.patterns, "textarea")}</div>
          <div class="field"><label>Barriers</label>${bind("attendance.barriers", at.barriers, "textarea")}</div>
          <div class="field"><label>Adjustments</label>${bind("attendance.adjustments", at.adjustments, "textarea")}</div>
          <div class="field"><label>Re-engagement strategies</label>${bind("attendance.reengagement", at.reengagement, "textarea")}</div>
          <div class="field"><label>Monitoring</label>${bind("attendance.monitoring", at.monitoring, "textarea")}</div>
          <div class="field"><label>Future planning</label>${bind("attendance.futurePlanning", at.futurePlanning, "textarea")}</div>
        </div>` : ""}
    </div>
    <a class="btn btn-primary btn-big" href="#/student/${student.id}/draft">Continue &rarr; AI Draft</a>
  `;
}

// ---------- Step: draft ----------
export function renderDraftStep(content, student) {
  const draft = student.draft.lastGenerated ? student.draft.sections : null;
  return `
    <div class="card">
      <h2>AI-generated draft</h2>
      <p class="hint">This draft is built only from information you entered elsewhere in this tool. Nothing is invented. If a section says "Not yet provided", go back and add that information.</p>
      <button class="btn btn-primary btn-big" data-action="generate-draft">${draft ? "Regenerate draft" : "Generate draft"}</button>
      ${student.draft.lastGenerated ? `<p class="small-muted">Last generated: ${new Date(student.draft.lastGenerated).toLocaleString()}</p>` : ""}
    </div>
    ${draft ? renderDraftContent(draft) : ""}
    <a class="btn btn-primary btn-big" href="#/student/${student.id}/check">Continue &rarr; Evidence Check</a>
  `;
}

function renderDraftContent(draft) {
  const ss = draft.studentSummary;
  const domainHtml = draft.domainSections.map((d) => `
    <div class="card domain-card">
      <h3>${escapeHtml(d.domainName)}</h3>
      ${d.activities.map((a) => `
        <div class="activity-block">
          <h4>${escapeHtml(a.activityName)}</h4>
          <p><strong>Functional need:</strong> ${nl2br(a.functionalNeed)}</p>
          <p><strong>Impact on participation:</strong> ${nl2br(a.impactOnParticipation)}</p>
          <p><strong>Current adjustment:</strong> ${nl2br(a.currentAdjustment)}</p>
          <p><strong>Personalisation:</strong> ${nl2br(a.personalisation)}</p>
          <p><strong>Frequency:</strong> ${nl2br(a.frequency)}</p>
          <p><strong>Intensity:</strong> ${nl2br(a.intensity)}</p>
          <p><strong>Monitoring:</strong> ${nl2br(a.monitoring)}</p>
          <p><strong>Evidence linked:</strong> ${a.evidenceCount}</p>
          <p><strong>Possible level for SSG discussion:</strong> ${a.possibleLevel && a.possibleLevel.message ? escapeHtml(a.possibleLevel.message) : "Not enough information yet."}</p>
        </div>`).join("")}
    </div>`).join("");

  return `
    <div class="card">
      <h3>Student summary</h3>
      <p><strong>Name:</strong> ${escapeHtml(ss.name)} &nbsp; <strong>Year level:</strong> ${escapeHtml(ss.yearLevel || "")} &nbsp; <strong>School:</strong> ${escapeHtml(ss.school || "")}</p>
      <p><strong>Strengths:</strong> ${nl2br(ss.strengths)}</p>
      <p><strong>Interests and motivations:</strong> ${nl2br(ss.interests)} ${nl2br(ss.motivations)}</p>
      <p><strong>Aspirations:</strong> ${nl2br(ss.aspirations)}</p>
      <p><strong>Communication preferences:</strong> ${nl2br(ss.communicationPreferences)}</p>
    </div>
    <div class="card">
      <h3>Student voice</h3>
      ${draft.studentVoice.length ? draft.studentVoice.map((r) => `<p><strong>${escapeHtml(r.question)}</strong><br><span class="${r.exact ? "quote-block" : ""}">${nl2br(r.answer)}</span></p>`).join("") : "<p>Not yet provided.</p>"}
    </div>
    ${domainHtml}
    <div class="card">
      <h3>Evidence gaps</h3>
      ${draft.evidenceGaps.length ? `<ul>${draft.evidenceGaps.map((g) => `<li>${escapeHtml(g.domainName)} &rarr; ${escapeHtml(g.activityName)}</li>`).join("")}</ul>` : "<p>None detected.</p>"}
    </div>
    <div class="card">
      <h3>Questions for the SSG</h3>
      ${draft.questionsForSSG.length ? `<ul>${draft.questionsForSSG.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}</ul>` : "<p>None generated yet.</p>"}
    </div>
  `;
}

// ---------- Step: check ----------
export function renderCheckStep(student) {
  const checks = qualityChecklist(student);
  const tag = (ok) => ok === "ok" || ok === true ? '<span class="tag tag-ok">&#10003;</span>' : ok === "partial" ? '<span class="tag tag-partial">&#9888; more detail needed</span>' : '<span class="tag tag-none">missing</span>';

  const allText = [];
  allText.push(student.profile.strengths, student.profile.background);
  allText.push(student.parentCarer.observations, student.parentCarer.concerns);
  (student.specialists || []).forEach((s) => allText.push(s.recommendation));
  Object.values(student.domainData || {}).forEach((d) => Object.values(d.activities || {}).forEach((a) => {
    allText.push(a.functionalNeed, a.impactOnParticipation, a.currentAdjustment, a.personalisation, a.frequency, a.intensity);
  }));
  const flags = [];
  allText.filter(Boolean).forEach((t) => flags.push(...scanRedFlags(t)));
  const uniqueFlags = Array.from(new Map(flags.map((f) => [f.phrase + f.type, f])).values());

  return `
    <div class="card">
      <h2>Check my profile</h2>
      ${checks.map((c) => `<div class="checklist-row"><span>${escapeHtml(c.label)}</span>${tag(c.ok)}</div>`).join("")}
    </div>
    <div class="card">
      <h2>Red flags</h2>
      ${uniqueFlags.length ? uniqueFlags.map((f) => `<div class="flag-box"><strong>${escapeHtml(f.phrase)}</strong>: ${escapeHtml(f.message)}</div>`).join("") : "<p>No absolute, vague or diagnosis-driven phrasing detected in the text entered so far.</p>"}
      <p class="hint">This is a simple wording check based on the text you entered. It cannot detect every issue &mdash; please also read the draft carefully yourself.</p>
    </div>
    <a class="btn btn-primary btn-big" href="#/student/${student.id}/ssg">Continue &rarr; SSG Preparation</a>
  `;
}

// ---------- Step: ssg ----------
export function renderSSGStep(content, student) {
  const draft = buildDraft(student, content);
  const parentQuestions = [
    "What are your priorities and goals for this profile?",
    "Is there anything about our description of adjustments that doesn't match your experience at home?",
    "Are there specialist reports you can share that the school doesn't already have?",
  ];
  const specialistQuestions = [
    "Can you confirm whether your recommendation has been implemented in the way described here?",
    "Is there anything about frequency/intensity we should adjust?",
    "Are there additional functional needs we should consider in this domain?",
  ];
  return `
    <div class="card">
      <h2>SSG meeting preparation</h2>
      ${sourceNote(content, "guidance-purpose", "How profile meetings are run")}
      <h3>Department end-to-end process</h3>
      <ol>${content.processSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
    </div>
    <div class="card">
      <h3>Questions for the SSG</h3>
      <ul>${draft.questionsForSSG.map((q) => `<li>${escapeHtml(q)}</li>`).join("") || "<li>None generated yet.</li>"}</ul>
    </div>
    <div class="card">
      <h3>Questions for parents/carers</h3>
      <ul>${parentQuestions.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}</ul>
    </div>
    <div class="card">
      <h3>Questions for specialists</h3>
      <ul>${specialistQuestions.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}</ul>
    </div>
    <div class="card">
      <h3>Evidence reminder</h3>
      <p>${(student.evidence || []).length} of the recommended maximum ${content.supportingInformation.maxRecommendedDocuments} documents entered.</p>
    </div>
    <a class="btn btn-primary btn-big" href="#/student/${student.id}/export">Continue &rarr; Export</a>
  `;
}

// ---------- Step: export ----------
export function renderExportStep(student) {
  return `
    <div class="card">
      <h2>Export</h2>
      <p class="hint">Every export is clearly labelled as an AI-assisted preparation document, not an official Disability Inclusion Profile.</p>
      <div class="button-grid">
        <button class="btn btn-primary btn-big" data-action="export-draft-doc">Student Profile Draft (DOC)</button>
        <button class="btn btn-primary btn-big" data-action="export-ssg-doc">SSG Meeting Preparation (DOC)</button>
        <button class="btn btn-primary btn-big" data-action="export-matrix-csv">Evidence Matrix (CSV/Excel)</button>
        <button class="btn btn-secondary btn-big" data-action="export-print-pdf">Print / Save as PDF</button>
        <button class="btn btn-secondary btn-big" data-action="export-student-json" data-id="${student.id}">Full backup (JSON)</button>
      </div>
    </div>
  `;
}
