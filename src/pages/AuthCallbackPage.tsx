import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase puts the token in the URL hash — this exchanges it for a session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, []);

  const handleSetPassword = async () => {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate("/admin");
    }
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-neutral-500">
        Verifying your invite link...
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Set your password</h1>
          <p className="mt-1 text-sm text-neutral-500">Choose a password for your admin account.</p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={handleSetPassword}
            disabled={loading || password.length < 6}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Set password & go to dashboard"}
          </button>
        </div>
      </div>
    </div>
  );
}