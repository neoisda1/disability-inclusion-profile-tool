// Local-only data layer. Nothing here ever sends data anywhere - it only reads/writes the browser's localStorage.
const STUDENTS_KEY = "dipt_students_v1";
const SETTINGS_KEY = "dipt_settings_v1";
const CONTENT_OVERRIDE_KEY = "dipt_content_override_v1";

function uid() {
  return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STUDENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Could not read student data from this browser", e);
    return [];
  }
}

function saveAll(students) {
  localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { privacyAcknowledged: false, role: "" };
  } catch (e) {
    return { privacyAcknowledged: false, role: "" };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getContentOverride() {
  try {
    const raw = localStorage.getItem(CONTENT_OVERRIDE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveContentOverride(content) {
  localStorage.setItem(CONTENT_OVERRIDE_KEY, JSON.stringify(content));
}

export function clearContentOverride() {
  localStorage.removeItem(CONTENT_OVERRIDE_KEY);
}

export function listStudents() {
  return loadAll().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function getStudent(id) {
  return loadAll().find((s) => s.id === id) || null;
}

export function createStudent(initialProfile) {
  const now = new Date().toISOString();
  const student = {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    profile: Object.assign(
      {
        name: "",
        yearLevel: "",
        age: "",
        school: "",
        classroom: "",
        strengths: "",
        interests: "",
        motivations: "",
        aspirations: "",
        communicationPreferences: "",
        background: "",
      },
      initialProfile || {}
    ),
    studentVoice: { ageBand: "", responses: [] },
    parentCarer: { observations: "", priorities: "", goals: "", concerns: "", strategies: "", specialistInfoFromParent: "" },
    specialists: [],
    nccd: { include: false, notes: "" },
    attendance: { lowAttendance: false, patterns: "", barriers: "", adjustments: "", reengagement: "", monitoring: "", futurePlanning: "" },
    domainData: {},
    evidence: [],
    draft: { sections: {}, lastGenerated: null },
  };
  const all = loadAll();
  all.push(student);
  saveAll(all);
  return student;
}

export function updateStudent(id, updater) {
  const all = loadAll();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const updated = typeof updater === "function" ? updater(all[idx]) : Object.assign({}, all[idx], updater);
  updated.updatedAt = new Date().toISOString();
  all[idx] = updated;
  saveAll(all);
  return updated;
}

export function deleteStudent(id) {
  const all = loadAll().filter((s) => s.id !== id);
  saveAll(all);
}

export function exportStudentJSON(id) {
  const student = getStudent(id);
  return student ? JSON.stringify(student, null, 2) : null;
}

export function importStudentJSON(jsonText) {
  const parsed = JSON.parse(jsonText);
  const all = loadAll();
  parsed.id = uid();
  parsed.updatedAt = new Date().toISOString();
  all.push(parsed);
  saveAll(all);
  return parsed;
}
