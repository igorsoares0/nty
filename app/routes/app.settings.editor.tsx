import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Grid,
  Button,
  InlineStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ButtonPreview } from "../components/ButtonPreview";
import { FormPreview } from "../components/FormPreview";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  // Load button settings
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


export default function EditorSelection() {
  const { buttonSettings, formSettings } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Widget Editor"
      subtitle="Choose which component you want to customize"
      backAction={{ content: "Settings", url: "/app/settings" }}
    >
      <Layout>
        <Layout.Section>
          <Grid>
            {/* Button Editor Selection Card */}
            <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <Text variant="headingLg" as="h2">
                      Button Editor
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Customize the "Notify Me" button that appears on out-of-stock products
                    </Text>
                  </BlockStack>
                  
                  <div style={{ padding: "20px", backgroundColor: "#f9f9f9", borderRadius: "8px" }}>
                    <ButtonPreview
                      backgroundColor={buttonSettings.backgroundColor}
                      textColor={buttonSettings.textColor}
                      borderRadius={buttonSettings.borderRadius}
                      textSize={buttonSettings.textSize}
                      textContent={buttonSettings.textContent}
                    />
                  </div>

                  <InlineStack align="end">
                    <Link to="/app/settings/editor-button">
                      <Button variant="primary" size="large">
                        Edit Button
                      </Button>
                    </Link>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Grid.Cell>

            {/* Form Editor Selection Card */}
            <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <Text variant="headingLg" as="h2">
                      Form Editor
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Customize the notification signup form that users see when they click the button
                    </Text>
                  </BlockStack>
                  
                  <div style={{ padding: "20px", backgroundColor: "#f9f9f9", borderRadius: "8px" }}>
                    <div style={{ transform: "scale(0.8)", transformOrigin: "center top" }}>
                      <FormPreview
                        formBgColor={formSettings.formBgColor}
                        formTextColor={formSettings.textColor}
                        formButtonColor={formSettings.buttonColor}
                        buttonBorderRadius={formSettings.buttonBorderRadius}
                        textSize={formSettings.textSize}
                        phoneNumberEnabled={formSettings.phoneNumberEnabled}
                        formTitle={formSettings.formTitle}
                        formDescription={formSettings.formDescription}
                        formButtonText={formSettings.buttonText}
                      />
                    </div>
                  </div>

                  <InlineStack align="end">
                    <Link to="/app/settings/editor-form">
                      <Button variant="primary" size="large">
                        Edit Form
                      </Button>
                    </Link>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Grid.Cell>
          </Grid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}