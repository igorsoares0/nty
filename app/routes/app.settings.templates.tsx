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

export default function TemplatesLayout() {
  const { shopId } = useLoaderData<typeof loader>();
  const location = useLocation();

  const tabs = [
    {
      id: "email",
      content: "Email Templates",
      url: "/app/settings/templates/email",
      panelID: "email-templates",
    },
    {
      id: "sms",
      content: "SMS Templates",
      url: "/app/settings/templates/sms",
      panelID: "sms-templates",
    },
  ];

  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.includes("/email")) return 0;
    if (path.includes("/sms")) return 1;
    return 0;
  };

  return (
    <BlockStack gap="500">
      <div>
        <Text variant="headingMd" as="h2">
          Template Editor
        </Text>
        <Text variant="bodyMd" as="p" color="subdued">
          Customize the email and SMS templates sent to your customers.
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