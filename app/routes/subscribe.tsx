import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import { sendThankYouEmail } from "../utils/email.server";
import { authenticate } from "../shopify.server";

// Função para buscar dados do produto via GraphQL
const getProductData = async (productId: string, shopDomain: string) => {
  try {
    // Buscar session para esta loja
    const session = await db.session.findFirst({
      where: {
        shop: shopDomain,
        isOnline: false // Usar offline token para API calls
      },
      orderBy: {
        expires: 'desc'
      }
    });

    if (!session) {
      console.log('🛍️ [PRODUCT] No session found for shop:', shopDomain);
      return null;
    }

    // Fazer query GraphQL
    const response = await fetch(`https://${shopDomain}/admin/api/2023-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': session.accessToken,
      },
      body: JSON.stringify({
        query: `
          query getProduct($id: ID!) {
            product(id: $id) {
              id
              title
              handle
              featuredImage {
                url
                altText
              }
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
            }
          }
        `,
        variables: {
          id: `gid://shopify/Product/${productId}`
        }
      })
    });

    if (!response.ok) {
      console.log('🛍️ [PRODUCT] GraphQL request failed:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.errors) {
      console.log('🛍️ [PRODUCT] GraphQL errors:', data.errors);
      return null;
    }

    const product = data.data?.product;
    if (!product) {
      console.log('🛍️ [PRODUCT] Product not found:', productId);
      return null;
    }

    console.log('🛍️ [PRODUCT] Product data retrieved:', {
      id: product.id,
      title: product.title,
      hasImage: !!(product.featuredImage?.url || product.images?.edges?.[0]?.node?.url)
    });

    return {
      title: product.title,
      handle: product.handle,
      image: product.featuredImage?.url || product.images?.edges?.[0]?.node?.url || null
    };

  } catch (error) {
    console.error('🛍️ [PRODUCT] Error fetching product data:', error);
    return null;
  }
};

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
    
    // Usar shop domain do header para consistência com outras rotas
    const shopDomain = request.headers.get('x-forwarded-host') || 'unknown';
    console.log(`🎯 [SUBSCRIBE] Shop domain from header:`, shopDomain);
    console.log(`🎯 [SUBSCRIBE] Original shopId from payload:`, shopId);
    
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
          // Extrair domínio completo da productUrl para buscar template correto
          let fullShopDomain = shopDomain;
          if (subscription.productUrl) {
            try {
              const url = new URL(subscription.productUrl);
              fullShopDomain = url.hostname;
              console.log(`🎯 [EMAIL] Using full shop domain for template:`, fullShopDomain);
            } catch (urlError) {
              console.log(`🎯 [EMAIL] Failed to extract domain, using shopDomain:`, shopDomain);
            }
          }
          
          // Buscar dados do produto incluindo imagem
          const productData = await getProductData(subscription.productId, fullShopDomain);
          
          const emailSent = await sendThankYouEmail({
            email: subscription.email,
            productTitle: productData?.title || subscription.productTitle || 'Product',
            productUrl: subscription.productUrl || '',
            productImage: productData?.image || null,
            shopId: fullShopDomain,
            shopDomain: fullShopDomain,
          });
          
          if (emailSent) {
            console.log(`🎯 [EMAIL] Thank you email sent to:`, subscription.email);
          } else {
            console.log(`🎯 [EMAIL] Failed to send thank you email to:`, subscription.email);
          }
        } catch (emailError) {
          console.error(`🎯 [EMAIL] Error sending thank you email:`, emailError);
        }
      }, 100);
      
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
