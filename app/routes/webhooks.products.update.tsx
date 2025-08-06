import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import crypto from "crypto";
import db from "../db.server";
import { addNotificationToQueue } from "../utils/notification-queue.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log('🔄 [WEBHOOK] Products update received');
  
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Verificar HMAC para segurança
    const body = await request.text();
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
    const shop = request.headers.get('x-shopify-shop-domain');
    
    if (!hmacHeader || !shop) {
      console.log('🔄 [WEBHOOK] Missing required headers');
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
      console.log('🔄 [WEBHOOK] Invalid HMAC');
      return json({ error: 'Invalid HMAC' }, { status: 401 });
    }

    // Parse do payload
    const product = JSON.parse(body);
    console.log('🔄 [WEBHOOK] Processing product:', {
      id: product.id,
      title: product.title,
      variants: product.variants?.length || 0
    });

    // Usar shop domain completo para consistência com outras rotas
    const shopId = shop;

    console.log('🔄 [WEBHOOK] Looking for settings with shopId:', shopId);

    // Verificar se auto notification está habilitada para esta loja
    const settings = await db.settings.findUnique({
      where: { shopId }
    });

    console.log('🔄 [WEBHOOK] Settings found:', settings ? 'YES' : 'NO');
    if (settings) {
      console.log('🔄 [WEBHOOK] Settings values:', {
        autoNotificationEnabled: settings.autoNotificationEnabled,
        firstEmailEnabled: settings.firstEmailEnabled
      });
    }

    if (!settings?.autoNotificationEnabled || !settings?.firstEmailEnabled) {
      console.log('🔄 [WEBHOOK] Auto notifications disabled for shop:', shopId);
      return json({ success: true, message: 'Auto notifications disabled' });
    }

    // Processar cada variant do produto
    let notificationsAdded = 0;
    
    for (const variant of product.variants || []) {
      // Verificar se a quantidade mudou de 0 para > 0
      const currentInventory = variant.inventory_quantity || 0;
      
      if (currentInventory > 0) {
        console.log('🔄 [WEBHOOK] Variant back in stock:', {
          variantId: variant.id,
          productId: product.id,
          inventory: currentInventory
        });

        // Buscar subscriptions ativas para este produto
        console.log('🔄 [WEBHOOK] Searching subscriptions with:', {
          productId: product.id.toString(),
          shopId: shopId,
          status: 'active'
        });

        const subscriptions = await db.subscription.findMany({
          where: {
            productId: product.id.toString(),
            shopId: shopId,
            status: 'active'
          }
        });

        console.log('🔄 [WEBHOOK] Found subscriptions:', subscriptions.length);
        if (subscriptions.length > 0) {
          console.log('🔄 [WEBHOOK] First subscription:', {
            email: subscriptions[0].email,
            productId: subscriptions[0].productId,
            shopId: subscriptions[0].shopId,
            status: subscriptions[0].status
          });
        }

        // Adicionar notificações à queue
        for (const subscription of subscriptions) {
          try {
            await addNotificationToQueue({
              subscriptionId: subscription.id,
              type: 'thankyou_notification',
              scheduledFor: new Date(), // Enviar imediatamente
              data: {
                productId: product.id,
                productTitle: product.title,
                productHandle: product.handle,
                shopDomain: shop,
                variantId: variant.id,
                inventory: currentInventory
              }
            });
            
            notificationsAdded++;
            console.log('🔄 [WEBHOOK] Added to queue:', subscription.email);
          } catch (queueError) {
            console.error('🔄 [WEBHOOK] Queue error:', queueError);
          }
        }
      }
    }

    console.log('🔄 [WEBHOOK] Processing complete:', {
      shop: shopId,
      product: product.title,
      notificationsAdded
    });

    return json({ 
      success: true, 
      processed: notificationsAdded,
      message: `Added ${notificationsAdded} notifications to queue`
    });

  } catch (error) {
    console.error('🔄 [WEBHOOK] Error processing webhook:', error);
    return json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
};

// GET não é necessário para webhooks, mas pode ser útil para debug
export const loader = async () => {
  return json({ 
    message: 'Products update webhook endpoint',
    method: 'POST required'
  });
};