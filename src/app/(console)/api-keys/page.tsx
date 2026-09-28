import type { Metadata } from "next";
import { ApiKeysView } from "@/components/settings/api-keys";

export const metadata: Metadata = { title: "API Keys" };

export default function ApiKeysPage() {
  return <ApiKeysView />;
}
