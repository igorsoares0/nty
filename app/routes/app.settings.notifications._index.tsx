import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Redirect to the first notification tab when accessing /app/settings/notifications
  return redirect("/app/settings/notifications/first");
};