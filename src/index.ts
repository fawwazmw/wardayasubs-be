import app from './app';
import { startScheduler } from './jobs/scheduler';

const PORT = process.env.PORT || 5000;

// Unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
});

// Uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('[FATAL] Uncaught exception:', err.message);
  console.error(err.stack);
  process.exit(1);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  startScheduler();
});

export default app;
