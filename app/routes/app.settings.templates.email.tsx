import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useOutletContext, useSearchParams, useFetcher } from "@remix-run/react";
import {
  FormLayout,
  TextField,
  Button,
  Banner,
  BlockStack,
  Text,
  Select,
  Grid,
  Card,
  ColorPicker,
  RangeSlider,
  Divider,
  Popover,
  InlineStack,
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

type TemplatesContext = {
  shopId: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const templateType = url.searchParams.get("type") || "first";
  
  let template = await db.emailTemplate.findUnique({
    where: { 
      shopId_type: {
        shopId: session.shop,
        type: templateType,
      }
    },
  });

  if (!template) {
    template = await db.emailTemplate.create({
      data: {
        shopId: session.shop,
        type: templateType,
      },
    });
  }

  return json({ template, templateType });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const type = formData.get("type") as string;
  const subject = formData.get("subject") as string;
  const headline = formData.get("headline") as string;
  const bodyText = formData.get("bodyText") as string;
  const buttonText = formData.get("buttonText") as string;
  const buttonColor = formData.get("buttonColor") as string;
  const buttonBgColor = formData.get("buttonBgColor") as string;
  const buttonRadius = parseInt(formData.get("buttonRadius") as string);

  console.log('🔧 [TEMPLATE SAVE] Dados recebidos:', {
    type, subject, headline, buttonText, buttonColor, buttonBgColor
  });

  try {
    await db.emailTemplate.upsert({
      where: { 
        shopId_type: {
          shopId: session.shop,
          type,
        }
      },
      update: {
        subject,
        headline,
        bodyText,
        buttonText,
        buttonColor,
        buttonBgColor,
        buttonRadius,
      },
      create: {
        shopId: session.shop,
        type,
        subject,
        headline,
        bodyText,
        buttonText,
        buttonColor,
        buttonBgColor,
        buttonRadius,
      },
    });

    return json({ success: true, message: "Email template saved successfully!" });
  } catch (error) {
    return json({ success: false, message: "Failed to save template. Please try again." }, { status: 400 });
  }
};

export default function EmailTemplateEditor() {
  const { template, templateType } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { shopId } = useOutletContext<TemplatesContext>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedType, setSelectedType] = useState(templateType);
  const [subject, setSubject] = useState(template.subject);
  const [headline, setHeadline] = useState(template.headline);
  const [bodyText, setBodyText] = useState(template.bodyText);
  const [buttonText, setButtonText] = useState(template.buttonText);
  const [buttonColor, setButtonColor] = useState(template.buttonColor);
  const [buttonBgColor, setButtonBgColor] = useState(template.buttonBgColor);
  const [buttonRadius, setButtonRadius] = useState([template.buttonRadius]);
  
  // Estados para controlar os color pickers
  const [showButtonColorPicker, setShowButtonColorPicker] = useState(false);
  const [showButtonBgColorPicker, setShowButtonBgColorPicker] = useState(false);

  const fetcher = useFetcher<typeof loader>();

  const isSubmitting = navigation.state === "submitting";

  const typeOptions = [
    { label: "First Notification", value: "first" },
    { label: "Thank You Message", value: "thankyou" },
    { label: "Reminder", value: "reminder" },
  ];

  const handleTypeChange = (value: string) => {
    console.log('🔄 [TEMPLATE CHANGE] Type changed to:', value);
    setSelectedType(value);
    // Usar fetcher para carregar dados do novo template
    fetcher.load(`/app/settings/templates/email?type=${value}`);
    // Atualizar URL também
    setSearchParams({ type: value });
  };

  // Funções para lidar com mudanças de cor
  const handleButtonColorChange = (color: string) => {
    setButtonColor(color);
  };

  const handleButtonBgColorChange = (color: string) => {
    setButtonBgColor(color);
  };

  // Função para validar e formatar cor hexadecimal
  const formatHexColor = (color: string) => {
    if (!color.startsWith('#')) {
      color = '#' + color;
    }
    return color.length === 7 ? color : '#000000';
  };

  // Função para converter hex para HSB para o ColorPicker
  const hexToHsb = (hex: string) => {
    // Garantir que o hex é válido
    if (!hex || hex.length !== 7 || !hex.startsWith('#')) {
      return { hue: 0, saturation: 0, brightness: 1 };
    }

    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let hue = 0;
    if (diff !== 0) {
      if (max === r) hue = ((g - b) / diff) % 6;
      else if (max === g) hue = (b - r) / diff + 2;
      else hue = (r - g) / diff + 4;
    }
    hue = hue * 60;
    if (hue < 0) hue += 360;

    const saturation = max === 0 ? 0 : diff / max;
    const brightness = max;

    return {
      hue: Math.max(0, Math.min(360, hue)), // Retornar em graus para o ColorPicker do Polaris
      saturation: Math.max(0, Math.min(1, saturation)),
      brightness: Math.max(0, Math.min(1, brightness)),
    };
  };

  // Função para converter HSB para hex
  const hsbToHex = (hsb: {hue: number, saturation: number, brightness: number}) => {
    let { hue, saturation, brightness } = hsb;
    
    // O ColorPicker do Polaris retorna hue em graus (0-360), normalizar para 0-1
    if (hue > 1) {
      hue = hue / 360;
    }
    
    const h = hue * 360;
    const s = saturation;
    const v = brightness;

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;
    if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
    else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
    else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
    else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
    else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
    else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

    r = Math.max(0, Math.min(255, Math.round((r + m) * 255)));
    g = Math.max(0, Math.min(255, Math.round((g + m) * 255)));
    b = Math.max(0, Math.min(255, Math.round((b + m) * 255)));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // Atualizar campos quando fetcher retornar dados
  useEffect(() => {
    if (fetcher.data && fetcher.state === 'idle') {
      const templateData = fetcher.data.template;
      console.log('🔄 [TEMPLATE CHANGE] Fetcher data received:', templateData);
      
      // Atualizar todos os campos com os dados do novo template
      setSubject(templateData.subject || '');
      setHeadline(templateData.headline || '');
      setBodyText(templateData.bodyText || '');
      setButtonText(templateData.buttonText || '');
      setButtonColor(templateData.buttonColor || '#ffffff');
      setButtonBgColor(templateData.buttonBgColor || '#000000');
      setButtonRadius([templateData.buttonRadius || 4]);
      
      console.log('🔄 [TEMPLATE CHANGE] All fields updated successfully');
    }
  }, [fetcher.data, fetcher.state]);

  // Generate email preview
  const emailPreview = `
    <div style="
      max-width: 600px; 
      margin: 0 auto; 
      font-family: Arial, sans-serif; 
      background-color: #ffffff;
      padding: 20px;
      border: 1px solid #e1e1e1;
      border-radius: 8px;
    ">
      <h1 style="
        color: #333; 
        font-size: 24px; 
        margin-bottom: 20px;
        text-align: center;
      ">
        ${headline}
      </h1>
      
      <!-- Product Image -->
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png" alt="Product Image" style="
          max-width: 300px;
          width: 100%;
          height: auto;
          border-radius: 8px;
          border: 1px solid #e1e1e1;
        ">
      </div>
      
      <p style="
        color: #666; 
        font-size: 16px; 
        line-height: 1.5;
        margin-bottom: 30px;
      ">
        ${bodyText}
      </p>
      
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="#" style="
          display: inline-block;
          padding: 12px 24px;
          color: ${buttonColor};
          background-color: ${buttonBgColor};
          text-decoration: none;
          border-radius: ${buttonRadius[0]}px;
          font-weight: bold;
          font-size: 16px;
        ">
          ${buttonText}
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;">
      
      <p style="
        color: #999; 
        font-size: 12px; 
        text-align: center;
      ">
        This email was sent by ${shopId}
      </p>
    </div>
  `;

  return (
    <Grid>
      <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 5, xl: 5}}>
        <BlockStack gap="500">
          <div>
            <Text variant="headingMd" as="h2">
              Email Template Editor
            </Text>
            <Text variant="bodyMd" as="p" color="subdued">
              Customize your email templates with live preview.
            </Text>
          </div>

          {actionData?.message && (
            <Banner
              title={actionData.success ? "Success" : "Error"}
              tone={actionData.success ? "success" : "critical"}
            >
              <p>{actionData.message}</p>
            </Banner>
          )}

          <Form method="post">
            <FormLayout>
              <input type="hidden" name="type" value={selectedType} />
              
              <Select
                label="Template Type"
                options={typeOptions}
                value={selectedType}
                onChange={handleTypeChange}
              />

              <TextField
                label="Email Subject"
                name="subject"
                value={subject}
                onChange={setSubject}
                placeholder="Your product is back in stock!"
                requiredIndicator
              />

              <TextField
                label="Email Headline"
                name="headline"
                value={headline}
                onChange={setHeadline}
                placeholder="Great News!"
                requiredIndicator
              />

              <TextField
                label="Email Body Text"
                name="bodyText"
                value={bodyText}
                onChange={setBodyText}
                multiline={4}
                placeholder="The item you requested is now back in stock. Don't miss out - get yours now!"
                requiredIndicator
              />

              <Divider />

              <Text variant="headingMd" as="h3">
                Button Settings
              </Text>

              <TextField
                label="Button Text"
                name="buttonText"
                value={buttonText}
                onChange={setButtonText}
                placeholder="Shop Now"
                requiredIndicator
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {/* Button Text Color */}
                <div>
                  <Text variant="bodyMd" as="label">
                    Button Text Color
                  </Text>
                  <div style={{ marginTop: "8px" }}>
                    <InlineStack gap="300" align="start">
                      <Popover
                        active={showButtonColorPicker}
                        activator={
                          <div
                            onClick={() => setShowButtonColorPicker(!showButtonColorPicker)}
                            style={{
                              width: "32px",
                              height: "32px",
                              backgroundColor: buttonColor,
                              border: "1px solid #c9cccf",
                              borderRadius: "4px",
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          />
                        }
                        onClose={() => setShowButtonColorPicker(false)}
                      >
                        <div style={{ padding: "16px", width: "200px" }}>
                          <ColorPicker
                            color={(() => {
                              const hsb = hexToHsb(buttonColor);
                              console.log('🎨 Initial hex to HSB:', buttonColor, '→', hsb);
                              return hsb;
                            })()}
                            onChange={(color) => {
                              console.log('🎨 ColorPicker onChange:', color);
                              const hex = hsbToHex(color);
                              console.log('🎨 Converted to hex:', hex);
                              handleButtonColorChange(hex);
                            }}
                            allowAlpha={false}
                          />
                        </div>
                      </Popover>
                      <div style={{ flex: 1 }}>
                        <TextField
                          value={buttonColor}
                          onChange={(value) => handleButtonColorChange(formatHexColor(value))}
                          placeholder="#ffffff"
                          autoComplete="off"
                        />
                      </div>
                    </InlineStack>
                    <input type="hidden" name="buttonColor" value={buttonColor} />
                  </div>
                </div>
                
                {/* Button Background Color */}
                <div>
                  <Text variant="bodyMd" as="label">
                    Button Background Color
                  </Text>
                  <div style={{ marginTop: "8px" }}>
                    <InlineStack gap="300" align="start">
                      <Popover
                        active={showButtonBgColorPicker}
                        activator={
                          <div
                            onClick={() => setShowButtonBgColorPicker(!showButtonBgColorPicker)}
                            style={{
                              width: "32px",
                              height: "32px",
                              backgroundColor: buttonBgColor,
                              border: "1px solid #c9cccf",
                              borderRadius: "4px",
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          />
                        }
                        onClose={() => setShowButtonBgColorPicker(false)}
                      >
                        <div style={{ padding: "16px", width: "200px" }}>
                          <ColorPicker
                            color={hexToHsb(buttonBgColor)}
                            onChange={(color) => {
                              const hex = hsbToHex(color);
                              handleButtonBgColorChange(hex);
                            }}
                            allowAlpha={false}
                          />
                        </div>
                      </Popover>
                      <div style={{ flex: 1 }}>
                        <TextField
                          value={buttonBgColor}
                          onChange={(value) => handleButtonBgColorChange(formatHexColor(value))}
                          placeholder="#000000"
                          autoComplete="off"
                        />
                      </div>
                    </InlineStack>
                    <input type="hidden" name="buttonBgColor" value={buttonBgColor} />
                  </div>
                </div>
              </div>

              <div>
                <Text variant="bodyMd" as="label">
                  Button Border Radius: {buttonRadius[0]}px
                </Text>
                <input
                  type="hidden"
                  name="buttonRadius"
                  value={buttonRadius[0]}
                />
                <RangeSlider
                  label=""
                  value={buttonRadius[0]}
                  onChange={(value) => setButtonRadius([value])}
                  min={0}
                  max={20}
                />
              </div>

              <Button
                submit
                variant="primary"
                loading={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Template"}
              </Button>
            </FormLayout>
          </Form>
        </BlockStack>
      </Grid.Cell>

      <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 7, xl: 7}}>
        <Card sectioned>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">
              Live Preview
            </Text>
            <Text variant="bodyMd" as="p" color="subdued">
              Subject: {subject}
            </Text>
            <div 
              style={{ 
                border: "1px solid #e1e1e1", 
                borderRadius: "8px", 
                overflow: "hidden",
                backgroundColor: "#f9f9f9",
                padding: "10px",
              }}
              dangerouslySetInnerHTML={{ __html: emailPreview }}
            />
          </BlockStack>
        </Card>
      </Grid.Cell>
    </Grid>
  );
}