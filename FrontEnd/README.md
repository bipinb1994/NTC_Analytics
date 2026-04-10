# NTC Analytics — Frontend

React + TypeScript + ECharts dashboard for Nokia Team Comms Operations Intelligence.

## Prerequisites
- Node.js 18 or higher (download from https://nodejs.org)
- Backend running at http://localhost:8000

## Setup & Run (3 steps)

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

Open http://localhost:5173 in your browser.

## That's it.

Make sure the backend is running first (`uvicorn main:app --reload` in the backend folder), 
otherwise the dashboard will show empty charts.

## Build for production (when you're ready to deploy)

```bash
npm run build
# Output goes to /dist folder — serve it with any static web server
```

## Dashboard tabs

| Tab | What it shows |
|-----|---------------|
| Overview | Daily call volume (day vs night shift stacked bar), call type donut, calls by talkgroup, KPI cards |
| Battery Health | Per-device battery levels with status badges, 7-day fleet trend |
| Response Time | 14-day trend line with avg marker, min/avg/max per group, SLA table |
| Worker Activity | Top 10 communicators leaderboard with call count + air time |

## Tech stack
- Vite + React 18 + TypeScript
- Apache ECharts (via echarts-for-react)
- TailwindCSS v3
- Axios for API calls
- Google Fonts: DM Sans + JetBrains Mono
