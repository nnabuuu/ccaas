# Quiz Analyzer Frontend

React + Vite frontend for the Quiz Analyzer solution.

## Features

- 📝 **Quiz List** - Browse and search quiz questions
- 🔍 **Quiz Detail** - View quiz content with real-time AI analysis
- ⚡ **Batch Analysis** - Process multiple quizzes in parallel
- 🌳 **Knowledge Points Tree** - Explore hierarchical knowledge structure
- 🔄 **Real-time Updates** - Socket.io integration for live AI analysis results

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Routing**: React Router 6
- **State Management**: React Hooks + Custom Hooks
- **HTTP Client**: Axios
- **WebSocket**: Socket.io Client

## Project Structure

```
frontend/src/
├── api/
│   └── client.ts           # API client with axios
├── components/
│   ├── Layout.tsx          # Main layout with sidebar
│   └── AnalysisView.tsx    # Display all SYNC_FIELDS
├── hooks/
│   └── useQuizSession.ts   # Socket.io integration hook
├── pages/
│   ├── QuizList.tsx        # Quiz list with search
│   ├── QuizDetail.tsx      # Quiz detail + analysis
│   ├── BatchAnalysis.tsx   # Batch processing UI
│   └── KnowledgePoints.tsx # Knowledge tree viewer
├── types/
│   └── index.ts            # TypeScript type definitions
├── App.tsx                 # Root component
├── main.tsx                # Application entry
└── index.css               # Global styles
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

The app will run on `http://localhost:5282`.

## Build

```bash
npm run build
```

Output will be in the `dist/` directory.

## Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_BASE=http://localhost:3005
VITE_BACKEND_URL=http://localhost:3005
```

## Key Components

### Layout

Main application layout with navigation sidebar.

- Routes: `/quizzes`, `/batch`, `/knowledge-points`
- Responsive sidebar design
- Dark mode support

### QuizList

Display and search quiz questions.

- Pagination support
- Multi-condition search
- Difficulty badges
- Knowledge point tags

### QuizDetail

View quiz content and AI analysis.

- Real-time AI analysis via Socket.io
- Display all SYNC_FIELDS:
  - 💡 Thinking Process (解题思路)
  - 📋 Solution Steps (解题步骤)
  - ⚠️ Common Mistakes (常见错误)
  - 📊 Knowledge Gap Analysis (知识缺口分析)
  - Difficulty & Time Estimate
- Connection status indicators
- Start analysis button

### AnalysisView

Renders all analysis fields with proper formatting:

- Markdown rendering for text fields
- Structured solution steps
- Mistake frequency badges
- Knowledge gap visualization

### BatchAnalysis

Batch processing management.

- Create new batch jobs
- Select multiple quizzes
- Real-time progress tracking
- Job status monitoring
- ETA display
- Cancel running jobs

### KnowledgePoints

Hierarchical knowledge points tree viewer.

- Expandable/collapsible tree
- Level indicators
- Grade level badges
- Auto-expand root nodes

## Custom Hooks

### useQuizSession

Socket.io integration for real-time AI analysis.

```typescript
const {
  socket,          // Socket.io instance
  analysis,        // Live analysis updates
  isConnected,     // Connection status
  isAnalyzing,     // Analysis in progress
  error,           // Error messages
  sendMessage,     // Send message to AI
  startAnalysis,   // Trigger analysis
  clearAnalysis,   // Clear current analysis
} = useQuizSession({
  quizId: 'quiz-001',
  sessionId: 'session-001',
  tenantId: 'default',
  autoConnect: true,
});
```

**Features**:
- Auto-connect on mount
- Automatic reconnection
- Real-time `output_update` events
- Analysis start/complete tracking
- Error handling

## API Integration

The frontend communicates with the backend API:

```typescript
// Import API clients
import { quizzesApi, analysesApi, batchApi, knowledgePointsApi } from './api/client';

// Example: Search quizzes
const { quizzes, pagination } = await quizzesApi.search({
  query: '方程',
  difficulty: 3,
  limit: 20,
});

// Example: Get analysis
const analysis = await analysesApi.get('quiz-001');

// Example: Create batch job
const { job } = await batchApi.create('Batch Name', ['quiz-1', 'quiz-2']);

// Example: Get knowledge tree
const { tree, totalNodes } = await knowledgePointsApi.getTree('math-001');
```

## Styling

The app uses custom CSS with:
- CSS custom properties for theming
- Flexbox and Grid layouts
- Dark mode support via `@media (prefers-color-scheme: dark)`
- Responsive design with media queries

## Proxy Configuration

Vite proxies API requests to avoid CORS issues:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3005',
      changeOrigin: true,
    },
  },
}
```

## Real-time Analysis Flow

1. User opens quiz detail page
2. `useQuizSession` hook connects to Socket.io
3. User clicks "Start Analysis"
4. Hook sends message via socket
5. Backend receives message, triggers AI analysis
6. AI emits `output_update` events for each SYNC_FIELD
7. Hook receives events and updates analysis state
8. UI re-renders with new analysis data

## Performance Considerations

- **Code Splitting**: Vite automatically splits routes
- **Lazy Loading**: Pages load on demand
- **Memoization**: React.memo for expensive components
- **Debouncing**: Search input debounced
- **Polling**: Batch jobs polled every 2 seconds

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Troubleshooting

### Backend connection failed

Check backend is running on port 3005:
```bash
cd ../backend
npm run start:dev
```

### Socket.io not connecting

Verify `VITE_BACKEND_URL` in `.env` matches backend URL.

### Build errors

Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Future Enhancements

- [ ] Search filters sidebar
- [ ] Quiz comparison view
- [ ] Export analysis to PDF
- [ ] Batch analysis results download
- [ ] Knowledge points search
- [ ] User authentication
- [ ] Dark mode toggle button
- [ ] i18n support (English translation)
- [ ] PWA support
- [ ] Mobile responsive improvements

## License

MIT
