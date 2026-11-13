/* ES2017 neon-arcade player — postMessage + expand + double-buffer loop */
(function () {
  "use strict";

  var DEMO = {
    id: "demo",
    name: "네온 데모",
    status: "draft",
    draftUpdatedAt: new Date().toISOString(),
    publishedVersion: null,
    skin: {
      id: "neon-arcade",
      options: {
        pointColor: "#C8F31D",
        restImageUrl: "rest_image.jpg",
        musicUrl: "audio/bgm_gym_loop.ogg",
        nextLeadSec: 10,
      },
    },
    items: [
      {
        id: "g1",
        type: "group",
        repeat: 3,
        steps: [
          {
            id: "s1",
            type: "exercise",
            durationSec: 20,
            label: "덤벨 숄더 프레스",
            videoId: "v1",
          },
          {
            id: "s2",
            type: "exercise",
            durationSec: 20,
            label: "얼터네이트 숄더 프레스",
            videoId: "v2",
          },
          { id: "s3", type: "rest", durationSec: 10, label: "휴식" },
        ],
      },
    ],
    _videos: [
      {
        id: "v1",
        name: "덤벨 숄더 프레스",
        url: "mvn_shoulder_press.mp4",
        durationSec: 3,
        thumbnailUrl: "rest_image.jpg",
        width: 1920,
        height: 1080,
      },
      {
        id: "v2",
        name: "얼터네이트 숄더 프레스",
        url: "mvn_shoulder_press.mp4",
        durationSec: 4,
        thumbnailUrl: "rest_image.jpg",
        width: 1920,
        height: 1080,
      },
    ],
  };

  function $(id) {
    return document.getElementById(id);
  }
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function clock(sec) {
    var s = Math.max(0, Math.ceil(sec));
    return pad(Math.floor(s / 60)) + ":" + pad(s % 60);
  }
  function safePlay(v) {
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  var stage = $("stage");
  var nextEl = $("next");
  var main = $("fA");
  var standby = $("fB");
  var scale = 1;
  var OX = 0;
  var OY = 0;
  var playItems = [];
  var idx = 0;
  var start = 0;
  var nextLeadSec = 10;
  var nextShown = false;
  var loopActive = null;
  var options = DEMO.skin.options;
  var videosById = {};

  function fit() {
    scale = Math.min(innerWidth / 1920, innerHeight / 1080);
    OX = (innerWidth - 1920 * scale) / 2;
    OY = (innerHeight - 1080 * scale) / 2;
    stage.style.transform = "translate(-50%,-50%) scale(" + scale + ")";
    document.documentElement.style.setProperty("--s", String(scale));
    place(main, geoMain());
    place(standby, nextShown ? geoPv() : geoMain());
    placeRest();
  }

  function R(id) {
    var s = stage.getBoundingClientRect();
    var r = $(id).getBoundingClientRect();
    var dx = id === "slotPv" && !nextEl.classList.contains("show") ? 40 * scale : 0;
    return { l: (r.left - s.left - dx) / scale, t: (r.top - s.top) / scale, w: r.width / scale, h: r.height / scale };
  }
  function place(f, r) {
    f.style.left = OX + r.l * scale + "px";
    f.style.top = OY + r.t * scale + "px";
    f.style.width = r.w * scale + "px";
    f.style.height = r.h * scale + "px";
  }
  function placeS(f, r) {
    f.style.left = r.l + "px";
    f.style.top = r.t + "px";
    f.style.width = r.w + "px";
    f.style.height = r.h + "px";
  }
  function geoMain() {
    return nextShown ? sideGeo() : R("slotMain");
  }
  function geoPv() {
    return R("slotPv");
  }
  function sideGeo() {
    var F = R("slotMain");
    var W = R("vw");
    var k = (W.w - 540 - 32) / F.w;
    return { l: W.l, t: F.t + (F.h - F.h * k) / 2, w: F.w * k, h: F.h * k };
  }
  function placeRest() {
    var W = R("vw");
    var tg = R("ntag");
    placeS($("rest"), { l: W.l + W.w - 540, t: W.t + 8, w: 540, h: Math.max(120, tg.t - W.t - 24) });
  }
  function vid(f) {
    return f.querySelector("video");
  }

  function applyOptions(opts) {
    options = opts || options;
    nextLeadSec = typeof options.nextLeadSec === "number" ? options.nextLeadSec : 10;
    if (options.pointColor) {
      document.documentElement.style.setProperty("--lime", options.pointColor);
      document.documentElement.style.setProperty("--neon", options.pointColor);
    }
    var stills = document.querySelectorAll(".still");
    var restUrl = options.restImageUrl || "rest_image.jpg";
    for (var i = 0; i < stills.length; i++) stills[i].setAttribute("src", restUrl);
    if (options.logoUrl) {
      var logo = $("logo");
      if (logo) {
        logo.src = options.logoUrl;
        logo.style.display = "block";
      }
    }
    if (options.musicUrl && A.el && A.el.bgm) {
      A.el.bgm.src = options.musicUrl;
    }
  }

  function stopLoop() {
    if (loopActive) {
      clearInterval(loopActive.timer);
      var va = vid(main);
      var vb = vid(standby);
      va.ontimeupdate = null;
      vb.ontimeupdate = null;
      loopActive = null;
    }
  }

  /** 더블버퍼: 같은 src를 두 video에 두고 끝나기 직전 교대 */
  function startDoubleBuffer(src) {
    stopLoop();
    var a = vid(main);
    var b = vid(standby);
    a.loop = false;
    b.loop = false;
    a.src = src;
    b.src = src;
    a.load();
    b.load();
    var active = a;
    var other = b;
    function swapSoon() {
      if (!loopActive || nextShown) return;
      try {
        other.currentTime = 0;
      } catch (e) {}
      safePlay(other);
      var tmp = active;
      active = other;
      other = tmp;
      // 같은 메인 자리에서 교차: standby를 main 자리로 잠시 맞춤
      if (!nextShown) {
        standby.classList.remove("pv");
        standby.classList.add("main", "show");
        place(standby, geoMain());
        main.classList.remove("main");
        main.classList.add("pv");
        var oldMain = main;
        main = standby;
        standby = oldMain;
        a = vid(main);
        b = vid(standby);
        active = a;
        other = b;
        place(standby, geoMain());
        standby.style.opacity = "0";
      }
    }
    function onUpdate() {
      if (!loopActive || nextShown) return;
      var v = active;
      if (v.duration && isFinite(v.duration) && v.currentTime >= v.duration - 0.18) {
        swapSoon();
      }
    }
    a.ontimeupdate = onUpdate;
    safePlay(a);
    loopActive = { timer: setInterval(onUpdate, 80) };
  }

  function setHud(item) {
    $("stepNo").textContent = "STEP " + (item.index + 1) + " / " + playItems.length;
    $("meta").textContent = item.type === "guide" ? "GUIDE" : item.type === "rest" ? "REST" : "WORK";
    $("name").textContent = item.label;
    $("tl").textContent = item.type === "rest" ? "REST" : "REMAINING";
  }

  function setNextPanel(item) {
    if (!item.next) {
      $("nname").textContent = "";
      $("nmeta").textContent = "";
      return;
    }
    $("nname").textContent = item.next.label;
    $("nmeta").textContent = item.next.afterRest ? "REST THEN NEXT" : "NEXT MOVE";
    var url = item.next.video && item.next.video.url;
    if (url) {
      var v = vid(standby);
      if (v.getAttribute("src") !== url) {
        v.src = url;
        v.load();
      }
    }
  }

  function showNext(on) {
    if (on === nextShown) return;
    nextShown = on;
    nextEl.classList.toggle("show", on);
    standby.classList.toggle("show", on);
    if (on) {
      standby.classList.remove("main");
      standby.classList.add("pv", "show");
      place(standby, geoPv());
      place(main, sideGeo());
      main.classList.add("main");
      var v = vid(main);
      v.loop = true;
      safePlay(vid(standby));
    } else {
      standby.classList.remove("show");
      place(main, R("slotMain"));
      var mv = vid(main);
      mv.loop = false;
    }
  }

  function beginItem(i, now) {
    stopLoop();
    idx = i;
    start = now || performance.now();
    var item = playItems[idx];
    if (!item) return;
    setHud(item);
    setNextPanel(item);
    showNext(false);
    stage.classList.toggle("resting", item.type === "rest" || item.type === "guide");
    $("rest").classList.toggle("show", item.type === "rest");
    main.classList.toggle("stillOn", item.type === "rest" || item.type === "guide");

    if (item.type === "exercise" && item.video && item.video.url) {
      main.classList.remove("stillOn");
      startDoubleBuffer(item.video.url);
    } else {
      vid(main).pause();
      if (item.next && item.next.video && item.next.video.url) {
        var pv = vid(standby);
        pv.src = item.next.video.url;
        pv.load();
        showNext(true);
        safePlay(pv);
      }
    }
    startBar(item.durationSec * 1000);
  }

  var barAnim = null;
  function startBar(totalMs) {
    var b = $("bar");
    if (barAnim) {
      barAnim.cancel();
      barAnim = null;
    }
    if (b.animate) {
      barAnim = b.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
        duration: totalMs,
        easing: "linear",
        fill: "forwards",
      });
    }
  }

  function tick(now) {
    if (!playItems.length) return;
    var item = playItems[idx];
    var totalMs = item.durationSec * 1000;
    var el = now - start;
    var left = Math.max(0, Math.ceil((totalMs - el) / 1000));
    $("t").textContent = clock(left);
    if (item.type === "rest") $("rcnt").textContent = String(left);

    if (item.type === "exercise" && item.next) {
      showNext(totalMs - el <= nextLeadSec * 1000);
    }

    if (el >= totalMs) {
      var next = idx + 1;
      if (next >= playItems.length) next = 0;
      beginItem(next, start + totalMs);
    }
  }

  function loop() {
    tick(performance.now());
    setTimeout(loop, 50);
  }

  function collectVideos(program) {
    videosById = {};
    var list = program._videos || program.videos || [];
    for (var i = 0; i < list.length; i++) videosById[list[i].id] = list[i];
    function walk(items) {
      for (var j = 0; j < items.length; j++) {
        var it = items[j];
        if (it.type === "group") walk(it.steps || []);
        else if (it.video) videosById[it.video.id || it.videoId] = it.video;
      }
    }
    walk(program.items || []);
    return Object.keys(videosById).map(function (k) {
      return videosById[k];
    });
  }

  function loadProgram(program) {
    if (!program) return;
    var payload = program.playItems
      ? program
      : { program: program, playItems: window.mvnExpand(program, collectVideos(program)) };
    var prog = payload.program || program;
    var items = payload.playItems || window.mvnExpand(prog, collectVideos(prog));
    if (prog.skin && prog.skin.options) applyOptions(prog.skin.options);
    playItems = items;
    beginItem(0, performance.now());
  }

  // audio (element mode — CDN 없음)
  var A = { on: false, el: {} };
  function enableAudio() {
    if (A.on) return;
    A.on = true;
    $("snd").classList.add("hide");
    var bgm = new Audio(options.musicUrl || "audio/bgm_gym_loop.ogg");
    bgm.loop = true;
    bgm.volume = 0.55;
    A.el.bgm = bgm;
    bgm.play().catch(function () {});
  }
  $("snd").addEventListener("click", enableAudio);
  addEventListener("keydown", function (e) {
    if (!A.on && (e.key === "Enter" || e.keyCode === 13)) {
      e.preventDefault();
      enableAudio();
    }
  });

  addEventListener("resize", fit);
  addEventListener("message", function (ev) {
    var data = ev.data;
    if (!data || data.type !== "mvn:program") return;
    loadProgram(data.program);
  });

  fit();
  place(main, R("slotMain"));
  place(standby, R("slotPv"));
  placeRest();
  loadProgram(DEMO);
  $("snd").focus();
  loop();
})();
