import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Redirect to the email templates tab when accessing /app/settings/templates
  return redirect("/app/settings/templates/email");
};