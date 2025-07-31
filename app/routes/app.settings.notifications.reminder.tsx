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
import { useState } from "react";
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
  
  const reminderEmailEnabled = formData.get("reminderEmailEnabled") === "on";
  const reminderSmsEnabled = formData.get("reminderSmsEnabled") === "on";

  try {
    await db.settings.upsert({
      where: { shopId: session.shop },
      update: {
        reminderEmailEnabled,
        reminderSmsEnabled,
      },
      create: {
        shopId: session.shop,
        reminderEmailEnabled,
        reminderSmsEnabled,
      },
    });

    return json({ success: true, message: "Reminder settings saved successfully!" });
  } catch (error) {
    return json({ success: false, message: "Failed to save settings. Please try again." }, { status: 400 });
  }
};

export default function ReminderNotificationSettings() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { shopId } = useOutletContext<NotificationsContext>();

  const [reminderEmailEnabled, setReminderEmailEnabled] = useState(settings.reminderEmailEnabled);
  const [reminderSmsEnabled, setReminderSmsEnabled] = useState(settings.reminderSmsEnabled);

  const isSubmitting = navigation.state === "submitting";

  return (
    <BlockStack gap="500">
      <div>
        <Text variant="headingMd" as="h2">
          Reminder Messages (Optional)
        </Text>
        <Text variant="bodyMd" as="p" color="subdued">
          Send follow-up messages to customers who haven't purchased after receiving the back-in-stock notification.
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
                Email Reminder
              </Text>
              
              <Checkbox
                label="Send email reminder"
                name="reminderEmailEnabled"
                checked={reminderEmailEnabled}
                onChange={setReminderEmailEnabled}
                helpText="Send a follow-up email to customers who haven't purchased the product yet."
              />

              {reminderEmailEnabled && (
                <InlineStack gap="300">
                  <Button 
                    url="/app/settings/templates/email?type=reminder"
                    variant="secondary"
                  >
                    Edit Email Template
                  </Button>
                  <Button 
                    url="/app/settings/templates/email?type=reminder&preview=true"
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
                SMS Reminder
              </Text>
              
              <Checkbox
                label="Send SMS reminder"
                name="reminderSmsEnabled"
                checked={reminderSmsEnabled}
                onChange={setReminderSmsEnabled}
                helpText="Send a follow-up SMS to customers who haven't purchased the product yet."
              />

              {reminderSmsEnabled && (
                <InlineStack gap="300">
                  <Button 
                    url="/app/settings/templates/sms?type=reminder"
                    variant="secondary"
                  >
                    Edit SMS Template
                  </Button>
                  <Button 
                    url="/app/settings/templates/sms?type=reminder&preview=true"
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
            How Reminder Messages Work
          </Text>
          <Text variant="bodyMd" as="p" color="subdued">
            Reminder messages are sent after the initial back-in-stock notification to customers who haven't 
            purchased the product yet. This is optional but can help increase conversion rates. Reminders are 
            typically sent 24-48 hours after the initial notification and should create urgency while remaining helpful.
          </Text>
          <Text variant="bodyMd" as="p" color="subdued">
            <strong>Note:</strong> Reminder messages are disabled by default to avoid over-communication with customers.
          </Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}