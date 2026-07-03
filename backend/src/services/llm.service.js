const Anthropic = require('@anthropic-ai/sdk');
const env = require('../config/env');

const client = env.anthropicApiKey ? new Anthropic({ apiKey: env.anthropicApiKey }) : null;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`LLM call timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function callJsonLLM(systemPrompt, userPrompt) {
  if (!client) throw new Error('ANTHROPIC_API_KEY is not configured');

  let lastErr;
  for (let attempt = 0; attempt <= env.llmMaxRetries; attempt += 1) {
    try {
      const response = await withTimeout(
        client.messages.create({
          model: env.llmModel,
          max_tokens: 600,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        env.llmTimeoutMs
      );
      const text = response.content.find((b) => b.type === 'text')?.text || '';
      const cleaned = text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      lastErr = err;
      if (attempt < env.llmMaxRetries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

async function generatePreVisitSummary(rawSymptoms) {
  try {
    const system =
      'You are a clinical triage assistant. Analyse patient-reported symptoms and produce a structured pre-visit brief for the doctor. Do not diagnose or prescribe. Respond with ONLY a raw JSON object, no markdown, matching exactly this shape: {"urgency": "Low"|"Medium"|"High", "chiefComplaint": string, "suggestedQuestions": [string, string, string]}.';
    const user = `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${rawSymptoms}`;
    const json = await callJsonLLM(system, user);
    return {
      urgency: String(json.urgency || 'Medium').toUpperCase(),
      chiefComplaint: json.chiefComplaint || '',
      suggestedQuestions: Array.isArray(json.suggestedQuestions) ? json.suggestedQuestions.slice(0, 3) : [],
    };
  } catch (err) {
    console.warn('[LLM] generatePreVisitSummary failed, using fallback:', err.message);
    return {
      urgency: 'MEDIUM',
      chiefComplaint: 'Patient reported symptoms requiring clinical evaluation',
      suggestedQuestions: [
        'How long have you been experiencing these symptoms?',
        'Have you taken any medication for this condition?',
        'Do you have any known allergies or pre-existing conditions?',
      ],
    };
  }
}

async function generatePostVisitSummary(doctorNotes) {
  try {
    const system =
      'You are a patient communication assistant. Convert clinical notes into a warm, clear, plain-language summary a patient with no medical background can understand. Respond with ONLY a raw JSON object, no markdown, matching exactly this shape: {"patientSummary": string, "medicationSchedule": [{"drugName": string, "dosage": string, "frequencyPerDay": number, "durationDays": number, "instructions": string}], "followUpSteps": [string]}.';
    const user = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${doctorNotes}`;
    const json = await callJsonLLM(system, user);
    return {
      patientSummary: json.patientSummary || '',
      medicationSchedule: Array.isArray(json.medicationSchedule) ? json.medicationSchedule : [],
      followUpSteps: Array.isArray(json.followUpSteps) ? json.followUpSteps : [],
    };
  } catch (err) {
    console.warn('[LLM] generatePostVisitSummary failed, using fallback:', err.message);
    return {
      patientSummary: 'Your visit has been completed. Please follow the prescribed medication schedule and attend any recommended follow-up appointments.',
      medicationSchedule: [],
      followUpSteps: [
        'Take prescribed medications as directed',
        'Rest and stay hydrated',
        'Schedule a follow-up appointment in 7 days if symptoms persist',
      ],
    };
  }
}

module.exports = { generatePreVisitSummary, generatePostVisitSummary };