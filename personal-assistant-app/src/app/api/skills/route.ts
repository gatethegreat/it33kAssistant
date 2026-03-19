import { NextResponse } from "next/server";
import { readSkills } from "@/lib/capabilities";

export async function GET() {
  return NextResponse.json(readSkills());
}
