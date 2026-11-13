/* ES2017 — @mvn/shared expand() 와 동일 규칙 */
(function (root) {
  "use strict";

  function stepLabel(step, videos) {
    if (step.label && String(step.label).trim()) return String(step.label).trim();
    if (step.videoId && videos[step.videoId]) return videos[step.videoId].name;
    if (step.type === "rest") return "휴식";
    if (step.type === "guide") return "안내";
    return "운동";
  }

  function flatten(program, videos) {
    var flat = [];
    var items = program.items || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.type === "group") {
        var repeat = Math.max(2, Math.floor(item.repeat || 2));
        for (var r = 0; r < repeat; r++) {
          for (var s = 0; s < item.steps.length; s++) {
            var st = item.steps[s];
            flat.push({
              id: st.id,
              type: st.type,
              durationSec: st.durationSec,
              videoId: st.videoId,
              label: st.label,
              text: st.text,
              video: st.videoId ? videos[st.videoId] : undefined,
            });
          }
        }
      } else {
        flat.push({
          id: item.id,
          type: item.type,
          durationSec: item.durationSec,
          videoId: item.videoId,
          label: item.label,
          text: item.text,
          video: item.videoId ? videos[item.videoId] : undefined,
        });
      }
    }
    return flat;
  }

  function findNextExercise(flat, fromIndex) {
    var afterRest = false;
    for (var i = fromIndex + 1; i < flat.length; i++) {
      if (flat[i].type === "rest") {
        afterRest = true;
        continue;
      }
      if (flat[i].type === "exercise") return { step: flat[i], afterRest: afterRest };
    }
    return null;
  }

  function mergeVideos(target, source) {
    if (!source) return;
    if (Array.isArray(source)) {
      for (var i = 0; i < source.length; i++) {
        if (source[i] && source[i].id) target[source[i].id] = source[i];
      }
      return;
    }
    var keys = Object.keys(source);
    for (var k = 0; k < keys.length; k++) {
      var id = keys[k];
      if (source[id]) target[id] = source[id];
    }
  }

  function expand(program, videoList) {
    var videos = {};
    mergeVideos(videos, videoList);
    if (program) {
      mergeVideos(videos, program.videos);
      mergeVideos(videos, program._videos);
    }
    var flat = flatten(program, videos);
    var out = [];
    for (var index = 0; index < flat.length; index++) {
      var step = flat[index];
      var found = findNextExercise(flat, index);
      var next;
      if (found) {
        var exerciseLabel = stepLabel(found.step, videos);
        var label =
          step.type !== "rest" && found.afterRest ? "휴식 후 · " + exerciseLabel : exerciseLabel;
        next = {
          label: label,
          video: found.step.video,
          afterRest: step.type === "rest" ? false : found.afterRest,
        };
      }
      out.push({
        index: index,
        stepId: step.id,
        type: step.type,
        durationSec: step.durationSec,
        video: step.video,
        label: stepLabel(step, videos),
        next: next,
      });
    }
    return out;
  }

  root.mvnExpand = expand;
})(typeof window !== "undefined" ? window : globalThis);
