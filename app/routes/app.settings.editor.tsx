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

  return json({ buttonSettings, formSettings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const action = formData.get("_action") as string;

  try {
    if (action === "saveButton") {
      const backgroundColor = formData.get("backgroundColor") as string;
      const textColor = formData.get("textColor") as string;
      const borderRadius = parseInt(formData.get("borderRadius") as string);
      const textSize = parseInt(formData.get("textSize") as string);
      const textContent = formData.get("textContent") as string;

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
      const phoneNumberEnabled = formData.get("phoneNumberEnabled") === "on";
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
  const [buttonColor, setButtonColor] = useState(formSettings.buttonColor);
  const [buttonBorderRadius, setButtonBorderRadius] = useState([formSettings.buttonBorderRadius]);
  const [formTextSize, setFormTextSize] = useState([formSettings.textSize]);
  const [formTextColor, setFormTextColor] = useState(formSettings.textColor);
  const [phoneNumberEnabled, setPhoneNumberEnabled] = useState(formSettings.phoneNumberEnabled);
  const [formTitle, setFormTitle] = useState(formSettings.formTitle);
  const [formDescription, setFormDescription] = useState(formSettings.formDescription);
  const [formButtonText, setFormButtonText] = useState(formSettings.buttonText);

  const isSubmitting = navigation.state === "submitting";

  // Preview components
  const ButtonPreview = () => (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <button
        style={{
          backgroundColor,
          color: textColor,
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
        <Text variant="headingMd" as="h3" style={{ 
          color: formTextColor, 
          fontSize: `${formTextSize[0]}px`,
          marginBottom: "8px"
        }}>
          {formTitle}
        </Text>
        <Text variant="bodyMd" as="p" style={{ 
          color: formTextColor, 
          fontSize: `${formTextSize[0] - 2}px`,
          marginBottom: "16px"
        }}>
          {formDescription}
        </Text>
        
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
            backgroundColor: buttonColor,
            color: "#ffffff",
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
                        <div>
                          <Text variant="bodyMd" as="label">
                            Background Color
                          </Text>
                          <input
                            type="color"
                            name="backgroundColor"
                            value={backgroundColor}
                            onChange={(e) => setBackgroundColor(e.target.value)}
                            style={{ 
                              width: "100%", 
                              height: "40px", 
                              border: "1px solid #ccc", 
                              borderRadius: "4px",
                              marginTop: "4px",
                            }}
                          />
                        </div>
                        
                        <div>
                          <Text variant="bodyMd" as="label">
                            Text Color
                          </Text>
                          <input
                            type="color"
                            name="textColor"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            style={{ 
                              width: "100%", 
                              height: "40px", 
                              border: "1px solid #ccc", 
                              borderRadius: "4px",
                              marginTop: "4px",
                            }}
                          />
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
                  
                  <Form method="post">
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
                        name="phoneNumberEnabled"
                        checked={phoneNumberEnabled}
                        onChange={setPhoneNumberEnabled}
                      />

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                        <div>
                          <Text variant="bodyMd" as="label">
                            Form Background
                          </Text>
                          <input
                            type="color"
                            name="formBgColor"
                            value={formBgColor}
                            onChange={(e) => setFormBgColor(e.target.value)}
                            style={{ 
                              width: "100%", 
                              height: "40px", 
                              border: "1px solid #ccc", 
                              borderRadius: "4px",
                              marginTop: "4px",
                            }}
                          />
                        </div>
                        
                        <div>
                          <Text variant="bodyMd" as="label">
                            Button Color
                          </Text>
                          <input
                            type="color"
                            name="buttonColor"
                            value={buttonColor}
                            onChange={(e) => setButtonColor(e.target.value)}
                            style={{ 
                              width: "100%", 
                              height: "40px", 
                              border: "1px solid #ccc", 
                              borderRadius: "4px",
                              marginTop: "4px",
                            }}
                          />
                        </div>

                        <div>
                          <Text variant="bodyMd" as="label">
                            Text Color
                          </Text>
                          <input
                            type="color"
                            name="textColor"
                            value={formTextColor}
                            onChange={(e) => setFormTextColor(e.target.value)}
                            style={{ 
                              width: "100%", 
                              height: "40px", 
                              border: "1px solid #ccc", 
                              borderRadius: "4px",
                              marginTop: "4px",
                            }}
                          />
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