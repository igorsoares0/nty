import { processNotificationQueue, cleanupOldJobs } from './notification-queue.server';

let isWorkerRunning = false;
let workerInterval: NodeJS.Timeout | null = null;

// Função para iniciar o background worker
export const startBackgroundWorker = (): void => {
  if (isWorkerRunning) {
    console.log('🔄 [WORKER] Background worker already running');
    return;
  }

  console.log('🔄 [WORKER] Starting background worker...');
  isWorkerRunning = true;

  // Processar queue a cada 30 segundos
  workerInterval = setInterval(async () => {
    try {
      await processNotificationQueue();
    } catch (error) {
      console.error('🔄 [WORKER] Error in background worker:', error);
    }
  }, 30000); // 30 segundos

  // Cleanup de jobs antigos a cada 1 hora
  setInterval(async () => {
    try {
      await cleanupOldJobs();
    } catch (error) {
      console.error('🔄 [WORKER] Error in cleanup job:', error);
    }
  }, 60 * 60 * 1000); // 1 hora

  console.log('🔄 [WORKER] Background worker started successfully');
};

// Função para parar o background worker
export const stopBackgroundWorker = (): void => {
  if (!isWorkerRunning) {
    console.log('🔄 [WORKER] Background worker not running');
    return;
  }

  console.log('🔄 [WORKER] Stopping background worker...');
  
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  
  isWorkerRunning = false;
  console.log('🔄 [WORKER] Background worker stopped');
};

// Função para verificar status do worker
export const getWorkerStatus = () => {
  return {
    isRunning: isWorkerRunning,
    startedAt: workerInterval ? new Date() : null
  };
};

// Auto-start do worker quando o módulo é carregado (apenas em produção)
if (process.env.NODE_ENV === 'production') {
  startBackgroundWorker();
}