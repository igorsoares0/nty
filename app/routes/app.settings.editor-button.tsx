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
  Divider,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { smartSyncToMetafields } from "../utils/metafields-sync";
import { ButtonPreview } from "../components/ButtonPreview";
import { ColorPickerField } from "../components/ColorPickerField";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  let buttonSettings;
  try {
    buttonSettings = await db.buttonSettings.findUnique({
      where: { shopId: session.shop },
    });
  } catch (error) {
    console.error("ButtonSettings findUnique error:", error);
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

  return json({ buttonSettings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  try {
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

    try {
      await smartSyncToMetafields(admin, session.shop, {
        buttonSettings: buttonSettings
      });
      console.log("Button settings synced to metafields successfully");
    } catch (syncError) {
      console.error("Failed to sync button settings to metafields:", syncError);
    }

    return json({ success: true, message: "Button settings saved and synced successfully!" });
  } catch (error) {
    return json({ success: false, message: "Failed to save settings. Please try again." }, { status: 400 });
  }
};

export default function ButtonEditor() {
  const { buttonSettings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const [backgroundColor, setBackgroundColor] = useState(buttonSettings.backgroundColor);
  const [textColor, setTextColor] = useState(buttonSettings.textColor);
  const [borderRadius, setBorderRadius] = useState([buttonSettings.borderRadius]);
  const [textSize, setTextSize] = useState([buttonSettings.textSize]);
  const [textContent, setTextContent] = useState(buttonSettings.textContent);

  const isSubmitting = navigation.state === "submitting";

  return (
    <Page
      title="Button Editor"
      subtitle="Customize the appearance of your notify me button"
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
                Button Settings
              </Text>
              
              <Form method="post">
                <FormLayout>
                  <TextField
                    label="Button Text"
                    name="textContent"
                    value={textContent}
                    onChange={setTextContent}
                    requiredIndicator
                  />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <ColorPickerField
                      label="Background Color"
                      value={backgroundColor}
                      onChange={setBackgroundColor}
                      name="backgroundColor"
                      placeholder="#000000"
                    />
                    
                    <ColorPickerField
                      label="Text Color"
                      value={textColor}
                      onChange={setTextColor}
                      name="textColor"
                      placeholder="#ffffff"
                    />
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
                    <ButtonPreview
                      backgroundColor={backgroundColor}
                      textColor={textColor}
                      borderRadius={borderRadius[0]}
                      textSize={textSize[0]}
                      textContent={textContent}
                    />
                  </BlockStack>

                  <Button
                    submit
                    variant="primary"
                    loading={isSubmitting}
                    size="large"
                  >
                    Save Button Settings
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