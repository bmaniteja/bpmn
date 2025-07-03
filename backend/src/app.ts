import express from 'express';
import { HealthCheck } from './routes';
import { ErrorHandler } from './middlewares';

const app = express();

app.use(express.json());

// Routes
app.use('/api/health', HealthCheck);

app.use('/api/health', HealthCheck);

app.use(ErrorHandler);

export default app;