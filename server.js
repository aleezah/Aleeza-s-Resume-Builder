require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

const { initDb } = require('./db')

const profilesRouter = require('./routes/profiles')
const documentsRouter = require('./routes/documents')
const experiencesRouter = require('./routes/experiences')
const jobsRouter = require('./routes/jobs')
const generateRouter = require('./routes/generate')
const integrationsRouter = require('./routes/integrations')
const scrapeRouter = require('./routes/scrape')
const settingsRouter = require('./routes/settings')

const app = express()
const PORT = process.env.PORT || 3001

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use('/uploads', express.static(uploadsDir))

// Init DB before registering routes
initDb()

app.use('/api/profiles', profilesRouter)
app.use('/api/documents', documentsRouter)
app.use('/api/experiences', experiencesRouter)
app.use('/api/jobs', jobsRouter)
app.use('/api/generate', generateRouter)
app.use('/api/integrations', integrationsRouter)
app.use('/api/scrape', scrapeRouter)
app.use('/api/settings', settingsRouter)

// Serve built frontend in production
const clientDist = path.join(__dirname, 'client', 'dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`Resume Builder running at http://localhost:${PORT}`)
})
