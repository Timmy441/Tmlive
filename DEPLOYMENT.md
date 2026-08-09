# TM Live Deployment

## Recommended setup
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

## Backend deploy steps
1. Push the repo to GitHub.
2. Create a new Render Web Service from the repo.
3. Use `render.yaml` or set:
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `npm start`
4. Add environment variables on Render:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `CORS_ORIGIN` = your Vercel domain, for example `https://tm-live.vercel.app`
   - `PORT` can be left to Render, or use `10000`

## Frontend deploy steps
1. Create a Vercel project from `frontend/public`.
2. Deploy the static site.
3. On the login page, enter the backend API URL once, for example:
   - `https://tm-live-backend.onrender.com`
4. The app will save that value in the browser and reuse it.

## Admin panel
- Open `/admin/index.html` on the deployed frontend.
- Use the admin login or token from `npm run seed-admin`.

## Notes
- The app uses same-origin requests when no backend URL is saved.
- For separate frontend/backend deployments, save the backend URL on the login page or via the settings button in the main app.
