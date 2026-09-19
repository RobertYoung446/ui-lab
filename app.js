const card = document.querySelector("#tilt-card");
const experimentTabs = [...document.querySelectorAll("[data-experiment-target]")];
const experiments = [...document.querySelectorAll(".experiment")];
const morphStage = document.querySelector("#morph-stage");
const morphShell = document.querySelector("#morph-shell");
const morphTrigger = document.querySelector("#morph-trigger");
const morphClose = document.querySelector("#morph-close");
const morphPanel = document.querySelector("#morph-panel-content");

const state = {
  active: false,
  pointerId: null,
  currentX: 0,
  currentY: 0,
  targetX: 0,
  targetY: 0,
  velocityX: 0,
  velocityY: 0,
  shineX: 50,
  shineY: 50,
  targetShineX: 50,
  targetShineY: 50,
};

const MAX_TILT = 14;
const FOLLOW = 0.22;
const SPRING = 0.105;
const DAMPING = 0.78;

const morphState = {
  progress: 0,
  target: 0,
  velocity: 0,
  startWidth: 186,
  startHeight: 58,
  endWidth: 500,
  endHeight: 360,
};

function selectExperiment(targetId) {
  experiments.forEach((experiment) => {
    experiment.hidden = experiment.id !== targetId;
  });

  experimentTabs.forEach((tab) => {
    const selected = tab.dataset.experimentTarget === targetId;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });

  if (targetId === "experiment-morph") {
    requestAnimationFrame(updateMorphBounds);
  }
}

function updateMorphBounds() {
  const availableWidth = Math.max(280, morphStage.clientWidth - 64);
  morphState.endWidth = Math.min(500, availableWidth);
  morphState.endHeight = morphStage.clientWidth < 520 ? 350 : 360;
}

function setMorphOpen(open) {
  morphState.target = open ? 1 : 0;
  morphShell.classList.toggle("is-opening", open);
  morphShell.classList.toggle("is-closing", !open);
  morphTrigger.setAttribute("aria-expanded", String(open));
  morphPanel.setAttribute("aria-hidden", String(!open));
  morphPanel.inert = !open;
}

function renderMorph() {
  const stiffness = 0.115;
  const damping = 0.82;
  const distance = morphState.target - morphState.progress;

  morphState.velocity = (morphState.velocity + distance * stiffness) * damping;
  morphState.progress += morphState.velocity;

  if (Math.abs(distance) < 0.0005 && Math.abs(morphState.velocity) < 0.0005) {
    morphState.progress = morphState.target;
    morphState.velocity = 0;
  }

  const p = Math.min(1.035, Math.max(-0.035, morphState.progress));
  const visualP = Math.min(1, Math.max(0, p));
  const width = morphState.startWidth + (morphState.endWidth - morphState.startWidth) * p;
  const height = morphState.startHeight + (morphState.endHeight - morphState.startHeight) * p;
  const radius = 29 + (32 - 29) * visualP;
  const pulse = Math.min(1, Math.abs(morphState.velocity) * 13);

  morphShell.style.setProperty("--morph-width", `${width.toFixed(2)}px`);
  morphShell.style.setProperty("--morph-height", `${height.toFixed(2)}px`);
  morphShell.style.setProperty("--morph-radius", `${radius.toFixed(2)}px`);
  morphShell.style.setProperty("--morph-open", visualP.toFixed(4));
  morphShell.style.setProperty("--morph-pulse", pulse.toFixed(4));

  const settledOpen = morphState.target === 1 && morphState.progress > 0.995 && Math.abs(morphState.velocity) < 0.005;
  const settledClosed = morphState.target === 0 && morphState.progress < 0.005 && Math.abs(morphState.velocity) < 0.005;
  morphShell.classList.toggle("is-open", settledOpen);

  if (settledOpen) morphShell.classList.remove("is-opening");
  if (settledClosed) morphShell.classList.remove("is-closing");

  requestAnimationFrame(renderMorph);
}

function updateTarget(clientX, clientY) {
  const rect = card.getBoundingClientRect();
  const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  const y = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);

  state.targetX = (0.5 - y) * MAX_TILT * 2;
  state.targetY = (x - 0.5) * MAX_TILT * 2;
  state.targetShineX = x * 100;
  state.targetShineY = y * 100;
}

function beginInteraction(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;

  state.active = true;
  state.pointerId = event.pointerId;
  state.velocityX = 0;
  state.velocityY = 0;
  card.setPointerCapture?.(event.pointerId);
  card.style.setProperty("--press", "1");
  card.style.setProperty("--scale", "1.025");
  updateTarget(event.clientX, event.clientY);
}

function moveInteraction(event) {
  if (!state.active || event.pointerId !== state.pointerId) return;
  updateTarget(event.clientX, event.clientY);
}

function endInteraction(event) {
  if (!state.active || (event.pointerId != null && event.pointerId !== state.pointerId)) return;

  state.active = false;
  state.pointerId = null;
  state.targetX = 0;
  state.targetY = 0;
  state.targetShineX = 50;
  state.targetShineY = 50;
  card.style.setProperty("--press", "0");
  card.style.setProperty("--scale", "1");
}

function animate() {
  if (state.active) {
    state.currentX += (state.targetX - state.currentX) * FOLLOW;
    state.currentY += (state.targetY - state.currentY) * FOLLOW;
  } else {
    state.velocityX += (state.targetX - state.currentX) * SPRING;
    state.velocityY += (state.targetY - state.currentY) * SPRING;
    state.velocityX *= DAMPING;
    state.velocityY *= DAMPING;
    state.currentX += state.velocityX;
    state.currentY += state.velocityY;
  }

  state.shineX += (state.targetShineX - state.shineX) * 0.16;
  state.shineY += (state.targetShineY - state.shineY) * 0.16;

  card.style.setProperty("--rotate-x", `${state.currentX.toFixed(3)}deg`);
  card.style.setProperty("--rotate-y", `${state.currentY.toFixed(3)}deg`);
  card.style.setProperty("--card-x", `${state.shineX.toFixed(2)}%`);
  card.style.setProperty("--card-y", `${state.shineY.toFixed(2)}%`);

  requestAnimationFrame(animate);
}

card.addEventListener("pointerdown", beginInteraction);
card.addEventListener("pointermove", moveInteraction);
card.addEventListener("pointerup", endInteraction);
card.addEventListener("pointercancel", endInteraction);
card.addEventListener("lostpointercapture", endInteraction);

card.addEventListener("keydown", (event) => {
  const amount = event.shiftKey ? 4 : 2;

  if (event.key === "ArrowUp") state.targetX = Math.min(MAX_TILT, state.targetX + amount);
  else if (event.key === "ArrowDown") state.targetX = Math.max(-MAX_TILT, state.targetX - amount);
  else if (event.key === "ArrowLeft") state.targetY = Math.max(-MAX_TILT, state.targetY - amount);
  else if (event.key === "ArrowRight") state.targetY = Math.min(MAX_TILT, state.targetY + amount);
  else return;

  event.preventDefault();
  state.active = true;
  card.style.setProperty("--press", "1");
});

card.addEventListener("keyup", () => endInteraction({ pointerId: null }));
card.addEventListener("blur", () => endInteraction({ pointerId: null }));

experimentTabs.forEach((tab) => {
  tab.addEventListener("click", () => selectExperiment(tab.dataset.experimentTarget));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
    const nextIndex = (experimentTabs.indexOf(tab) + direction + experimentTabs.length) % experimentTabs.length;
    experimentTabs[nextIndex].focus();
    selectExperiment(experimentTabs[nextIndex].dataset.experimentTarget);
  });
});

morphTrigger.addEventListener("click", () => setMorphOpen(true));
morphClose.addEventListener("click", () => {
  setMorphOpen(false);
  window.setTimeout(() => morphTrigger.focus(), 180);
});

morphShell.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && morphState.target === 1) {
    setMorphOpen(false);
    morphTrigger.focus();
  }
});

window.addEventListener("resize", updateMorphBounds);

animate();
updateMorphBounds();
renderMorph();
