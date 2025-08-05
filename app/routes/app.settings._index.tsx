import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useOutletContext } from "@remix-run/react";
import {
  FormLayout,
  TextField,
  Button,
  Banner,
  BlockStack,
  Text,
  Checkbox,
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

type SettingsContext = {
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
        ownerEmail: session.email || "",
      },
    });
  }

  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const ownerEmail = formData.get("ownerEmail") as string;
  const autoNotificationEnabled = formData.get("autoNotificationEnabled") === "on";

  try {
    await db.settings.upsert({
      where: { shopId: session.shop },
      update: {
        ownerEmail,
        autoNotificationEnabled,
      },
      create: {
        shopId: session.shop,
        ownerEmail,
        autoNotificationEnabled,
      },
    });

    return json({ success: true, message: "Settings saved successfully!" });
  } catch (error) {
    return json({ success: false, message: "Failed to save settings. Please try again." }, { status: 400 });
  }
};

export default function GeneralSettings() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { shopId } = useOutletContext<SettingsContext>();

  const [ownerEmail, setOwnerEmail] = useState(settings.ownerEmail || "");
  const [autoNotificationEnabled, setAutoNotificationEnabled] = useState(settings.autoNotificationEnabled);

  const isSubmitting = navigation.state === "submitting";

  // Sincronizar estado local com dados do servidor após mudanças
  useEffect(() => {
    setOwnerEmail(settings.ownerEmail || "");
    setAutoNotificationEnabled(settings.autoNotificationEnabled);
  }, [settings.ownerEmail, settings.autoNotificationEnabled]);

  return (
    <BlockStack gap="500">
      <Text variant="headingMd" as="h2">
        General Settings
      </Text>
      <Text variant="bodyMd" as="p" color="subdued">
        Configure your basic notification preferences and contact information.
      </Text>

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
          <TextField
            label="Store Owner Email"
            type="email"
            name="ownerEmail"
            value={ownerEmail}
            onChange={setOwnerEmail}
            placeholder="your-email@example.com"
            helpText="This email will receive notification summaries and system alerts."
            autoComplete="email"
            requiredIndicator
          />

          <Checkbox
            label="Enable automatic notifications"
            name="autoNotificationEnabled"
            checked={autoNotificationEnabled}
            onChange={setAutoNotificationEnabled}
            helpText="When enabled, customers will be automatically notified when out-of-stock products become available."
          />

          <Button
            submit
            variant="primary"
            loading={isSubmitting}
            disabled={!ownerEmail.trim()}
          >
            {isSubmitting ? "Saving..." : "Save Settings"}
          </Button>
        </FormLayout>
      </Form>

      <div style={{ marginTop: "2rem", padding: "1rem", backgroundColor: "#f9f9f9", borderRadius: "6px" }}>
        <Text variant="headingXs" as="h3">
          Shop Information
        </Text>
        <Text variant="bodyMd" as="p" color="subdued">
          Shop ID: {shopId}
        </Text>
      </div>
    </BlockStack>
  );
}