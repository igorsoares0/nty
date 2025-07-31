import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import {
  Card,
  Tabs,
  BlockStack,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  return json({
    shopId: session.shop,
  });
};

export default function NotificationsLayout() {
  const { shopId } = useLoaderData<typeof loader>();
  const location = useLocation();

  const tabs = [
    {
      id: "first",
      content: "First Notification",
      url: "/app/settings/notifications/first",
      panelID: "first-notification",
    },
    {
      id: "thankyou",
      content: "Thank You Message",
      url: "/app/settings/notifications/thankyou",
      panelID: "thankyou-message",
    },
    {
      id: "reminder",
      content: "Reminder (Optional)",
      url: "/app/settings/notifications/reminder",
      panelID: "reminder-message",
    },
  ];

  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.includes("/first")) return 0;
    if (path.includes("/thankyou")) return 1;
    if (path.includes("/reminder")) return 2;
    return 0;
  };

  return (
    <BlockStack gap="500">
      <div>
        <Text variant="headingMd" as="h2">
          Notification Settings
        </Text>
        <Text variant="bodyMd" as="p" color="subdued">
          Configure when and how customers receive notifications about back-in-stock products.
        </Text>
      </div>

      <Card>
        <Tabs
          tabs={tabs.map((tab) => ({
            ...tab,
            content: (
              <Link to={tab.url} style={{ textDecoration: "none", color: "inherit" }}>
                {tab.content}
              </Link>
            ),
          }))}
          selected={getCurrentTab()}
        />
        <div style={{ padding: "1rem" }}>
          <Outlet context={{ shopId }} />
        </div>
      </Card>
    </BlockStack>
  );
}