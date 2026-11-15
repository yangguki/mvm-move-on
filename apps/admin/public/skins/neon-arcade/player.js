/* ES2017 MOVE ON Player — ADM-SKIN-09 compliant */
(function () {
  "use strict";

  var DEMO = {
    id: "demo",
    name: "네온 데모",
    skin: {
      id: "neon-arcade",
      options: { restImageUrl: "rest_image.jpg", nextLeadSec: 10 },
      music: { url: "audio/bgm_gym_loop.mp3" },
      voicePack: {
        cues: {
          countdown5: { url: "audio/count_5.mp3" },
          countdown4: { url: "audio/count_4.mp3" },
          countdown3: { url: "audio/count_3.mp3" },
          countdown2: { url: "audio/count_2.mp3" },
          countdown1: { url: "audio/count_1.mp3" },
          restStart: { url: "audio/rest_10.mp3" },
        },
      },
    },
    items: [
      {
        id: "g1",
        type: "group",
        repeat: 3,
        steps: [
          { id: "s1", type: "exercise", durationSec: 20, label: "덤벨 숄더 프레스", videoId: "v1" },
          { id: "s2", type: "exercise", durationSec: 20, label: "얼터네이트 숄더 프레스", videoId: "v2" },
          { id: "s3", type: "rest", durationSec: 10, label: "휴식" },
        ],
      },
    ],
    videos: {
      v1: { id: "v1", name: "덤벨 숄더 프레스", url: "mvn_shoulder_press.mp4", durationSec: 3, thumbnailUrl: "rest_image.jpg" },
      v2: { id: "v2", name: "얼터네이트 숄더 프레스", url: "mvn_shoulder_press.mp4", durationSec: 4, thumbnailUrl: "rest_image.jpg" },
    },
  };

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function safePlay(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }

  var stage = $("stage");
  var video = $("fA");
  var restImg = $("rest");
  var scale = 1;
  var playItems = [];
  var idx = 0;
  var start = 0;
  var nextLeadSec = 10;
  var loopActive = null;
  var loopMode = true;
  var isPaused = false;
  var videosById = {};
  var spokenKey = "";
  var options = DEMO.skin.options;
  var musicUrl = (DEMO.skin.music && DEMO.skin.music.url) || "";
  var cueUrls = {
    countdown5: "audio/count_5.mp3",
    countdown4: "audio/count_4.mp3",
    countdown3: "audio/count_3.mp3",
    countdown2: "audio/count_2.mp3",
    countdown1: "audio/count_1.mp3",
    restStart: "audio/rest_10.mp3",
  };

  function fit() {
    scale = Math.min(innerWidth / 1920, innerHeight / 1080);
    var ox = (innerWidth - 1920 * scale) / 2;
    var oy = (innerHeight - 1080 * scale) / 2;
    stage.style.transform = "translate(" + ox + "px," + oy + "px) scale(" + scale + ")";
  }

  function setTimerDigits(sec) {
    var s = Math.max(0, Math.ceil(sec));
    var mm = pad(Math.floor(s / 60));
    var ss = pad(s % 60);
    var timerEl = $("timer");
    var spans = timerEl.querySelectorAll(".d");
    if (spans.length === 4) {
      if (spans[0].textContent !== mm[0]) spans[0].textContent = mm[0];
      if (spans[1].textContent !== mm[1]) spans[1].textContent = mm[1];
      if (spans[2].textContent !== ss[0]) spans[2].textContent = ss[0];
      if (spans[3].textContent !== ss[1]) spans[3].textContent = ss[1];
    } else {
      timerEl.innerHTML = '<span class="d">' + mm[0] + '</span><span class="d">' + mm[1] +
        '</span><span class="c">:</span><span class="d">' + ss[0] + '</span><span class="d">' + ss[1] + '</span>';
    }
  }

  function setBar(pct) {
    var bar = $("bar");
    bar.style.width = (pct * 100) + "%";
  }

  function setGauge(pct) {
    var g = $("gauge");
    if (g) g.style.height = (pct * 100) + "%";
    var pctEl = $("gPct");
    if (pctEl) pctEl.textContent = Math.round(pct * 100) + "%";
  }

  function setState(state) {
    stage.setAttribute("data-state", state);
  }

  function setHud(item) {
    $("stepN").textContent = item.index + 1;
    $("stepT").textContent = playItems.length;
    $("name").textContent = item.label || "";
    var subText = item.type === "rest" ? "" : item.type === "guide" ? "" : item.group || "";
    var subEl = $("sub");
    subEl.textContent = subText;
    subEl.style.display = subText ? "" : "none";
    $("timerLbl").textContent = item.type === "rest" ? "휴식 시간" : "남은 시간";
    var hasSet = typeof item.setNum === "number" && typeof item.setTotal === "number";
    var hasRep = typeof item.reps === "number" && item.reps > 0;
    var setBox = $("setBox");
    var repBox = $("repBox");
    var gutSep = $("gutSep");
    var gutL = $("gutL");
    if (hasSet) {
      $("setV").innerHTML = item.setNum + "<small>/" + item.setTotal + "</small>";
      if (setBox) setBox.style.display = "";
    } else {
      if (setBox) setBox.style.display = "none";
    }
    if (hasRep) {
      $("repV").innerHTML = item.reps + "<small>회</small>";
      if (repBox) repBox.style.display = "";
    } else {
      if (repBox) repBox.style.display = "none";
    }
    if (gutSep) gutSep.style.display = (hasSet && hasRep) ? "" : "none";
    if (gutL) gutL.style.display = (hasSet || hasRep) ? "" : "none";
    $("gLbl").textContent = "남은 시간";
  }

  function setNextPanel(item) {
    if (!item.next) {
      $("nname").textContent = "";
      $("nmeta").textContent = "";
      return;
    }
    $("nname").textContent = item.next.label || "";
    var meta = item.next.afterRest ? "휴식 후" : "다음 동작";
    if (typeof item.next.reps === "number" && item.next.reps > 0) {
      meta += " · " + item.next.reps + "회";
    }
    $("nmeta").textContent = meta;
    var url = item.next.video && item.next.video.thumbnailUrl;
    if (url) $("nimg").src = url;
  }

  function setCountdownOverlay(item, sec) {
    $("cdNum").textContent = sec;
    $("cdText").innerHTML = "<em>" + sec + "초</em> 뒤, " + playItems.length + "가지 운동 루틴이<br>시작됩니다";
    var chips = $("cdChips");
    var uniqueExercises = [];
    var seen = {};
    for (var i = 0; i < playItems.length; i++) {
      var it = playItems[i];
      if (it.type === "exercise" && !seen[it.label]) {
        seen[it.label] = true;
        uniqueExercises.push(it.label);
      }
    }
    chips.innerHTML = uniqueExercises.slice(0, 3).map(function (name, j) {
      return '<span class="chip"><em>' + (j + 1) + '</em>' + name + '</span>';
    }).join("");
  }

  function setRestOverlay(item, sec) {
    $("rsLabel").textContent = item.durationSec + "초";
    $("rsNum").textContent = sec;
    var next = item.next;
    var nxBox = $("rsNxBox");
    if (next && next.label) {
      var meta = next.label;
      if (typeof next.reps === "number" && next.reps > 0) {
        meta += " · " + next.reps + "회";
      }
      $("rsNext").textContent = meta;
      if (nxBox) nxBox.style.display = "";
    } else {
      $("rsNext").textContent = "";
      if (nxBox) nxBox.style.display = "none";
    }
  }

  var programName = "";
  function setTicker(item) {
    var tickerText = $("tickerText");
    if (!tickerText) return;
    var parts = [];
    if (programName) parts.push(programName);
    if (item && item.label) parts.push("현재: " + item.label);
    if (item && item.next && item.next.label) parts.push("다음: " + item.next.label);
    tickerText.innerHTML = parts.join('<i>|</i>');
  }

  function setCompleteOverlay() {
    var totalSec = 0;
    var exCount = 0;
    var uniqueEx = {};
    for (var i = 0; i < playItems.length; i++) {
      totalSec += playItems[i].durationSec || 0;
      if (playItems[i].type === "exercise") {
        exCount++;
        uniqueEx[playItems[i].label] = true;
      }
    }
    var uniqueCount = Object.keys(uniqueEx).length;
    var mm = Math.floor(totalSec / 60);
    var ss = totalSec % 60;
    var stats = $("cpStats");
    stats.innerHTML = '<div class="stat"><span class="n1">' + uniqueCount + '</span><span>가지 운동</span></div>' +
      '<div class="stat"><span class="n1">' + exCount + '</span><span>세트</span></div>' +
      '<div class="stat"><span class="n1">' + mm + ":" + pad(ss) + '</span><span>운동 시간</span></div>';
    var cpMsg = $("cpMsg");
    if (cpMsg) cpMsg.textContent = "오늘도 해냈어요. " + mm + "분 동안 수고 많으셨어요";
  }

  function stopLoop() {
    if (loopActive) {
      clearInterval(loopActive.timer);
      video.ontimeupdate = null;
      loopActive = null;
    }
  }

  function startVideoLoop(src) {
    stopLoop();
    video.loop = true;
    video.src = src;
    video.load();
    safePlay(video);
    loopActive = { timer: 0 };
  }

  function beginItem(i, now) {
    stopLoop();
    idx = i;
    start = now || performance.now();
    spokenKey = "";
    var item = playItems[idx];
    if (!item) return;

    setHud(item);
    setNextPanel(item);
    setTicker(item);

    if (item.type === "countdown") {
      setState("countdown");
      video.pause();
      restImg.style.display = "block";
      setCountdownOverlay(item, item.durationSec);
    } else if (item.type === "rest") {
      setState("rest");
      video.pause();
      restImg.style.display = "block";
      setRestOverlay(item, item.durationSec);
      playCue("restStart");
    } else if (item.type === "exercise") {
      setState("exercise");
      restImg.style.display = "none";
      if (item.video && item.video.url) {
        startVideoLoop(item.video.url);
      }
    } else {
      setState("exercise");
      restImg.style.display = "none";
    }
  }

  function tick(now) {
    if (!playItems.length || isPaused) return;
    var item = playItems[idx];
    var totalMs = item.durationSec * 1000;
    var el = now - start;
    var left = Math.max(0, Math.ceil((totalMs - el) / 1000));
    var pct = Math.min(1, el / totalMs);

    setTimerDigits(left);
    setBar(pct);
    setGauge(1 - pct);

    if (item.type === "countdown") {
      $("cdNum").textContent = left;
    } else if (item.type === "rest") {
      $("rsNum").textContent = left;
    }

    if ((item.type === "exercise" || item.type === "rest" || item.type === "countdown") && left >= 1 && left <= 5) {
      var key = idx + ":c" + left;
      if (spokenKey !== key) {
        spokenKey = key;
        playCue("countdown" + left);
      }
    }

    if (el >= totalMs) {
      var next = idx + 1;
      if (next >= playItems.length) {
        if (loopMode) {
          next = 0;
        } else {
          setState("complete");
          setCompleteOverlay();
          stopLoop();
          try { (window.parent || window).postMessage({ type: "mvn:done" }, "*"); } catch (e) {}
          return;
        }
      }
      beginItem(next, start + totalMs);
    }
  }

  function loop() {
    tick(performance.now());
    setTimeout(loop, 50);
  }

  function collectVideos(program) {
    videosById = {};
    function merge(source) {
      if (!source) return;
      if (Array.isArray(source)) {
        for (var i = 0; i < source.length; i++) {
          if (source[i] && source[i].id) videosById[source[i].id] = source[i];
        }
        return;
      }
      var keys = Object.keys(source);
      for (var k = 0; k < keys.length; k++) {
        var id = keys[k];
        if (source[id]) videosById[id] = source[id];
      }
    }
    merge(program.videos);
    function walk(items) {
      for (var j = 0; j < items.length; j++) {
        var it = items[j];
        if (it.type === "group") walk(it.steps || []);
        else if (it.video) videosById[it.video.id || it.videoId] = it.video;
      }
    }
    walk(program.items || []);
    return Object.keys(videosById).map(function (k) { return videosById[k]; });
  }

  function applySkin(skin) {
    options = (skin && skin.options) || options;
    nextLeadSec = typeof options.nextLeadSec === "number" ? options.nextLeadSec : 10;
    var stills = document.querySelectorAll(".still");
    var restUrl = options.restImageUrl || "rest_image.jpg";
    for (var i = 0; i < stills.length; i++) stills[i].setAttribute("src", restUrl);
    if (skin && skin.music && skin.music.url) musicUrl = skin.music.url;
    if (skin && skin.voicePack && skin.voicePack.cues) {
      var cues = skin.voicePack.cues;
      var keys = ["countdown5", "countdown4", "countdown3", "countdown2", "countdown1", "restStart"];
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        if (cues[key] && cues[key].url) cueUrls[key] = cues[key].url;
      }
    }
    if (skin && skin.id) {
      stage.setAttribute("data-skin", skin.id);
    }
    if (A.el && A.el.bgm && musicUrl) {
      A.el.bgm.src = musicUrl;
      if (A.on) A.el.bgm.play().catch(function () {});
    }
  }

  function loadProgram(program) {
    if (!program) return;
    var payload = program.playItems
      ? program
      : { program: program, playItems: window.mvnExpand ? window.mvnExpand(program, collectVideos(program)) : [] };
    var prog = payload.program || program;
    var items = payload.playItems || [];
    if (!items.length && prog.items) {
      items = [];
      var exIdx = 0;
      function walk(list, setN, setT) {
        for (var i = 0; i < list.length; i++) {
          var it = list[i];
          if (it.type === "group") {
            var rep = it.repeat || 1;
            for (var r = 0; r < rep; r++) {
              walk(it.steps || [], r + 1, rep);
            }
          } else {
            items.push({
              index: items.length,
              id: it.id,
              type: it.type,
              label: it.label,
              durationSec: it.durationSec || 20,
              video: videosById[it.videoId],
              setNum: setN,
              setTotal: setT,
              reps: it.reps || 12,
              group: it.group || "",
            });
          }
        }
      }
      collectVideos(prog);
      walk(prog.items, 1, 1);
      for (var n = 0; n < items.length; n++) {
        items[n].next = items[n + 1] || null;
      }
    }
    if (prog.skin) applySkin(prog.skin);
    programName = prog.name || "";
    playItems = items;
    if (playItems.length) beginItem(0, performance.now());
  }

  var A = { on: false, el: {} };
  function playCue(name) {
    if (!A.on) return;
    var url = cueUrls[name];
    if (!url) return;
    try {
      var a = new Audio(url);
      a.volume = 0.9;
      a.play().catch(function () {});
    } catch (e) {}
  }
  function enableAudio() {
    if (A.on) return;
    A.on = true;
    $("snd").classList.add("hide");
    try {
      var bgm = new Audio(musicUrl || "audio/bgm_gym_loop.mp3");
      bgm.loop = true;
      bgm.volume = 0.55;
      A.el.bgm = bgm;
      bgm.play().catch(function () {});
    } catch (e) {}
  }
  $("snd").addEventListener("click", enableAudio);
  addEventListener("pointerdown", function () { if (!A.on) enableAudio(); }, { once: true });
  addEventListener("keydown", function (e) {
    if (!A.on && (e.key === "Enter" || e.keyCode === 13)) {
      e.preventDefault();
      enableAudio();
    }
  });

  addEventListener("resize", fit);
  addEventListener("message", function (ev) {
    var data = ev.data;
    if (!data) return;
    if (data.type === "mvn:program") {
      loopMode = data.loop !== false;
      loadProgram(data.program);
      return;
    }
    if (data.type === "mvn:pause") {
      isPaused = true;
      video.pause();
      if (A.el.bgm) A.el.bgm.pause();
      return;
    }
    if (data.type === "mvn:resume") {
      isPaused = false;
      var item = playItems[idx];
      if (item && item.type === "exercise") safePlay(video);
      if (A.el.bgm) A.el.bgm.play().catch(function () {});
      return;
    }
  });

  fit();
  loadProgram(DEMO);
  $("snd").focus();
  loop();
})();
