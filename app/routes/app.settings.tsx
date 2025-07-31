import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import {
  Card,
  Page,
  Tabs,
  Layout,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  return json({
    shopId: session.shop,
  });
};

export default function SettingsLayout() {
  const { shopId } = useLoaderData<typeof loader>();
  const location = useLocation();

  const tabs = [
    {
      id: "general",
      content: "General",
      url: "/app/settings",
      panelID: "general-settings",
    },
    {
      id: "products",
      content: "Products",
      url: "/app/settings/products",
      panelID: "product-settings",
    },
    {
      id: "notifications",
      content: "Notifications",
      url: "/app/settings/notifications",
      panelID: "notification-settings",
    },
    {
      id: "templates",
      content: "Templates",
      url: "/app/settings/templates",
      panelID: "template-settings",
    },
    {
      id: "editor",
      content: "Button & Form",
      url: "/app/settings/editor",
      panelID: "editor-settings",
    },
  ];

  const getCurrentTab = () => {
    const path = location.pathname;
    if (path === "/app/settings") return 0;
    if (path.includes("/products")) return 1;
    if (path.includes("/notifications")) return 2;
    if (path.includes("/templates")) return 3;
    if (path.includes("/editor")) return 4;
    return 0;
  };

  return (
    <Page
      title="Notify Settings"
      subtitle="Configure your out-of-stock notification settings"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
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
        </Layout.Section>
      </Layout>
    </Page>
  );
}