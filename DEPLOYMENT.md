# TM Live Deployment

## Production setup
- Frontend: Vercel (`https://tmliveweb.vercel.app`)
- Backend: Vercel (`https://tmlive-avtn.vercel.app`)
- Database: MongoDB Atlas

## GitHub Pages option
- GitHub Pages can host the static frontend in `frontend/public`.
- GitHub Pages cannot run the Node.js backend, so it uses the deployed Vercel backend.
- After deploying the frontend, save `https://tmlive-avtn.vercel.app` on the login page if an API override is needed.

## Backend deploy steps
1. Push the repo to GitHub.
2. Deploy the `backend` directory as the Vercel project root.
3. Add these environment variables in the Vercel project:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `CORS_ORIGIN=https://tmliveweb.vercel.app`
4. Verify `https://tmlive-avtn.vercel.app/api/health` reports `status: "ok"` and `database: "connected"`.

## Frontend deploy steps
1. Create a Vercel project from `frontend/public`.
2. Deploy the static site to `https://tmliveweb.vercel.app`.
3. The runtime configuration routes this host to `https://tmlive-avtn.vercel.app` automatically.
4. A temporary API override can still be saved on the login page for local/staging troubleshooting.

## GitHub Pages deploy steps
1. Open the repository on GitHub.
2. Go to `Settings` > `Pages`.
3. Set the source to GitHub Actions.
4. The workflow in `.github/workflows/deploy-pages.yml` will publish the static frontend.
5. After the Pages URL is live, open the site and enter `https://tmlive-avtn.vercel.app` on the login page.

## Admin panel
- Open `/admin/index.html` on the deployed frontend.
- Use the admin login or token from `npm run seed-admin`.

## Notes
- The app uses same-origin requests when no backend URL is saved.
- For separate frontend/backend deployments, save the backend URL on the login page or via the settings button in the main app.
