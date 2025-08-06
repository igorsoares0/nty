import db from '../db.server';
import { sendFirstNotificationEmail, sendReminderNotificationEmail } from './email.server';

// Interface para dados da queue
interface QueueJobData {
  subscriptionId: string;
  type: 'first_notification' | 'thankyou_notification' | 'reminder_email' | 'reminder_sms';
  scheduledFor: Date;
  data: any;
}

// Função para adicionar job à queue
export const addNotificationToQueue = async (jobData: QueueJobData): Promise<boolean> => {
  try {
    console.log('⚡ [QUEUE] Adding job to queue:', {
      subscriptionId: jobData.subscriptionId,
      type: jobData.type,
      scheduledFor: jobData.scheduledFor
    });

    await db.notificationQueue.create({
      data: {
        subscriptionId: jobData.subscriptionId,
        type: jobData.type,
        scheduledFor: jobData.scheduledFor,
        data: JSON.stringify(jobData.data),
        status: 'pending',
        attempts: 0,
        maxAttempts: 3
      }
    });

    console.log('⚡ [QUEUE] Job added successfully');
    return true;

  } catch (error) {
    console.error('⚡ [QUEUE] Error adding job to queue:', error);
    return false;
  }
};

// Função para processar jobs pendentes
export const processNotificationQueue = async (): Promise<void> => {
  try {
    console.log('⚡ [QUEUE] Processing notification queue...');

    // Buscar jobs pendentes que estão na hora de serem processados
    const pendingJobs = await db.notificationQueue.findMany({
      where: {
        status: 'pending',
        scheduledFor: {
          lte: new Date()
        },
        attempts: {
          lt: 3 // Não exceder max attempts
        }
      },
      orderBy: {
        scheduledFor: 'asc'
      },
      take: 10 // Processar até 10 jobs por vez
    });

    console.log('⚡ [QUEUE] Found pending jobs:', pendingJobs.length);

    for (const job of pendingJobs) {
      await processQueueJob(job);
    }

  } catch (error) {
    console.error('⚡ [QUEUE] Error processing queue:', error);
  }
};

// Função para processar um job específico
const processQueueJob = async (job: any): Promise<void> => {
  try {
    console.log('⚡ [QUEUE] Processing job:', {
      id: job.id,
      type: job.type,
      subscriptionId: job.subscriptionId,
      attempts: job.attempts
    });

    // Marcar job como processando
    await db.notificationQueue.update({
      where: { id: job.id },
      data: {
        status: 'processing',
        attempts: job.attempts + 1
      }
    });

    // Buscar subscription details
    const subscription = await db.subscription.findUnique({
      where: { id: job.subscriptionId }
    });

    if (!subscription) {
      console.log('⚡ [QUEUE] Subscription not found:', job.subscriptionId);
      await markJobAsFailed(job.id, 'Subscription not found');
      return;
    }

    // Para reminders, aceitar subscriptions 'notified' (que já receberam back-in-stock)
    // Para outras notificações, só processar se 'active'
    if (job.type === 'reminder_email' || job.type === 'reminder_sms') {
      if (subscription.status === 'cancelled') {
        console.log('⚡ [QUEUE] Subscription cancelled, skipping reminder:', subscription.status);
        await markJobAsCompleted(job.id);
        return;
      }
    } else {
      if (subscription.status !== 'active') {
        console.log('⚡ [QUEUE] Subscription not active:', subscription.status);
        await markJobAsCompleted(job.id);
        return;
      }
    }

    // Parse job data
    const jobData = JSON.parse(job.data);

    let emailSent = false;

    // Processar baseado no tipo
    switch (job.type) {
      case 'first_notification':
        emailSent = await sendFirstNotificationEmail({
          email: subscription.email,
          productTitle: subscription.productTitle || jobData.productTitle || 'Product',
          productUrl: subscription.productUrl || constructProductUrl(jobData),
          shopId: subscription.shopId,
          shopDomain: jobData.shopDomain
        });
        break;

      case 'thankyou_notification':
        emailSent = await sendFirstNotificationEmail({
          email: subscription.email,
          productTitle: subscription.productTitle || jobData.productTitle || 'Product',
          productUrl: subscription.productUrl || constructProductUrl(jobData),
          shopId: subscription.shopId,
          shopDomain: jobData.shopDomain
        });

        // Se enviou com sucesso, agendar lembretes
        if (emailSent) {
          await scheduleReminders(subscription.id, subscription.shopId, jobData);
        }
        break;

      case 'reminder_email':
        // Verificar se ainda deve enviar lembrete
        const shouldSendReminder = await shouldSendReminderNotification(subscription.id);
        if (shouldSendReminder) {
          emailSent = await sendReminderNotificationEmail({
            email: subscription.email,
            productTitle: subscription.productTitle || jobData.productTitle || 'Product',
            productUrl: subscription.productUrl || constructProductUrl(jobData),
            shopId: subscription.shopId,
            shopDomain: jobData.shopDomain,
            reminderNumber: jobData.reminderNumber || 1
          });

          // Se enviou com sucesso, atualizar contador de lembretes
          if (emailSent) {
            await db.subscription.update({
              where: { id: subscription.id },
              data: {
                reminderCount: { increment: 1 },
                lastReminderAt: new Date()
              }
            });

            // Agendar próximo lembrete se não atingiu o máximo
            const settings = await db.settings.findUnique({
              where: { shopId: subscription.shopId }
            });
            
            const maxReminders = settings?.reminderMaxCount || 2;
            const currentReminders = subscription.reminderCount + 1; // +1 porque acabamos de incrementar
            
            if (currentReminders < maxReminders) {
              const nextReminderTime = new Date();
              const delayHours = settings?.reminderDelayHours || 24;
              
              if (delayHours < 1) {
                nextReminderTime.setMinutes(nextReminderTime.getMinutes() + Math.round(delayHours * 60));
              } else {
                nextReminderTime.setHours(nextReminderTime.getHours() + delayHours);
              }
              
              await addNotificationToQueue({
                subscriptionId: subscription.id,
                type: 'reminder_email',
                scheduledFor: nextReminderTime,
                data: {
                  ...jobData,
                  reminderNumber: currentReminders + 1
                }
              });
            }
          }
        } else {
          emailSent = true; // Marcar como "enviado" para não tentar novamente
        }
        break;

      default:
        console.log('⚡ [QUEUE] Unknown job type:', job.type);
        await markJobAsFailed(job.id, 'Unknown job type');
        return;
    }

    if (emailSent) {
      // Marcar job como completado
      await markJobAsCompleted(job.id);
      
      // Atualizar subscription status
      await db.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'notified',
          notifiedAt: new Date()
        }
      });

      // Criar registro na tabela Notification
      await db.notification.create({
        data: {
          subscriptionId: subscription.id,
          type: 'first_email',
          status: 'sent',
          subject: 'Product Back in Stock',
          content: `${subscription.productTitle} is back in stock!`,
          recipient: subscription.email,
          sentAt: new Date()
        }
      });

      console.log('⚡ [QUEUE] Job completed successfully:', job.id);

    } else {
      // Email falhou - verificar se deve tentar novamente
      if (job.attempts >= 3) {
        await markJobAsFailed(job.id, 'Max attempts reached');
      } else {
        // Reagendar para tentar novamente em 5 minutos
        await db.notificationQueue.update({
          where: { id: job.id },
          data: {
            status: 'pending',
            scheduledFor: new Date(Date.now() + 5 * 60 * 1000), // 5 minutos
            errorMessage: 'Email sending failed, retrying...'
          }
        });
        console.log('⚡ [QUEUE] Job rescheduled for retry:', job.id);
      }
    }

  } catch (error) {
    console.error('⚡ [QUEUE] Error processing job:', error);
    await markJobAsFailed(job.id, error.message);
  }
};

// Função auxiliar para construir URL do produto
const constructProductUrl = (jobData: any): string => {
  if (jobData.productHandle && jobData.shopDomain) {
    return `https://${jobData.shopDomain}/products/${jobData.productHandle}`;
  }
  return jobData.productUrl || '';
};

// Função para marcar job como completado
const markJobAsCompleted = async (jobId: string): Promise<void> => {
  await db.notificationQueue.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      processedAt: new Date()
    }
  });
};

// Função para marcar job como falhado
const markJobAsFailed = async (jobId: string, errorMessage: string): Promise<void> => {
  await db.notificationQueue.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      processedAt: new Date(),
      errorMessage
    }
  });
};

// Função para limpar jobs antigos (executar periodicamente)
export const cleanupOldJobs = async (): Promise<void> => {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const deleted = await db.notificationQueue.deleteMany({
      where: {
        status: {
          in: ['completed', 'failed']
        },
        processedAt: {
          lt: oneWeekAgo
        }
      }
    });

    console.log('⚡ [QUEUE] Cleaned up old jobs:', deleted.count);
  } catch (error) {
    console.error('⚡ [QUEUE] Error cleaning up jobs:', error);
  }
};

// Função para agendar lembretes após envio de thank you
const scheduleReminders = async (subscriptionId: string, shopId: string, jobData: any): Promise<void> => {
  try {
    console.log('⚡ [REMINDER] Scheduling reminders for subscription:', subscriptionId);

    // Buscar configurações da loja
    const settings = await db.settings.findUnique({
      where: { shopId }
    });

    console.log('⚡ [REMINDER] Settings found for shop:', shopId, {
      exists: !!settings,
      reminderEmailEnabled: settings?.reminderEmailEnabled,
      reminderSmsEnabled: settings?.reminderSmsEnabled,
      reminderDelayHours: settings?.reminderDelayHours,
      reminderMaxCount: settings?.reminderMaxCount
    });

    if (!settings?.reminderEmailEnabled) {
      console.log('⚡ [REMINDER] Reminder emails disabled for shop:', shopId);
      return;
    }

    const delayHours = settings.reminderDelayHours || 24;
    const firstReminderTime = new Date();
    
    if (delayHours < 1) {
      // Para valores menores que 1 hora, calcular em minutos
      firstReminderTime.setMinutes(firstReminderTime.getMinutes() + Math.round(delayHours * 60));
    } else {
      firstReminderTime.setHours(firstReminderTime.getHours() + delayHours);
    }

    // Agendar primeiro lembrete
    await addNotificationToQueue({
      subscriptionId,
      type: 'reminder_email',
      scheduledFor: firstReminderTime,
      data: {
        ...jobData,
        reminderNumber: 1,
        originalNotificationSentAt: new Date()
      }
    });

    console.log('⚡ [REMINDER] First reminder scheduled for:', firstReminderTime);

  } catch (error) {
    console.error('⚡ [REMINDER] Error scheduling reminders:', error);
  }
};

// Função para verificar se deve enviar lembrete
const shouldSendReminderNotification = async (subscriptionId: string): Promise<boolean> => {
  try {
    const subscription = await db.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      console.log('⚡ [REMINDER] Subscription not found:', subscriptionId);
      return false;
    }

    // Não enviar se compra foi detectada
    if (subscription.purchaseDetectedAt) {
      console.log('⚡ [REMINDER] Purchase already detected for subscription:', subscriptionId);
      return false;
    }

    // Não enviar se subscription foi cancelada
    if (subscription.status === 'cancelled') {
      console.log('⚡ [REMINDER] Subscription cancelled:', subscription.status);
      return false;
    }

    // Verificar se produto ainda está em estoque
    // TODO: Implementar verificação de estoque via Shopify API se necessário

    console.log('⚡ [REMINDER] Should send reminder for subscription:', subscriptionId);
    return true;

  } catch (error) {
    console.error('⚡ [REMINDER] Error checking if should send reminder:', error);
    return false;
  }
};

// Função para obter estatísticas da queue
export const getQueueStats = async () => {
  try {
    const stats = await db.notificationQueue.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });

    return stats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.id;
      return acc;
    }, {} as Record<string, number>);

  } catch (error) {
    console.error('⚡ [QUEUE] Error getting queue stats:', error);
    return {};
  }
};