"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";

const NAME_MAX = 60;

type CreatedSkin = { id: string; name: string };

export function NewSkinForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("스킨 이름을 입력해 주세요.");
      return;
    }
    if (trimmed.length > NAME_MAX) {
      setError(`스킨 이름은 ${NAME_MAX}자 이하여야 해요.`);
      return;
    }
    setPending(true);
    setError("");
    try {
      const created = await api<CreatedSkin>("/admin/v1/skins", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      router.push(`/skins/${created.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "스킨을 만들지 못했어요");
      setPending(false);
    }
  }

  return (
    <form className="card" onSubmit={(event) => void submit(event)}>
      <div className="card-body" style={{ padding: 24, display: "grid", gap: 16, maxWidth: 420 }}>
        <div className="field">
          <label className="label" htmlFor="skin-name">
            스킨 이름
          </label>
          <input
            id="skin-name"
            className="input input-lg"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={NAME_MAX}
            required
            autoFocus
            disabled={pending}
            placeholder="예: 네온 아케이드"
          />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="row" style={{ gap: 12 }}>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "만드는 중…" : "만들기"}
          </button>
        </div>
      </div>
    </form>
  );
}