<script setup lang="ts"></script>

<template>
  <router-view v-slot="{ Component }">
    <Suspense>
      <component :is="Component" />
      <template #fallback>
        <main class="shell skeleton-shell" aria-label="页面加载中">
          <div class="skeleton-card skeleton-card--hero"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line skeleton-line--short"></div>
        </main>
      </template>
    </Suspense>
  </router-view>
</template>

<style>
:root {
  font-family:
    'Iowan Old Style', 'Songti SC', 'Noto Serif SC', 'PingFang SC', 'Helvetica Neue', serif;
  color: #263126;
  background: #f3eadb;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  --ink: #263126;
  --muted: #6d7568;
  --paper: #fff9ef;
  --paper-strong: #fff4dc;
  --line: rgba(38, 49, 38, 0.12);
  --green: #315f43;
  --green-2: #74936f;
  --gold: #c78f39;
  --red: #a33d2f;
  --shadow: 0 24px 60px rgba(61, 48, 27, 0.16);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  background:
    radial-gradient(circle at 8% 4%, rgba(116, 147, 111, 0.22), transparent 28%),
    radial-gradient(circle at 92% 0%, rgba(199, 143, 57, 0.18), transparent 30%), #f3eadb;
}

button,
input,
select {
  font: inherit;
}

button {
  border: 0;
}

.shell {
  width: min(100%, 480px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 22px 18px 96px;
}

.card {
  border: 1px solid var(--line);
  border-radius: 28px;
  background: rgba(255, 249, 239, 0.88);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(49, 95, 67, 0.2);
  border-radius: 999px;
  padding: 7px 11px;
  color: var(--green);
  background: rgba(255, 255, 255, 0.52);
  font-size: 12px;
  letter-spacing: 0.05em;
}

.primary-button,
.ghost-button,
.danger-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  border-radius: 999px;
  padding: 0 18px;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.primary-button {
  color: #fffaf1;
  background: linear-gradient(135deg, #244d35, #6a7f3a);
  box-shadow: 0 14px 30px rgba(49, 95, 67, 0.24);
}

.ghost-button {
  color: var(--green);
  border: 1px solid rgba(49, 95, 67, 0.22);
  background: rgba(255, 255, 255, 0.56);
}

.danger-button {
  color: #fffaf1;
  background: linear-gradient(135deg, #a33d2f, #d5843d);
}

.primary-button:active,
.ghost-button:active,
.danger-button:active {
  transform: translateY(1px) scale(0.99);
}

.bottom-nav {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.bottom-nav__inner {
  width: min(100%, 480px);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 10px 16px 16px;
  background: linear-gradient(to top, rgba(243, 234, 219, 0.96), rgba(243, 234, 219, 0.5));
  pointer-events: auto;
}

.bottom-nav a {
  color: var(--muted);
  text-decoration: none;
  text-align: center;
  border-radius: 18px;
  padding: 10px 8px;
  background: rgba(255, 249, 239, 0.72);
  border: 1px solid var(--line);
  font-size: 13px;
}

.bottom-nav a.router-link-active {
  color: #fffaf1;
  background: var(--green);
}

.skeleton-shell {
  display: grid;
  gap: 14px;
}

.skeleton-card,
.skeleton-line {
  border-radius: 28px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.45),
    rgba(255, 255, 255, 0.82),
    rgba(255, 255, 255, 0.45)
  );
  background-size: 220% 100%;
  animation: shimmer 1.2s infinite;
}

.skeleton-card--hero {
  height: 240px;
}
.skeleton-line {
  height: 18px;
}
.skeleton-line--short {
  width: 64%;
}

@keyframes shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}

@media (min-width: 760px) {
  .shell {
    padding-top: 36px;
  }
}
</style>
