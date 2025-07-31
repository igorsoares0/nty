(function() {
  'use strict';
  
  class NotifyMeEmbedWidget {
    constructor() {
      // Debug mode
      this.debug = window.location.search.includes('notyys_debug=true');
      
      this.log('NotifyMe Widget initializing...');
      
      // Só executa em páginas de produto
      if (!this.isProductPage()) {
        this.log('Not a product page, skipping initialization');
        return;
      }
      
      // Aguarda o DOM estar pronto
      this.init();
    }
    
    log(message, data = null) {
      if (this.debug) {
        console.log('[NotifyMe]', message, data || '');
      }
    }
    
    async init() {
      try {
        this.log('Starting initialization...');
        
        // Carrega configurações (primeiro tenta do metafields, depois do endpoint)
        await this.loadAppConfig();
        
        // Verifica se deve renderizar o widget
        if (this.shouldRenderWidget()) {
          this.log('Rendering widget...');
          this.renderWidget();
        } else {
          this.log('Widget should not be rendered', {
            configEnabled: this.appConfig?.enabled,
            isOutOfStock: this.isOutOfStock(),
            isEligible: this.isProductEligible()
          });
        }
      } catch (error) {
        this.log('Error during initialization:', error);
      }
    }
    
    isProductPage() {
      // Método 1: Verifica URL
      const isProductURL = window.location.pathname.includes('/products/');
      
      // Método 2: Verifica objetos globais do Shopify
      const hasProductData = !!(window.product || window.ShopifyAnalytics?.meta?.product);
      
      // Método 3: Verifica elementos DOM específicos de produto
      const hasProductElements = !!(
        document.querySelector('.product-form') ||
        document.querySelector('[data-product-id]') ||
        document.querySelector('.product') ||
        document.querySelector('#product-form')
      );
      
      return isProductURL && (hasProductData || hasProductElements);
    }
    
    async loadAppConfig() {
      try {
        this.log('Loading app configuration...');
        
        // Primeiro, tenta usar configurações dos metafields (carregadas no liquid)
        if (window.notyysEmbedConfig?.widget) {
          this.log('Using config from metafields:', window.notyysEmbedConfig.widget);
          this.appConfig = window.notyysEmbedConfig.widget;
          return;
        }
        
        // Fallback: busca configurações via endpoint
        const shopDomain = window.notyysEmbedConfig?.shopDomain;
        if (!shopDomain) {
          this.log('No shop domain found, using defaults');
          this.appConfig = this.getDefaultConfig();
          return;
        }
        
        // Tenta múltiplas URLs possíveis para o endpoint
        const possibleUrls = [
          `/apps/notyys-public-config?shop=${shopDomain}`,
          `https://${shopDomain}/apps/notyys-public-config?shop=${shopDomain}`,
          `/apps/notyys-public-config`
        ];
        
        let configLoaded = false;
        
        for (const url of possibleUrls) {
          try {
            this.log(`Trying to load config from: ${url}`);
            
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              }
            });
            
            if (response.ok) {
              const endpointConfig = await response.json();
              this.appConfig = endpointConfig;
              this.log('App config loaded successfully from endpoint:', url, this.appConfig);
              configLoaded = true;
              break;
            } else {
              this.log(`Failed to load from ${url}, status:`, response.status);
            }
          } catch (fetchError) {
            this.log(`Error fetching from ${url}:`, fetchError);
          }
        }
        
        if (!configLoaded) {
          this.log('All config URLs failed, using defaults');
          this.appConfig = this.getDefaultConfig();
        }
        
      } catch (error) {
        this.log('Error loading app config:', error);
        this.appConfig = this.getDefaultConfig();
      }
    }
    
    getDefaultConfig() {
      return {
        enabled: true,
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
        formTextSize: 14
      };
    }
    
    shouldRenderWidget() {
      const enabled = this.appConfig?.enabled;
      const outOfStock = this.isOutOfStock();
      const eligible = this.isProductEligible();
      
      this.log('Widget render check:', { enabled, outOfStock, eligible });
      
      return enabled && outOfStock && eligible;
    }
    
    isOutOfStock() {
      // Método 1: Verifica window.product (tema padrão do Shopify)
      if (window.product) {
        const product = window.product;
        this.log('Checking window.product:', { available: product.available, variants: product.variants?.length });
        
        if (product.available === false) {
          this.log('Product marked as unavailable');
          return true;
        }
        
        if (product.variants && product.variants.length > 0) {
          const hasStock = product.variants.some(variant => 
            variant.available && (variant.inventory_quantity === undefined || variant.inventory_quantity > 0)
          );
          if (!hasStock) {
            this.log('No variants have stock');
            return true;
          }
        }
      }
      
      // Método 2: Verifica ShopifyAnalytics
      const analyticsProduct = window.ShopifyAnalytics?.meta?.product;
      if (analyticsProduct) {
        this.log('Checking ShopifyAnalytics product:', analyticsProduct);
        
        if (analyticsProduct.variants && analyticsProduct.variants.length > 0) {
          const hasStock = analyticsProduct.variants.some(variant => 
            variant.inventory_quantity > 0
          );
          if (!hasStock) {
            this.log('Analytics shows no stock');
            return true;
          }
        }
      }
      
      // Método 3: Verifica botão de compra desabilitado
      const buyButtonSelectors = [
        '[name="add"]',
        '.btn-product-add', 
        '.product-form__cart-submit',
        '.product-form__button',
        '.shopify-payment-button__button',
        '.product-form__add-button',
        '#AddToCart',
        '.add-to-cart'
      ];
      
      for (const selector of buyButtonSelectors) {
        const buyButton = document.querySelector(selector);
        if (buyButton) {
          const isDisabled = buyButton.disabled || 
                            buyButton.hasAttribute('disabled') ||
                            buyButton.classList.contains('disabled') ||
                            buyButton.classList.contains('btn--sold-out');
          
          const textIndicatesSoldOut = /sold out|unavailable|out of stock|esgotado|indisponível/i.test(buyButton.textContent || '');
          
          if (isDisabled || textIndicatesSoldOut) {
            this.log('Buy button indicates sold out:', { disabled: isDisabled, soldOutText: textIndicatesSoldOut });
            return true;
          }
        }
      }
      
      // Método 4: Verifica elementos "Sold Out" na página
      const soldOutSelectors = [
        '.sold-out',
        '.out-of-stock', 
        '.unavailable',
        '[data-sold-out="true"]',
        '.product__sold-out',
        '.product-sold-out',
        '.inventory--unavailable'
      ];
      
      for (const selector of soldOutSelectors) {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) { // Elemento visível
          this.log('Found sold out element:', selector);
          return true;
        }
      }
      
      // Método 5: Verifica texto "Sold Out" visível
      const textElements = document.querySelectorAll('span, div, p, button');
      for (const element of textElements) {
        const text = element.textContent || '';
        if (/sold out|unavailable|out of stock|esgotado|indisponível/i.test(text) && 
            element.offsetParent !== null && 
            !element.closest('.notyys-widget')) { // Não contar nosso próprio widget
          this.log('Found sold out text:', text);
          return true;
        }
      }
      
      this.log('Product appears to be in stock');
      return false;
    }
    
    isProductEligible() {
      const productId = this.getProductId();
      this.log('Checking product eligibility:', { productId, disabledProducts: this.appConfig.disabledProducts });
      
      // Verifica se o produto não está na lista de desabilitados
      return !this.appConfig.disabledProducts?.includes(productId?.toString());
    }
    
    getProductId() {
      // Método 1: window.product
      if (window.product?.id) {
        return window.product.id;
      }
      
      // Método 2: ShopifyAnalytics
      if (window.ShopifyAnalytics?.meta?.product?.id) {
        return window.ShopifyAnalytics.meta.product.id;
      }
      
      // Método 3: DOM attributes
      const productElement = document.querySelector('[data-product-id]');
      if (productElement) {
        return productElement.dataset.productId;
      }
      
      // Método 4: Form product input
      const productInput = document.querySelector('input[name="id"], input[name="product-id"]');
      if (productInput) {
        return productInput.value;
      }
      
      // Método 5: URL parsing
      const match = window.location.pathname.match(/\/products\/([^\/\?]+)/);
      if (match) {
        return match[1]; // Product handle
      }
      
      return null;
    }
    
    getProductTitle() {
      return window.product?.title || 
             window.ShopifyAnalytics?.meta?.product?.title ||
             document.querySelector('h1.product__title, .product-title, .product__name')?.textContent?.trim() ||
             document.title;
    }
    
    renderWidget() {
      const container = document.getElementById('notyys-embed-container');
      if (!container) {
        this.log('Container not found');
        return;
      }
      
      container.innerHTML = this.getWidgetHTML();
      container.style.display = 'block';
      
      this.attachEventListeners();
      this.positionWidget();
      
      this.log('Widget rendered successfully');
    }
    
    getWidgetHTML() {
      return `
        <div class="notyys-embed-widget" data-product-id="${this.getProductId()}">
          <button 
            id="notyys-notify-btn"
            class="notyys-notify-button"
            style="
              background-color: ${this.appConfig.buttonColor};
              color: ${this.appConfig.textColor};
              border-radius: ${this.appConfig.borderRadius}px;
              font-size: ${this.appConfig.textSize}px;
              padding: 12px 24px;
              border: none;
              cursor: pointer;
              font-weight: 500;
              margin: 16px 0;
              transition: all 0.3s ease;
              display: inline-block;
              text-decoration: none;
              font-family: inherit;
              line-height: 1.2;
            "
            aria-label="Get notified when this product is back in stock"
          >
            ${this.appConfig.buttonText}
          </button>
          
          <div id="notyys-modal" class="notyys-modal" style="display: none;" role="dialog" aria-labelledby="notyys-form-title" aria-modal="true">
            <div class="notyys-modal-backdrop"></div>
            <div class="notyys-modal-content" style="background-color: ${this.appConfig.formBgColor};">
              <button type="button" class="notyys-close-btn" aria-label="Close notification form">×</button>
              
              <div class="notyys-form-container">
                <h3 id="notyys-form-title" class="notyys-form-title" style="
                  color: ${this.appConfig.formTextColor};
                  font-size: ${this.appConfig.formTextSize + 8}px;
                ">${this.appConfig.formTitle}</h3>
                <p class="notyys-form-description" style="
                  color: ${this.appConfig.formTextColor};
                  font-size: ${this.appConfig.formTextSize}px;
                ">${this.appConfig.formDescription}</p>
                
                <form id="notyys-subscription-form" novalidate>
                  <div class="notyys-input-group">
                    <label for="notyys-email" class="notyys-label" style="
                      color: ${this.appConfig.formTextColor};
                      font-size: ${this.appConfig.formTextSize - 1}px;
                    ">Email address *</label>
                    <input 
                      type="email" 
                      id="notyys-email" 
                      name="email"
                      placeholder="Enter your email" 
                      required 
                      class="notyys-input"
                      autocomplete="email"
                      aria-describedby="notyys-email-error"
                      style="font-size: ${this.appConfig.formTextSize}px;"
                    />
                    <div id="notyys-email-error" class="notyys-error-text" style="display: none;"></div>
                  </div>
                  
                  ${this.appConfig.phoneNumberEnabled ? `
                    <div class="notyys-input-group">
                      <label for="notyys-phone" class="notyys-label" style="
                        color: ${this.appConfig.formTextColor};
                        font-size: ${this.appConfig.formTextSize - 1}px;
                      ">Phone number</label>
                      <input 
                        type="tel" 
                        id="notyys-phone" 
                        name="phone"
                        placeholder="Phone number (optional)" 
                        class="notyys-input"
                        autocomplete="tel"
                        style="font-size: ${this.appConfig.formTextSize}px;"
                      />
                    </div>
                  ` : ''}
                  
                  <button type="submit" class="notyys-submit-btn" id="notyys-submit-btn" style="
                    background-color: ${this.appConfig.buttonColor};
                    border-radius: ${this.appConfig.buttonBorderRadius}px;
                    font-size: ${this.appConfig.formTextSize + 2}px;
                  ">
                    ${this.appConfig.formButtonText}
                  </button>
                </form>
                
                <div id="notyys-success-message" class="notyys-message notyys-success" style="display: none;" role="alert">
                  <div class="notyys-success-icon">✓</div>
                  <div>
                    <strong>Thank you!</strong>
                    <p>You'll be notified when this item is back in stock.</p>
                  </div>
                </div>
                
                <div id="notyys-error-message" class="notyys-message notyys-error" style="display: none;" role="alert">
                  <div class="notyys-error-icon">⚠</div>
                  <div>
                    <strong>Something went wrong</strong>
                    <p>Please try again or contact support.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    
    attachEventListeners() {
      const notifyBtn = document.getElementById('notyys-notify-btn');
      const modal = document.getElementById('notyys-modal');
      const form = document.getElementById('notyys-subscription-form');
      const closeBtn = document.querySelector('.notyys-close-btn');
      const backdrop = document.querySelector('.notyys-modal-backdrop');
      
      notifyBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        this.openModal();
      });
      
      closeBtn?.addEventListener('click', () => this.closeModal());
      backdrop?.addEventListener('click', () => this.closeModal());
      form?.addEventListener('submit', (e) => this.handleSubmit(e));
      
      // Fecha modal com Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display !== 'none') {
          this.closeModal();
        }
      });
    }
    
    positionWidget() {
      // Encontra o melhor local para inserir o widget
      const targets = [
        '.product-form__buttons',
        '.product-form__cart-submit',
        '.product-form',
        '.product__info',
        '.product-single__form',
        '.product__form',
        '.product-details',
        '.product-info'
      ];
      
      const widget = document.querySelector('.notyys-embed-widget');
      let inserted = false;
      
      for (const selector of targets) {
        const target = document.querySelector(selector);
        if (target && !inserted) {
          // Insere depois do elemento alvo
          if (target.nextSibling) {
            target.parentNode.insertBefore(widget, target.nextSibling);
          } else {
            target.parentNode.appendChild(widget);
          }
          inserted = true;
          this.log('Widget positioned after:', selector);
          break;
        }
      }
      
      // Se não encontrou um local específico, mantém no container original
      if (!inserted) {
        this.log('Widget positioned in default container');
      }
    }
    
    openModal() {
      const modal = document.getElementById('notyys-modal');
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      
      // Foca no campo de email
      setTimeout(() => {
        document.getElementById('notyys-email')?.focus();
      }, 100);
      
      this.log('Modal opened');
    }
    
    closeModal() {
      const modal = document.getElementById('notyys-modal');
      modal.style.display = 'none';
      document.body.style.overflow = '';
      
      // Reset form state
      this.resetForm();
      
      this.log('Modal closed');
    }
    
    resetForm() {
      const form = document.getElementById('notyys-subscription-form');
      const successMessage = document.getElementById('notyys-success-message');
      const errorMessage = document.getElementById('notyys-error-message');
      
      form.style.display = 'block';
      successMessage.style.display = 'none';
      errorMessage.style.display = 'none';
      
      // Clear form fields
      form.reset();
      
      // Clear validation errors
      document.querySelectorAll('.notyys-error-text').forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
      });
      
      document.querySelectorAll('.notyys-input').forEach(input => {
        input.classList.remove('error');
      });
    }
    
    validateForm(formData) {
      const errors = {};
      
      const email = formData.get('email');
      if (!email) {
        errors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = 'Please enter a valid email address';
      }
      
      return errors;
    }
    
    showValidationErrors(errors) {
      // Clear previous errors
      document.querySelectorAll('.notyys-error-text').forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
      });
      
      document.querySelectorAll('.notyys-input').forEach(input => {
        input.classList.remove('error');
      });
      
      // Show new errors
      Object.keys(errors).forEach(field => {
        const input = document.getElementById(`notyys-${field}`);
        const errorEl = document.getElementById(`notyys-${field}-error`);
        
        if (input && errorEl) {
          input.classList.add('error');
          errorEl.textContent = errors[field];
          errorEl.style.display = 'block';
        }
      });
    }
    
    async handleSubmit(e) {
      e.preventDefault();
      
      const form = e.target;
      const formData = new FormData(form);
      const submitBtn = document.getElementById('notyys-submit-btn');
      const originalText = submitBtn.textContent;
      
      // Validate form
      const errors = this.validateForm(formData);
      if (Object.keys(errors).length > 0) {
        this.showValidationErrors(errors);
        return;
      }
      
      // Estado de loading
      submitBtn.textContent = 'Subscribing...';
      submitBtn.disabled = true;
      
      const email = formData.get('email');
      const phone = formData.get('phone') || '';
      const productId = this.getProductId();
      const productTitle = this.getProductTitle();
      
      try {
        this.log('Submitting subscription:', { email, phone, productId, productTitle });
        
        const response = await fetch(`https://${window.notyysEmbedConfig.shopDomain}/apps/notyys-subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            phone,
            productId,
            productTitle,
            productUrl: window.location.href,
            shopId: window.notyysEmbedConfig.shopId
          })
        });
        
        if (response.ok) {
          this.log('Subscription successful');
          this.showSuccess();
        } else {
          const errorData = await response.json().catch(() => ({}));
          this.log('Subscription failed:', errorData);
          this.showError();
        }
      } catch (error) {
        this.log('Subscription error:', error);
        this.showError();
      } finally {
        // Restaura botão
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }
    
    showSuccess() {
      document.getElementById('notyys-subscription-form').style.display = 'none';
      document.getElementById('notyys-success-message').style.display = 'flex';
      
      // Fecha modal automaticamente após 3 segundos
      setTimeout(() => {
        this.closeModal();
      }, 3000);
    }
    
    showError() {
      document.getElementById('notyys-error-message').style.display = 'flex';
      
      // Esconde erro após 5 segundos
      setTimeout(() => {
        document.getElementById('notyys-error-message').style.display = 'none';
      }, 5000);
    }
  }
  
  // Inicialização
  function initNotifyWidget() {
    new NotifyMeEmbedWidget();
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotifyWidget);
  } else {
    initNotifyWidget();
  }
  
})();