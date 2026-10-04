<template>
  <span class="costs" :class="{ light }">
    <span v-for="[r, n] in cost" :key="r" class="cost num" :class="{ short: have && have[r] < n }" :aria-label="n + ' ' + $name.res(r)">
      <Icon :name="r" />{{ n }}
    </span>
  </span>
</template>

<script>
export default {
  name: 'CostList',
  props: {
    /** [[resource, amount], …] */
    cost: { type: Array, required: true },
    /** Stock to compare against (missing shown red) */
    have: { type: Object, default: null },
    /** on parchment */
    light: Boolean,
  },
};
</script>

<style>
.costs { display: inline-flex; flex-wrap: wrap; gap: 0.125rem 0.5rem; align-items: center; font-size: var(--fs-sm); font-weight: 700; color: var(--ink); }
.cost { display: inline-flex; align-items: center; gap: 0.1875rem; white-space: nowrap; }
.cost .ico { width: 1rem; height: 1rem; }
.cost.short { color: var(--bad); }
.costs.light { color: var(--parch-ink); }
.costs.light .cost.short { color: #b0301b; }
</style>
