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
  RangeSlider,
  Checkbox,
  Divider,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { smartSyncToMetafields } from "../utils/metafields-sync";
import { FormPreview } from "../components/FormPreview";
import { ColorPickerField } from "../components/ColorPickerField";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
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

  return json({ formSettings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  try {
    const formBgColor = formData.get("formBgColor") as string;
    const buttonColor = formData.get("buttonColor") as string;
    const buttonBorderRadius = parseInt(formData.get("buttonBorderRadius") as string);
    const textSize = parseInt(formData.get("textSize") as string);
    const textColor = formData.get("textColor") as string;

    const rawPhoneValue = formData.get("phoneNumberEnabled");
    const phoneNumberEnabled = rawPhoneValue === "true" || rawPhoneValue === "on";
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

    try {
      await smartSyncToMetafields(admin, session.shop, {
        formSettings: formSettings
      });
      console.log("Form settings synced to metafields successfully");
    } catch (syncError) {
      console.error("Failed to sync form settings to metafields:", syncError);
    }

    return json({ success: true, message: "Form settings saved and synced successfully!" });
  } catch (error) {
    return json({ success: false, message: "Failed to save settings. Please try again." }, { status: 400 });
  }
};

export default function FormEditor() {
  const { formSettings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const [formBgColor, setFormBgColor] = useState(formSettings.formBgColor);
  const [formButtonColor, setFormButtonColor] = useState(formSettings.buttonColor);
  const [buttonBorderRadius, setButtonBorderRadius] = useState([formSettings.buttonBorderRadius]);
  const [formTextSize, setFormTextSize] = useState([formSettings.textSize]);
  const [formTextColor, setFormTextColor] = useState(formSettings.textColor);
  const [phoneNumberEnabled, setPhoneNumberEnabled] = useState(formSettings.phoneNumberEnabled);
  const [formTitle, setFormTitle] = useState(formSettings.formTitle);
  const [formDescription, setFormDescription] = useState(formSettings.formDescription);
  const [formButtonText, setFormButtonText] = useState(formSettings.buttonText);

  const isSubmitting = navigation.state === "submitting";

  return (
    <Page
      title="Form Editor"
      subtitle="Customize the appearance of your notification signup form"
      backAction={{ content: "Back to Editor Selection", url: "/app/settings/editor" }}
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
          <Card sectioned>
            <BlockStack gap="500">
              <Text variant="headingMd" as="h2">
                Form Settings
              </Text>
              
              <Form method="post">
                <FormLayout>
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
                    <ColorPickerField
                      label="Form Background"
                      value={formBgColor}
                      onChange={setFormBgColor}
                      name="formBgColor"
                      placeholder="#ffffff"
                    />
                    
                    <ColorPickerField
                      label="Button Color"
                      value={formButtonColor}
                      onChange={setFormButtonColor}
                      name="buttonColor"
                      placeholder="#000000"
                    />

                    <ColorPickerField
                      label="Text Color"
                      value={formTextColor}
                      onChange={setFormTextColor}
                      name="textColor"
                      placeholder="#333333"
                    />
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
                    <FormPreview
                      formBgColor={formBgColor}
                      formTextColor={formTextColor}
                      formButtonColor={formButtonColor}
                      buttonBorderRadius={buttonBorderRadius[0]}
                      textSize={formTextSize[0]}
                      phoneNumberEnabled={phoneNumberEnabled}
                      formTitle={formTitle}
                      formDescription={formDescription}
                      formButtonText={formButtonText}
                    />
                  </BlockStack>

                  <Button
                    submit
                    variant="primary"
                    loading={isSubmitting}
                    size="large"
                  >
                    Save Form Settings
                  </Button>
                </FormLayout>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}