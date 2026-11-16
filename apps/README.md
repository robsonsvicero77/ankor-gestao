# apps

Contém os aplicativos principais do monorepo.
- web: frontend React (Vite)
- backend: Node.js (Express)

## Como rodar

### Backend Node.js
cd apps/backend
npm install
npm start

### Frontend React
cd apps/web
npm install
npm run dev

### Endpoints
- Backend: http://localhost:3001
- Frontend: http://localhost:5173

Para desenvolvimento, configure o proxy do frontend para /api apontar para o backend.
