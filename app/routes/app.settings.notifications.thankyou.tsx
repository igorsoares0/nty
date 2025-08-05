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
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

type NotificationsContext = {
  shopId: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  let settings = await db.settings.findUnique({
    where: { shopId: session.shop },
  });

  if (!settings) {
    settings = await db.settings.create({
      data: {
        shopId: session.shop,
      },
    });
  }

  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const thankYouEmailEnabled = formData.get("thankYouEmailEnabled") === "on";
  const thankYouSmsEnabled = formData.get("thankYouSmsEnabled") === "on";

  try {
    await db.settings.upsert({
      where: { shopId: session.shop },
      update: {
        thankYouEmailEnabled,
        thankYouSmsEnabled,
      },
      create: {
        shopId: session.shop,
        thankYouEmailEnabled,
        thankYouSmsEnabled,
      },
    });

    return json({ success: true, message: "Thank you message settings saved successfully!" });
  } catch (error) {
    return json({ success: false, message: "Failed to save settings. Please try again." }, { status: 400 });
  }
};

export default function ThankYouNotificationSettings() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { shopId } = useOutletContext<NotificationsContext>();

  const [thankYouEmailEnabled, setThankYouEmailEnabled] = useState(settings.thankYouEmailEnabled);
  const [thankYouSmsEnabled, setThankYouSmsEnabled] = useState(settings.thankYouSmsEnabled);

  const isSubmitting = navigation.state === "submitting";

  // Sincronizar estado local com dados do servidor após mudanças
  useEffect(() => {
    setThankYouEmailEnabled(settings.thankYouEmailEnabled);
    setThankYouSmsEnabled(settings.thankYouSmsEnabled);
  }, [settings.thankYouEmailEnabled, settings.thankYouSmsEnabled]);

  return (
    <BlockStack gap="500">
      <div>
        <Text variant="headingMd" as="h2">
          Thank You Message
        </Text>
        <Text variant="bodyMd" as="p" color="subdued">
          This message is sent to customers when the out-of-stock product becomes available again.
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
                name="thankYouEmailEnabled"
                checked={thankYouEmailEnabled}
                onChange={setThankYouEmailEnabled}
                helpText="Customers will receive an email when the product is back in stock."
              />

              {thankYouEmailEnabled && (
                <InlineStack gap="300">
                  <Button 
                    url="/app/settings/templates/email?type=thankyou"
                    variant="secondary"
                  >
                    Edit Email Template
                  </Button>
                  <Button 
                    url="/app/settings/templates/email?type=thankyou&preview=true"
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
                name="thankYouSmsEnabled"
                checked={thankYouSmsEnabled}
                onChange={setThankYouSmsEnabled}
                helpText="Customers will receive an SMS when the product is back in stock."
              />

              {thankYouSmsEnabled && (
                <InlineStack gap="300">
                  <Button 
                    url="/app/settings/templates/sms?type=thankyou"
                    variant="secondary"
                  >
                    Edit SMS Template
                  </Button>
                  <Button 
                    url="/app/settings/templates/sms?type=thankyou&preview=true"
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
            How Thank You Messages Work
          </Text>
          <Text variant="bodyMd" as="p" color="subdued">
            This is the main notification that customers receive when a product they requested is back in stock. 
            It should include a clear call-to-action to visit your store and purchase the item before it sells out again.
            This message is typically sent automatically when inventory levels are restored.
          </Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}