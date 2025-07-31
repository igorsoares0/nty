import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useOutletContext } from "@remix-run/react";
import {
  Button,
  Banner,
  BlockStack,
  Text,
  DataTable,
  Checkbox,
  EmptyState,
  Card,
  Badge,
  TextField,
  InlineStack,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

type SettingsContext = {
  shopId: string;
};

type Product = {
  id: string;
  title: string;
  handle: string;
  status: string;
  totalInventory: number;
  showNotification: boolean;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Fetch out of stock products from Shopify
  const response = await admin.graphql(`
    #graphql
    query getProducts($first: Int!) {
      products(first: $first, query: "inventory_total:0") {
        edges {
          node {
            id
            title
            handle
            status
            totalInventory
          }
        }
      }
    }
  `, {
    variables: { first: 50 }
  });

  const responseJson = await response.json();
  const products = responseJson.data?.products?.edges?.map((edge: any) => edge.node) || [];

  // Get existing product settings
  const productSettings = await db.productSettings.findMany({
    where: { shopId: session.shop },
  });

  const settingsMap = new Map(productSettings.map(setting => [setting.productId, setting.showNotification]));

  // Combine product data with settings
  const productsWithSettings = products.map((product: any) => ({
    ...product,
    showNotification: settingsMap.get(product.id) ?? true, // Default to true
  }));

  return json({ 
    products: productsWithSettings,
    shopId: session.shop,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const action = formData.get("_action") as string;
  
  if (action === "toggle") {
    const productId = formData.get("productId") as string;
    const showNotification = formData.get("showNotification") === "true";

    try {
      await db.productSettings.upsert({
        where: { 
          shopId_productId: {
            shopId: session.shop,
            productId: productId,
          }
        },
        update: { showNotification },
        create: {
          shopId: session.shop,
          productId: productId,
          showNotification,
        },
      });

      return json({ success: true, message: "Product setting updated successfully!" });
    } catch (error) {
      return json({ success: false, message: "Failed to update product setting." }, { status: 400 });
    }
  }

  return json({ success: false, message: "Invalid action." }, { status: 400 });
};

export default function ProductSettings() {
  const { products, shopId } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");

  const isSubmitting = navigation.state === "submitting";

  const filteredProducts = products.filter((product: Product) =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleNotification = (productId: string, currentValue: boolean) => {
    const form = document.createElement('form');
    form.method = 'post';
    form.style.display = 'none';
    
    const actionInput = document.createElement('input');
    actionInput.name = '_action';
    actionInput.value = 'toggle';
    
    const productIdInput = document.createElement('input');
    productIdInput.name = 'productId';
    productIdInput.value = productId;
    
    const showNotificationInput = document.createElement('input');
    showNotificationInput.name = 'showNotification';
    showNotificationInput.value = (!currentValue).toString();
    
    form.appendChild(actionInput);
    form.appendChild(productIdInput);
    form.appendChild(showNotificationInput);
    
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  const rows = filteredProducts.map((product: Product) => [
    product.title,
    product.handle,
    <Badge tone={product.status === 'ACTIVE' ? 'success' : 'attention'} key={product.id}>
      {product.status}
    </Badge>,
    product.totalInventory.toString(),
    <Checkbox
      key={`${product.id}-checkbox`}
      checked={product.showNotification}
      onChange={() => toggleNotification(product.id, product.showNotification)}
      disabled={isSubmitting}
      label=""
    />,
  ]);

  return (
    <BlockStack gap="500">
      <InlineStack align="space-between">
        <div>
          <Text variant="headingMd" as="h2">
            Product Management
          </Text>
          <Text variant="bodyMd" as="p" color="subdued">
            Configure which out-of-stock products should show notification buttons.
          </Text>
        </div>
      </InlineStack>

      {actionData?.message && (
        <Banner
          title={actionData.success ? "Success" : "Error"}
          tone={actionData.success ? "success" : "critical"}
        >
          <p>{actionData.message}</p>
        </Banner>
      )}

      <TextField
        label="Search products"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by product name or handle..."
        clearButton
        onClearButtonClick={() => setSearchQuery("")}
      />

      {filteredProducts.length === 0 ? (
        <Card>
          <EmptyState
            heading="No out-of-stock products found"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              {products.length === 0 
                ? "All your products are currently in stock! When products go out of stock, they'll appear here."
                : "No products match your search criteria."
              }
            </p>
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'numeric', 'text']}
            headings={['Product Name', 'Handle', 'Status', 'Inventory', 'Show Notification']}
            rows={rows}
            footerContent={`${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''}`}
          />
        </Card>
      )}

      <div style={{ marginTop: "2rem", padding: "1rem", backgroundColor: "#f9f9f9", borderRadius: "6px" }}>
        <Text variant="headingXs" as="h3">
          How it works
        </Text>
        <Text variant="bodyMd" as="p" color="subdued">
          When "Show Notification" is enabled for a product, customers will see a "Notify Me" button on the product page when it's out of stock. 
          When disabled, no notification button will appear for that product.
        </Text>
      </div>
    </BlockStack>
  );
}