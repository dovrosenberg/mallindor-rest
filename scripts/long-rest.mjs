/**
 * Long Rest functionality for Mallindor Rest Module
 */

import { SocketManager } from "./socket.mjs";
import { saveHP, restoreHP } from "./hp.mjs";

export const longRest = async function () { 
  // Mallindor Custom Long Rest Macro
  // Applies partial healing, exhaustion check, lets players reallocate restored spell slots, and allows HD healing

  const pcs = game.actors.filter(a => a.type === "character");

  const content = `<form>
    <div style="display: flex; flex-direction: column; gap: 0.5em;">
      <div>
        <label>Select PCs for Mallindor Long Rest:</label><br>
        <select multiple name="actors" size="${pcs.length}" style="width: 100%;">
          ${pcs.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
        </select>
      </div>
      <div>
        <label><input type="checkbox" name="hadCombat"> Characters had combat or lost HP today</label>
      </div>
    </div>
  </form>`;

  new Dialog({
    title: "Mallindor Long Rest",
    content,
    buttons: {
      rest: {
        label: "Apply Long Rest",
        callback: async (html) => {
          const selected = Array.from(html[0].querySelector('select').selectedOptions).map(o => o.value);
          const hadCombat = html.find('[name="hadCombat"]')[0].checked;

          for (let id of selected) {
            const actor = game.actors.get(id);

            // 1. Save spell slots and HP before rest
            const savedSlots = {};
            for (let lvl = 1; lvl <= 9; lvl++) {
              savedSlots[`spell${lvl}`] = getProperty(actor, `system.spells.spell${lvl}.value`);
            }
            savedSlots.pact = getProperty(actor, "system.spells.pact.value");

            saveHP(actor);
            
            // 2. Run long rest
            await actor.longRest({ dialog: false });

            // 3. Mallindor rules: partial HP recovery, calculate spell slot recovery value
            const unrecoveredHP = await restoreHP(actor, true);

            // Calculate spell slot recovery (by level total)
            let totalUsed = 0;
            for (let lvl = 1; lvl <= 9; lvl++) {
              const slot = actor.system.spells[`spell${lvl}`];
              totalUsed += (slot.max - slot.value) * lvl;
            }
            totalUsed += (actor.system.spells.pact.max - actor.system.spells.pact.value) * actor.system.spells.pact.level;
            const toRestore = Math.ceil(totalUsed / 2);

            // Set spell slots back to pre-rest state so players can reallocate
            const restoreSlots = {};
            for (let lvl = 1; lvl <= 9; lvl++) {
              restoreSlots[`system.spells.spell${lvl}.value`] = savedSlots[`spell${lvl}`];
            }
            restoreSlots["system.spells.pact.value"] = savedSlots.pact;
            await actor.update(restoreSlots);

            // add one HD to the actor
            HD.value = Math.min(HD.max, HD.value + 1);
            await actor.update({ "system.attributes.hd": HD });

            const playerUser = game.users.find(u => u.active && u.id!==game.user.id && actor.testUserPermission(u, "OWNER"));
            const whisperTo = playerUser ? [playerUser.id, ...ChatMessage.getWhisperRecipients("GM").map(u => u.id)] : ChatMessage.getWhisperRecipients("GM").map(u => u.id);

            // Send reallocation prompt
            if (toRestore > 0) {
              ChatMessage.create({
                content: `<strong>${actor.name}</strong> may reallocate up to <strong>${toRestore}</strong> levels of spell slots.`,
                whisper: []
              });
            }

            // Send HD spending message
            if (playerUser) {

              try {
                await SocketManager.assignHitDice(playerUser.id, actor.id);
              } catch (error) {
                console.error("Mallindor Rest Module | Socket call failed:", error);
              }
            }

            // 4. Exhaustion check
            if (hadCombat) {
              const ex = actor.system.attributes.exhaustion || 0;
              const dc = 11 + 2 * ex;
              const result = await new Roll("1d20 + @abilities.con.mod", actor.getRollData()).roll({ async: true });
              result.toMessage({ flavor: `${actor.name} Long Rest CON Save (DC ${dc})` });
              if (result.total < dc) {
                const newEx = Math.min(ex + 1, 6);
                await actor.update({ "system.attributes.exhaustion": newEx });
                if (newEx >= 6) {
                  ChatMessage.create({
                    content: `<strong>${actor.name}</strong> has died from exhaustion.`,
                    whisper: ChatMessage.getWhisperRecipients("GM")
                  });
                } else {
                  ChatMessage.create({
                    content: `<strong>${actor.name}</strong> gained 1 level of exhaustion (now ${newEx}).`,
                    whisper: ChatMessage.getWhisperRecipients("GM")
                  });
                }
              }
            }

            ChatMessage.create({ content: `<strong>${actor.name}</strong> completed a Mallindor Long Rest. HP restoration reduced by ${unrecoveredHP}. Spell slots have not been restored yet.`, whisper: [] });
          }
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "rest"
  }).render(true);
};
