const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function initSlingshot() {
  const panel = document.querySelector("#experiment-slingshot");
  const status = document.querySelector("#sling-status");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const controls = [];
  let audio;
  let lastDing = -Infinity;
  let shake = 0;
  let shakeFrame = 0;

  function colorAt(value) {
    const hue = value * 360;
    const color = `hsl(${hue} 85% 65%)`;
    const chroma = .7 * .85;
    const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = .65 - chroma / 2;
    const bands = [[chroma,x,0],[x,chroma,0],[0,chroma,x],[0,x,chroma],[x,0,chroma],[chroma,0,x]];
    const rgb = bands[Math.floor(hue / 60) % 6].map(v => Math.round((v + m) * 255));
    document.body.style.setProperty("--theme", color);
    document.body.style.setProperty("--theme-rgb", rgb.join(","));
    document.body.style.setProperty("--theme-secondary", `hsl(${(hue + 48) % 360} 80% 68%)`);
    document.body.style.setProperty("--theme-accent-bg", color);
    document.body.style.setProperty("--blue", color);
    document.body.style.setProperty("--violet", `hsl(${(hue + 48) % 360} 80% 68%)`);
  }

  async function ding(value, force = false) {
    if (!value || (!force && performance.now() - lastDing < 150)) return;
    lastDing = performance.now();
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error("Audio unavailable");
      audio ??= new Audio();
      if (audio.state === "suspended") await audio.resume();
      if (panel.hidden) return;
      const now = audio.currentTime;
      // A short bell with fixed pitch; only its loudness changes with the slider.
      [[1046.5, 1], [2093, .24], [3139.5, .08]].forEach(([frequency, weight]) => {
        const oscillator = audio.createOscillator();
        const envelope = audio.createGain();
        oscillator.frequency.value = frequency;
        envelope.gain.setValueAtTime(.0001, now);
        envelope.gain.exponentialRampToValueAtTime(Math.max(.0001, .22 * value * value * weight), now + .008);
        envelope.gain.exponentialRampToValueAtTime(.0001, now + .65);
        oscillator.connect(envelope).connect(audio.destination);
        oscillator.start(now);
        oscillator.stop(now + .7);
        oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
      });
    } catch {
      status.textContent = "声音暂不可用，请点“试听”重试";
    }
  }

  function stopShake() {
    shake = 0;
    cancelAnimationFrame(shakeFrame);
    shakeFrame = 0;
    document.body.classList.remove("sling-shaking");
    document.body.style.removeProperty("--shake-x");
    document.body.style.removeProperty("--shake-y");
  }

  function shakeTick(time) {
    if (!shake || panel.hidden || document.hidden || reduced.matches) { stopShake(); return; }
    const amplitude = 9 * shake * shake;
    document.body.style.setProperty("--shake-x", `${(Math.sin(time * .068) * amplitude).toFixed(2)}px`);
    document.body.style.setProperty("--shake-y", `${(Math.sin(time * .091 + 1) * amplitude * .65).toFixed(2)}px`);
    shakeFrame = requestAnimationFrame(shakeTick);
  }

  function setShake(value) {
    if (!value || reduced.matches) {
      stopShake();
      if (value && reduced.matches) status.textContent = "已遵循系统的减少动态效果设置";
      return;
    }
    shake = value;
    document.body.classList.add("sling-shaking");
    if (!shakeFrame) shakeFrame = requestAnimationFrame(shakeTick);
  }

  document.querySelectorAll("[data-sling]").forEach(row => {
    const kind = row.dataset.sling;
    const surface = row.querySelector(".sling-surface");
    const thumb = row.querySelector(".sling-thumb");
    const bubble = row.querySelector(".sling-bubble");
    const cord = row.querySelector(".sling-cord");
    const flight = row.querySelector(".sling-flight");
    const targetMark = row.querySelector(".sling-target");
    const output = row.querySelector("output");
    const maximum = kind === "color" ? 360 : 100;
    let value = kind === "color" ? 200 / 360 : kind === "sound" ? .35 : 0;
    let width = 1;
    let x = 0, y = 0, vx = 0, vy = 0;
    let frame = 0, previousTime = 0;
    let pointer = null;
    let gesture;
    let pulled = false;

    const formatted = () => `${Math.round(value * maximum)}${kind === "color" ? "°" : "%"}`;
    function render() {
      thumb.style.transform = `translate(${x}px, ${y}px)`;
      surface.style.setProperty("--sling-value", `${value * 100}%`);
      bubble.textContent = formatted();
      bubble.style.transform = `translate(${clamp(value * width - 15, 0, Math.max(0, width - 35))}px, -2px)`;
      output.value = formatted();
      surface.setAttribute("aria-valuenow", String(Math.round(value * maximum)));
      surface.setAttribute("aria-valuetext", kind === "color" ? `色相 ${formatted()}` : formatted());
    }
    function apply(next, feedback = true) {
      const changed = Math.abs(next - value) > .001;
      value = clamp(next, 0, 1);
      if (kind === "color") colorAt(value);
      if (kind === "sound" && changed && feedback) void ding(value);
      if (kind === "shake") setShake(value);
      render();
    }
    function clearDrawing() {
      [cord, flight, targetMark].forEach(path => path.setAttribute("d", ""));
    }
    function settle(time) {
      const dt = Math.min((time - (previousTime || time - 16)) / 1000, .032);
      previousTime = time;
      // Substeps keep the damped spring stable across 60/120 Hz screens.
      for (let i = 0; i < 4; i++) {
        const step = dt / 4;
        vx += ((value * width - x) * 180 - vx * 19) * step;
        vy += (-y * 180 - vy * 16) * step;
        x += vx * step;
        y += vy * step;
      }
      render();
      if (Math.abs(x - value * width) + Math.abs(y) + Math.abs(vx) + Math.abs(vy) < .15) {
        x = value * width; y = vx = vy = 0; frame = 0; render();
        if (kind === "sound") void ding(value, true);
        return;
      }
      frame = requestAnimationFrame(settle);
    }
    function release(cancelled = false) {
      if (pointer === null) return;
      const id = pointer;
      pointer = null;
      row.classList.remove("is-dragging");
      clearDrawing();
      if (cancelled) apply(gesture.value, false);
      if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
      status.textContent = cancelled ? "已取消调整" : pulled ? "已发射 · 弹性回落" : "已调整";
      if (reduced.matches) {
        x = value * width; y = 0; render();
        if (kind === "sound" && !cancelled) void ding(value, true);
        return;
      }
      vx = pulled ? (value * width - x) * 3 : 0;
      vy = pulled ? -Math.max(180, Math.abs(y) * 5) : 0;
      previousTime = 0;
      frame = requestAnimationFrame(settle);
    }
    surface.addEventListener("pointerdown", event => {
      if (pointer !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
      event.preventDefault();
      cancelAnimationFrame(frame); frame = 0;
      const rect = surface.getBoundingClientRect();
      width = rect.width;
      const start = clamp(event.clientX - rect.left, 0, width);
      gesture = { clientX:event.clientX, clientY:event.clientY, anchor:start, value, rect };
      pointer = event.pointerId;
      pulled = false;
      x = start; y = vx = vy = 0;
      surface.setPointerCapture(pointer);
      surface.focus({ preventScroll:true });
      row.classList.add("is-dragging");
      status.textContent = "拉离轨道，预览弹射落点";
      apply(start / width);
      if (kind === "sound") void ding(value, true);
    });
    surface.addEventListener("pointermove", event => {
      if (event.pointerId !== pointer) return;
      const dx = event.clientX - gesture.clientX;
      const dy = event.clientY - gesture.clientY;
      if (Math.abs(dy) > 18) pulled = true;
      if (!pulled) {
        x = clamp(gesture.anchor + dx, 0, width); y = 0;
        apply(x / width);
        return;
      }
      x = clamp(gesture.anchor + dx * .65, -12, width + 12);
      y = 80 * Math.tanh(dy / 100);
      const target = clamp(gesture.anchor - dx * 1.65, 0, width);
      apply(target / width);
      const anchor = gesture.anchor;
      cord.setAttribute("d", `M ${anchor - 8} 32 L ${x} ${32 + y} L ${anchor + 8} 32`);
      flight.setAttribute("d", `M ${x} ${32 + y} Q ${(x + target) / 2} ${-35 - Math.abs(y) * .45} ${target} 32`);
      targetMark.setAttribute("d", `M ${target} 24 L ${target} 40`);
      status.textContent = "松手发射";
    });
    surface.addEventListener("pointerup", event => { if (event.pointerId === pointer) release(); });
    surface.addEventListener("pointercancel", event => { if (event.pointerId === pointer) release(true); });
    surface.addEventListener("lostpointercapture", event => { if (event.pointerId === pointer) release(true); });
    surface.addEventListener("keydown", event => {
      let next = value;
      if (event.key === "Home") next = 0;
      else if (event.key === "End") next = 1;
      else if (["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"].includes(event.key)) next += (["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : -1) * (event.shiftKey ? 10 : 1) / maximum;
      else return;
      event.preventDefault();
      cancelAnimationFrame(frame); frame = 0;
      apply(next); x = value * width; y = 0; render();
    });
    const reset = () => {
      if (pointer !== null) release(true);
      cancelAnimationFrame(frame); frame = 0;
      if (kind === "shake") { value = 0; stopShake(); }
      x = value * width; y = vx = vy = 0;
      clearDrawing(); row.classList.remove("is-dragging"); render();
    };
    new ResizeObserver(() => {
      width = surface.clientWidth || width;
      if (pointer === null) { x = value * width; y = 0; render(); }
    }).observe(surface);
    controls.push({ kind, reset, getValue:() => value });
    render();
  });

  const resetShake = () => {
    controls.find(control => control.kind === "shake").reset();
    status.textContent = "震动已停止";
  };
  document.querySelector("#sling-ding").addEventListener("click", () => void ding(controls.find(c => c.kind === "sound").getValue(), true));
  document.querySelector("#sling-stop").addEventListener("click", resetShake);
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !panel.hidden) { controls.forEach(c => c.reset()); status.textContent = "已停止"; } });
  document.addEventListener("experiment:selected", event => {
    controls.forEach(control => control.reset());
    if (event.detail.targetId === panel.id) colorAt(controls.find(c => c.kind === "color").getValue());
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) controls.forEach(c => c.reset()); });
  window.addEventListener("blur", () => controls.forEach(c => c.reset()));
  reduced.addEventListener("change", () => { if (reduced.matches) resetShake(); });
}
