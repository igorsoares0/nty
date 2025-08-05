import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useOutletContext } from "@remix-run/react";
import {
  FormLayout,
  Button,
  Banner,
  BlockStack,
  Text,
  Checkbox,
  InlineStack,
  Card,
  ButtonGroup,
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

type NotificationsContext = {
  shopId: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  console.log('🔍 [FIRST] Loading settings for shop:', session.shop);
  
  let settings = await db.settings.findUnique({
    where: { shopId: session.shop },
  });

  console.log('🔍 [FIRST] Found settings:', settings ? 'YES' : 'NO');
  
  if (!settings) {
    console.log('🔍 [FIRST] Creating default settings');
    settings = await db.settings.create({
      data: {
        shopId: session.shop,
      },
    });
  }

  console.log('🔍 [FIRST] Settings data:', {
    firstEmailEnabled: settings.firstEmailEnabled,
    firstSmsEnabled: settings.firstSmsEnabled,
    autoNotificationEnabled: settings.autoNotificationEnabled
  });

  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const firstEmailEnabled = formData.get("firstEmailEnabled") === "true";
  const firstSmsEnabled = formData.get("firstSmsEnabled") === "true";

  console.log('💾 [FIRST] Saving settings:', {
    shop: session.shop,
    firstEmailEnabled,
    firstSmsEnabled,
    formData: Object.fromEntries(formData.entries())
  });

  try {
    const updatedSettings = await db.settings.upsert({
      where: { shopId: session.shop },
      update: {
        firstEmailEnabled,
        firstSmsEnabled,
      },
      create: {
        shopId: session.shop,
        firstEmailEnabled,
        firstSmsEnabled,
      },
    });

    console.log('💾 [FIRST] Settings saved successfully:', {
      firstEmailEnabled: updatedSettings.firstEmailEnabled,
      firstSmsEnabled: updatedSettings.firstSmsEnabled
    });

    return json({ success: true, message: "First notification settings saved successfully!" });
  } catch (error) {
    console.error('💾 [FIRST] Error saving settings:', error);
    return json({ success: false, message: "Failed to save settings. Please try again." }, { status: 400 });
  }
};

export default function FirstNotificationSettings() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { shopId } = useOutletContext<NotificationsContext>();

  const [firstEmailEnabled, setFirstEmailEnabled] = useState(settings.firstEmailEnabled);
  const [firstSmsEnabled, setFirstSmsEnabled] = useState(settings.firstSmsEnabled);

  const isSubmitting = navigation.state === "submitting";

  // Sincronizar estado local com dados do servidor após mudanças
  useEffect(() => {
    setFirstEmailEnabled(settings.firstEmailEnabled);
    setFirstSmsEnabled(settings.firstSmsEnabled);
  }, [settings.firstEmailEnabled, settings.firstSmsEnabled]);

  return (
    <BlockStack gap="500">
      <div>
        <Text variant="headingMd" as="h2">
          First Notification
        </Text>
        <Text variant="bodyMd" as="p" color="subdued">
          This notification is sent immediately when a customer requests to be notified about an out-of-stock product.
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
          <Card sectioned>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                Email Notification
              </Text>
              
              <Checkbox
                label="Send email notification"
                checked={firstEmailEnabled}
                onChange={setFirstEmailEnabled}
                helpText="Customers will receive an email confirmation that they've been added to the notification list."
              />
              <input 
                type="hidden" 
                name="firstEmailEnabled" 
                value={firstEmailEnabled ? "true" : "false"} 
              />

              {firstEmailEnabled && (
                <InlineStack gap="300">
                  <Button 
                    url="/app/settings/templates/email?type=first"
                    variant="secondary"
                  >
                    Edit Email Template
                  </Button>
                  <Button 
                    url="/app/settings/templates/email?type=first&preview=true"
                    variant="tertiary"
                  >
                    Preview Email
                  </Button>
                </InlineStack>
              )}
            </BlockStack>
          </Card>

          <Card sectioned>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                SMS Notification
              </Text>
              
              <Checkbox
                label="Send SMS notification"
                checked={firstSmsEnabled}
                onChange={setFirstSmsEnabled}
                helpText="Customers will receive an SMS confirmation (requires phone number collection)."
              />
              <input 
                type="hidden" 
                name="firstSmsEnabled" 
                value={firstSmsEnabled ? "true" : "false"} 
              />

              {firstSmsEnabled && (
                <InlineStack gap="300">
                  <Button 
                    url="/app/settings/templates/sms?type=first"
                    variant="secondary"
                  >
                    Edit SMS Template
                  </Button>
                  <Button 
                    url="/app/settings/templates/sms?type=first&preview=true"
                    variant="tertiary"
                  >
                    Preview SMS
                  </Button>
                </InlineStack>
              )}
            </BlockStack>
          </Card>

          <Button
            submit
            variant="primary"
            loading={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Settings"}
          </Button>
        </FormLayout>
      </Form>

      <Card sectioned>
        <BlockStack gap="300">
          <Text variant="headingXs" as="h4">
            How First Notifications Work
          </Text>
          <Text variant="bodyMd" as="p" color="subdued">
            When a customer clicks "Notify Me" on an out-of-stock product, they'll receive this confirmation message 
            letting them know they've been successfully added to the notification list. This helps build trust and 
            sets proper expectations about when they'll hear from you next.
          </Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}