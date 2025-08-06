import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import crypto from "crypto";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log('🛒 [WEBHOOK] Order create received');
  
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Verificar HMAC para segurança
    const body = await request.text();
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
    const shop = request.headers.get('x-shopify-shop-domain');
    
    if (!hmacHeader || !shop) {
      console.log('🛒 [WEBHOOK] Missing required headers');
      return json({ error: 'Missing headers' }, { status: 400 });
    }

    // Validar HMAC (em produção usar secret do ambiente)
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET || 'dev-secret';
    const calculatedHmac = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('base64');

    // Em desenvolvimento, pular validação HMAC se não configurado
    if (process.env.NODE_ENV === 'production' && hmacHeader !== calculatedHmac) {
      console.log('🛒 [WEBHOOK] Invalid HMAC');
      return json({ error: 'Invalid HMAC' }, { status: 401 });
    }

    // Parse do payload
    const order = JSON.parse(body);
    console.log('🛒 [WEBHOOK] Processing order:', {
      id: order.id,
      email: order.email,
      line_items: order.line_items?.length || 0
    });

    const shopId = shop;
    let purchasesDetected = 0;

    // Processar cada item do pedido
    for (const lineItem of order.line_items || []) {
      const productId = lineItem.product_id?.toString();
      const customerEmail = order.email;

      if (!productId || !customerEmail) {
        continue;
      }

      console.log('🛒 [WEBHOOK] Checking for subscriptions:', {
        productId,
        customerEmail,
        shopId
      });

      // Buscar subscriptions ativas para este produto e email
      const subscriptions = await db.subscription.findMany({
        where: {
          productId: productId,
          email: customerEmail,
          shopId: shopId,
          status: 'active',
          purchaseDetectedAt: null // Ainda não detectamos compra
        }
      });

      console.log('🛒 [WEBHOOK] Found matching subscriptions:', subscriptions.length);

      // Marcar subscriptions como "compra detectada"
      for (const subscription of subscriptions) {
        try {
          await db.subscription.update({
            where: { id: subscription.id },
            data: {
              purchaseDetectedAt: new Date(),
              status: 'notified' // Alterar status para indicar que o objetivo foi alcançado
            }
          });

          // Cancelar quaisquer lembretes pendentes para esta subscription
          await db.notificationQueue.updateMany({
            where: {
              subscriptionId: subscription.id,
              type: {
                in: ['reminder_email', 'reminder_sms']
              },
              status: 'pending'
            },
            data: {
              status: 'cancelled',
              errorMessage: 'Purchase detected - reminders cancelled'
            }
          });

          purchasesDetected++;
          console.log('🛒 [WEBHOOK] Purchase detected for subscription:', subscription.id);
          
        } catch (updateError) {
          console.error('🛒 [WEBHOOK] Error updating subscription:', updateError);
        }
      }
    }

    console.log('🛒 [WEBHOOK] Processing complete:', {
      shop: shopId,
      orderId: order.id,
      purchasesDetected
    });

    return json({ 
      success: true, 
      purchasesDetected,
      message: `Detected ${purchasesDetected} purchases from active subscriptions`
    });

  } catch (error) {
    console.error('🛒 [WEBHOOK] Error processing webhook:', error);
    return json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
};

// GET não é necessário para webhooks, mas pode ser útil para debug
export const loader = async () => {
  return json({ 
    message: 'Orders create webhook endpoint',
    method: 'POST required'
  });
};