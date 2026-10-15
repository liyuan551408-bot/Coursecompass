<script setup>
defineProps({
  subjects: { type: Array, default: () => [] },
  modelValue: { type: [Number, String], default: null },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <nav class="subject-nav" aria-label="Course subjects" :aria-disabled="disabled">
    <div class="subject-nav__scroll">
      <button
        type="button"
        class="subject-nav__item"
        :class="{ 'is-active': modelValue === '' || modelValue === null || modelValue === undefined }"
        :disabled="disabled"
        @click="emit('update:modelValue', null)"
      >
        All courses
      </button>
      <button
        v-for="subject in subjects"
        :key="subject.id"
        type="button"
        class="subject-nav__item"
        :class="{ 'is-active': Number(modelValue) === Number(subject.id) }"
        :disabled="disabled"
        @click="emit('update:modelValue', subject.id)"
      >
        <span><b>{{ subject.code }}</b>{{ subject.name }}</span>
        <small>{{ subject._count?.courses ?? 0 }}</small>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.subject-nav {
  margin-bottom: 16px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: rgba(255, 255, 255, .82);
  box-shadow: 0 8px 24px rgba(50, 37, 79, .04);
}

.subject-nav__scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: thin;
}

.subject-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  min-height: 42px;
  padding: 8px 13px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  transition: color .18s ease, background .18s ease, border-color .18s ease, transform .18s ease;
}

.subject-nav__item > span {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.subject-nav__item b {
  color: var(--text-h);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .04em;
}

.subject-nav__item small {
  display: grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(114, 81, 232, .09);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.subject-nav__item:hover:not(:disabled) {
  border-color: var(--accent-border);
  background: var(--accent-bg);
  color: var(--accent);
  transform: translateY(-1px);
}

.subject-nav__item.is-active {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
  box-shadow: 0 5px 14px rgba(114, 81, 232, .2);
}

.subject-nav__item.is-active b,
.subject-nav__item.is-active small {
  color: white;
}

.subject-nav__item.is-active small {
  background: rgba(255, 255, 255, .18);
}

.subject-nav__item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.subject-nav__item:disabled {
  cursor: wait;
  opacity: .58;
}
</style>
