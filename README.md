# TM Live

TM Live is a real-time video chat and livestream platform with a Node.js backend and a static frontend.

## Project Structure
- `backend/` - Express, Socket.io, MongoDB, auth, and admin APIs
- `frontend/public/` - Static frontend pages and client-side scripts
- `render.yaml` - Render deployment config for the backend

## Local Development
### Backend
1. Open a terminal in `backend/`.
2. Run `npm install`.
3. Run `npm start`.

### Frontend
1. Open `frontend/public/index.html` with a static server or Live Server.
2. On the login page, set the backend API URL to `http://localhost:5001` if needed.

## Deploy Options
### Backend
- Recommended host: Render
- Set these environment variables:
  - `MONGO_URI`
  - `JWT_SECRET`
  - `CORS_ORIGIN`

### Frontend
- Recommended host: Vercel
- GitHub Pages is also supported for the static frontend via `.github/workflows/deploy-pages.yml`.
- GitHub Pages cannot run the backend, so the frontend must point to the deployed backend URL.

## GitHub Pages
If you use GitHub Pages, the workflow publishes `frontend/public` from the `main` branch.
After the site is live, enter the backend URL on the login page so the frontend can connect to the API and Socket.io server.

## Notes
- The backend listens on port `5001` by default in local development.
- The app stores the backend URL in the browser so you only need to set it once.