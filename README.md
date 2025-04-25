# ChatGPT Next.js Clone Demo
A ChatGPT-style chat application with streamed responses, chat history, title editing, and deletion, all styled with Tailwind CSS.

![Chat Interface](screenshots/chat.jpg)

## Features
- **Streaming responses** from OpenAI API  
- **Chat history** with custom titles  
- **Edit chat titles** inline  
- **Delete chat sessions**  
- **Sidebar navigation** between chats  
- **Responsive design** with Tailwind CSS  

## Tech Stack
- **Next.js**  
- **Tailwind CSS**  
- **PostgreSQL**  
- **OpenAI API** (GPT-4o-mini)  

## Setup
1. **Clone repository**  
   ```bash
   git clone https://github.com/yourusername/chatgpt-clone.git
   cd chatgpt-clone
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   Create a .env file in the project root with the following content:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   DATABASE_URL=postgresql://user:password@localhost:5432/dbname
   ```

4. **Initialize the database**
   Use Prisma to push the schema to the database:
   ```bash
   npx prisma db push
   ```

5. **Run development server**
   Start the Next.js development server:
   ```bash
   npm run dev
   ```
   You can now access the app at http://localhost:3000.

## Folder Structure
```bash
/app/api/stream/chat         # Streaming chat API routes
/components/StreamChat.tsx   # Main chat UI with sidebar
/lib/prisma.ts              # Prisma client instance
/prisma/schema.prisma        # Database schema
/screenshots/chat.jpg        # UI screenshot
```

## Prisma Schema
```prisma
model Chat {
  id        String   @id @default(cuid())
  title     String
  messages  Json
  createdAt DateTime @default(now())
}
```

## License

This project is for demonstration purposes only. It is not intended for production use.

MIT License