import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // Endpoint público para processar inscrições do widget
  
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }
  
  try {
    const body = await request.json();
    const { email, phone, productId, productTitle, productUrl, shopId } = body;
    
    // Validação básica
    if (!email || !productId || !shopId) {
      return json({ 
        error: 'Missing required fields',
        details: 'Email, productId, and shopId are required'
      }, { status: 400 });
    }
    
    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json({ 
        error: 'Invalid email format' 
      }, { status: 400 });
    }
    
    // Verifica se já existe uma inscrição ativa para este email/produto
    const existingSubscription = await db.subscription.findUnique({
      where: {
        email_productId_shopId: {
          email: email.toLowerCase().trim(),
          productId: productId.toString(),
          shopId: shopId.toString()
        }
      }
    }).catch(() => null);
    
    if (existingSubscription && existingSubscription.status === 'active') {
      return json({ 
        success: true,
        message: 'You are already subscribed to notifications for this product',
        subscriptionId: existingSubscription.id
      });
    }
    
    // Cria ou atualiza a inscrição
    const subscriptionData = {
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      productId: productId.toString(),
      productTitle: productTitle?.trim() || null,
      productUrl: productUrl?.trim() || null,
      shopId: shopId.toString(),
      status: 'active' as const,
      subscribedAt: new Date(),
      // Metadata adicional
      userAgent: request.headers.get('user-agent') || null,
      ipAddress: getClientIP(request),
      source: 'widget'
    };
    
    let subscription;
    
    if (existingSubscription) {
      // Reativa inscrição existente
      subscription = await db.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          ...subscriptionData,
          reactivatedAt: new Date(),
          reactivationCount: existingSubscription.reactivationCount + 1
        }
      });
    } else {
      // Cria nova inscrição
      subscription = await db.subscription.create({
        data: subscriptionData
      });
    }
    
    // Log da inscrição para analytics
    await logSubscriptionEvent(subscription.id, 'subscribed', {
      email,
      productId,
      productTitle,
      shopId,
      source: 'widget'
    });
    
    // Dispara primeira notificação (confirmação) se habilitada
    await sendConfirmationNotification(subscription);
    
    // Headers CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache'
    };
    
    return json({
      success: true,
      message: 'Successfully subscribed! You will be notified when this item is back in stock.',
      subscriptionId: subscription.id,
      data: {
        email: subscription.email,
        productId: subscription.productId,
        productTitle: subscription.productTitle,
        subscribedAt: subscription.subscribedAt
      }
    }, { headers });
    
  } catch (error) {
    console.error('Error processing subscription:', error);
    
    // Log do erro para debugging
    await logSubscriptionEvent(null, 'error', {
      error: error.message,
      stack: error.stack,
      body: await request.text().catch(() => 'Unable to read body')
    }).catch(() => {}); // Fail silently se logging falhar
    
    return json({
      success: false,
      error: 'Internal server error',
      message: 'Something went wrong while processing your subscription. Please try again.'
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }
};

// Função para extrair IP do cliente
function getClientIP(request: Request): string | null {
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  const xRealIP = request.headers.get('x-real-ip');
  if (xRealIP) {
    return xRealIP.trim();
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }
  
  return null;
}

// Função para log de eventos de inscrição
async function logSubscriptionEvent(
  subscriptionId: string | null, 
  event: string, 
  data: any
) {
  try {
    await db.subscriptionLog.create({
      data: {
        subscriptionId,
        event,
        data: JSON.stringify(data),
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to log subscription event:', error);
  }
}

// Função para enviar notificação de confirmação
async function sendConfirmationNotification(subscription: any) {
  try {
    // Verifica se primeira notificação está habilitada
    const settings = await db.settings.findUnique({
      where: { shopId: subscription.shopId },
      select: { 
        firstEmailEnabled: true, 
        firstSmsEnabled: true 
      }
    });
    
    if (!settings) return;
    
    // Agenda primeira notificação de email
    if (settings.firstEmailEnabled && subscription.email) {
      await db.notificationQueue.create({
        data: {
          subscriptionId: subscription.id,
          type: 'first_email',
          scheduledFor: new Date(), // Enviar imediatamente
          data: JSON.stringify({
            email: subscription.email,
            productTitle: subscription.productTitle,
            productUrl: subscription.productUrl
          })
        }
      });
    }
    
    // Agenda primeira notificação de SMS
    if (settings.firstSmsEnabled && subscription.phone) {
      await db.notificationQueue.create({
        data: {
          subscriptionId: subscription.id,
          type: 'first_sms',
          scheduledFor: new Date(), // Enviar imediatamente
          data: JSON.stringify({
            phone: subscription.phone,
            productTitle: subscription.productTitle,
            productUrl: subscription.productUrl
          })
        }
      });
    }
    
  } catch (error) {
    console.error('Failed to schedule confirmation notifications:', error);
  }
}

// Suporte para preflight CORS
export const loader = async ({ request }: { request: Request }) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  
  return json({ error: 'Method not allowed' }, { status: 405 });
};