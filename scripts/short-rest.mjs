/**
 * Short Rest functionality for Mallindor Rest Module
 */
import { saveHP, restoreHP } from "./hp.mjs";
import { SocketManager } from "./socket.mjs";

export const shortRest = async function () {
  const pcs = game.actors.filter(a => a.type === "character");

  const content = `<form><div class="form-group">
  <label>Select PCs for short rest:</label>
  <select multiple name="actors" size="${pcs.length}">
    ${pcs.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
  </select></div></form>`;

  new Dialog({
    title: "Short Rest",
    content,
    buttons: {
      rest: {
        label: "Apply Short Rest",
        callback: async (html) => {
          const selected = Array.from(html[0].querySelector('select').selectedOptions).map(o => o.value);

          const rested = [];
          const exhausted = [];
          const dead = [];

          for (let id of selected) {
            const actor = game.actors.get(id);
            saveHP(actor);

            // Perform short rest
            // This should restore pact spells, along with any other short rest features and usages
            const result = await actor.shortRest({ dialog: false });
            if (!result) continue;

            // allow sorcerers to use HD for sorcery points
            SocketManager.assignSorceryPoints(actor.id);

            // Suppress Hit Dice healing by restoring any that happened (shouldn't be any, but just in case)
            await restoreHP(actor);

            // Update short rest counter
            const count = actor.getFlag("world", "mallindor.shortRestCount") || 0;
            await actor.setFlag("world", "mallindor.shortRestCount", count + 1);
            rested.push(actor.name);

            // Apply exhaustion if more than 2 short rests
            if (count >= 2) {
              const currentEx = actor.system.attributes.exhaustion ?? 0;

              if (currentEx >= 6) continue;

              const newEx = currentEx + 1;
              await actor.update({ "system.attributes.exhaustion": newEx });
              exhausted.push(`${actor.name} (Exhaustion ${newEx})`);

              if (newEx === 6) {
                dead.push(actor.name);
              }
            }
          }

          if (exhausted.length) {
            ChatMessage.create({
              content: `<strong>Exhaustion gained due to multiple short rests:</strong><br>${exhausted.join("<br>")}`,
              whisper: []
            });
          }

          if (dead.length) {
            ChatMessage.create({
              content: `<strong>The following characters have reached Exhaustion 6 and died:</strong><br>${dead.join("<br>")}`,
              whisper: [game.user.id]
            });
          }
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "rest"
  }).render(true);
};
