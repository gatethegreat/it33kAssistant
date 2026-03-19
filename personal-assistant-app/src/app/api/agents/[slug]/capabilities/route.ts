import { NextResponse } from "next/server";
import { getAgentCapabilities } from "@/lib/capabilities";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const capabilities = getAgentCapabilities(slug);
  return NextResponse.json(capabilities);
}
