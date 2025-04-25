// app/api/stream/chat/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OpenAI } from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources.mjs';


export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { message }: { message: string } = await req.json();

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

    // Fetch existing chat
    const chat = await prisma.chat.findUnique({ where: { id } });
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const chatMessages = chat.messages as { role: string; content: string }[];
    const updatedMessages = [...chatMessages, { role: 'user', content: message }];

    // Create streaming response from OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: updatedMessages as ChatCompletionMessageParam[],
      stream: true,
      temperature: 0.7,
    });

    let fullResponse = '';
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const content = chunk.choices?.[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            controller.enqueue(encoder.encode(content));
          }
        }

        const finalMessages = [...updatedMessages, { role: 'assistant', content: fullResponse }];
        await prisma.chat.update({
          where: { id },
          data: { messages: finalMessages },
        });

        controller.close();
      },
    });

    return new Response(stream);
  } catch (error: any) {
    console.error('Error in stream update:', error);
    return NextResponse.json({ error: error.message || 'Stream error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest,  { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    await prisma.chat.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
  }
}
