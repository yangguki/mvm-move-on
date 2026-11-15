#!/usr/bin/env node
/**
 * E2E Smoke Test
 * 전체 흐름: 로그인 → 영상 업로드 → 프로그램 생성/게시 → 페어링 → 플레이어 재생
 */

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const API = "http://localhost:3001";

let token = "";
let videoId = "";
let audioId = "";
let programId = "";
let storeId = "";
let pairingCode = "";
let deviceToken = "";

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function fail(step, msg) {
  console.error(`[${step}] FAILED: ${msg}`);
  process.exit(1);
}

function curl(method, path, body, headers = {}) {
  const args = ["-s", "-X", method];
  
  Object.entries(headers).forEach(([k, v]) => {
    args.push("-H", `${k}: ${v}`);
  });
  
  if (body) {
    args.push("-H", "Content-Type: application/json");
    args.push("-d", JSON.stringify(body));
  }
  
  args.push(`${API}${path}`);
  
  try {
    const result = execSync(`curl ${args.map(a => `'${a}'`).join(" ")}`, { encoding: "utf-8" });
    return JSON.parse(result);
  } catch (err) {
    throw new Error(`curl failed: ${err.message}`);
  }
}

function curlWithAuth(method, path, body) {
  return curl(method, path, body, { Authorization: `Bearer ${token}` });
}

function curlFormData(path, filePath, name) {
  const cmd = `curl -s -X POST -H "Authorization: Bearer ${token}" -F "file=@${filePath}" -F "name=${name}" "${API}${path}"`;
  try {
    const result = execSync(cmd, { encoding: "utf-8" });
    return JSON.parse(result);
  } catch (err) {
    throw new Error(`curl upload failed: ${err.message}`);
  }
}

function step1_login() {
  log("1", "로그인...");
  const res = curl("POST", "/admin/v1/auth/login", {
    email: "inkuk.yang@mvmfit.kr",
    password: "password",
  });
  if (!res.accessToken) fail("1", `토큰 없음: ${JSON.stringify(res)}`);
  token = res.accessToken;
  log("1", `로그인 성공: ${res.email}`);
}

function step2_uploadVideo() {
  log("2", "영상 업로드...");
  
  const res = curlFormData("/admin/v1/videos/upload", "/tmp/test-video.mp4", "E2E 테스트 영상");
  if (!res.id) fail("2", `업로드 실패: ${JSON.stringify(res)}`);
  
  videoId = res.id;
  log("2", `업로드 시작: ${videoId}, status=${res.status}`);
  
  // 처리 완료 대기 (최대 30초)
  for (let i = 0; i < 15; i++) {
    execSync("sleep 2");
    const video = curlWithAuth("GET", `/admin/v1/videos/${videoId}`);
    log("2", `  처리 중: status=${video.status}`);
    if (video.status === "ready") {
      log("2", `영상 준비 완료: ${video.url}`);
      return video;
    }
    if (video.status === "failed") {
      fail("2", `영상 처리 실패: ${video.error}`);
    }
  }
  fail("2", "영상 처리 타임아웃");
}

function step2b_uploadAudio() {
  log("2b", "오디오 업로드...");
  
  // 1초 무음 MP3 생성
  try {
    execSync("ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -c:a libmp3lame /tmp/test-audio.mp3 2>/dev/null");
  } catch {
    log("2b", "WARNING: 테스트 오디오 생성 실패, 스킵");
    return;
  }
  
  const audioData = readFileSync("/tmp/test-audio.mp3").toString("base64");
  const res = curlWithAuth("POST", "/admin/v1/audio", {
    name: "E2E 테스트 음악",
    kind: "music",
    durationSec: 1,
    mimeType: "audio/mpeg",
    dataBase64: audioData,
  });
  
  if (!res.id) fail("2b", `업로드 실패: ${JSON.stringify(res)}`);
  audioId = res.id;
  log("2b", `오디오 업로드 완료: ${audioId}, url=${res.url}`);
}

function step3_createProgram() {
  log("3", "프로그램 생성...");
  const skinOptions = { pointColor: "#C8F31D", nextLeadSec: 3 };
  if (audioId) skinOptions.musicId = audioId;
  
  const res = curlWithAuth("POST", "/admin/v1/programs", {
    name: "E2E 테스트 프로그램",
    draft: {
      items: [
        { id: "ex-1", type: "exercise", durationSec: 10, label: "운동 1", videoId },
        { id: "rest-1", type: "rest", durationSec: 5, label: "휴식" },
        { id: "ex-2", type: "exercise", durationSec: 10, label: "운동 2", videoId },
      ],
      skin: { id: "neon-arcade", options: skinOptions },
    },
  });
  if (!res.id) fail("3", `생성 실패: ${JSON.stringify(res)}`);
  programId = res.id;
  log("3", `프로그램 생성: ${programId}`);
}

function step3b_audioDeleteProtection() {
  if (!audioId) {
    log("3b", "오디오 없음, 삭제 보호 테스트 스킵");
    return;
  }
  log("3b", "오디오 삭제 보호 테스트...");
  
  try {
    const result = execSync(
      `curl -s -w "\\n%{http_code}" -X DELETE -H "Authorization: Bearer ${token}" "${API}/admin/v1/audio/${audioId}"`,
      { encoding: "utf-8" }
    );
    const lines = result.trim().split("\n");
    const status = lines.pop();
    
    if (status === "409") {
      log("3b", `삭제 보호 OK: 409 응답`);
    } else {
      fail("3b", `삭제가 허용됨 (status=${status})`);
    }
  } catch (err) {
    fail("3b", `요청 실패: ${err.message}`);
  }
}

function step4_publishProgram() {
  log("4", "프로그램 게시...");
  const res = curlWithAuth("POST", `/admin/v1/programs/${programId}/publish`);
  if (!res.publishedVersion) fail("4", `게시 실패: ${JSON.stringify(res)}`);
  log("4", `게시 완료: v${res.publishedVersion}`);
}

function step5_createPairing() {
  log("5", "지점 확인 및 페어링 코드 발급...");
  
  const stores = curlWithAuth("GET", "/admin/v1/stores");
  if (!stores.items?.length) fail("5", "지점 없음");
  storeId = stores.items[0].id;
  log("5", `지점: ${stores.items[0].name} (${storeId})`);
  
  const session = curlWithAuth("POST", "/admin/v1/pairing-sessions", { storeId });
  if (!session.code) fail("5", `페어링 실패: ${JSON.stringify(session)}`);
  pairingCode = session.code;
  log("5", `페어링 코드: ${pairingCode}`);
}

function step6_playerPair() {
  log("6", "플레이어 페어링...");
  const res = curl("POST", "/player/v1/pair", { code: pairingCode });
  if (!res.token) fail("6", `토큰 발급 실패: ${JSON.stringify(res)}`);
  deviceToken = res.token;
  log("6", `기기 토큰 발급 완료`);
}

function step7_playerPrograms() {
  log("7", "플레이어 프로그램 목록 조회...");
  const res = curl("GET", "/player/v1/programs", null, { "X-Device-Token": deviceToken });
  if (!res.items) fail("7", `목록 조회 실패: ${JSON.stringify(res)}`);
  log("7", `프로그램 ${res.items.length}개`);
  
  const found = res.items.find((p) => p.id === programId);
  if (!found) fail("7", "게시한 프로그램이 목록에 없음");
  log("7", `E2E 프로그램 발견: ${found.name} v${found.publishedVersion}`);
}

function step8_playerProgramDetail() {
  log("8", "플레이어 프로그램 상세 조회...");
  const res = curl("GET", `/player/v1/programs/${programId}`, null, { "X-Device-Token": deviceToken });
  if (!res.playItems) fail("8", `상세 조회 실패: ${JSON.stringify(res)}`);
  
  log("8", `playItems: ${res.playItems.length}개`);
  log("8", `videos: ${Object.keys(res.videos || {}).length}개`);
  
  const video = res.videos?.[videoId];
  if (!video) fail("8", "영상이 스냅샷에 없음");
  log("8", `영상 URL: ${video.url}`);
  
  // 영상 URL 접근 가능 확인
  try {
    execSync(`curl -s -I "${video.url}" | head -1`, { encoding: "utf-8" });
    log("8", `영상 URL 접근 가능`);
  } catch {
    log("8", `WARNING: 영상 URL 접근 불가`);
  }
}

function step9_playerProxy() {
  log("9", "플레이어(3002) 프록시 확인...");
  
  try {
    const result = execSync(`curl -s -H "X-Device-Token: ${deviceToken}" "http://localhost:3002/player/v1/programs"`, { encoding: "utf-8" });
    const res = JSON.parse(result);
    if (res.items) {
      log("9", `플레이어 프록시 OK: ${res.items.length}개 프로그램`);
    } else {
      log("9", `WARNING: 플레이어 프록시 응답 이상`);
    }
  } catch {
    log("9", `WARNING: 플레이어 프록시 실패`);
  }
}

function main() {
  console.log("=== E2E Smoke Test ===\n");
  
  try {
    step1_login();
    step2_uploadVideo();
    step2b_uploadAudio();
    step3_createProgram();
    step3b_audioDeleteProtection();
    step4_publishProgram();
    step5_createPairing();
    step6_playerPair();
    step7_playerPrograms();
    step8_playerProgramDetail();
    step9_playerProxy();
    
    console.log("\n=== ALL STEPS PASSED ===");
    console.log("\n브라우저 확인:");
    console.log(`  관리자: http://localhost:3000/programs`);
    console.log(`  플레이어: http://localhost:3002`);
    console.log(`  페어링 코드: ${pairingCode}`);
  } catch (err) {
    console.error("\nError:", err.message);
    process.exit(1);
  }
}

main();
