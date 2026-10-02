import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import taskRoutes from './routes/taskRoutes';

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);

app.get('/', (_req, res) => {
  res.send('TaskForge API is running!');
});

// Last-resort error handler, so failures still answer with the API's `{ message }` shape
// instead of Express's default HTML page (which includes a stack trace outside production).
app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);
  const bodyError = error as { type?: string; status?: number };
  if (bodyError.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }
  if (bodyError.status === 413) return res.status(413).json({ message: 'Request body too large' });
  return res.status(500).json({ message: 'Server error' });
});

export default app;
