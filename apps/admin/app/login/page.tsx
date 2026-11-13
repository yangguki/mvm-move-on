import type { Metadata } from "next";
import { ChevronRight, Coffee, Dumbbell, Eye, Timer } from "lucide-react";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";
import "./login.css";

export const metadata: Metadata = {
  title: "로그인 · MOVE ON 관리자",
};

export default function LoginPage() {
  return (
    <main className="login">
      <section className="hero">
        <div className="beams" />
        <div className="grid" />
        <svg className="bigv" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#C8F31D" stopOpacity=".95" />
              <stop offset="1" stopColor="#C8F31D" stopOpacity=".05" />
            </linearGradient>
          </defs>
          <path d="M15 30H33L47.5 58L66 17H85L56.5 80H40Z" fill="none" stroke="url(#gv)" strokeWidth=".35" />
          <path d="M15 30H33L47.5 58L66 17H85L56.5 80H40Z" fill="url(#gv)" opacity=".08" />
        </svg>
        <div className="hero-top">
          <div className="brand">
            <Logo variant="icon" height={36} radius={9} />
            <Logo variant="wordmark-white" height={18} />
          </div>
          <span className="tag">BY MVM FITNESS</span>
        </div>
        <div className="hero-mid">
          <div className="over">ROUTINE PLAYER · ADMIN</div>
          <h2 className="headline">
            오늘의 <em>30분</em>을
            <br />
            모든 지점 TV에.
          </h2>
          <p className="lede">
            프로그램을 한 번 발행하면 지점 TV가 카운트다운부터 휴식까지 알아서 진행해요. 코치는 회원에게만 집중하세요.
          </p>
          <div className="flow">
            <div className="st">
              <span className="b st-count"><Timer className="i" aria-hidden /></span>
              카운트다운
              <span className="t">10s</span>
            </div>
            <ChevronRight className="i arrow" aria-hidden />
            <div className="st">
              <span className="b st-work"><Dumbbell className="i" aria-hidden /></span>
              운동
              <span className="t">45s</span>
            </div>
            <ChevronRight className="i arrow" aria-hidden />
            <div className="st">
              <span className="b st-next"><Eye className="i" aria-hidden /></span>
              NEXT
              <span className="t">10s</span>
            </div>
            <ChevronRight className="i arrow" aria-hidden />
            <div className="st">
              <span className="b st-rest"><Coffee className="i" aria-hidden /></span>
              휴식
              <span className="t">15s</span>
            </div>
          </div>
        </div>
        <div className="hero-foot">
          <div>
            <b>1 버튼</b>
            <span>시작만 누르면 자동 진행</span>
          </div>
          <div>
            <b>1920×1080</b>
            <span>지점 TV · PWA 플레이어</span>
          </div>
          <div>
            <b>5종</b>
            <span>스킨 템플릿</span>
          </div>
        </div>
      </section>
      <section className="form-side">
        <LoginForm />
        <div className="foot">
          <span>© 2026 MOVE ON</span>
          <span>
            <button type="button">이용약관</button>
            <button type="button">개인정보처리방침</button>
            <button type="button">운영 문의</button>
          </span>
        </div>
      </section>
    </main>
  );
}
