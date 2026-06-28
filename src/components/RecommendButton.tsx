import { Sparkles } from "lucide-react";
import { useState } from "react";
import { RecommendModal } from "./RecommendModal";

export function RecommendButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white"
      >
        <Sparkles size={15} />
        Not sure what to buy?
      </button>

      {open && <RecommendModal onClose={() => setOpen(false)} />}
    </>
  );
}