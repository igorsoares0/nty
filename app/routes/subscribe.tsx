import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import { sendThankYouEmail } from "../utils/email.server";

// App Proxy endpoint: /subscribe (após remoção do prefixo /apps/notyys)
export const action = async ({ request }: ActionFunctionArgs) => {
  console.log(`🎯 [SUBSCRIBE] ${request.method} request received`);
  console.log(`🎯 [SUBSCRIBE] URL:`, request.url);
  console.log(`🎯 [SUBSCRIBE] Headers:`, Object.fromEntries(request.headers.entries()));
  
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }
  
  try {
    const body = await request.json();
    const { email, phone, productId, productTitle, productUrl, shopId } = body;
    
    console.log(`🎯 [SUBSCRIBE] Processing subscription:`, { email, productId, shopId });
    
    // Validação básica
    if (!email || !productId || !shopId) {
      console.log(`🎯 [SUBSCRIBE] Missing fields:`, { email: !!email, productId: !!productId, shopId: !!shopId });
      return json({ 
        error: 'Missing required fields',
        details: 'Email, productId, and shopId are required'
      }, { status: 400 });
    }
    
    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log(`🎯 [SUBSCRIBE] Invalid email:`, email);
      return json({ 
        error: 'Invalid email format' 
      }, { status: 400 });
    }
    
    // Converte shopId para string
    const shopDomain = shopId.toString().replace(/^gid:\/\/shopify\/Shop\//, '');
    console.log(`🎯 [SUBSCRIBE] Shop domain:`, shopDomain);
    
    // Verifica se já existe inscrição
    let existingSubscription = null;
    try {
      existingSubscription = await db.subscription.findUnique({
        where: {
          email_productId_shopId: {
            email: email.toLowerCase().trim(),
            productId: productId.toString(),
            shopId: shopDomain
          }
        }
      });
      console.log(`🎯 [SUBSCRIBE] Existing:`, existingSubscription?.id || 'none');
    } catch (dbError) {
      console.error(`🎯 [SUBSCRIBE] DB find error:`, dbError);
    }
    
    if (existingSubscription && existingSubscription.status === 'active') {
      console.log(`🎯 [SUBSCRIBE] Already subscribed:`, existingSubscription.id);
      return json({ 
        success: true,
        message: 'You are already subscribed to notifications for this product',
        subscriptionId: existingSubscription.id
      });
    }
    
    // Dados da inscrição
    const subscriptionData = {
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      productId: productId.toString(),
      productTitle: productTitle?.trim() || null,
      productUrl: productUrl?.trim() || null,
      shopId: shopDomain,
      status: 'active' as const,
      subscribedAt: new Date(),
      userAgent: request.headers.get('user-agent') || null,
      ipAddress: getClientIP(request),
      source: 'widget_proxy'
    };
    
    let subscription;
    
    try {
      if (existingSubscription) {
        console.log(`🎯 [SUBSCRIBE] Reactivating:`, existingSubscription.id);
        subscription = await db.subscription.update({
          where: { id: existingSubscription.id },
          data: {
            ...subscriptionData,
            reactivatedAt: new Date(),
            reactivationCount: existingSubscription.reactivationCount + 1
          }
        });
      } else {
        console.log(`🎯 [SUBSCRIBE] Creating new subscription`);
        subscription = await db.subscription.create({
          data: subscriptionData
        });
      }
      
      console.log(`🎯 [SUBSCRIBE] SUCCESS:`, subscription.id);
      
      // Enviar email de agradecimento (não bloquear response se falhar)
      setTimeout(async () => {
        try {
          const emailSent = await sendThankYouEmail({
            email: subscription.email,
            productTitle: subscription.productTitle || 'Product',
            productUrl: subscription.productUrl || '',
            shopId: subscription.shopId,
            shopDomain: shopDomain,
          });
          
          if (emailSent) {
            console.log(`🎯 [EMAIL] Thank you email sent to:`, subscription.email);
          } else {
            console.log(`🎯 [EMAIL] Failed to send thank you email to:`, subscription.email);
          }
        } catch (emailError) {
          console.error(`🎯 [EMAIL] Error sending thank you email:`, emailError);
        }
      }, 100); // Enviar após 100ms para não bloquear response
      
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
      });
      
    } catch (dbError) {
      console.error(`🎯 [SUBSCRIBE] Database error:`, dbError);
      return json({
        success: false,
        error: 'Database error',
        message: 'Failed to save subscription'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error(`🎯 [SUBSCRIBE] General error:`, error);
    
    return json({
      success: false,
      error: 'Internal server error',
      message: 'Something went wrong while processing your subscription. Please try again.'
    }, { status: 500 });
  }
};

// Loader para GET requests
export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log(`🎯 [SUBSCRIBE] GET request`);
  const url = new URL(request.url);
  console.log(`🎯 [SUBSCRIBE] Query params:`, Object.fromEntries(url.searchParams.entries()));
  
  return json({ 
    message: 'Notyys subscription endpoint via App Proxy',
    method: 'POST required',
    timestamp: new Date().toISOString(),
    queryParams: Object.fromEntries(url.searchParams.entries())
  });
};

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