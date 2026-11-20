"use client";

import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { ApiError, api } from "@/lib/api";

type Props = {
  skinId: string;
  screenId: string;
  index: number;
  total: number;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
};

export function SkinScreenCardActions({ skinId, screenId, index, total, onRefresh, onError }: Props) {
  const [busy, setBusy] = useState(false);

  async function runAction(action: () => Promise<void>) {
    onError("");
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  async function move(direction: "up" | "down") {
    await runAction(async () => {
      try {
        await api(`/admin/v1/skins/${skinId}/screens/${screenId}/move`, {
          method: "POST",
          body: JSON.stringify({ direction }),
        });
        await onRefresh();
      } catch (caught) {
        onError(caught instanceof ApiError ? caught.message : "순서를 바꾸지 못했어요");
      }
    });
  }

  async function duplicate() {
    await runAction(async () => {
      try {
        await api(`/admin/v1/skins/${skinId}/screens/${screenId}/duplicate`, { method: "POST" });
        await onRefresh();
      } catch (caught) {
        onError(caught instanceof ApiError ? caught.message : "복제하지 못했어요");
      }
    });
  }

  async function remove() {
    await runAction(async () => {
      try {
        const usage = await api<{ programs: string[] }>(
          `/admin/v1/skins/${skinId}/screens/${screenId}/usage`,
        );
        const programs = usage.programs ?? [];
        let confirmed = false;
        if (programs.length > 0) {
          const list = programs.join(", ");
          confirmed = window.confirm(
            `다음 프로그램에서 사용 중이에요: ${list}\n삭제하면 해당 프로그램에서 이 화면이 빠집니다. 삭제할까요?`,
          );
        } else {
          confirmed = window.confirm("이 화면을 삭제할까요?");
        }
        if (!confirmed) return;
        const forceQuery = programs.length > 0 ? "?force=1" : "";
        await api(`/admin/v1/skins/${skinId}/screens/${screenId}${forceQuery}`, { method: "DELETE" });
        await onRefresh();
      } catch (caught) {
        onError(caught instanceof ApiError ? caught.message : "삭제하지 못했어요");
      }
    });
  }

  return (
    <div
      className="row"
      style={{ gap: 4, marginTop: 8, padding: "0 4px" }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={busy || index === 0}
        data-testid="screen-move-up"
        aria-label="화면 위로"
        onClick={() => void move("up")}
      >
        ▲
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={busy || index === total - 1}
        data-testid="screen-move-down"
        aria-label="화면 아래로"
        onClick={() => void move("down")}
      >
        ▼
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={busy}
        data-testid="screen-duplicate"
        aria-label="화면 복제"
        onClick={() => void duplicate()}
      >
        <Copy className="i" aria-hidden />
        복제
      </button>
      <button
        type="button"
        className="btn btn-danger btn-sm"
        disabled={busy}
        data-testid="screen-delete"
        aria-label="화면 삭제"
        onClick={() => void remove()}
      >
        <Trash2 className="i" aria-hidden />
        삭제
      </button>
    </div>
  );
}