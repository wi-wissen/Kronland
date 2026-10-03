<template>
  <div class="gmenu" @click.self="$emit('close')">
    <div class="panel gcard" role="dialog" aria-label="Spielmenü">
      <h2>Menü</h2>
      <button class="primary" @click="$emit('close')">Weiterspielen</button>
      <button data-testid="save" @click="$emit('save')">Spiel speichern</button>
      <button :disabled="!hasSave" @click="$emit('load')">Gespeichertes Spiel laden</button>
      <button @click="help = !help">{{ help ? 'Steuerung ausblenden' : 'Steuerung anzeigen' }}</button>
      <div v-if="help" class="help">
        <template v-if="touch">
          <p><b>Tippen</b> wählt aus. Mit Auswahl: <b>Tippen</b> auf Boden, Baum, Haufen, Baustelle oder Feind gibt den Befehl.</p>
          <p><b>1 Finger</b> verschiebt die Karte, <b>2 Finger</b> drehen und zoomen.</p>
        </template>
        <template v-else>
          <p><b>Linksklick</b> wählt aus, <b>Rahmen ziehen</b> wählt mehrere. <b>Rechtsklick</b> gibt den Befehl (laufen, bauen, abbauen, angreifen).</p>
          <p><b>WASD</b> verschiebt, <b>Q/E</b> dreht, <b>Mausrad</b> zoomt. <b>Leertaste</b> pausiert, <b>.</b> wählt untätige Leibeigene.</p>
        </template>
        <p>Arbeiter kommen von selbst, wenn Werkstätten frei sind. Sie brauchen <b>Wohnhaus</b> und <b>Bauernhof</b> in der Nähe, sonst arbeiten sie viel langsamer.</p>
      </div>
      <button class="danger" @click="$emit('quit')">Zum Hauptmenü</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GameMenu',
  props: { hasSave: Boolean, touch: Boolean },
  emits: ['close', 'save', 'load', 'quit'],
  data() { return { help: false }; },
};
</script>

<style>
.gmenu { position: fixed; inset: 0; background: rgba(10, 14, 12, 0.55); display: grid; place-items: center; z-index: 30; padding: 16px; }
.gcard { width: min(380px, 100%); padding: 20px; display: flex; flex-direction: column; gap: 8px; max-height: 90vh; overflow-y: auto; }
.gcard h2 { font-family: var(--display); color: var(--accent); margin: 0 0 4px; }
.gcard .help { color: var(--muted); font-size: 14px; line-height: 1.45; }
.gcard .help p { margin: 0 0 6px; }
.gcard .help b { color: var(--ink); }
.gcard .danger { border-color: var(--bad); color: var(--bad); }
</style>
