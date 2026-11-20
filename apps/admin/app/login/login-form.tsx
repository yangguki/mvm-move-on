"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, EyeOff, Mail } from "lucide-react";
import { ApiError, api, isAuthenticated, setCloudSession, setToken } from "@/lib/api";
import { isCloudDataMode } from "@/lib/data-mode";

export function LoginForm() {
  const router = useRouter();
  const cloud = isCloudDataMode();
  const [showPassword, setShowPassword] = useState(false);
  const [keep, setKeep] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace("/");
  }, [router]);

  return (
    <div className="form-wrap">
      <h1>관리자 로그인</h1>
      <p>
        {cloud ? "클라우드 관리 비밀번호로 로그인해 주세요." : "본사 또는 지점 관리자 계정으로 로그인해 주세요."}
      </p>
      <form
        className="form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setPending(true);
          setError("");
          try {
            const body = cloud
              ? { password: String(form.get("password") ?? "") }
              : { email: form.get("email"), password: form.get("password") };
            const result = await api<{ accessToken: string }>("/admin/v1/auth/login", {
              method: "POST",
              body: JSON.stringify(body),
            });
            if (cloud) setCloudSession(keep);
            else setToken(result.accessToken, keep);
            router.push("/");
          } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : "로그인에 실패했어요");
            setPending(false);
          }
        }}
      >
        {!cloud ? (
          <div className="field">
            <label className="label" htmlFor="email">
              이메일
            </label>
            <input
              id="email"
              className="input input-lg"
              type="email"
              name="email"
              autoComplete="username"
              defaultValue="inkuk.yang@mvmfit.kr"
            />
          </div>
        ) : null}
        <div className="field">
          <div className="between">
            <label className="label" htmlFor="password">
              비밀번호
            </label>
            {!cloud ? (
              <button type="button" className="link">
                비밀번호를 잊으셨나요?
              </button>
            ) : null}
          </div>
          <div className="pw">
            <input
              id="password"
              className="input input-lg"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              defaultValue={cloud ? "" : "password"}
              style={{ letterSpacing: showPassword ? undefined : "2px" }}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={showPassword ? "비밀번호 가리기" : "비밀번호 보기"}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <Eye className="i" aria-hidden /> : <EyeOff className="i" aria-hidden />}
            </button>
          </div>
        </div>
        <label className="row remember">
          <input type="checkbox" checked={keep} onChange={(event) => setKeep(event.target.checked)} />
          <span className={keep ? "check on" : "check"}>
            {keep ? <Check className="i" aria-hidden /> : null}
          </span>
          이 기기에서 로그인 유지
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="btn btn-primary btn-lg submit" type="submit" disabled={pending}>
          {pending ? "확인하는 중이에요" : "로그인"}
          <ArrowRight className="i" aria-hidden />
        </button>
        {!cloud ? (
          <>
            <div className="or">또는</div>
            <button className="btn btn-secondary btn-lg submit" type="button">
              <Mail className="i" aria-hidden />
              초대 메일로 계정 만들기
            </button>
          </>
        ) : null}
      </form>
    </div>
  );
}