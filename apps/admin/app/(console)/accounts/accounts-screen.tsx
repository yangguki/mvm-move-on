"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { ApiError, api } from "@/lib/api";

type Store = { id: string; name: string; code: string };
type Account = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  stores: Store[];
};

const ROLE = { hq_admin: "본사 관리자", store_admin: "지점 관리자" };
const STATUS = { invited: "초대됨", active: "사용 중", disabled: "중지" };

export function AccountsScreen() {
  const [items, setItems] = useState<Account[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("store_admin");
  const [storeId, setStoreId] = useState("");
  const [issued, setIssued] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [accounts, storeList] = await Promise.all([
      api<{ items: Account[] }>("/admin/v1/accounts"),
      api<{ items: Store[] }>("/admin/v1/stores"),
    ]);
    setItems(accounts.items);
    setStores(storeList.items);
    setStoreId((current) => current || storeList.items[0]?.id || "");
  }

  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof ApiError ? caught.message : "계정을 불러오지 못했어요"));
  }, []);

  async function invite(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIssued("");
    try {
      const result = await api<{ temporaryPassword: string | null; account: Account }>("/admin/v1/accounts", {
        method: "POST",
        body: JSON.stringify({
          email,
          displayName,
          role,
          storeIds: role === "store_admin" ? [storeId] : [],
        }),
      });
      setEmail("");
      setDisplayName("");
      setOpen(false);
      if (result.temporaryPassword) setIssued(`${result.account.email} 임시 비밀번호는 ${result.temporaryPassword} 이에요. 이 화면을 닫으면 다시 볼 수 없어요.`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "초대하지 못했어요");
    }
  }

  return (
    <div className="ops">
      <div className="page-head">
        <div>
          <h1 className="t-title">계정 · 권한</h1>
          <p>본사 관리자는 전체 지점을 보고, 지점 관리자는 소속 지점만 봐요.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen((value) => !value)}>
          <Plus className="i" aria-hidden />
          관리자 초대
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {issued ? <p className="card pair-box">{issued}</p> : null}
      {open ? (
        <form className="card pair-box" onSubmit={(event) => void invite(event)}>
          <input className="input" style={{ width: 220 }} type="email" placeholder="이메일" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <input className="input" style={{ width: 160 }} placeholder="이름" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          <select className="input" style={{ width: 140 }} value={role} onChange={(event) => setRole(event.target.value)} aria-label="역할">
            <option value="hq_admin">본사 관리자</option>
            <option value="store_admin">지점 관리자</option>
          </select>
          {role === "store_admin" ? (
            <select className="input" style={{ width: 180 }} value={storeId} onChange={(event) => setStoreId(event.target.value)} aria-label="소속 지점">
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          ) : null}
          <button type="submit" className="btn btn-primary btn-sm">
            초대
          </button>
        </form>
      ) : null}
      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>계정</th>
              <th>역할</th>
              <th>상태</th>
              <th>소속 지점</th>
            </tr>
          </thead>
          <tbody>
            {items.map((account) => (
              <tr key={account.id}>
                <td>
                  <div className="cell-main">{account.displayName || account.email}</div>
                  <div className="cell-sub">{account.email}</div>
                </td>
                <td>{ROLE[account.role as keyof typeof ROLE] ?? account.role}</td>
                <td>
                  <span className={`badge ${account.status === "active" ? "badge-ok" : account.status === "disabled" ? "badge-err" : "badge-warn"}`}>
                    <span className="dot" />
                    {STATUS[account.status as keyof typeof STATUS] ?? account.status}
                  </span>
                </td>
                <td>{account.stores.length ? account.stores.map((store) => store.name).join(", ") : "전체 지점"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
