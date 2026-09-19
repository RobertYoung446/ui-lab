const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function initSharedElement() {
  const stage = document.querySelector("#shared-stage");
  const card = document.querySelector("#shared-card");
  const open = document.querySelector("#shared-open");
  const close = document.querySelector("#shared-close");
  const detail = card.querySelector(".shared-card__detail");

  const setExpanded = (expanded) => {
    stage.classList.toggle("is-expanded", expanded);
    open.setAttribute("aria-expanded", String(expanded));
    detail.setAttribute("aria-hidden", String(!expanded));
    open.tabIndex = expanded ? -1 : 0;
    close.tabIndex = expanded ? 0 : -1;
  };

  open.addEventListener("click", () => setExpanded(true));

  card.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && stage.classList.contains("is-expanded")) {
      setExpanded(false);
      open.focus();
    }
  });

  close.addEventListener("click", (event) => {
    event.stopPropagation();
    setExpanded(false);
    open.focus();
  });

  close.tabIndex = -1;
}

function initMagneticChart() {
  const plot = document.querySelector("#chart-plot");
  const cursor = document.querySelector("#chart-cursor");
  const ticker = document.querySelector("#chart-ticker");
  const label = document.querySelector("#chart-label");
  const circles = [...document.querySelectorAll(".chart-points circle")];
  const values = [312, 386, 354, 428, 401, 512, 466];
  const labels = ["MON · 15", "TUE · 16", "WED · 17", "THU · 18", "FRI · 19", "SAT · 20", "SUN · 21"];
  const svgPoints = [[40, 183], [143, 130], [247, 157], [350, 76], [453, 111], [557, 48], [660, 91]];
  const state = { position: 3, x: 0, y: 0, targetX: 0, targetY: 0, vx: 0, vy: 0, dragging: false };

  const tracks = Array.from({ length: 3 }, () => {
    const digit = document.createElement("span");
    digit.className = "ticker-digit";
    const track = document.createElement("span");
    track.className = "ticker-digit__track";
    for (let number = 0; number <= 9; number += 1) {
      const item = document.createElement("span");
      item.textContent = String(number);
      track.append(item);
    }
    digit.append(track);
    ticker.append(digit);
    return track;
  });

  function setTicker(value) {
    String(value).padStart(3, "0").split("").forEach((digit, index) => {
      tracks[index].style.transform = `translateY(-${Number(digit)}em)`;
    });
    ticker.setAttribute("aria-label", `当前数值 ${value}`);
  }

  function selectPosition(position, immediate = false) {
    const rawPosition = Math.max(0, Math.min(values.length - 1, position));
    const nearest = Math.round(rawPosition);
    const distance = Math.abs(rawPosition - nearest);
    const magneticPull = Math.max(0, 1 - distance / 0.22) * 0.42;
    const magneticPosition = rawPosition + (nearest - rawPosition) * magneticPull;
    const leftIndex = Math.floor(magneticPosition);
    const rightIndex = Math.min(values.length - 1, leftIndex + 1);
    const progress = magneticPosition - leftIndex;
    const svgX = svgPoints[leftIndex][0] + (svgPoints[rightIndex][0] - svgPoints[leftIndex][0]) * progress;
    const svgY = svgPoints[leftIndex][1] + (svgPoints[rightIndex][1] - svgPoints[leftIndex][1]) * progress;
    const value = Math.round(values[leftIndex] + (values[rightIndex] - values[leftIndex]) * progress);
    const width = plot.clientWidth || 700;

    state.position = magneticPosition;
    state.targetX = (svgX / 700) * width;
    state.targetY = (svgY / 260) * 255;
    if (immediate || reducedMotion.matches) {
      state.x = state.targetX;
      state.y = state.targetY;
      state.vx = 0;
      state.vy = 0;
    }
    setTicker(value);
    label.textContent = leftIndex === rightIndex
      ? labels[leftIndex]
      : `${labels[leftIndex].slice(0, 3)} → ${labels[rightIndex].slice(0, 3)} · ${Math.round(progress * 100)}%`;
    circles.forEach((circle, circleIndex) => circle.classList.toggle("is-active", Math.abs(circleIndex - magneticPosition) < 0.075));
  }

  function selectFromClientX(clientX) {
    const rect = plot.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    selectPosition(ratio * (values.length - 1));
  }

  plot.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse") {
      state.dragging = true;
      plot.setPointerCapture?.(event.pointerId);
    }
    selectFromClientX(event.clientX);
  });
  plot.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" || state.dragging) selectFromClientX(event.clientX);
  });
  const endDrag = () => { state.dragging = false; };
  plot.addEventListener("pointerup", endDrag);
  plot.addEventListener("pointercancel", endDrag);
  plot.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    selectPosition(state.position + (event.key === "ArrowRight" ? 0.2 : -0.2));
  });

  function animate() {
    state.vx = (state.vx + (state.targetX - state.x) * 0.16) * 0.68;
    state.vy = (state.vy + (state.targetY - state.y) * 0.16) * 0.68;
    state.x += state.vx;
    state.y += state.vy;
    cursor.style.setProperty("--cursor-x", `${state.x.toFixed(2)}px`);
    cursor.style.setProperty("--cursor-y", `${state.y.toFixed(2)}px`);
    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", () => selectPosition(state.position, true));
  document.addEventListener("experiment:selected", (event) => {
    if (event.detail.targetId === "experiment-chart") {
      requestAnimationFrame(() => selectPosition(state.position, true));
    }
  });
  requestAnimationFrame(() => selectPosition(3, true));
  animate();
}

function initBottomSheet() {
  const stage = document.querySelector("#sheet-stage");
  const sheet = document.querySelector("#bottom-sheet");
  const handle = document.querySelector("#sheet-handle");
  const backdrop = document.querySelector("#sheet-backdrop");
  const state = { y: 250, target: 250, velocity: 0, dragging: false, lastY: 0, lastTime: 0, anchorIndex: 1 };

  const anchors = () => {
    const height = stage.clientHeight || 610;
    return [58, Math.round(height * 0.41), height - 96];
  };

  function nearestAnchor(value) {
    const points = anchors();
    return points.reduce((best, point, index) => Math.abs(point - value) < Math.abs(points[best] - value) ? index : best, 0);
  }

  handle.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    state.velocity = 0;
    state.lastY = event.clientY;
    state.lastTime = event.timeStamp;
    handle.setPointerCapture?.(event.pointerId);
  });

  handle.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    const points = anchors();
    const delta = event.clientY - state.lastY;
    const elapsed = Math.max(8, event.timeStamp - state.lastTime);
    let next = state.y + delta;
    if (next < points[0]) next = points[0] + (next - points[0]) * 0.24;
    if (next > points[2]) next = points[2] + (next - points[2]) * 0.24;
    state.velocity = delta / elapsed;
    state.y = next;
    state.target = next;
    state.lastY = event.clientY;
    state.lastTime = event.timeStamp;
  });

  function release() {
    if (!state.dragging) return;
    state.dragging = false;
    const predicted = state.y + state.velocity * 190;
    state.anchorIndex = nearestAnchor(predicted);
    state.target = anchors()[state.anchorIndex];
    state.velocity *= 16;
  }

  handle.addEventListener("pointerup", release);
  handle.addEventListener("pointercancel", release);
  handle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    state.anchorIndex = Math.max(0, Math.min(2, state.anchorIndex + (event.key === "ArrowDown" ? 1 : -1)));
    state.target = anchors()[state.anchorIndex];
  });

  function animate() {
    if (!state.dragging) {
      if (reducedMotion.matches) {
        state.y = state.target;
        state.velocity = 0;
      } else {
        state.velocity = (state.velocity + (state.target - state.y) * 0.075) * 0.77;
        state.y += state.velocity;
      }
    }
    const points = anchors();
    const openness = 1 - Math.max(0, Math.min(1, (state.y - points[0]) / (points[2] - points[0])));
    sheet.style.setProperty("--sheet-y", `${state.y.toFixed(2)}px`);
    backdrop.style.setProperty("--sheet-dim", (openness * 0.38).toFixed(3));
    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", () => {
    state.target = anchors()[state.anchorIndex];
  });
  document.addEventListener("experiment:selected", (event) => {
    if (event.detail.targetId === "experiment-sheet") {
      requestAnimationFrame(() => {
        state.y = anchors()[state.anchorIndex];
        state.target = state.y;
      });
    }
  });
  animate();
}

function initCascade() {
  const list = document.querySelector("#cascade-list");
  const replay = document.querySelector("#cascade-replay");
  const play = () => {
    list.classList.remove("is-playing");
    void list.offsetWidth;
    list.classList.add("is-playing");
  };
  replay.addEventListener("click", play);
  document.addEventListener("experiment:selected", (event) => {
    if (event.detail.targetId === "experiment-cascade") play();
  });
}

function initTactileButton() {
  const button = document.querySelector("#tactile-button");
  const readout = document.querySelector("#tactile-scale");
  const state = { scale: 1, target: 1, velocity: 0, pressed: false };

  const press = (event) => {
    if (event?.pointerType === "mouse" && event.button !== 0) return;
    state.pressed = true;
    state.target = 0.96;
    state.velocity = 0;
    button.classList.add("is-pressed");
    if (event?.pointerId != null) button.setPointerCapture?.(event.pointerId);
  };

  const release = () => {
    if (!state.pressed) return;
    state.pressed = false;
    state.target = 1;
    state.velocity = reducedMotion.matches ? 0 : 0.018;
    button.classList.remove("is-pressed");
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("keydown", (event) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) press();
  });
  button.addEventListener("keyup", (event) => {
    if (event.key === " " || event.key === "Enter") release();
  });
  button.addEventListener("blur", release);

  function animate() {
    if (reducedMotion.matches) {
      state.scale = state.target;
    } else {
      state.velocity = (state.velocity + (state.target - state.scale) * 0.18) * 0.7;
      state.scale += state.velocity;
    }
    button.style.setProperty("--tactile-scale", state.scale.toFixed(4));
    readout.textContent = state.scale.toFixed(3);
    readout.previousElementSibling.previousElementSibling.textContent = state.pressed ? "PRESS" : Math.abs(state.velocity) > 0.0005 ? "SPRING" : "REST";
    requestAnimationFrame(animate);
  }
  animate();
}

export function initAdvancedExperiments() {
  initSharedElement();
  initMagneticChart();
  initBottomSheet();
  initCascade();
  initTactileButton();
}
