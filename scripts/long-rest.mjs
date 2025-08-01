/**
 * Long Rest functionality for Mallindor Rest Module
 */

import { SocketManager } from './socket.mjs';
import { saveHP, restoreHP, addHD } from './hp.mjs';
import { restoreSlots, saveSpells } from './spells.mjs';

/**
 * Long Rest rules:
 * - Recover 1/2 HP lost (rounded up)
 * - Recover 1/2 used spell slot levels (rounded up) (warlocks get full recovery)
 * - Recover 1 HD if you have any spent HD
 * - Characters can then apply HD to heal
 * - No exhaustion recovery
 * - If there was combat or HP loss this day, a group CON save.  Each player's DC is 11+2/level of exhaustion
 *   - On a success (>=50% pass), nothing happens
 *   - On a failure (<50% pass), each player regains 1 level of exhaustion
 * - It also needs to clear the short rest counter
 *
 * Approach:
 * - Save spell slots and HP before rest
 * - Check the exhaustion level
 * - Apply a normal D&D long rest
 * - Reset HP and HD to the proper (penalized recovery) levels
 * - Add on HD if you have any spent HD
 * - Allow players with HD to apply HD to heal
 * - Allow players with spells to reallocate spell slots
 * - Clear the short rest counter
 *
 */
export const longRest = async function () { 
  // Mallindor Custom Long Rest Macro
  // Applies partial healing, exhaustion check, lets players reallocate restored spell slots, and allows HD healing

  const pcs = game.actors.filter(a => a.type === 'character');

  const content = `<form>
    <div style="display: flex; flex-direction: column; gap: 0.5em;">
      <div>
        <label>Select PCs for Mallindor Long Rest:</label><br>
        <select multiple name="actors" size="${pcs.length}" style="width: 100%;">
          ${pcs.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
      </div>
      <div>
        <label><input type="checkbox" name="hadCombat"> Characters had combat or lost HP today</label>
      </div>
    </div>
  </form>`;

  new Dialog({
    title: 'Mallindor Long Rest',
    content,
    buttons: {
      rest: {
        label: 'Apply Long Rest',
        callback: async (html) => {
          const selected = Array.from(html[0].querySelector('select').selectedOptions).map(o => o.value);
          const hadCombat = html.find('[name="hadCombat"]')[0].checked;

          const exhausted = [];
          const dead = [];
          const madeSave = [];
          const failedSave = [];

          for (const id of selected) {
            const actor = game.actors.get(id);
            const playerUser = game.users.find(u => u.active && u.id !== game.user.id && actor.testUserPermission(u, 'OWNER'));

            // 1. Save spell slots, HP, HD, and exhaustion before rest
            const spellSlotsToRestore = saveSpells(actor);
            saveHP(actor);
            const beforeEx = actor.system.attributes.exhaustion ?? 0;

            // 2. Run long rest
            await actor.longRest({ dialog: false });

            // 3. Mallindor rules: partial HP recovery, calculate spell slot recovery value
            const unrecoveredHP = await restoreHP(actor, true);

            // Set spell slots back to pre-rest state so players can reallocate
            const unrecoveredSlots = await restoreSlots(actor);

            // add one HD to the actor
            const addedHD = await addHD(actor);

            // const whisperTo = playerUser ? [playerUser.id, ...ChatMessage.getWhisperRecipients('GM').map(u => u.id)] : ChatMessage.getWhisperRecipients('GM').map(u => u.id);

            if (playerUser) {
              try {
                // Send HD spending message - this will trigger the client on the players side to allow HD for healing
                await SocketManager.assignHitDice(playerUser.id, actor.id);

                // Send reallocation prompt
                if (spellSlotsToRestore > 0) {
                  await SocketManager.assignSpellSlots(playerUser.id, actor.id, spellSlotsToRestore);
                }
              } catch (error) {
                console.error('Mallindor Rest Module | Socket call failed:', error);
              }
            }

            // 4. Exhaustion check
            // first restore the old one in case the long rest reduced it
            await actor.update({ 'system.attributes.exhaustion': beforeEx });

            if (hadCombat) {
              const dc = 11 + 2 * beforeEx;
              const result = await new Roll('1d20 + @abilities.con.mod', actor.getRollData()).roll({ async: true });
              if (result.total >= dc) {
                madeSave.push(actor.name);
              } else {
                failedSave.push(actor.name);
              }
            }

            // clear short rest counter
            await actor.unsetFlag('world', 'mallindor.shortRestCount');

            // send summary
            ChatMessage.create({ content: `<strong>${actor.name}</strong> completed a Mallindor Long Rest. \
              ${unrecoveredHP > 0 ? `HP restoration reduced by ${unrecoveredHP}.` : ''} \
              ${unrecoveredSlots > 0 ? `Pact spell restoration reduced by ${unrecoveredSlots}.` : ''} \
              ${addedHD ? 'One HD has been restored.' : ''} \
              ${spellSlotsToRestore > 0 ? 'Spell slots have not been restored yet.' : ''}`,
             whisper: []
            });
          }

          // check group exhaustion save - have to apply to everyone
          if (madeSave.length < failedSave.length) {
            for (const id of selected) {
              const actor = game.actors.get(id);

              const beforeEx = actor.system.attributes.exhaustion ?? 0;
              const newEx = Math.min(beforeEx + 1, 6);

              await actor.update({ 'system.attributes.exhaustion': newEx });

              if (newEx >= 6) {
                dead.push(actor.name);
              } else {
                exhausted.push(`${actor.name} (Exhaustion ${beforeEx} → ${newEx})`);
              }
            }
          }

          if (exhausted.length) {
            ChatMessage.create({
              content: `<strong>Exhaustion gained due to failed group CON save:</strong><br>${exhausted.join('<br>')}`,
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
