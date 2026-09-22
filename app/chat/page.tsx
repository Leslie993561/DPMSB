import { ChatWindow } from "@/components/chat/ChatWindow";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata = { title: "Chat — Portal Recursos Humanos" };

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Chat" titulo="Assistente de Departamento Pessoal" subtitulo="Interpretação e riscos — nunca calcula folha sozinho" />
      <ChatWindow />
    </div>
  );
}
