const card = document.querySelector("#tilt-card");

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

animate();
