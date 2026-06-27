const express = require('express')
const { scrapeJobPage } = require('../services/scraper')

const router = express.Router()

router.post('/', async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'url required' })

  try {
    const result = await scrapeJobPage(url)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
