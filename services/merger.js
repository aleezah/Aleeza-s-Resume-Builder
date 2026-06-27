const { getDb } = require('../db')

// Simple string similarity (Dice coefficient on bigrams)
function diceSimilarity(a, b) {
  if (!a || !b) return 0
  a = a.toLowerCase().trim()
  b = b.toLowerCase().trim()
  if (a === b) return 1

  const bigrams = (str) => {
    const set = new Set()
    for (let i = 0; i < str.length - 1; i++) set.add(str.slice(i, i + 2))
    return set
  }

  const setA = bigrams(a)
  const setB = bigrams(b)
  const intersection = [...setA].filter(x => setB.has(x)).length
  return (2 * intersection) / (setA.size + setB.size)
}

// Check if two date ranges overlap or are very close
function datesOverlap(start1, end1, start2, end2) {
  if (!start1 || !start2) return true // unknown dates — assume overlap possible
  const s1 = new Date(start1), s2 = new Date(start2)
  const e1 = end1 ? new Date(end1) : new Date()
  const e2 = end2 ? new Date(end2) : new Date()
  return s1 <= e2 && s2 <= e1
}

function experienceSimilarity(a, b) {
  const companySim = diceSimilarity(a.company, b.company)
  if (companySim < 0.5) return 0 // different companies — not a duplicate

  const titleSim = diceSimilarity(a.title, b.title)
  const overlap = datesOverlap(a.start_date, a.end_date, b.start_date, b.end_date) ? 1 : 0

  return companySim * 0.5 + titleSim * 0.3 + overlap * 0.2
}

/**
 * Given a list of NEW experiences extracted from a document,
 * compare them against what's already in the DB for this profile
 * and return candidate merge pairs.
 */
function detectDuplicates(profileId, newExperiences) {
  const existing = getDb().prepare(
    'SELECT * FROM experiences WHERE profile_id = ?'
  ).all(profileId)

  const candidates = []

  for (const newExp of newExperiences) {
    for (const ex of existing) {
      const score = experienceSimilarity(newExp, ex)
      if (score >= 0.65) {
        candidates.push({
          score: Math.round(score * 100),
          incoming: newExp,
          existing: ex
        })
      }
    }
  }

  // Deduplicate — keep highest score per existing id
  const seen = new Map()
  for (const c of candidates) {
    const key = c.existing.id
    if (!seen.has(key) || seen.get(key).score < c.score) seen.set(key, c)
  }

  return [...seen.values()].sort((a, b) => b.score - a.score)
}

/**
 * Apply a confirmed merge: update the kept experience with merged content
 * and delete the discarded one.
 */
function confirmMerge({ keep_id, discard_id, merged_achievements, merged_description }) {
  const db = getDb()
  db.prepare('UPDATE experiences SET achievements=?, description=? WHERE id=?')
    .run(merged_achievements || null, merged_description || null, keep_id)
  if (discard_id) {
    db.prepare('DELETE FROM experiences WHERE id = ?').run(discard_id)
  }
}

module.exports = { detectDuplicates, confirmMerge, experienceSimilarity }
