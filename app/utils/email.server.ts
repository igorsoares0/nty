import * as nodemailer from 'nodemailer';
import db from '../db.server';

// Configuração do transportador SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io',
    port: parseInt(process.env.MAILTRAP_PORT || '2525'),
    auth: {
      user: process.env.MAILTRAP_USER,
      pass: process.env.MAILTRAP_PASS,
    },
  });
};

// Interface para dados do email
interface ThankYouEmailData {
  email: string;
  productTitle: string;
  productUrl: string;
  shopId: string;
  shopDomain?: string;
}

// Interface para first notification email
interface FirstNotificationEmailData {
  email: string;
  productTitle: string;
  productUrl: string;
  shopId: string;
  shopDomain?: string;
}

// Interface para reminder notification email
interface ReminderNotificationEmailData {
  email: string;
  productTitle: string;
  productUrl: string;
  shopId: string;
  shopDomain?: string;
  reminderNumber: number;
}

// Função para buscar template do banco
const getEmailTemplate = async (shopId: string, type: string = 'thankyou') => {
  try {
    console.log('📧 [TEMPLATE] Searching for template:', { shopId, type });
    
    let template = await db.emailTemplate.findUnique({
      where: {
        shopId_type: {
          shopId,
          type,
        },
      },
    });

    console.log('📧 [TEMPLATE] Found template:', template ? 'YES' : 'NO');
    
    if (template) {
      console.log('📧 [TEMPLATE] Template data:', {
        subject: template.subject,
        headline: template.headline,
        buttonColor: template.buttonColor,
        buttonBgColor: template.buttonBgColor,
      });
    }

    // Se não existe template, cria um padrão
    if (!template) {
      console.log('📧 [TEMPLATE] Creating default template');
      
      let defaultData;
      if (type === 'first') {
        defaultData = {
          subject: 'Great News! Your Product is Back in Stock!',
          headline: 'It\'s Back! 🎉',
          bodyText: 'Great news! The product you requested is now back in stock and ready for you to purchase.',
          buttonText: 'Shop Now',
          buttonColor: '#ffffff',
          buttonBgColor: '#000000',
          buttonRadius: 4,
        };
      } else if (type === 'thankyou') {
        defaultData = {
          subject: 'Thank you for subscribing!',
          headline: 'Thank You! 🙏',
          bodyText: 'Thank you for subscribing to back-in-stock notifications for this product. We\'ll notify you as soon as it\'s available again.',
          buttonText: 'Visit Store',
          buttonColor: '#ffffff',
          buttonBgColor: '#000000',
          buttonRadius: 4,
        };
      } else if (type === 'reminder') {
        defaultData = {
          subject: 'Still interested? Your Product is Still Available!',
          headline: 'Don\'t Miss Out! ⏰',
          bodyText: 'Just a friendly reminder that the product you were interested in is still available. Limited stock remaining!',
          buttonText: 'Get It Now',
          buttonColor: '#ffffff',
          buttonBgColor: '#ff6b6b',
          buttonRadius: 4,
        };
      } else {
        defaultData = {
          subject: 'Thank you for subscribing!',
          headline: 'Thank You!',
          bodyText: 'Thank you for subscribing to back-in-stock notifications for this product. We\'ll notify you as soon as it\'s available again.',
          buttonText: 'Visit Store',
          buttonColor: '#ffffff',
          buttonBgColor: '#000000',
          buttonRadius: 4,
        };
      }
      
      template = await db.emailTemplate.create({
        data: {
          shopId,
          type,
          ...defaultData,
        },
      });
    }

    return template;
  } catch (error) {
    console.error('📧 [TEMPLATE] Error fetching email template:', error);
    // Retorna template padrão em caso de erro
    if (type === 'first') {
      return {
        subject: 'Great News! Your Product is Back in Stock!',
        headline: 'It\'s Back! 🎉',
        bodyText: 'Great news! The product you requested is now back in stock and ready for you to purchase.',
        buttonText: 'Shop Now',
        buttonColor: '#ffffff',
        buttonBgColor: '#000000',
        buttonRadius: 4,
      };
    } else if (type === 'thankyou') {
      return {
        subject: 'Thank you for subscribing!',
        headline: 'Thank You! 🙏',
        bodyText: 'Thank you for subscribing to back-in-stock notifications for this product. We\'ll notify you as soon as it\'s available again.',
        buttonText: 'Visit Store',
        buttonColor: '#ffffff',
        buttonBgColor: '#000000',
        buttonRadius: 4,
      };
    } else if (type === 'reminder') {
      return {
        subject: 'Still interested? Your Product is Still Available!',
        headline: 'Don\'t Miss Out! ⏰',
        bodyText: 'Just a friendly reminder that the product you were interested in is still available. Limited stock remaining!',
        buttonText: 'Get It Now',
        buttonColor: '#ffffff',
        buttonBgColor: '#ff6b6b',
        buttonRadius: 4,
      };
    } else {
      return {
        subject: 'Thank you for subscribing!',
        headline: 'Thank You!',
        bodyText: 'Thank you for subscribing to back-in-stock notifications for this product. We\'ll notify you as soon as it\'s available again.',
        buttonText: 'Visit Store',
        buttonColor: '#ffffff',
        buttonBgColor: '#000000',
        buttonRadius: 4,
      };
    }
  }
};

// Função para gerar HTML do email
const generateEmailHTML = (template: any, data: ThankYouEmailData | FirstNotificationEmailData | ReminderNotificationEmailData, emailType: string = 'thankyou') => {
  const { productTitle, productUrl, shopDomain } = data;
  
  console.log('📧 [HTML] Generating email with template:', {
    subject: template.subject,
    headline: template.headline,
    buttonColor: template.buttonColor,
    buttonBgColor: template.buttonBgColor,
    buttonRadius: template.buttonRadius,
  });
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${template.subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px; margin-top: 20px; margin-bottom: 20px;">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; font-size: 28px; margin: 0; font-weight: bold;">
            ${template.headline}
          </h1>
        </div>
        
        <!-- Body -->
        <div style="margin-bottom: 30px;">
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            ${template.bodyText.replace('this product', `<strong>${productTitle}</strong>`).replace('The product you requested', `<strong>${productTitle}</strong>`)}
          </p>
          
          ${emailType === 'first' ? `
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            You'll receive an email notification as soon as <strong>${productTitle}</strong> is back in stock.
          </p>
          ` : emailType === 'thankyou' ? `
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            <strong>${productTitle}</strong> is now available and ready for purchase. Don't miss out - get yours today!
          </p>
          ` : emailType === 'reminder' ? `
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            <strong>${productTitle}</strong> is still available but stock is limited. Don't wait too long!
          </p>
          <p style="color: #ff6b6b; font-size: 14px; font-weight: bold; text-align: center; margin-bottom: 20px;">
            ⚠️ Limited Stock Remaining
          </p>
          ` : `
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            You'll receive an email notification as soon as <strong>${productTitle}</strong> is back in stock.
          </p>
          `}
        </div>
        
        <!-- Button -->
        <div style="text-align: center; margin-bottom: 30px;">
          <a href="${productUrl}" style="
            display: inline-block;
            padding: 15px 30px;
            color: ${template.buttonColor};
            background-color: ${template.buttonBgColor};
            text-decoration: none;
            border-radius: ${template.buttonRadius}px;
            font-weight: bold;
            font-size: 16px;
            border: none;
            cursor: pointer;
          ">
            ${template.buttonText}
          </a>
        </div>
        
        <!-- Product Info -->
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <h3 style="color: #333; font-size: 18px; margin: 0 0 10px 0;">Product Details:</h3>
          <p style="color: #666; font-size: 14px; margin: 5px 0;"><strong>Product:</strong> ${productTitle}</p>
          <p style="color: #666; font-size: 14px; margin: 5px 0;"><strong>Store:</strong> ${shopDomain || 'Your Store'}</p>
        </div>
        
        <!-- Footer -->
        <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 30px 0;">
        
        <div style="text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            This email was sent by ${shopDomain || 'Notyys'} because you subscribed to back-in-stock notifications.
          </p>
          <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">
            © ${new Date().getFullYear()} ${shopDomain || 'Notyys'}. All rights reserved.
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;
};

// Função principal para enviar email de agradecimento
export const sendThankYouEmail = async (data: ThankYouEmailData): Promise<boolean> => {
  try {
    console.log('📧 Sending thank you email to:', data.email);
    
    // Busca template personalizado
    const template = await getEmailTemplate(data.shopId, 'thankyou');
    
    // Gera HTML do email
    const htmlContent = generateEmailHTML(template, data, 'thankyou');
    
    // Configura transportador
    const transporter = createTransporter();
    
    // Configura opções do email
    const mailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME || 'Back in Stock Notifications',
        address: process.env.EMAIL_FROM_ADDRESS || 'noreply@notyys.app',
      },
      to: data.email,
      subject: template.subject,
      html: htmlContent,
      text: `
        ${template.headline}
        
        ${template.bodyText.replace('this product', data.productTitle)}
        
        You'll receive an email notification as soon as ${data.productTitle} is back in stock.
        
        Visit: ${data.productUrl}
        
        This email was sent by ${data.shopDomain || 'Notyys'}.
      `.trim(),
    };
    
    // Envia o email
    const result = await transporter.sendMail(mailOptions);
    
    console.log('📧 Email sent successfully:', {
      messageId: result.messageId,
      to: data.email,
      product: data.productTitle,
    });
    
    return true;
    
  } catch (error) {
    console.error('📧 Error sending thank you email:', error);
    return false;
  }
};

// Função principal para enviar first notification email
export const sendFirstNotificationEmail = async (data: FirstNotificationEmailData): Promise<boolean> => {
  try {
    console.log('🎉 [FIRST] Sending first notification email to:', data.email);
    
    // Busca template personalizado para 'first'
    const template = await getEmailTemplate(data.shopId, 'first');
    
    // Gera HTML do email
    const htmlContent = generateEmailHTML(template, data, 'first');
    
    // Configura transportador
    const transporter = createTransporter();
    
    // Configura opções do email
    const mailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME || 'Back in Stock Notifications',
        address: process.env.EMAIL_FROM_ADDRESS || 'noreply@notyys.app',
      },
      to: data.email,
      subject: template.subject,
      html: htmlContent,
      text: `
        ${template.headline}
        
        ${template.bodyText.replace('The product you requested', data.productTitle)}
        
        ${data.productTitle} is now available and ready for purchase. Don't miss out - get yours today!
        
        Shop now: ${data.productUrl}
        
        This email was sent by ${data.shopDomain || 'Notyys'}.
      `.trim(),
    };
    
    // Envia o email
    const result = await transporter.sendMail(mailOptions);
    
    console.log('🎉 [FIRST] First notification email sent successfully:', {
      messageId: result.messageId,
      to: data.email,
      product: data.productTitle,
    });
    
    return true;
    
  } catch (error) {
    console.error('🎉 [FIRST] Error sending first notification email:', error);
    return false;
  }
};


// Função principal para enviar email de lembrete
export const sendReminderNotificationEmail = async (data: ReminderNotificationEmailData): Promise<boolean> => {
  try {
    console.log(`⏰ [REMINDER ${data.reminderNumber}] Sending reminder email to:`, data.email);
    
    // Busca template personalizado para 'reminder'
    const template = await getEmailTemplate(data.shopId, 'reminder');
    
    // Personalizar subject baseado no número do lembrete
    const customTemplate = {
      ...template,
      subject: data.reminderNumber > 1 
        ? `Final Reminder: ${data.productTitle} - Still Available!`
        : template.subject
    };
    
    // Gera HTML do email
    const htmlContent = generateEmailHTML(customTemplate, data, 'reminder');
    
    // Configura transportador
    const transporter = createTransporter();
    
    // Configura opções do email
    const mailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME || 'Back in Stock Notifications',
        address: process.env.EMAIL_FROM_ADDRESS || 'noreply@notyys.app',
      },
      to: data.email,
      subject: customTemplate.subject,
      html: htmlContent,
      text: `
        ${customTemplate.headline}
        
        ${customTemplate.bodyText.replace('the product you were interested in', data.productTitle)}
        
        ${data.productTitle} is still available but stock is limited. Don't wait too long!
        
        Get it now: ${data.productUrl}
        
        This is reminder #${data.reminderNumber}.
        
        This email was sent by ${data.shopDomain || 'Notyys'}.
      `.trim(),
    };
    
    // Envia o email
    const result = await transporter.sendMail(mailOptions);
    
    console.log(`⏰ [REMINDER ${data.reminderNumber}] Reminder email sent successfully:`, {
      messageId: result.messageId,
      to: data.email,
      product: data.productTitle,
      reminderNumber: data.reminderNumber,
    });
    
    return true;
    
  } catch (error) {
    console.error(`⏰ [REMINDER ${data.reminderNumber}] Error sending reminder email:`, error);
    return false;
  }
};

// Função para testar configuração SMTP
export const testEmailConfiguration = async (): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('📧 SMTP configuration is valid');
    return true;
  } catch (error) {
    console.error('📧 SMTP configuration error:', error);
    return false;
  }
};