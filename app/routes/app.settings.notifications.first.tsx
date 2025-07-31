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
  
  const firstEmailEnabled = formData.get("firstEmailEnabled") === "on";
  const firstSmsEnabled = formData.get("firstSmsEnabled") === "on";

  try {
    await db.settings.upsert({
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

    return json({ success: true, message: "First notification settings saved successfully!" });
  } catch (error) {
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
                name="firstEmailEnabled"
                checked={firstEmailEnabled}
                onChange={setFirstEmailEnabled}
                helpText="Customers will receive an email confirmation that they've been added to the notification list."
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
                name="firstSmsEnabled"
                checked={firstSmsEnabled}
                onChange={setFirstSmsEnabled}
                helpText="Customers will receive an SMS confirmation (requires phone number collection)."
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