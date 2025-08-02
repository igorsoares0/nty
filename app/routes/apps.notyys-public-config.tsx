import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Endpoint público para buscar configurações do widget
    // Usado pelo widget no storefront
    
    const url = new URL(request.url);
    let shop = url.searchParams.get('shop');
    
    // Tenta obter shop de várias fontes
    if (!shop) {
      const referer = request.headers.get('referer');
      if (referer) {
        const refererUrl = new URL(referer);
        shop = refererUrl.hostname;
      }
    }
    
    if (!shop) {
      shop = request.headers.get('x-shopify-shop-domain') || 
            request.headers.get('x-forwarded-host') ||
            request.headers.get('host');
    }
    
    if (!shop) {
      console.log('No shop found, returning default config');
      return json({ 
        error: 'Shop parameter required',
        enabled: true, // Fallback para permitir funcionamento básico
        ...getDefaultConfig()
      }, { 
        status: 200, // Mudança para 200 para não quebrar o widget
        headers: {
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
    
    // Remove protocolo e .myshopify.com se presente
    const shopDomain = shop.replace(/^https?:\/\//, '').replace(/\.myshopify\.com$/, '');
    
    console.log(`Loading config for shop: ${shopDomain}`);
    
    // Busca configurações do banco de dados
    const [buttonSettings, formSettings, productSettings, generalSettings] = await Promise.all([
      db.buttonSettings.findUnique({
        where: { shopId: shopDomain },
      }).catch(() => null),
      
      db.formSettings.findUnique({
        where: { shopId: shopDomain },
      }).catch(() => null),
      
      db.productSettings.findMany({
        where: { 
          shopId: shopDomain,
          showNotification: false // Produtos desabilitados
        },
        select: { productId: true }
      }).catch(() => []),
      
      db.settings.findUnique({
        where: { shopId: shopDomain },
      }).catch(() => null)
    ]);
    
    // Monta configuração completa para o widget
    const config = {
      // Configurações gerais
      enabled: generalSettings?.autoNotificationEnabled ?? true,
      
      // Configurações do botão
      buttonText: buttonSettings?.textContent || "Notify Me",
      buttonColor: buttonSettings?.backgroundColor || "#000000",
      textColor: buttonSettings?.textColor || "#ffffff",
      borderRadius: buttonSettings?.borderRadius || 4,
      textSize: buttonSettings?.textSize || 16,
      
      // Configurações do formulário
      formTitle: formSettings?.formTitle || "Get notified when back in stock!",
      formDescription: formSettings?.formDescription || "Enter your email to be notified when this item is available.",
      formButtonText: formSettings?.buttonText || "Subscribe",
      phoneNumberEnabled: formSettings?.phoneNumberEnabled || false,
      formBgColor: formSettings?.formBgColor || "#ffffff",
      formButtonColor: formSettings?.buttonColor || "#000000",
      formTextColor: formSettings?.textColor || "#333333",
      buttonBorderRadius: formSettings?.buttonBorderRadius || 4,
      formTextSize: formSettings?.textSize || 14,
      
      // Produtos desabilitados
      disabledProducts: productSettings.map(p => p.productId),
      
      // Metadados
      lastUpdated: new Date().toISOString(),
      version: "1.0.0"
    };
    
    // Headers para cache
    const headers = {
      'Cache-Control': 'public, max-age=300', // Cache por 5 minutos
      'Vary': 'Accept-Encoding',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    return json(config, { headers });
    
  } catch (error) {
    console.error('Error loading public config:', error);
    
    // Retorna configuração padrão em caso de erro
    return json({
      error: 'Failed to load configuration',
      enabled: true,
      ...getDefaultConfig()
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
};

function getDefaultConfig() {
  return {
    buttonText: "Notify Me",
    buttonColor: "#000000",
    textColor: "#ffffff",
    borderRadius: 4,
    textSize: 16,
    formTitle: "Get notified when back in stock!",
    formDescription: "Enter your email to be notified when this item is available.",
    formButtonText: "Subscribe",
    phoneNumberEnabled: false,
    formBgColor: "#ffffff",
    formTextColor: "#333333",
    buttonBorderRadius: 4,
    formTextSize: 14,
    disabledProducts: [],
    lastUpdated: new Date().toISOString(),
    version: "1.0.0"
  };
}