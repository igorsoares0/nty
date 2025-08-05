import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { processNotificationQueue, cleanupOldJobs, getQueueStats } from "../utils/notification-queue.server";

// Endpoint para processar queue - pode ser chamado por cron job
export const action = async ({ request }: ActionFunctionArgs) => {
  console.log('🔄 [CRON] Queue processing job started');
  
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Validar que só pode ser chamado internamente ou com secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret';
    
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${cronSecret}`) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Processar queue de notificações
    await processNotificationQueue();
    
    // Limpar jobs antigos (executa apenas 1 vez por hora)
    const currentHour = new Date().getHours();
    if (currentHour === 2) { // 2 AM cleanup
      await cleanupOldJobs();
    }

    // Obter estatísticas
    const stats = await getQueueStats();

    console.log('🔄 [CRON] Queue processing completed', stats);

    return json({
      success: true,
      timestamp: new Date().toISOString(),
      stats
    });

  } catch (error) {
    console.error('🔄 [CRON] Error processing queue:', error);
    return json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
};

// GET para debug/status
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const stats = await getQueueStats();
    
    return json({
      message: 'Notification queue processor',
      method: 'POST to trigger processing',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return json({
      error: 'Failed to get queue stats'
    }, { status: 500 });
  }
};