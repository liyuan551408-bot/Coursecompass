# CourseCompass frontend

The Vue frontend uses Vite, Vue Router, Pinia, Element Plus, and Axios.

See the [project README](../README.md) for requirements, environment variables, backend setup, and testing instructions.

Run these commands from this directory:

```bash
npm ci
npm run dev
```

Copy .env.example to .env to configure VITE_API_BASE_URL. The local API default is http://localhost:3000/api.

| Command | Purpose |
| --- | --- |
| npm run dev | Start the development server at http://localhost:5173 |
| npm test | Run frontend tests |
| npm run build | Build the production frontend into dist |
| npm run preview | Preview the production build locally |
