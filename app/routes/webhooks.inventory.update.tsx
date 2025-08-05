import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import crypto from "crypto";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log('📦 [WEBHOOK] Inventory update received');
  
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Verificar HMAC para segurança
    const body = await request.text();
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
    const shop = request.headers.get('x-shopify-shop-domain');
    
    if (!hmacHeader || !shop) {
      console.log('📦 [WEBHOOK] Missing required headers');
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
      console.log('📦 [WEBHOOK] Invalid HMAC');
      return json({ error: 'Invalid HMAC' }, { status: 401 });
    }

    // Parse do payload do inventory level
    const inventoryLevel = JSON.parse(body);
    console.log('📦 [WEBHOOK] Processing inventory level:', {
      inventoryItemId: inventoryLevel.inventory_item_id,
      locationId: inventoryLevel.location_id,
      available: inventoryLevel.available
    });

    // Extrair shop ID do header
    const shopId = shop.replace('.myshopify.com', '');

    // Verificar se auto notification está habilitada
    const settings = await db.settings.findUnique({
      where: { shopId }
    });

    if (!settings?.autoNotificationEnabled || !settings?.firstEmailEnabled) {
      console.log('📦 [WEBHOOK] Auto notifications disabled for shop:', shopId);
      return json({ success: true, message: 'Auto notifications disabled' });
    }

    // Verificar se inventory mudou para > 0 (indicating back in stock)
    const currentInventory = inventoryLevel.available || 0;
    
    if (currentInventory > 0) {
      console.log('📦 [WEBHOOK] Inventory back in stock:', {
        inventoryItemId: inventoryLevel.inventory_item_id,
        available: currentInventory
      });

      // Buscar produto associado a este inventory item
      // Nota: Precisaríamos fazer uma query na Shopify API para buscar o produto
      // Por agora, vamos usar o webhook de products/update que é mais completo
      
      console.log('📦 [WEBHOOK] Inventory webhook received, but using products/update for complete flow');
    }

    return json({ 
      success: true, 
      message: 'Inventory webhook processed (using products/update for notifications)'
    });

  } catch (error) {
    console.error('📦 [WEBHOOK] Error processing inventory webhook:', error);
    return json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
};

export const loader = async () => {
  return json({ 
    message: 'Inventory update webhook endpoint',
    method: 'POST required'
  });
};