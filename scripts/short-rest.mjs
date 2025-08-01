/**
 * Short Rest functionality for Mallindor Rest Module
 * 
 * Short rest rules:
 * - Normal D&D rules, except no using HD to heal
 * - Have to track the number of rests because after 2 per long rest, a level of exhaustion is applied
 * 
 * Approach:
 * - Store the current HD and hit points
 * - Apply a normal D&D short rest
 * - Restore the HD and hit points in case they somehow changed
 * - Allow sorcerers to use HD for sorcery points on the player side
 * - If the counter is at 3+ short rests, apply a level of exhaustion
 * - Add to the short rest counter
 * 
 */
import { saveHP, restoreHP } from './hp.mjs';
import { SocketManager } from './socket.mjs';

export const shortRest = async function () {
  const pcs = game.actors.filter(a => a.type === 'character');

  const content = `<form><div class="form-group">
  <label>Select PCs for short rest:</label>
  <select multiple name="actors" size="${pcs.length}">
    ${pcs.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
  </select></div></form>`;

  new Dialog({
    title: 'Short Rest',
    content,
    buttons: {
      rest: {
        label: 'Apply Short Rest',
        callback: async (html) => {
          const selected = Array.from(html[0].querySelector('select').selectedOptions).map(o => o.value);

          // track which players did what
          const rested = [];
          const exhausted = [];
          const dead = [];

          for (const id of selected) {
            const actor = game.actors.get(id);

            // save the current state of HP and HD
            saveHP(actor);

            // Perform short rest
            // This should restore pact spells, along with any other short rest features and usages
            const result = await actor.shortRest({ dialog: false });
            if (!result) {
              continue;
            }

            // Suppress Hit Dice healing by restoring any that happened (shouldn't be any, but just in case)
            await restoreHP(actor);

            // allow sorcerers to use HD for sorcery points
            SocketManager.assignSorceryPoints(actor.id);

            // Update short rest counter on each actor
            const count = (actor.getFlag('world', 'mallindor.shortRestCount') || 0) + 1;
            await actor.setFlag('world', 'mallindor.shortRestCount', count);
            rested.push(actor.name);

            // Apply exhaustion if more than 2 short rests
            if (count > 2) {
              const currentEx = actor.system.attributes.exhaustion ?? 0;

              if (currentEx >= 6) {
                // they're already dead, still ignore them
                continue;
              }

              const newEx = currentEx + 1;
              await actor.update({ 'system.attributes.exhaustion': newEx });
              exhausted.push(`${actor.name} (Exhaustion ${currentEx} → ${newEx})`);

              if (newEx === 6) {
                dead.push(actor.name);
              }
            }
          }

          if (exhausted.length) {
            ChatMessage.create({
              content: `<strong>Exhaustion gained due to multiple short rests:</strong><br>${exhausted.join('<br>')}`,
              whisper: []
            });
          }

          if (dead.length) {
            ChatMessage.create({
              content: `<strong>The following characters have reached Exhaustion 6 and died:</strong><br>${dead.join('<br>')}`,
              whisper: [game.user.id]
            });
          }
        }
      },
      cancel: { label: 'Cancel' }
    },
    default: 'rest'
  }).render(true);
};
