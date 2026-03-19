import { NextResponse } from "next/server";
import { readCommands } from "@/lib/capabilities";

export async function GET() {
  return NextResponse.json(readCommands());
}
