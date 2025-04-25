// app/api/stream/chat/route.ts
import { OpenAI } from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const { messages } = await req.json();

        // Create an OpenAI API client
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || '',
        });

        // Extract the first user message to create a title
        const firstUserMessage = messages.find((msg: any) => msg.role === 'user')?.content || '';

        // Generate a title from the first message
        let chatTitle = "New Chat";
        if (firstUserMessage.length > 0) {
            // Use the first few words as the title
            chatTitle = firstUserMessage.split(' ').slice(0, 4).join(' ');
            if (firstUserMessage.length > chatTitle.length) {
                chatTitle += '...';
            }
        }

        // Create a chat entry in the database first
        const chat = await prisma.chat.create({
            data: {
                title: chatTitle,
                messages: messages, // Save the initial messages
            },
        });

        // Create a chat completion with streaming
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            stream: true,
            temperature: 0.7,
        });

        // Variables to collect the full response
        let fullResponse = '';
        const chatId = chat.id;

        // Create a TransformStream to handle the streaming response
        const encoder = new TextEncoder();

        // Create a streaming response
        const stream = new ReadableStream({
            async start(controller) {
                // Process the stream from OpenAI
                for await (const chunk of response) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) {
                        // Add to the full response
                        fullResponse += content;

                        // Send the content chunk to the client
                        controller.enqueue(encoder.encode(content));
                    }
                }

                // After streaming is complete, update the database with the full conversation
                const updatedMessages = [
                    ...messages,
                    { role: 'assistant', content: fullResponse }
                ];

                // Update the chat in the database with the complete conversation
                await prisma.chat.update({
                    where: { id: chatId },
                    data: {
                        messages: updatedMessages,
                    },
                });

                controller.close();
            },
        });

        // Create headers to send chat ID to client
        const headers = new Headers();
        headers.append('X-Chat-ID', chatId);

        return new Response(stream, {
            headers
        });
    } catch (error: any) {
        console.error("Error in chat API:", error);
        return NextResponse.json({ error: error.message || "An error occurred" }, { status: 500 });
    }
}

export async function GET() {
    // Fetch all past chats
    const chats = await prisma.chat.findMany({
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(chats);
}