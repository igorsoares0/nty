import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

// Rota de teste do App Proxy: /apps/notyys
export const action = async ({ request }: ActionFunctionArgs) => {
  console.log(`[APP PROXY] ${request.method} request to /apps/notyys`);
  console.log(`[APP PROXY] Headers:`, Object.fromEntries(request.headers.entries()));
  
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      console.log(`[APP PROXY] POST body:`, body);
      
      return json({
        success: true,
        message: "App Proxy is working!",
        receivedData: body,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.log(`[APP PROXY] Error parsing JSON:`, error);
      return json({ error: "Invalid JSON" }, { status: 400 });
    }
  }
  
  return json({ message: "App Proxy base route", method: request.method });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log(`[APP PROXY] GET request to /apps/notyys`);
  console.log(`[APP PROXY] URL:`, request.url);
  console.log(`[APP PROXY] Headers:`, Object.fromEntries(request.headers.entries()));
  
  return json({ 
    message: "App Proxy is working!",
    method: "GET",
    url: request.url,
    timestamp: new Date().toISOString()
  });
};