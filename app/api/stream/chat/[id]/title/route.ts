// app/api/stream/chat/[id]/title/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { title } = await req.json();

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Update chat title
    const updatedChat = await prisma.chat.update({
      where: { id },
      data: { title },
    });

    return NextResponse.json(updatedChat);
  } catch (error) {
    console.error("Error updating chat title:", error);
    return NextResponse.json({ error: "Failed to update chat title" }, { status: 500 });
  }
}