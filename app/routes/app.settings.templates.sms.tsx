import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useOutletContext, useSearchParams } from "@remix-run/react";
import {
  FormLayout,
  TextField,
  Button,
  Banner,
  BlockStack,
  Text,
  Select,
  Grid,
  Card,
  Badge,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

type TemplatesContext = {
  shopId: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const templateType = url.searchParams.get("type") || "first";
  
  let template = await db.smsTemplate.findUnique({
    where: { 
      shopId_type: {
        shopId: session.shop,
        type: templateType,
      }
    },
  });

  if (!template) {
    template = await db.smsTemplate.create({
      data: {
        shopId: session.shop,
        type: templateType,
      },
    });
  }

  return json({ template, templateType });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const type = formData.get("type") as string;
  const message = formData.get("message") as string;

  if (!message || message.length > 160) {
    return json({ 
      success: false, 
      message: "SMS message is required and must be 160 characters or less." 
    }, { status: 400 });
  }

  try {
    await db.smsTemplate.upsert({
      where: { 
        shopId_type: {
          shopId: session.shop,
          type,
        }
      },
      update: {
        message,
      },
      create: {
        shopId: session.shop,
        type,
        message,
      },
    });

    return json({ success: true, message: "SMS template saved successfully!" });
  } catch (error) {
    return json({ success: false, message: "Failed to save template. Please try again." }, { status: 400 });
  }
};

export default function SmsTemplateEditor() {
  const { template, templateType } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { shopId } = useOutletContext<TemplatesContext>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedType, setSelectedType] = useState(templateType);
  const [message, setMessage] = useState(template.message);

  const isSubmitting = navigation.state === "submitting";

  const typeOptions = [
    { label: "First Notification", value: "first" },
    { label: "Thank You Message", value: "thankyou" },
    { label: "Reminder", value: "reminder" },
  ];

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    setSearchParams({ type: value });
  };

  const characterCount = message.length;
  const isOverLimit = characterCount > 160;

  const getCharacterCountColor = () => {
    if (characterCount > 140) return "critical";
    if (characterCount > 120) return "warning";
    return "success";
  };

  return (
    <Grid>
      <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 7, xl: 7}}>
        <BlockStack gap="500">
          <div>
            <Text variant="headingMd" as="h2">
              SMS Template Editor
            </Text>
            <Text variant="bodyMd" as="p" color="subdued">
              Create concise SMS messages for your customers. Keep messages under 160 characters for optimal delivery.
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
              <input type="hidden" name="type" value={selectedType} />
              
              <Select
                label="Template Type"
                options={typeOptions}
                value={selectedType}
                onChange={handleTypeChange}
              />

              <div>
                <TextField
                  label="SMS Message"
                  name="message"
                  value={message}
                  onChange={setMessage}
                  multiline={4}
                  placeholder="Great news! The item you requested is back in stock. Visit our store to get yours now!"
                  requiredIndicator
                  error={isOverLimit ? "Message exceeds 160 character limit" : undefined}
                />
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  marginTop: "8px" 
                }}>
                  <Text variant="bodyMd" as="p" color="subdued">
                    SMS messages are charged per 160 characters
                  </Text>
                  <Badge tone={getCharacterCountColor()}>
                    {characterCount}/160 characters
                  </Badge>
                </div>
              </div>

              <Button
                submit
                variant="primary"
                loading={isSubmitting}
                disabled={isOverLimit || !message.trim()}
              >
                {isSubmitting ? "Saving..." : "Save Template"}
              </Button>
            </FormLayout>
          </Form>

          <Card sectioned>
            <BlockStack gap="300">
              <Text variant="headingXs" as="h4">
                SMS Best Practices
              </Text>
              <Text variant="bodyMd" as="p" color="subdued">
                • Keep messages concise and to the point
              </Text>
              <Text variant="bodyMd" as="p" color="subdued">
                • Include a clear call-to-action
              </Text>
              <Text variant="bodyMd" as="p" color="subdued">
                • Avoid special characters that may not display correctly
              </Text>
              <Text variant="bodyMd" as="p" color="subdued">
                • Test messages on different devices before going live
              </Text>
            </BlockStack>
          </Card>
        </BlockStack>
      </Grid.Cell>

      <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 5, xl: 5}}>
        <Card sectioned>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">
              Message Preview
            </Text>
            <div 
              style={{ 
                border: "1px solid #e1e1e1", 
                borderRadius: "12px", 
                padding: "16px",
                backgroundColor: "#f0f8ff",
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontSize: "16px",
                lineHeight: "1.4",
                maxWidth: "300px",
                margin: "0 auto",
              }}
            >
              <div style={{ 
                backgroundColor: "#007AFF", 
                color: "white", 
                padding: "8px 12px", 
                borderRadius: "18px", 
                wordWrap: "break-word",
                fontSize: "15px",
              }}>
                {message || "Your SMS message will appear here..."}
              </div>
            </div>
            
            <Text variant="bodyMd" as="p" color="subdued" textAlign="center">
              Preview of how your SMS will appear on mobile devices
            </Text>

            <div style={{ 
              padding: "12px", 
              backgroundColor: "#f9f9f9", 
              borderRadius: "6px",
              marginTop: "16px",
            }}>
              <Text variant="headingXs" as="h4">
                Template Variables
              </Text>
              <Text variant="bodyMd" as="p" color="subdued">
                You can use these variables in your message:
              </Text>
              <Text variant="bodyMd" as="p" color="subdued">
                • {`{product_name}`} - Product title
              </Text>
              <Text variant="bodyMd" as="p" color="subdued">
                • {`{shop_name}`} - Your store name
              </Text>
              <Text variant="bodyMd" as="p" color="subdued">
                • {`{customer_name}`} - Customer's first name
              </Text>
            </div>
          </BlockStack>
        </Card>
      </Grid.Cell>
    </Grid>
  );
}