// Rule-based "AI" logic. No external AI calls are made - every function below only
// rearranges, checks or summarises text the user has actually typed in. Nothing is invented.

const ABSOLUTE_PHRASES = [
  "cannot", "can't", "never able", "always struggles", "totally unable",
  "completely unable", "impossible for", "will never", "has no ability",
];

const VAGUE_PHRASES = [
  "a lot of help", "lots of help", "quite a bit", "some help", "some support",
  "struggles with everything", "needs lots of support", "a bit of support",
  "often needs help", "sometimes needs help",
];

const MEDICAL_CONCLUSION_HINTS = [
  "because he has autism", "because she has autism", "because of adhd",
  "because they have adhd", "due to their diagnosis", "as a result of the diagnosis",
];

export function scanRedFlags(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const flags = [];
  ABSOLUTE_PHRASES.forEach((p) => {
    if (lower.includes(p)) {
      flags.push({
        type: "absolute-statement",
        phrase: p,
        message: `"${p}" is an absolute statement. Consider whether this should be described more precisely using observable evidence (what happens, how often, with what support).`,
      });
    }
  });
  VAGUE_PHRASES.forEach((p) => {
    if (lower.includes(p)) {
      flags.push({
        type: "vague-description",
        phrase: p,
        message: `"${p}" is vague. State what specifically is provided, by whom, how often and how intensively.`,
      });
    }
  });
  MEDICAL_CONCLUSION_HINTS.forEach((p) => {
    if (lower.includes(p)) {
      flags.push({
        type: "diagnosis-driven",
        phrase: p,
        message: `This links the adjustment directly to a diagnosis rather than a functional need. Describe what the student finds difficult in the school environment instead.`,
      });
    }
  });
  return flags;
}

const REQUIRED_ACTIVITY_FIELDS = [
  ["functionalNeed", "Functional need"],
  ["impactOnParticipation", "Impact on participation"],
  ["currentAdjustment", "Current adjustment"],
  ["personalisation", "Personalisation"],
  ["frequency", "Frequency"],
  ["intensity", "Intensity"],
  ["monitoring", "Monitoring"],
];

export function activityCompleteness(activityEntry) {
  const missing = [];
  REQUIRED_ACTIVITY_FIELDS.forEach(([key, label]) => {
    if (!activityEntry || !activityEntry[key] || !activityEntry[key].trim()) missing.push(label);
  });
  if (!activityEntry || !activityEntry.evidenceIds || activityEntry.evidenceIds.length === 0) {
    missing.push("Evidence");
  }
  return { missing, complete: missing.length === 0 };
}

// Turns entered fields into the specific, structured sentence style shown in the Department-aligned
// worked example. Only uses fields the user has actually filled in; asks for anything missing instead
// of guessing it.
export function makeMoreSpecific(activityEntry, activityName) {
  const { missing } = activityCompleteness(activityEntry);
  if (missing.length) {
    return {
      ok: false,
      askFor: missing,
      message: `I don't have enough information to make this more specific. Please provide: ${missing.join(", ")}.`,
    };
  }
  const text =
    `During ${activityName || "this activity"}, the student requires ${activityEntry.currentAdjustment.trim()}. ` +
    `This is because ${activityEntry.functionalNeed.trim()}, which affects participation as follows: ${activityEntry.impactOnParticipation.trim()} ` +
    `The adjustment is personalised in that ${activityEntry.personalisation.trim()} It is provided ${activityEntry.frequency.trim()} ` +
    `and requires ${activityEntry.intensity.trim()}. This is monitored through ${activityEntry.monitoring.trim()}`;
  return { ok: true, text };
}

const LEVEL_SIGNALS = {
  differentiated: { keywords: ["occasional", "reminder", "visual cue", "whole class", "verbal reminder", "check-in"], weight: 1 },
  supplementary: { keywords: ["small group", "weekly", "some 1:1", "extra time", "modified", "adjusted task"], weight: 2 },
  substantial: { keywords: ["daily", "every lesson", "1:1 support", "individual aide", "specialist-informed", "significant"], weight: 3 },
  extensive: { keywords: ["constant supervision", "every activity", "full-time support", "life-threatening", "high risk", "continuous"], weight: 4 },
};

// Heuristic-only "possible level" indicator. This NEVER sets a level automatically - it just
// surfaces which Department wording the entered text most resembles, for SSG discussion.
export function suggestPossibleLevel(activityEntry) {
  const combined = [
    activityEntry.personalisation,
    activityEntry.frequency,
    activityEntry.intensity,
  ].filter(Boolean).join(" ").toLowerCase();

  if (!combined.trim()) {
    return { ok: false, message: "Not enough information entered yet to compare against the Department's adjustment-level descriptions." };
  }

  const scored = Object.entries(LEVEL_SIGNALS).map(([levelId, cfg]) => {
    const matches = cfg.keywords.filter((k) => combined.includes(k));
    return { levelId, matches, score: matches.length };
  });

  const best = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)[0];
  if (!best) {
    return {
      ok: true,
      levelId: null,
      message: "Based on the information entered, none of the Department's adjustment-level descriptions were clearly matched. Add more detail on frequency and intensity, or discuss directly with the SSG/facilitator.",
    };
  }
  return {
    ok: true,
    levelId: best.levelId,
    matches: best.matches,
    message: `Based on the information entered, this appears consistent with the Department's description of the "${best.levelId}" level (matched terms: ${best.matches.join(", ")}). This is not a determination - the final level is agreed by the SSG/facilitator during the profile meeting.`,
  };
}

export function qualityChecklist(student) {
  const checks = [];
  const has = (v) => !!(v && String(v).trim());

  checks.push({ label: "Strengths documented", ok: has(student.profile.strengths) });
  checks.push({ label: "Interests / motivations documented", ok: has(student.profile.interests) || has(student.profile.motivations) });
  checks.push({ label: "Aspirations documented", ok: has(student.profile.aspirations) });
  checks.push({ label: "Student voice recorded", ok: (student.studentVoice.responses || []).length > 0 });
  checks.push({ label: "Parent/carer input recorded", ok: has(student.parentCarer.observations) || has(student.parentCarer.priorities) });

  const domainEntries = Object.values(student.domainData || {});
  const activityEntries = [];
  domainEntries.forEach((d) => Object.values(d.activities || {}).forEach((a) => { if (a.relevant) activityEntries.push(a); }));

  const withField = (key) => activityEntries.filter((a) => has(a[key])).length;
  const total = activityEntries.length || 1;

  function level(fraction) {
    if (activityEntries.length === 0) return "none";
    if (fraction === 1) return "ok";
    if (fraction > 0) return "partial";
    return "none";
  }

  const fnFrac = withField("functionalNeed") / total;
  const adjFrac = withField("currentAdjustment") / total;
  const persFrac = withField("personalisation") / total;
  const freqFrac = withField("frequency") / total;
  const intFrac = withField("intensity") / total;
  const monFrac = withField("monitoring") / total;
  const evFrac = activityEntries.filter((a) => (a.evidenceIds || []).length > 0).length / total;

  checks.push({ label: "Functional needs clearly described", ok: level(fnFrac), fraction: fnFrac });
  checks.push({ label: "Adjustments clearly described", ok: level(adjFrac), fraction: adjFrac });
  checks.push({ label: "Personalisation described", ok: level(persFrac), fraction: persFrac });
  checks.push({ label: "Frequency described", ok: level(freqFrac), fraction: freqFrac });
  checks.push({ label: "Intensity described", ok: level(intFrac), fraction: intFrac });
  checks.push({ label: "Monitoring described", ok: level(monFrac), fraction: monFrac });
  checks.push({ label: "Evidence linked to activities", ok: level(evFrac), fraction: evFrac });

  return checks;
}

export function overallProgress(student) {
  const sections = [
    !!(student.profile.strengths && student.profile.name),
    (student.studentVoice.responses || []).length > 0,
    !!(student.parentCarer.observations || student.parentCarer.priorities),
    Object.values(student.domainData || {}).some((d) => Object.values(d.activities || {}).some((a) => a.relevant)),
    (student.evidence || []).length > 0,
    !!student.draft.lastGenerated,
  ];
  const done = sections.filter(Boolean).length;
  return Math.round((done / sections.length) * 100);
}

export function evidenceGaps(student, content) {
  const gaps = [];
  Object.entries(student.domainData || {}).forEach(([domainId, d]) => {
    Object.entries(d.activities || {}).forEach(([activityId, a]) => {
      if (!a.relevant) return;
      if (!a.evidenceIds || a.evidenceIds.length === 0) {
        const domain = content.domains.find((dm) => dm.id === domainId);
        const activity = domain ? domain.activities.concat(d.customActivities || []).find((ac) => ac.id === activityId) : null;
        gaps.push({
          domainId,
          activityId,
          domainName: domain ? domain.name : domainId,
          activityName: activity ? activity.name : activityId,
          reason: "No evidence linked to this activity yet.",
        });
      }
    });
  });
  return gaps;
}

export function findDuplicateEvidence(evidenceList) {
  const seen = new Map();
  const duplicates = [];
  (evidenceList || []).forEach((e) => {
    const key = (e.title || "").trim().toLowerCase();
    if (!key) return;
    if (seen.has(key)) duplicates.push({ title: e.title, ids: [seen.get(key), e.id] });
    else seen.set(key, e.id);
  });
  return duplicates;
}

// Builds the draft strictly from student-entered data. Empty fields become an explicit
// "not yet provided" prompt rather than invented text.
export function buildDraft(student, content) {
  const np = "Not yet provided \u2013 ask staff/parents/carers for this information.";
  const val = (v) => (v && String(v).trim()) || np;

  const domainSections = Object.entries(student.domainData || {}).map(([domainId, d]) => {
    const domain = content.domains.find((dm) => dm.id === domainId);
    const activities = Object.entries(d.activities || {})
      .filter(([, a]) => a.relevant)
      .map(([activityId, a]) => {
        const activity = domain ? domain.activities.concat(d.customActivities || []).find((ac) => ac.id === activityId) : null;
        const level = suggestPossibleLevel(a);
        return {
          activityId,
          activityName: activity ? activity.name : activityId,
          functionalNeed: val(a.functionalNeed),
          impactOnParticipation: val(a.impactOnParticipation),
          currentAdjustment: val(a.currentAdjustment),
          personalisation: val(a.personalisation),
          frequency: val(a.frequency),
          intensity: val(a.intensity),
          monitoring: val(a.monitoring),
          studentVoiceNote: a.studentVoiceNote || "",
          familyInput: a.familyInput || "",
          specialistInput: a.specialistInput || "",
          evidenceCount: (a.evidenceIds || []).length,
          possibleLevel: level,
        };
      });
    return { domainId, domainName: domain ? domain.name : domainId, activities };
  }).filter((d) => d.activities.length > 0);

  return {
    generatedAt: new Date().toISOString(),
    studentSummary: {
      name: student.profile.name || "(student name not entered)",
      yearLevel: student.profile.yearLevel,
      school: student.profile.school,
      strengths: val(student.profile.strengths),
      interests: val(student.profile.interests),
      motivations: val(student.profile.motivations),
      aspirations: val(student.profile.aspirations),
      communicationPreferences: val(student.profile.communicationPreferences),
    },
    studentVoice: student.studentVoice.responses || [],
    parentCarer: student.parentCarer,
    specialists: student.specialists || [],
    domainSections,
    evidenceGaps: evidenceGaps(student, content),
    questionsForSSG: buildQuestions(student, domainSections),
  };
}

function buildQuestions(student, domainSections) {
  const qs = [];
  if (!(student.studentVoice.responses || []).length) qs.push("Have we captured the student's own voice about what helps them at school?");
  if (!student.parentCarer.priorities) qs.push("What are the parent/carer's priorities and goals for this profile?");
  domainSections.forEach((d) => {
    d.activities.forEach((a) => {
      if (a.evidenceCount === 0) qs.push(`What existing documentation could evidence the adjustment for "${a.activityName}" (${d.domainName})?`);
      if (a.possibleLevel && a.possibleLevel.ok === false) qs.push(`More detail is needed on frequency/intensity for "${a.activityName}" before discussing a possible level.`);
    });
  });
  return qs;
}
