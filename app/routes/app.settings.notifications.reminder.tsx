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
  Select,
  TextField,
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

  console.log('⚙️ [REMINDER SETTINGS] Loading reminder settings for shop:', session.shop);
  console.log('⚙️ [REMINDER SETTINGS] Current settings from database:', {
    reminderEmailEnabled: settings.reminderEmailEnabled,
    reminderSmsEnabled: settings.reminderSmsEnabled,
    reminderDelayHours: settings.reminderDelayHours,
    reminderMaxCount: settings.reminderMaxCount
  });

  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const reminderEmailEnabled = formData.get("reminderEmailEnabledHidden") === "true";
  const reminderSmsEnabled = formData.get("reminderSmsEnabledHidden") === "true";
  const reminderDelayHours = parseFloat(formData.get("reminderDelayHours") as string) || 24;
  const reminderMaxCount = parseInt(formData.get("reminderMaxCount") as string) || 2;

  console.log('⚙️ [REMINDER SETTINGS] Saving reminder settings:', {
    shop: session.shop,
    reminderEmailEnabled,
    reminderSmsEnabled,
    reminderDelayHours,
    reminderMaxCount,
    formData: {
      reminderEmailEnabled: formData.get("reminderEmailEnabled"),
      reminderDelayHours: formData.get("reminderDelayHours"),
      reminderMaxCount: formData.get("reminderMaxCount")
    }
  });

  try {
    await db.settings.upsert({
      where: { shopId: session.shop },
      update: {
        reminderEmailEnabled,
        reminderSmsEnabled,
        reminderDelayHours,
        reminderMaxCount,
      },
      create: {
        shopId: session.shop,
        reminderEmailEnabled,
        reminderSmsEnabled,
        reminderDelayHours,
        reminderMaxCount,
      },
    });

    console.log('⚙️ [REMINDER SETTINGS] Settings saved successfully to database');
    return json({ success: true, message: "Reminder settings saved successfully!" });
  } catch (error) {
    console.error('⚙️ [REMINDER SETTINGS] Error saving settings:', error);
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
  const [reminderDelayHours, setReminderDelayHours] = useState(settings.reminderDelayHours?.toString() || "24");
  const [reminderMaxCount, setReminderMaxCount] = useState(settings.reminderMaxCount?.toString() || "2");

  const isSubmitting = navigation.state === "submitting";

  // Sincronizar estado local com dados do servidor após mudanças
  useEffect(() => {
    setReminderEmailEnabled(settings.reminderEmailEnabled);
    setReminderSmsEnabled(settings.reminderSmsEnabled);
    setReminderDelayHours(settings.reminderDelayHours?.toString() || "24");
    setReminderMaxCount(settings.reminderMaxCount?.toString() || "2");
  }, [settings.reminderEmailEnabled, settings.reminderSmsEnabled, settings.reminderDelayHours, settings.reminderMaxCount]);

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
                Timing Settings
              </Text>
              
              <BlockStack gap="300">
                <Select
                  label="Send first reminder after"
                  name="reminderDelayHours"
                  value={reminderDelayHours}
                  onChange={setReminderDelayHours}
                  options={[
                    { label: "5 minutes (TEST)", value: "0.083" },
                    { label: "12 hours", value: "12" },
                    { label: "24 hours (1 day)", value: "24" },
                    { label: "48 hours (2 days)", value: "48" },
                    { label: "72 hours (3 days)", value: "72" },
                  ]}
                  helpText="How long to wait after the back-in-stock notification before sending the first reminder."
                />

                <Select
                  label="Maximum reminders per customer"
                  name="reminderMaxCount"
                  value={reminderMaxCount}
                  onChange={setReminderMaxCount}
                  options={[
                    { label: "1 reminder only", value: "1" },
                    { label: "2 reminders", value: "2" },
                    { label: "3 reminders", value: "3" },
                  ]}
                  helpText="Maximum number of reminder messages to send per customer. Additional reminders are sent at the same interval."
                />
              </BlockStack>

              <Text variant="bodyMd" as="p" color="subdued">
                <strong>Example:</strong> With current settings, customers will receive their first reminder {reminderDelayHours} hours after the back-in-stock notification, 
                {reminderMaxCount === "1" ? " and no additional reminders." : ` followed by ${parseInt(reminderMaxCount) - 1} more reminder${parseInt(reminderMaxCount) > 2 ? 's' : ''} at ${reminderDelayHours}-hour intervals.`}
              </Text>
            </BlockStack>
          </Card>

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
              <input type="hidden" name="reminderEmailEnabledHidden" value={reminderEmailEnabled ? "true" : "false"} />

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
              <input type="hidden" name="reminderSmsEnabledHidden" value={reminderSmsEnabled ? "true" : "false"} />

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
            Reminder messages are automatically sent to customers who received a back-in-stock notification but haven't 
            purchased the product yet. The system tracks purchases and stops sending reminders once a customer buys the product.
          </Text>
          <Text variant="bodyMd" as="p" color="subdued">
            <strong>Smart Features:</strong>
          </Text>
          <ul style={{ color: "var(--p-color-text-subdued)", fontSize: "14px", paddingLeft: "20px", margin: "10px 0" }}>
            <li>Automatically stops reminders when customer purchases</li>
            <li>Won't send reminders if product goes out of stock</li>
            <li>Respects maximum reminder limits to avoid spam</li>
            <li>Each reminder becomes more urgent in tone</li>
          </ul>
          <Text variant="bodyMd" as="p" color="subdued">
            <strong>Note:</strong> Reminder messages are disabled by default. Enable them to increase conversion rates while maintaining good customer experience.
          </Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}