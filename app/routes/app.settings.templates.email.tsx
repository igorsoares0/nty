import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useOutletContext, useSearchParams, useFetcher } from "@remix-run/react";
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
  ColorPicker,
  RangeSlider,
  Divider,
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

type TemplatesContext = {
  shopId: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const templateType = url.searchParams.get("type") || "first";
  
  let template = await db.emailTemplate.findUnique({
    where: { 
      shopId_type: {
        shopId: session.shop,
        type: templateType,
      }
    },
  });

  if (!template) {
    template = await db.emailTemplate.create({
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
  const subject = formData.get("subject") as string;
  const headline = formData.get("headline") as string;
  const bodyText = formData.get("bodyText") as string;
  const buttonText = formData.get("buttonText") as string;
  const buttonColor = formData.get("buttonColor") as string;
  const buttonBgColor = formData.get("buttonBgColor") as string;
  const buttonRadius = parseInt(formData.get("buttonRadius") as string);

  console.log('🔧 [TEMPLATE SAVE] Dados recebidos:', {
    type, subject, headline, buttonText, buttonColor, buttonBgColor
  });

  try {
    await db.emailTemplate.upsert({
      where: { 
        shopId_type: {
          shopId: session.shop,
          type,
        }
      },
      update: {
        subject,
        headline,
        bodyText,
        buttonText,
        buttonColor,
        buttonBgColor,
        buttonRadius,
      },
      create: {
        shopId: session.shop,
        type,
        subject,
        headline,
        bodyText,
        buttonText,
        buttonColor,
        buttonBgColor,
        buttonRadius,
      },
    });

    return json({ success: true, message: "Email template saved successfully!" });
  } catch (error) {
    return json({ success: false, message: "Failed to save template. Please try again." }, { status: 400 });
  }
};

export default function EmailTemplateEditor() {
  const { template, templateType } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { shopId } = useOutletContext<TemplatesContext>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedType, setSelectedType] = useState(templateType);
  const [subject, setSubject] = useState(template.subject);
  const [headline, setHeadline] = useState(template.headline);
  const [bodyText, setBodyText] = useState(template.bodyText);
  const [buttonText, setButtonText] = useState(template.buttonText);
  const [buttonColor, setButtonColor] = useState(template.buttonColor);
  const [buttonBgColor, setButtonBgColor] = useState(template.buttonBgColor);
  const [buttonRadius, setButtonRadius] = useState([template.buttonRadius]);

  const fetcher = useFetcher<typeof loader>();

  const isSubmitting = navigation.state === "submitting";

  const typeOptions = [
    { label: "First Notification", value: "first" },
    { label: "Thank You Message", value: "thankyou" },
    { label: "Reminder", value: "reminder" },
  ];

  const handleTypeChange = (value: string) => {
    console.log('🔄 [TEMPLATE CHANGE] Type changed to:', value);
    setSelectedType(value);
    // Usar fetcher para carregar dados do novo template
    fetcher.load(`/app/settings/templates/email?type=${value}`);
    // Atualizar URL também
    setSearchParams({ type: value });
  };

  // Atualizar campos quando fetcher retornar dados
  useEffect(() => {
    if (fetcher.data && fetcher.state === 'idle') {
      const templateData = fetcher.data.template;
      console.log('🔄 [TEMPLATE CHANGE] Fetcher data received:', templateData);
      
      // Atualizar todos os campos com os dados do novo template
      setSubject(templateData.subject || '');
      setHeadline(templateData.headline || '');
      setBodyText(templateData.bodyText || '');
      setButtonText(templateData.buttonText || '');
      setButtonColor(templateData.buttonColor || '#ffffff');
      setButtonBgColor(templateData.buttonBgColor || '#000000');
      setButtonRadius([templateData.buttonRadius || 4]);
      
      console.log('🔄 [TEMPLATE CHANGE] All fields updated successfully');
    }
  }, [fetcher.data, fetcher.state]);

  // Generate email preview
  const emailPreview = `
    <div style="
      max-width: 600px; 
      margin: 0 auto; 
      font-family: Arial, sans-serif; 
      background-color: #ffffff;
      padding: 20px;
      border: 1px solid #e1e1e1;
      border-radius: 8px;
    ">
      <h1 style="
        color: #333; 
        font-size: 24px; 
        margin-bottom: 20px;
        text-align: center;
      ">
        ${headline}
      </h1>
      
      <p style="
        color: #666; 
        font-size: 16px; 
        line-height: 1.5;
        margin-bottom: 30px;
      ">
        ${bodyText}
      </p>
      
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="#" style="
          display: inline-block;
          padding: 12px 24px;
          color: ${buttonColor};
          background-color: ${buttonBgColor};
          text-decoration: none;
          border-radius: ${buttonRadius[0]}px;
          font-weight: bold;
          font-size: 16px;
        ">
          ${buttonText}
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;">
      
      <p style="
        color: #999; 
        font-size: 12px; 
        text-align: center;
      ">
        This email was sent by ${shopId}
      </p>
    </div>
  `;

  return (
    <Grid>
      <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 7, xl: 7}}>
        <BlockStack gap="500">
          <div>
            <Text variant="headingMd" as="h2">
              Email Template Editor
            </Text>
            <Text variant="bodyMd" as="p" color="subdued">
              Customize your email templates with live preview.
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

              <TextField
                label="Email Subject"
                name="subject"
                value={subject}
                onChange={setSubject}
                placeholder="Your product is back in stock!"
                requiredIndicator
              />

              <TextField
                label="Email Headline"
                name="headline"
                value={headline}
                onChange={setHeadline}
                placeholder="Great News!"
                requiredIndicator
              />

              <TextField
                label="Email Body Text"
                name="bodyText"
                value={bodyText}
                onChange={setBodyText}
                multiline={4}
                placeholder="The item you requested is now back in stock. Don't miss out - get yours now!"
                requiredIndicator
              />

              <Divider />

              <Text variant="headingMd" as="h3">
                Button Settings
              </Text>

              <TextField
                label="Button Text"
                name="buttonText"
                value={buttonText}
                onChange={setButtonText}
                placeholder="Shop Now"
                requiredIndicator
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <Text variant="bodyMd" as="label" htmlFor="buttonColor">
                    Button Text Color
                  </Text>
                  <input
                    type="color"
                    name="buttonColor"
                    value={buttonColor}
                    onChange={(e) => setButtonColor(e.target.value)}
                    style={{ 
                      width: "100%", 
                      height: "40px", 
                      border: "1px solid #ccc", 
                      borderRadius: "4px",
                      marginTop: "4px",
                    }}
                  />
                </div>
                
                <div>
                  <Text variant="bodyMd" as="label" htmlFor="buttonBgColor">
                    Button Background Color
                  </Text>
                  <input
                    type="color"
                    name="buttonBgColor"
                    value={buttonBgColor}
                    onChange={(e) => setButtonBgColor(e.target.value)}
                    style={{ 
                      width: "100%", 
                      height: "40px", 
                      border: "1px solid #ccc", 
                      borderRadius: "4px",
                      marginTop: "4px",
                    }}
                  />
                </div>
              </div>

              <div>
                <Text variant="bodyMd" as="label">
                  Button Border Radius: {buttonRadius[0]}px
                </Text>
                <input
                  type="hidden"
                  name="buttonRadius"
                  value={buttonRadius[0]}
                />
                <RangeSlider
                  label=""
                  value={buttonRadius[0]}
                  onChange={(value) => setButtonRadius([value])}
                  min={0}
                  max={20}
                />
              </div>

              <Button
                submit
                variant="primary"
                loading={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Template"}
              </Button>
            </FormLayout>
          </Form>
        </BlockStack>
      </Grid.Cell>

      <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 5, xl: 5}}>
        <Card sectioned>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">
              Live Preview
            </Text>
            <Text variant="bodyMd" as="p" color="subdued">
              Subject: {subject}
            </Text>
            <div 
              style={{ 
                border: "1px solid #e1e1e1", 
                borderRadius: "8px", 
                overflow: "hidden",
                backgroundColor: "#f9f9f9",
                padding: "10px",
              }}
              dangerouslySetInnerHTML={{ __html: emailPreview }}
            />
          </BlockStack>
        </Card>
      </Grid.Cell>
    </Grid>
  );
}