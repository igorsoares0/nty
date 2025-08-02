import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
  BlockStack,
  Text,
  Grid,
  RangeSlider,
  Checkbox,
  Divider,
  ColorPicker,
  Popover,
  InlineStack,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { smartSyncToMetafields } from "../utils/metafields-sync";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  console.log("DB object:", db);
  console.log("DB properties:", Object.keys(db));
  
  // Load button settings - try different casing
  let buttonSettings;
  try {
    buttonSettings = await db.buttonSettings.findUnique({
      where: { shopId: session.shop },
    });
  } catch (error) {
    console.error("ButtonSettings findUnique error:", error);
    // Create default settings if model doesn't exist yet
    buttonSettings = {
      id: "temp",
      shopId: session.shop,
      backgroundColor: "#000000",
      textColor: "#ffffff", 
      borderRadius: 4,
      textSize: 16,
      textContent: "Notify Me",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  if (!buttonSettings) {
    try {
      buttonSettings = await db.buttonSettings.create({
        data: { shopId: session.shop },
      });
    } catch (error) {
      console.error("ButtonSettings create error:", error);
      buttonSettings = {
        id: "temp",
        shopId: session.shop,
        backgroundColor: "#000000",
        textColor: "#ffffff", 
        borderRadius: 4,
        textSize: 16,
        textContent: "Notify Me",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  // Load form settings
  let formSettings;
  try {
    formSettings = await db.formSettings.findUnique({
      where: { shopId: session.shop },
    });
  } catch (error) {
    console.error("FormSettings findUnique error:", error);
    formSettings = {
      id: "temp",
      shopId: session.shop,
      formBgColor: "#ffffff",
      buttonColor: "#000000",
      buttonBorderRadius: 4,
      textSize: 14,
      textColor: "#333333",
      phoneNumberEnabled: false,
      formTitle: "Get notified when back in stock!",
      formDescription: "Enter your email to be notified when this item is available.",
      buttonText: "Subscribe",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  if (!formSettings) {
    try {
      formSettings = await db.formSettings.create({
        data: { shopId: session.shop },
      });
    } catch (error) {
      console.error("FormSettings create error:", error);
      formSettings = {
        id: "temp",
        shopId: session.shop,
        formBgColor: "#ffffff",
        buttonColor: "#000000",
        buttonBorderRadius: 4,
        textSize: 14,
        textColor: "#333333",
        phoneNumberEnabled: false,
        formTitle: "Get notified when back in stock!",
        formDescription: "Enter your email to be notified when this item is available.",
        buttonText: "Subscribe",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  // Debug log the loaded data
  console.log('🔍 [LOADER] buttonSettings.backgroundColor:', buttonSettings.backgroundColor);
  console.log('🔍 [LOADER] formSettings.buttonColor:', formSettings.buttonColor);

  return json({ buttonSettings, formSettings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const action = formData.get("_action") as string;
  console.log('🔍 [ACTION] Form submitted with action:', action);

  try {
    if (action === "saveButton") {
      const backgroundColor = formData.get("backgroundColor") as string;
      const textColor = formData.get("textColor") as string;
      const borderRadius = parseInt(formData.get("borderRadius") as string);
      const textSize = parseInt(formData.get("textSize") as string);
      const textContent = formData.get("textContent") as string;

      console.log('🔍 [SAVE BUTTON] Saving backgroundColor:', backgroundColor);

      let buttonSettings;
      try {
        buttonSettings = await db.buttonSettings.upsert({
          where: { shopId: session.shop },
          update: {
            backgroundColor,
            textColor,
            borderRadius,
            textSize,
            textContent,
          },
          create: {
            shopId: session.shop,
            backgroundColor,
            textColor,
            borderRadius,
            textSize,
            textContent,
          },
        });
      } catch (error) {
        console.error("ButtonSettings upsert error:", error);
        return json({ success: false, message: "Button settings model not available yet. Please run database migration." }, { status: 400 });
      }

      // Sincroniza com metafields da shop
      try {
        await smartSyncToMetafields(admin, session.shop, {
          buttonSettings: buttonSettings
        });
        console.log("Button settings synced to metafields successfully");
      } catch (syncError) {
        console.error("Failed to sync button settings to metafields:", syncError);
        // Não falha a operação se a sincronização falhar
      }

      return json({ success: true, message: "Button settings saved and synced successfully!" });
    }

    if (action === "saveForm") {
      const formBgColor = formData.get("formBgColor") as string;
      const buttonColor = formData.get("buttonColor") as string;
      const buttonBorderRadius = parseInt(formData.get("buttonBorderRadius") as string);
      const textSize = parseInt(formData.get("textSize") as string);
      const textColor = formData.get("textColor") as string;

      console.log('🔍 [SAVE FORM] Saving form buttonColor:', buttonColor);
      const rawPhoneValue = formData.get("phoneNumberEnabled");
      const phoneNumberEnabled = rawPhoneValue === "true" || rawPhoneValue === "on";
      console.log('🔍 [SAVE FORM] Saving phoneNumberEnabled:', phoneNumberEnabled, 'Raw value:', rawPhoneValue);
      const formTitle = formData.get("formTitle") as string;
      const formDescription = formData.get("formDescription") as string;
      const buttonText = formData.get("buttonText") as string;

      let formSettings;
      try {
        formSettings = await db.formSettings.upsert({
          where: { shopId: session.shop },
          update: {
            formBgColor,
            buttonColor,
            buttonBorderRadius,
            textSize,
            textColor,
            phoneNumberEnabled,
            formTitle,
            formDescription,
            buttonText,
          },
          create: {
            shopId: session.shop,
            formBgColor,
            buttonColor,
            buttonBorderRadius,
            textSize,
            textColor,
            phoneNumberEnabled,
            formTitle,
            formDescription,
            buttonText,
          },
        });
      } catch (error) {
        console.error("FormSettings upsert error:", error);
        return json({ success: false, message: "Form settings model not available yet. Please run database migration." }, { status: 400 });
      }

      // Sincroniza com metafields da shop
      try {
        await smartSyncToMetafields(admin, session.shop, {
          formSettings: formSettings
        });
        console.log("Form settings synced to metafields successfully");
      } catch (syncError) {
        console.error("Failed to sync form settings to metafields:", syncError);
        // Não falha a operação se a sincronização falhar
      }

      return json({ success: true, message: "Form settings saved and synced successfully!" });
    }

    return json({ success: false, message: "Invalid action." }, { status: 400 });
  } catch (error) {
    return json({ success: false, message: "Failed to save settings. Please try again." }, { status: 400 });
  }
};

export default function ButtonFormEditor() {
  const { buttonSettings, formSettings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  // Button state
  const [backgroundColor, setBackgroundColor] = useState(buttonSettings.backgroundColor);
  const [textColor, setTextColor] = useState(buttonSettings.textColor);
  const [borderRadius, setBorderRadius] = useState([buttonSettings.borderRadius]);
  const [textSize, setTextSize] = useState([buttonSettings.textSize]);
  const [textContent, setTextContent] = useState(buttonSettings.textContent);

  // Form state
  const [formBgColor, setFormBgColor] = useState(formSettings.formBgColor);
  const [formButtonColor, setFormButtonColor] = useState(formSettings.buttonColor); // Renamed for clarity

  // Debug logging - let's see what values are loaded initially
  console.log('🔍 [INITIAL VALUES] Button backgroundColor:', buttonSettings.backgroundColor);
  console.log('🔍 [INITIAL VALUES] Form buttonColor:', formSettings.buttonColor);
  console.log('🔍 [INITIAL VALUES] Are they equal?', buttonSettings.backgroundColor === formSettings.buttonColor);
  const [buttonBorderRadius, setButtonBorderRadius] = useState([formSettings.buttonBorderRadius]);
  const [formTextSize, setFormTextSize] = useState([formSettings.textSize]);
  const [formTextColor, setFormTextColor] = useState(formSettings.textColor);
  const [phoneNumberEnabled, setPhoneNumberEnabled] = useState(formSettings.phoneNumberEnabled);
  const [formTitle, setFormTitle] = useState(formSettings.formTitle);
  const [formDescription, setFormDescription] = useState(formSettings.formDescription);
  const [formButtonText, setFormButtonText] = useState(formSettings.buttonText);

  // Estados para controlar os color pickers
  const [showBackgroundColorPicker, setShowBackgroundColorPicker] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showFormBgColorPicker, setShowFormBgColorPicker] = useState(false);
  const [showFormButtonColorPicker, setShowFormButtonColorPicker] = useState(false); // Renamed for clarity
  const [showFormTextColorPicker, setShowFormTextColorPicker] = useState(false);

  const isSubmitting = navigation.state === "submitting";

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

  // Preview components
  const ButtonPreview = () => (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <button
        style={{
          backgroundColor: backgroundColor, // Explicit reference
          color: textColor,
          // Debug logging
          ...(console.log('🔍 [BUTTON PREVIEW] Using backgroundColor:', backgroundColor) || {}),
          borderRadius: `${borderRadius[0]}px`,
          fontSize: `${textSize[0]}px`,
          padding: "12px 24px",
          border: "none",
          cursor: "pointer",
          fontWeight: "500",
        }}
      >
        {textContent}
      </button>
    </div>
  );

  const FormPreview = () => (
    <div style={{ 
      position: "relative",
      border: "1px solid #e1e1e1",
      borderRadius: "8px",
      overflow: "hidden",
      backgroundColor: "#f9f9f9",
      padding: "10px",
    }}>
      <div
        style={{
          backgroundColor: formBgColor,
          padding: "24px",
          borderRadius: "8px",
          maxWidth: "400px",
          margin: "0 auto",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        <h3 style={{ 
          color: formTextColor, 
          fontSize: `${formTextSize[0]}px`,
          marginBottom: "8px",
          fontWeight: "600",
          margin: "0 0 8px 0"
        }}>
          {formTitle}
        </h3>
        <p style={{ 
          color: formTextColor, 
          fontSize: `${formTextSize[0] - 2}px`,
          marginBottom: "16px",
          margin: "0 0 16px 0"
        }}>
          {formDescription}
        </p>
        
        <div style={{ marginBottom: "12px" }}>
          <input
            type="email"
            placeholder="Enter your email"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: `${formTextSize[0] - 2}px`,
            }}
          />
        </div>
        
        {phoneNumberEnabled && (
          <div style={{ marginBottom: "12px" }}>
            <input
              type="tel"
              placeholder="Phone number (optional)"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: `${formTextSize[0] - 2}px`,
              }}
            />
          </div>
        )}
        
        <button
          style={{
            backgroundColor: formButtonColor, // Explicit reference
            color: "#ffffff",
            // Debug logging
            ...(console.log('🔍 [FORM PREVIEW] Using formButtonColor:', formButtonColor) || {}),
            borderRadius: `${buttonBorderRadius[0]}px`,
            fontSize: `${formTextSize[0]}px`,
            padding: "10px 20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "500",
            width: "100%",
          }}
        >
          {formButtonText}
        </button>
      </div>
    </div>
  );

  return (
    <Page
      title="Button & Form Editor"
      subtitle="Customize the appearance of your notify me button and signup form"
      backAction={{ content: "Settings", url: "/app/settings" }}
    >
      <Layout>
        {actionData?.message && (
          <Layout.Section>
            <Banner
              title={actionData.success ? "Success" : "Error"}
              tone={actionData.success ? "success" : "critical"}
            >
              <p>{actionData.message}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Grid>
            {/* Button Editor Card */}
            <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
              <Card sectioned>
                <BlockStack gap="500">
                  <Text variant="headingMd" as="h2">
                    Button Editor
                  </Text>
                  
                  <Form method="post">
                    <FormLayout>
                      <input type="hidden" name="_action" value="saveButton" />
                      
                      <TextField
                        label="Button Text"
                        name="textContent"
                        value={textContent}
                        onChange={setTextContent}
                        requiredIndicator
                      />

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        {/* Background Color */}
                        <div>
                          <Text variant="bodyMd" as="label">
                            Background Color
                          </Text>
                          <div style={{ marginTop: "8px" }}>
                            <InlineStack gap="300" align="start">
                              <Popover
                                active={showBackgroundColorPicker}
                                activator={
                                  <div
                                    onClick={() => setShowBackgroundColorPicker(!showBackgroundColorPicker)}
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      backgroundColor: backgroundColor,
                                      border: "1px solid #c9cccf",
                                      borderRadius: "4px",
                                      cursor: "pointer",
                                      flexShrink: 0,
                                    }}
                                  />
                                }
                                onClose={() => setShowBackgroundColorPicker(false)}
                              >
                                <div style={{ padding: "16px", width: "200px" }}>
                                  <ColorPicker
                                    color={hexToHsb(backgroundColor)}
                                    onChange={(color) => {
                                      const hex = hsbToHex(color);
                                      console.log('🔍 [BUTTON COLOR CHANGE] Setting backgroundColor to:', hex);
                                      setBackgroundColor(hex);
                                    }}
                                    allowAlpha={false}
                                  />
                                </div>
                              </Popover>
                              <div style={{ flex: 1 }}>
                                <TextField
                                  value={backgroundColor}
                                  onChange={(value) => setBackgroundColor(formatHexColor(value))}
                                  placeholder="#000000"
                                  autoComplete="off"
                                />
                              </div>
                            </InlineStack>
                            <input type="hidden" name="backgroundColor" value={backgroundColor} />
                          </div>
                        </div>
                        
                        {/* Text Color */}
                        <div>
                          <Text variant="bodyMd" as="label">
                            Text Color
                          </Text>
                          <div style={{ marginTop: "8px" }}>
                            <InlineStack gap="300" align="start">
                              <Popover
                                active={showTextColorPicker}
                                activator={
                                  <div
                                    onClick={() => setShowTextColorPicker(!showTextColorPicker)}
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      backgroundColor: textColor,
                                      border: "1px solid #c9cccf",
                                      borderRadius: "4px",
                                      cursor: "pointer",
                                      flexShrink: 0,
                                    }}
                                  />
                                }
                                onClose={() => setShowTextColorPicker(false)}
                              >
                                <div style={{ padding: "16px", width: "200px" }}>
                                  <ColorPicker
                                    color={hexToHsb(textColor)}
                                    onChange={(color) => {
                                      const hex = hsbToHex(color);
                                      setTextColor(hex);
                                    }}
                                    allowAlpha={false}
                                  />
                                </div>
                              </Popover>
                              <div style={{ flex: 1 }}>
                                <TextField
                                  value={textColor}
                                  onChange={(value) => setTextColor(formatHexColor(value))}
                                  placeholder="#ffffff"
                                  autoComplete="off"
                                />
                              </div>
                            </InlineStack>
                            <input type="hidden" name="textColor" value={textColor} />
                          </div>
                        </div>
                      </div>

                      <div>
                        <Text variant="bodyMd" as="label">
                          Border Radius: {borderRadius[0]}px
                        </Text>
                        <input type="hidden" name="borderRadius" value={borderRadius[0]} />
                        <RangeSlider
                          label=""
                          value={borderRadius[0]}
                          onChange={(value) => setBorderRadius([value])}
                          min={0}
                          max={20}
                        />
                      </div>

                      <div>
                        <Text variant="bodyMd" as="label">
                          Text Size: {textSize[0]}px
                        </Text>
                        <input type="hidden" name="textSize" value={textSize[0]} />
                        <RangeSlider
                          label=""
                          value={textSize[0]}
                          onChange={(value) => setTextSize([value])}
                          min={12}
                          max={24}
                        />
                      </div>

                      <Divider />
                      
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">
                          Live Preview
                        </Text>
                        <ButtonPreview />
                      </BlockStack>

                      <Button
                        submit
                        variant="primary"
                        loading={isSubmitting}
                      >
                        Save Button Settings
                      </Button>
                    </FormLayout>
                  </Form>
                </BlockStack>
              </Card>
            </Grid.Cell>

            {/* Form Editor Card */}
            <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
              <Card sectioned>
                <BlockStack gap="500">
                  <Text variant="headingMd" as="h2">
                    Form Editor
                  </Text>
                  
                  <Form method="post" onSubmit={() => console.log('🔍 [CLIENT] Form submitting with phoneNumberEnabled:', phoneNumberEnabled)}>
                    <FormLayout>
                      <input type="hidden" name="_action" value="saveForm" />
                      
                      <TextField
                        label="Form Title"
                        name="formTitle"
                        value={formTitle}
                        onChange={setFormTitle}
                        requiredIndicator
                      />

                      <TextField
                        label="Form Description"
                        name="formDescription"
                        value={formDescription}
                        onChange={setFormDescription}
                        multiline={2}
                        requiredIndicator
                      />

                      <TextField
                        label="Submit Button Text"
                        name="buttonText"
                        value={formButtonText}
                        onChange={setFormButtonText}
                        requiredIndicator
                      />

                      <Checkbox
                        label="Show phone number field"
                        checked={phoneNumberEnabled}
                        onChange={setPhoneNumberEnabled}
                      />
                      <input 
                        type="hidden" 
                        name="phoneNumberEnabled" 
                        value={phoneNumberEnabled ? "true" : "false"} 
                      />

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                        {/* Form Background Color */}
                        <div>
                          <Text variant="bodyMd" as="label">
                            Form Background
                          </Text>
                          <div style={{ marginTop: "8px" }}>
                            <InlineStack gap="300" align="start">
                              <Popover
                                active={showFormBgColorPicker}
                                activator={
                                  <div
                                    onClick={() => setShowFormBgColorPicker(!showFormBgColorPicker)}
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      backgroundColor: formBgColor,
                                      border: "1px solid #c9cccf",
                                      borderRadius: "4px",
                                      cursor: "pointer",
                                      flexShrink: 0,
                                    }}
                                  />
                                }
                                onClose={() => setShowFormBgColorPicker(false)}
                              >
                                <div style={{ padding: "16px", width: "200px" }}>
                                  <ColorPicker
                                    color={hexToHsb(formBgColor)}
                                    onChange={(color) => {
                                      const hex = hsbToHex(color);
                                      setFormBgColor(hex);
                                    }}
                                    allowAlpha={false}
                                  />
                                </div>
                              </Popover>
                              <div style={{ flex: 1 }}>
                                <TextField
                                  value={formBgColor}
                                  onChange={(value) => setFormBgColor(formatHexColor(value))}
                                  placeholder="#ffffff"
                                  autoComplete="off"
                                />
                              </div>
                            </InlineStack>
                            <input type="hidden" name="formBgColor" value={formBgColor} />
                          </div>
                        </div>
                        
                        {/* Button Color */}
                        <div>
                          <Text variant="bodyMd" as="label">
                            Button Color
                          </Text>
                          <div style={{ marginTop: "8px" }}>
                            <InlineStack gap="300" align="start">
                              <Popover
                                active={showFormButtonColorPicker}
                                activator={
                                  <div
                                    onClick={() => setShowFormButtonColorPicker(!showFormButtonColorPicker)}
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      backgroundColor: formButtonColor,
                                      border: "1px solid #c9cccf",
                                      borderRadius: "4px",
                                      cursor: "pointer",
                                      flexShrink: 0,
                                    }}
                                  />
                                }
                                onClose={() => setShowFormButtonColorPicker(false)}
                              >
                                <div style={{ padding: "16px", width: "200px" }}>
                                  <ColorPicker
                                    color={hexToHsb(formButtonColor)}
                                    onChange={(color) => {
                                      const hex = hsbToHex(color);
                                      console.log('🔍 [FORM COLOR CHANGE] Setting formButtonColor to:', hex);
                                      setFormButtonColor(hex);
                                    }}
                                    allowAlpha={false}
                                  />
                                </div>
                              </Popover>
                              <div style={{ flex: 1 }}>
                                <TextField
                                  value={formButtonColor}
                                  onChange={(value) => setFormButtonColor(formatHexColor(value))}
                                  placeholder="#000000"
                                  autoComplete="off"
                                />
                              </div>
                            </InlineStack>
                            <input type="hidden" name="buttonColor" value={formButtonColor} />
                          </div>
                        </div>

                        {/* Text Color */}
                        <div>
                          <Text variant="bodyMd" as="label">
                            Text Color
                          </Text>
                          <div style={{ marginTop: "8px" }}>
                            <InlineStack gap="300" align="start">
                              <Popover
                                active={showFormTextColorPicker}
                                activator={
                                  <div
                                    onClick={() => setShowFormTextColorPicker(!showFormTextColorPicker)}
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      backgroundColor: formTextColor,
                                      border: "1px solid #c9cccf",
                                      borderRadius: "4px",
                                      cursor: "pointer",
                                      flexShrink: 0,
                                    }}
                                  />
                                }
                                onClose={() => setShowFormTextColorPicker(false)}
                              >
                                <div style={{ padding: "16px", width: "200px" }}>
                                  <ColorPicker
                                    color={hexToHsb(formTextColor)}
                                    onChange={(color) => {
                                      const hex = hsbToHex(color);
                                      setFormTextColor(hex);
                                    }}
                                    allowAlpha={false}
                                  />
                                </div>
                              </Popover>
                              <div style={{ flex: 1 }}>
                                <TextField
                                  value={formTextColor}
                                  onChange={(value) => setFormTextColor(formatHexColor(value))}
                                  placeholder="#333333"
                                  autoComplete="off"
                                />
                              </div>
                            </InlineStack>
                            <input type="hidden" name="textColor" value={formTextColor} />
                          </div>
                        </div>
                      </div>

                      <div>
                        <Text variant="bodyMd" as="label">
                          Button Border Radius: {buttonBorderRadius[0]}px
                        </Text>
                        <input type="hidden" name="buttonBorderRadius" value={buttonBorderRadius[0]} />
                        <RangeSlider
                          label=""
                          value={buttonBorderRadius[0]}
                          onChange={(value) => setButtonBorderRadius([value])}
                          min={0}
                          max={20}
                        />
                      </div>

                      <div>
                        <Text variant="bodyMd" as="label">
                          Text Size: {formTextSize[0]}px
                        </Text>
                        <input type="hidden" name="textSize" value={formTextSize[0]} />
                        <RangeSlider
                          label=""
                          value={formTextSize[0]}
                          onChange={(value) => setFormTextSize([value])}
                          min={12}
                          max={18}
                        />
                      </div>

                      <Divider />
                      
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">
                          Live Preview
                        </Text>
                        <FormPreview />
                      </BlockStack>

                      <Button
                        submit
                        variant="primary"
                        loading={isSubmitting}
                      >
                        Save Form Settings
                      </Button>
                    </FormLayout>
                  </Form>
                </BlockStack>
              </Card>
            </Grid.Cell>
          </Grid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}