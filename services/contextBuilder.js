const { getDb } = require('../db')

function buildContext(profileId) {
  const db = getDb()
  return {
    basics:         db.prepare('SELECT * FROM profile_basics WHERE profile_id = ?').get(profileId) || {},
    experiences:    db.prepare(`SELECT * FROM experiences WHERE profile_id = ?
                    ORDER BY CASE WHEN is_current=1 THEN 0 ELSE 1 END, end_date DESC, start_date DESC`).all(profileId),
    education:      db.prepare('SELECT * FROM education WHERE profile_id = ? ORDER BY end_date DESC').all(profileId),
    skills:         db.prepare('SELECT * FROM skills WHERE profile_id = ? ORDER BY category, name').all(profileId),
    certifications: db.prepare('SELECT * FROM certifications WHERE profile_id = ? ORDER BY issued_date DESC').all(profileId),
    projects:       db.prepare('SELECT * FROM projects WHERE profile_id = ? ORDER BY start_date DESC').all(profileId)
  }
}

module.exports = { buildContext }
