import { useEffect, useRef, useState } from "react";
import { MessageCircleMore, Send, ShieldAlert } from "lucide-react";
import { useMapStore } from "../../store/useMapStore";
import { useStation } from "../../api/useStation";
import { useSendChatMessage } from "../../api/useChat";

// Bubble ini teks polos, bukan markdown renderer — instruksi di
// ai/station-chat-prompt.md sudah minta AI tidak pakai markdown, tapi
// model kadang tetap menyelipkannya. Ini jaring pengaman kedua di sisi
// frontend supaya "**enak**" tidak pernah tampil apa adanya ke user.
function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "• ");
}

// Chat nyata ke POST /stations/:id/chat (backend/routes/chat.js, Phase
// 10). Stateless di server — riwayat percakapan disimpan di sini (state
// komponen) dan dikirim penuh setiap request. App.jsx me-render ini
// dengan `key={selectedStationId}` supaya ganti stasiun = remount penuh
// (riwayat lama dari stasiun lain otomatis hilang, tanpa effect
// terpisah buat mereset state — konteks AI itu spesifik per-stasiun).
export function MiniChatbot() {
  const selectedStationId = useMapStore((s) => s.selectedStationId);
  const { data: station } = useStation(selectedStationId);
  const send = useSendChatMessage(selectedStationId);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, send.isPending]);

  if (!selectedStationId) return null;

  function submit(e) {
    e.preventDefault();
    const content = input.trim();
    if (!content || send.isPending) return;

    const history = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");

    send.mutate(
      history.map(({ role, content }) => ({ role, content })),
      {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            data.allowed
              ? { role: "assistant", content: data.reply }
              : { role: "assistant", content: data.reason, blocked: true },
          ]);
        },
      }
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <MessageCircleMore className="h-3.5 w-3.5 text-accent" />
        Tanya AI seputar {station?.name ?? "stasiun ini"}
      </div>

      {messages.length === 0 && (
        <p className="mb-2 text-sm text-slate-500">
          Tanya apa saja soal kawasan ini — misalnya <em>"ada yang enak buat sarapan?"</em> atau{" "}
          <em>"ada laporan masalah di sekitar sini?"</em>
        </p>
      )}

      {messages.length > 0 && (
        <div ref={scrollRef} className="mb-2 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-sm text-white">
                {m.content}
              </div>
            ) : m.blocked ? (
              <div key={i} className="flex max-w-[85%] items-start gap-1.5 self-start rounded-2xl rounded-bl-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{m.content}</span>
              </div>
            ) : (
              <div key={i} className="max-w-[85%] self-start whitespace-pre-line rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-700">
                {stripMarkdown(m.content)}
              </div>
            )
          )}
          {send.isPending && (
            <div className="max-w-[85%] self-start rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-400">
              Mengetik…
            </div>
          )}
        </div>
      )}

      {send.isError && (
        <p className="mb-2 text-xs text-rose-500">
          Gagal mengirim pesan. {send.error?.message ?? "Coba lagi."}
        </p>
      )}

      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tulis pertanyaan…"
          disabled={send.isPending}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-accent focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={send.isPending || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-40"
          aria-label="Kirim"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
