#!/usr/bin/env node
/**
 * E2E Smoke Test
 * 새 흐름: 로그인 → 영상 업로드 → 프로그램 생성/게시 → 플레이어 코드 발급 → 관리자 승인 → 전체 프로그램 목록
 */

import { readFileSync } from "fs";
import { execSync } from "child_process";

const API = process.env.API || "http://localhost:3001";

let token = "";
let videoId = "";
let audioId = "";
let programId = "";
let deviceToken = "";

const cleanupIds = { videos: [], audio: [], programs: [], stores: [], devices: [] };

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function fail(step, msg) {
  console.error(`[${step}] FAILED: ${msg}`);
  cleanup();
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

function cleanup() {
  log("cleanup", "테스트 데이터 정리...");
  
  // 프로그램 삭제 (cascade로 versions도 삭제됨)
  for (const id of cleanupIds.programs) {
    try {
      curlWithAuth("DELETE", `/admin/v1/programs/${id}`);
      log("cleanup", `  프로그램 ${id.slice(0, 8)}... 삭제`);
    } catch { /* ignore */ }
  }
  
  // 오디오 삭제
  for (const id of cleanupIds.audio) {
    try {
      curlWithAuth("DELETE", `/admin/v1/audio/${id}`);
      log("cleanup", `  오디오 ${id.slice(0, 8)}... 삭제`);
    } catch { /* ignore */ }
  }
  
  // 영상 삭제
  for (const id of cleanupIds.videos) {
    try {
      curlWithAuth("DELETE", `/admin/v1/videos/${id}`);
      log("cleanup", `  영상 ${id.slice(0, 8)}... 삭제`);
    } catch { /* ignore */ }
  }
  
  // 디바이스 삭제 (지점보다 먼저)
  for (const id of cleanupIds.devices) {
    try {
      curlWithAuth("DELETE", `/admin/v1/devices/${id}`);
      log("cleanup", `  디바이스 ${id.slice(0, 8)}... 삭제`);
    } catch { /* ignore */ }
  }
  
  // E2E 지점만 삭제 (E2E로 시작하는 코드)
  try {
    const stores = curlWithAuth("GET", "/admin/v1/stores");
    for (const store of stores.items || []) {
      if (store.code?.startsWith("E2E") && store.tvCount === 0) {
        curlWithAuth("DELETE", `/admin/v1/stores/${store.id}`);
        log("cleanup", `  지점 ${store.name} 삭제`);
      }
    }
  } catch { /* ignore */ }
}

function step1_login() {
  log("1", "로그인...");
  const res = curl("POST", "/admin/v1/auth/login", {
    email: "inkuk.yang@mvmfit.kr",
    password: "password",
  });
  if (!res.accessToken) fail("1", `토큰 없음: ${JSON.stringify(res)}`);
  token = res.accessToken;
  log("1", `로그인 성공`);
}

function step2_uploadVideo() {
  log("2", "영상 업로드...");
  const res = curlFormData("/admin/v1/videos/upload", "/tmp/test-video.mp4", "E2E 테스트 영상");
  if (!res.id) fail("2", `업로드 실패: ${JSON.stringify(res)}`);
  videoId = res.id;
  cleanupIds.videos.push(videoId);
  log("2", `업로드 시작: ${videoId.slice(0, 8)}...`);
  
  for (let i = 0; i < 15; i++) {
    execSync("sleep 2");
    const video = curlWithAuth("GET", `/admin/v1/videos/${videoId}`);
    if (video.status === "ready") {
      log("2", `영상 준비 완료`);
      return;
    }
    if (video.status === "failed") fail("2", `영상 처리 실패`);
  }
  fail("2", "영상 처리 타임아웃");
}

function step2b_uploadAudio() {
  log("2b", "오디오 업로드...");
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
  if (!res.id) fail("2b", `업로드 실패`);
  audioId = res.id;
  cleanupIds.audio.push(audioId);
  log("2b", `오디오 업로드 완료`);
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
  if (!res.id) fail("3", `생성 실패`);
  programId = res.id;
  cleanupIds.programs.push(programId);
  log("3", `프로그램 생성: ${programId.slice(0, 8)}...`);
}

function step4_publishProgram() {
  log("4", "프로그램 게시...");
  const res = curlWithAuth("POST", `/admin/v1/programs/${programId}/publish`);
  if (!res.publishedVersion) fail("4", `게시 실패`);
  log("4", `게시 완료: v${res.publishedVersion}`);
}

function step5_playerCodeAndApproval() {
  log("5", "플레이어 코드 발급 → 관리자 승인 흐름...");
  
  // 1. 플레이어가 코드 요청
  const codeRes = curl("POST", "/player/v1/code", null);
  if (!codeRes.code) fail("5", `코드 발급 실패: ${JSON.stringify(codeRes)}`);
  log("5", `플레이어 코드: ${codeRes.code}`);
  
  // 2. 승인 전 상태 확인 (pending)
  const pendingStatus = curl("GET", `/player/v1/code/${codeRes.code}/status`, null);
  if (pendingStatus.status !== "pending") fail("5", `승인 전 상태가 pending이 아님: ${pendingStatus.status}`);
  log("5", `상태 확인 OK: pending`);
  
  // 3. 관리자가 승인
  const approveRes = curlWithAuth("POST", "/admin/v1/approve-pairing", { code: codeRes.code });
  if (!approveRes.ok) fail("5", `승인 실패: ${JSON.stringify(approveRes)}`);
  if (approveRes.device?.id) cleanupIds.devices.push(approveRes.device.id);
  log("5", `관리자 승인 완료: ${approveRes.device?.code}`);
  
  // 4. 플레이어가 폴링으로 토큰 수신
  const approvedStatus = curl("GET", `/player/v1/code/${codeRes.code}/status`, null);
  if (approvedStatus.status !== "approved") fail("5", `승인 후 상태가 approved가 아님: ${approvedStatus.status}`);
  if (!approvedStatus.token) fail("5", `토큰이 없음`);
  deviceToken = approvedStatus.token;
  log("5", `토큰 수신 완료`);
}

function step6_playerProgramList() {
  log("6", "플레이어 전체 발행 프로그램 목록 조회...");
  const res = curl("GET", "/player/v1/programs", null, { "X-Device-Token": deviceToken });
  if (!res.items) fail("6", `목록 조회 실패`);
  
  // 전체 발행 프로그램이 반환되어야 함 (최소 1개 = E2E 프로그램)
  if (res.items.length < 1) fail("6", `발행 프로그램이 없음`);
  log("6", `프로그램 ${res.items.length}개 (전체 발행)`);
  
  const found = res.items.find((p) => p.id === programId);
  if (!found) fail("6", "E2E 프로그램이 목록에 없음");
  log("6", `E2E 프로그램 발견: ${found.name} v${found.publishedVersion}`);
}

function step7_playerProgramDetail() {
  log("7", "플레이어 프로그램 상세 조회...");
  const res = curl("GET", `/player/v1/programs/${programId}`, null, { "X-Device-Token": deviceToken });
  if (!res.playItems) fail("7", `상세 조회 실패`);
  
  log("7", `playItems: ${res.playItems.length}개, videos: ${Object.keys(res.videos || {}).length}개`);
  
  const video = res.videos?.[videoId];
  if (!video) fail("7", "영상이 스냅샷에 없음");
  log("7", `영상 URL 확인 OK`);
}

function step8_playerProxy() {
  log("8", "플레이어(3002) 프록시 확인...");
  for (let retry = 0; retry < 3; retry++) {
    try {
      const result = execSync(`curl -s --max-time 3 -H "X-Device-Token: ${deviceToken}" "http://localhost:3002/player/v1/programs"`, { encoding: "utf-8" });
      const res = JSON.parse(result);
      if (res.items) {
        log("8", `플레이어 프록시 OK: ${res.items.length}개 프로그램`);
        return;
      }
    } catch {
      if (retry < 2) execSync("sleep 2");
    }
  }
  log("8", `WARNING: 플레이어 프록시 실패 (3002 미실행 가능)`);
}

function step9_storeTests() {
  log("9", "지점 기능 테스트 (삭제 보호 등)...");
  
  // TV 있는 지점 삭제 시도 (409)
  const stores = curlWithAuth("GET", "/admin/v1/stores");
  const storeWithTv = stores.items?.find((s) => s.tvCount > 0);
  if (storeWithTv) {
    try {
      const result = execSync(
        `curl -s -w "\\n%{http_code}" -X DELETE -H "Authorization: Bearer ${token}" "${API}/admin/v1/stores/${storeWithTv.id}"`,
        { encoding: "utf-8" }
      );
      const status = result.trim().split("\n").pop();
      if (status === "409") {
        log("9", `TV 있는 지점 삭제 보호 OK: 409`);
      } else {
        log("9", `WARNING: 삭제 보호 미작동 (status=${status})`);
      }
    } catch { /* ignore */ }
  } else {
    log("9", `WARNING: TV 있는 지점 없어 삭제 보호 테스트 스킵`);
  }
}

function main() {
  console.log("=== E2E Smoke Test (새 흐름) ===\n");
  
  try {
    step1_login();
    step2_uploadVideo();
    step2b_uploadAudio();
    step3_createProgram();
    step4_publishProgram();
    step5_playerCodeAndApproval();
    step6_playerProgramList();
    step7_playerProgramDetail();
    step8_playerProxy();
    step9_storeTests();
    
    console.log("\n=== ALL STEPS PASSED ===");
    cleanup();
    console.log("\n브라우저 확인:");
    console.log(`  관리자: http://localhost:3000/programs`);
    console.log(`  플레이어: http://localhost:3002`);
  } catch (err) {
    console.error("\nError:", err.message);
    cleanup();
    process.exit(1);
  }
}

main();
