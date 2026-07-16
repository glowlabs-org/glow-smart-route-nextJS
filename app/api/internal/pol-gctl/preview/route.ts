import { type NextRequest } from "next/server";
import { proxyPolGctlRequest } from "@/lib/server/pol-gctl-proxy";

export function POST(request: NextRequest) {
  return proxyPolGctlRequest(request, "preview");
}
