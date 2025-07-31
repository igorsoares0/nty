import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

// Função para sincronizar configurações do banco com metafields da shop
export async function syncConfigToMetafields(
  admin: AdminApiContext, 
  shopDomain: string, 
  configData: {
    buttonSettings?: any;
    formSettings?: any;
    productSettings?: any;
    generalSettings?: any;
  }
) {
  try {
    // Primeiro, obtém o ID numérico da shop
    const shopResponse = await admin.graphql(`
      query getShop {
        shop {
          id
        }
      }
    `);
    
    const shopResult = await shopResponse.json();
    const shopId = shopResult.data?.shop?.id;
    
    if (!shopId) {
      throw new Error('Could not get shop ID');
    }
    
    const metafieldsToSet = [];
    
    // Converte configurações do botão para metafield
    if (configData.buttonSettings) {
      metafieldsToSet.push({
        ownerId: shopId,
        namespace: "notyys_config",
        key: "button_settings",
        value: JSON.stringify({
          backgroundColor: configData.buttonSettings.backgroundColor,
          textColor: configData.buttonSettings.textColor,
          borderRadius: configData.buttonSettings.borderRadius,
          textSize: configData.buttonSettings.textSize,
          textContent: configData.buttonSettings.textContent,
          updatedAt: new Date().toISOString()
        }),
        type: "json"
      });
    }
    
    // Converte configurações do formulário para metafield
    if (configData.formSettings) {
      metafieldsToSet.push({
        ownerId: shopId,
        namespace: "notyys_config",
        key: "form_settings",
        value: JSON.stringify({
          formBgColor: configData.formSettings.formBgColor,
          buttonColor: configData.formSettings.buttonColor,
          buttonBorderRadius: configData.formSettings.buttonBorderRadius,
          textSize: configData.formSettings.textSize,
          textColor: configData.formSettings.textColor,
          phoneNumberEnabled: configData.formSettings.phoneNumberEnabled,
          formTitle: configData.formSettings.formTitle,
          formDescription: configData.formSettings.formDescription,
          buttonText: configData.formSettings.buttonText,
          updatedAt: new Date().toISOString()
        }),
        type: "json"
      });
    }
    
    // Converte configurações gerais para metafield
    if (configData.generalSettings) {
      metafieldsToSet.push({
        ownerId: shopId,
        namespace: "notyys_config",
        key: "general_settings",
        value: JSON.stringify({
          enabled: configData.generalSettings.autoNotificationEnabled,
          ownerEmail: configData.generalSettings.ownerEmail,
          updatedAt: new Date().toISOString()
        }),
        type: "json"
      });
    }
    
    // Converte lista de produtos desabilitados para metafield
    if (configData.productSettings) {
      metafieldsToSet.push({
        ownerId: shopId,
        namespace: "notyys_config",
        key: "disabled_products",
        value: JSON.stringify({
          productIds: configData.productSettings.disabledProducts || [],
          updatedAt: new Date().toISOString()
        }),
        type: "json"
      });
    }
    
    // Executa a mutação para definir os metafields
    if (metafieldsToSet.length > 0) {
      const response = await admin.graphql(`
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              namespace
              key
              value
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: { metafields: metafieldsToSet }
      });
      
      const result = await response.json();
      
      if (result.data?.metafieldsSet?.userErrors?.length > 0) {
        console.error('Metafields sync errors:', result.data.metafieldsSet.userErrors);
        throw new Error(`Metafields sync failed: ${result.data.metafieldsSet.userErrors[0].message}`);
      }
      
      console.log(`Successfully synced ${metafieldsToSet.length} metafields for shop ${shopDomain}`);
      return result.data?.metafieldsSet?.metafields || [];
    }
    
    return [];
    
  } catch (error) {
    console.error('Error syncing config to metafields:', error);
    throw error;
  }
}

// Função para buscar configurações dos metafields da shop
export async function loadConfigFromMetafields(admin: AdminApiContext) {
  try {
    const response = await admin.graphql(`
      query getShopMetafields {
        shop {
          buttonSettings: metafield(namespace: "notyys_config", key: "button_settings") {
            value
            updatedAt
          }
          formSettings: metafield(namespace: "notyys_config", key: "form_settings") {
            value
            updatedAt
          }
          generalSettings: metafield(namespace: "notyys_config", key: "general_settings") {
            value
            updatedAt
          }
          disabledProducts: metafield(namespace: "notyys_config", key: "disabled_products") {
            value
            updatedAt
          }
        }
      }
    `);
    
    const result = await response.json();
    const shop = result.data?.shop;
    
    if (!shop) {
      return null;
    }
    
    // Parse dos metafields JSON
    const config = {
      buttonSettings: shop.buttonSettings ? JSON.parse(shop.buttonSettings.value) : null,
      formSettings: shop.formSettings ? JSON.parse(shop.formSettings.value) : null,
      generalSettings: shop.generalSettings ? JSON.parse(shop.generalSettings.value) : null,
      disabledProducts: shop.disabledProducts ? JSON.parse(shop.disabledProducts.value).productIds : [],
      lastSync: {
        buttonSettings: shop.buttonSettings?.updatedAt,
        formSettings: shop.formSettings?.updatedAt,
        generalSettings: shop.generalSettings?.updatedAt,
        disabledProducts: shop.disabledProducts?.updatedAt,
      }
    };
    
    return config;
    
  } catch (error) {
    console.error('Error loading config from metafields:', error);
    return null;
  }
}

// Função para invalidar cache das configurações públicas
export async function invalidatePublicConfigCache(shopDomain: string) {
  try {
    // Aqui você poderia implementar invalidação de cache
    // Por exemplo, limpar cache do CDN, Redis, etc.
    
    // Por enquanto, apenas log
    console.log(`Public config cache invalidated for shop: ${shopDomain}`);
    
    return true;
  } catch (error) {
    console.error('Error invalidating public config cache:', error);
    return false;
  }
}

// Função para detectar mudanças e sincronizar apenas se necessário
export async function smartSyncToMetafields(
  admin: AdminApiContext,
  shopDomain: string,
  newConfig: any,
  forceSync: boolean = false
) {
  try {
    if (!forceSync) {
      // Busca configurações atuais dos metafields
      const currentConfig = await loadConfigFromMetafields(admin);
      
      // Compara se houve mudanças significativas
      if (currentConfig && !hasConfigChanged(currentConfig, newConfig)) {
        console.log('No configuration changes detected, skipping metafields sync');
        return { synced: false, reason: 'no_changes' };
      }
    }
    
    // Executa sincronização
    const result = await syncConfigToMetafields(admin, shopDomain, newConfig);
    
    // Invalida cache público
    await invalidatePublicConfigCache(shopDomain);
    
    return { synced: true, metafields: result };
    
  } catch (error) {
    console.error('Smart sync failed:', error);
    throw error;
  }
}

// Função helper para comparar configurações
function hasConfigChanged(currentConfig: any, newConfig: any): boolean {
  try {
    // Compara configurações do botão
    if (newConfig.buttonSettings) {
      const current = currentConfig.buttonSettings;
      const updated = newConfig.buttonSettings;
      
      if (!current || 
          current.backgroundColor !== updated.backgroundColor ||
          current.textColor !== updated.textColor ||
          current.borderRadius !== updated.borderRadius ||
          current.textSize !== updated.textSize ||
          current.textContent !== updated.textContent) {
        return true;
      }
    }
    
    // Compara configurações do formulário
    if (newConfig.formSettings) {
      const current = currentConfig.formSettings;
      const updated = newConfig.formSettings;
      
      if (!current ||
          current.formBgColor !== updated.formBgColor ||
          current.buttonColor !== updated.buttonColor ||
          current.buttonBorderRadius !== updated.buttonBorderRadius ||
          current.textSize !== updated.textSize ||
          current.textColor !== updated.textColor ||
          current.phoneNumberEnabled !== updated.phoneNumberEnabled ||
          current.formTitle !== updated.formTitle ||
          current.formDescription !== updated.formDescription ||
          current.buttonText !== updated.buttonText) {
        return true;
      }
    }
    
    // Compara configurações gerais
    if (newConfig.generalSettings) {
      const current = currentConfig.generalSettings;
      const updated = newConfig.generalSettings;
      
      if (!current ||
          current.enabled !== updated.autoNotificationEnabled ||
          current.ownerEmail !== updated.ownerEmail) {
        return true;
      }
    }
    
    // Compara produtos desabilitados
    if (newConfig.productSettings) {
      const currentProducts = currentConfig.disabledProducts || [];
      const updatedProducts = newConfig.productSettings.disabledProducts || [];
      
      if (JSON.stringify(currentProducts.sort()) !== JSON.stringify(updatedProducts.sort())) {
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    console.error('Error comparing configs:', error);
    return true; // Em caso de erro, assume que houve mudança
  }
}