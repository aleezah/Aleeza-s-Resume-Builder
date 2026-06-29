import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// ── Profiles ──────────────────────────────────────────────────────────────────
export const listProfiles      = ()           => api.get('/profiles').then(r => r.data)
export const getCurrentProfile = ()           => api.get('/profiles/current').then(r => r.data)
export const setCurrentProfile = (id)         => api.put('/profiles/current', { id })
export const createProfile     = (name)       => api.post('/profiles', { name }).then(r => r.data)
export const renameProfile     = (id, name)   => api.patch(`/profiles/${id}`, { name })
export const deleteProfile     = (id)         => api.delete(`/profiles/${id}`)
export const getProfileData    = (id)         => api.get(`/profiles/${id}/data`).then(r => r.data)
export const updateBasics      = (id, data)   => api.put(`/profiles/${id}/basics`, data)

// ── Documents ─────────────────────────────────────────────────────────────────
export const listDocuments  = (profile_id)       => api.get('/documents', { params: { profile_id } }).then(r => r.data)
export const uploadDocument = (formData)          => api.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
export const setTemplate        = (id, profile_id) => api.patch(`/documents/${id}/set-template`, { profile_id })
export const deleteDocument     = (id)             => api.delete(`/documents/${id}`)
export const getDocText         = (id)             => api.get(`/documents/${id}/text`).then(r => r.data)
export const reprocessDocument  = (id)             => api.post(`/documents/${id}/reprocess`).then(r => r.data)

// ── Experiences ───────────────────────────────────────────────────────────────
export const listExperiences    = (profile_id) => api.get('/experiences', { params: { profile_id } }).then(r => r.data)
export const createExperience   = (data)       => api.post('/experiences', data).then(r => r.data)
export const updateExperience   = (id, data)   => api.put(`/experiences/${id}`, data)
export const deleteExperience   = (id)         => api.delete(`/experiences/${id}`)
export const confirmMerge       = (data)       => api.post('/experiences/merge', data)
export const findDuplicates     = (profile_id) => api.get('/experiences/find-duplicates', { params: { profile_id } }).then(r => r.data)
export const polishExperience   = (id)         => api.post(`/experiences/${id}/polish`).then(r => r.data)
export const importExtracted    = (data)       => api.post('/experiences/import', data).then(r => r.data)

export const listEducation      = (profile_id) => api.get('/experiences/education', { params: { profile_id } }).then(r => r.data)
export const createEducation    = (data)       => api.post('/experiences/education', data).then(r => r.data)
export const updateEducation    = (id, data)   => api.put(`/experiences/education/${id}`, data)
export const deleteEducation    = (id)         => api.delete(`/experiences/education/${id}`)

export const listSkills         = (profile_id) => api.get('/experiences/skills', { params: { profile_id } }).then(r => r.data)
export const createSkill        = (data)       => api.post('/experiences/skills', data).then(r => r.data)
export const deleteSkill        = (id)         => api.delete(`/experiences/skills/${id}`)

export const listCertifications = (profile_id) => api.get('/experiences/certifications', { params: { profile_id } }).then(r => r.data)
export const createCertification= (data)       => api.post('/experiences/certifications', data).then(r => r.data)
export const deleteCertification= (id)         => api.delete(`/experiences/certifications/${id}`)

export const listProjects       = (profile_id) => api.get('/experiences/projects', { params: { profile_id } }).then(r => r.data)
export const createProject      = (data)       => api.post('/experiences/projects', data).then(r => r.data)
export const updateProject      = (id, data)   => api.put(`/experiences/projects/${id}`, data)
export const deleteProject      = (id)         => api.delete(`/experiences/projects/${id}`)

// ── Jobs ──────────────────────────────────────────────────────────────────────
export const listJobs    = (profile_id) => api.get('/jobs', { params: { profile_id } }).then(r => r.data)
export const getJob      = (id)         => api.get(`/jobs/${id}`).then(r => r.data)
export const createJob   = (data)       => api.post('/jobs', data).then(r => r.data)
export const updateJob   = (id, data)   => api.put(`/jobs/${id}`, data)
export const updateStatus= (id, status) => api.patch(`/jobs/${id}/status`, { status })
export const deleteJob   = (id)         => api.delete(`/jobs/${id}`)

// ── Scrape ────────────────────────────────────────────────────────────────────
export const scrapeUrl = (url) => api.post('/scrape', { url }).then(r => r.data)

// ── Generate ──────────────────────────────────────────────────────────────────
export const generate        = (data)      => api.post('/generate', data).then(r => r.data)
export const listGenerations = (profile_id)=> api.get('/generate', { params: { profile_id } }).then(r => r.data)
export const deleteGeneration = (id)       => api.delete(`/generate/${id}`)
export const getUsage        = ()          => api.get('/generate/usage').then(r => r.data)

// ── Integrations ──────────────────────────────────────────────────────────────
export const connectGitHub      = (data) => api.post('/integrations/github', data).then(r => r.data)
export const getGitHubStatus    = ()     => api.get('/integrations/github/status').then(r => r.data)
export const syncGitHub         = (profile_id) => api.post('/integrations/github/sync', { profile_id }).then(r => r.data)
export const enrichGitHubProject= (id)   => api.post(`/integrations/github/enrich/${id}`).then(r => r.data)
export const connectGitLab      = (data) => api.post('/integrations/gitlab', data).then(r => r.data)
export const importLinkedIn = (formData)  => api.post('/integrations/linkedin', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)

// ── Settings ──────────────────────────────────────────────────────────────────
export const getSettings      = ()     => api.get('/settings').then(r => r.data)
export const saveSettings     = (data) => api.put('/settings', data)
export const testAI           = ()     => api.post('/settings/test-ai').then(r => r.data)
export const getOllamaModels  = ()     => api.get('/settings/ollama-models').then(r => r.data)
export const getGeminiModels  = ()     => api.get('/settings/gemini-models').then(r => r.data)
export const getGroqModels    = ()     => api.get('/settings/groq-models').then(r => r.data)
