# Semrush rank tracking configuration

The repository uses a server-side/GitHub Actions workflow for Semrush. Never expose the API key in `index.html` or committed JSON.

Required GitHub Actions secret:

- `SEMRUSH_API_KEY`

Position Tracking campaign IDs should be supplied separately as a secret or workflow variable once the campaigns exist in Semrush. The campaign must be configured for Google, India, and the desired device.
