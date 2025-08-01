/**
 * Relax Rest functionality for Mallindor Rest Module
 */

/**
 * Relax Rest rules:
 * - This is for a 24-hour break with no combat, HP loss, or spellcasting above a cantrip
 * - It fully restores everything and clears one level of exhaustion - so essentially a normal D&D long rest
 * - It also needs to clear the short rest counter
 *
 * Approach:
 * - Check the exhaustion level
 * - Apply a normal D&D long rest
 * - Reduce the exhaustion level by the number of days
 * - Clear the short rest counter
 *
 */
export const relaxRest = async function () {
  const pcs = game.actors.filter(a => a.type === 'character');

  const content = `<form>
    <div class="form-group">
      <label>How many days of downtime?</label>
      <input type="number" name="days" value="1" min="1" />
    </div>
    <div class="form-group">
      <label>Select PCs to apply recovery:</label>
      <select multiple name="actors" size="${pcs.length}">
        ${pcs.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
      </select>
    </div>
  </form>`;

  new Dialog({
    title: '24-Hour Downtime Recovery',
    content,
    buttons: {
      rest: {
        label: 'Apply Recovery',
        callback: async (html) => {
          const form = html[0];
          const days = parseInt(form.querySelector('input[name="days"]').value);
          const selected = Array.from(form.querySelector('select').selectedOptions).map(o => o.value);

          const recovered = [];

          for (const id of selected) {
            const actor = game.actors.get(id);

            // check exhaustion level
            const beforeEx = actor.system.attributes.exhaustion ?? 0;

            // Run system-defined long rest
            const result = await actor.longRest({ dialog: false });
            if (!result) {
              continue;
            }

            // Reduce exhaustion manually
            const newEx = Math.max(0, beforeEx - days);
            await actor.update({ 'system.attributes.exhaustion': newEx });

            // Clear rest tracking flag
            await actor.unsetFlag('world', 'mallindor.shortRestCount');

            recovered.push(`${actor.name} (Exhaustion ${beforeEx} → ${newEx})`);
          }

          if (recovered.length) {
            ChatMessage.create({
              content: `<strong>🛌 ${days}-Day Downtime Recovery:</strong><br>${recovered.join('<br>')}`,
              whisper: []
            });
          }
        }
      },
      cancel: { label: 'Cancel' }
    },
    default: 'rest'
  }).render(true);
};
