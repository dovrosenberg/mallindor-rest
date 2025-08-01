let socket;

Hooks.once("socketlib.ready", () => {
  console.log("Mallindor Rest Module | SocketLib Ready");
  socket = socketlib.registerModule("mallindor-rest");
  debugger;
  console.log("Mallindor Rest Module | Socket registered:", socket);
  
  socket.register("showShortRestDialog", async (actorId) => {
    debugger;
    const actor = game.actors.get(actorId);
    
    if (!actor || !actor.isOwner) {
      console.log("Mallindor Rest Module | Exiting - no actor or not owner");
      return;
    }

    console.log("Mallindor Rest Module | About to show short rest dialog");

    // show the dialog to allow the player to use HD
    await actor.shortRest({ dialog: true });

    // Reset pact slots if needed
    const pact = actor.system.spells.pact;
    if (pact?.max != null) {
      await actor.update({ "system.spells.pact.value": pact.max });
    }
  });
  
  console.log("Mallindor Rest Module | showShortRestDialog function registered");
});

Hooks.once("ready", () => {
  // Add CSS rule to hide the Rest Configuration fieldset with newDay checkbox and then the button
  const style = document.createElement('style');
  style.textContent = 'fieldset:has([name="newDay"]) { display: none !important; }';
  document.head.appendChild(style);

  const buttonStyle = document.createElement('style');
  buttonStyle.textContent = '.dnd5e2.short-rest .form-footer { display: none !important; }';
  document.head.appendChild(buttonStyle);

  // Socket listener to trigger above hook remotely (e.g. GM initiates for players)
  game.socket.on("module.mallindor-rest", (data) => {
    if (data.type === "shortRestPrompt" && game.user.id === data.userId) {
      Hooks.callAll("mallindor:shortRestPrompt", data.actorId);
    }
  });

  game.mallindorRest = {

    //////////////////////////////////////////////////////
    // Short Rest
    //////////////////////////////////////////////////////
    shortRest: async function () {
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
                const preHP = actor.system.attributes.hp.value;
                const preHD = actor.system.attributes.hd;

                // Perform short rest
                const result = await actor.shortRest({ dialog: false });
                if (!result) continue;

                // Suppress Hit Dice healing
                await actor.update({
                  "system.attributes.hp.value": preHP,
                  "system.attributes.hd": preHD
                });

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
    },
    
    //////////////////////////////////////////////////////
    // Relax Rest
    //////////////////////////////////////////////////////
    relaxRest: async function () {
      const pcs = game.actors.filter(a => a.type === "character");

      const content = `<form>
        <div class="form-group">
          <label>How many days of downtime?</label>
          <input type="number" name="days" value="1" min="1" />
        </div>
        <div class="form-group">
          <label>Select PCs to apply recovery:</label>
          <select multiple name="actors" size="${pcs.length}">
            ${pcs.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
          </select>
        </div>
      </form>`;
      
      new Dialog({
        title: "24-Hour Downtime Recovery",
        content,
        buttons: {
          rest: {
            label: "Apply Recovery",
            callback: async (html) => {
              const form = html[0];
              const days = parseInt(form.querySelector('input[name="days"]').value);
              const selected = Array.from(form.querySelector('select').selectedOptions).map(o => o.value);
      
              const recovered = [];
      
              for (let id of selected) {
                const actor = game.actors.get(id);
      
                const beforeEx = actor.system.attributes.exhaustion ?? 0;
      
                // Run system-defined long rest
                const result = await actor.longRest({ dialog: false });
                if (!result) continue;
      
                // Reduce exhaustion manually
                const newEx = Math.max(0, beforeEx - days);
                await actor.update({ "system.attributes.exhaustion": newEx });
      
                // Clear rest tracking flags
                await actor.unsetFlag("world", "mallindor.shortRestCount");
                await actor.unsetFlag("world", "mallindor.hadCombat");
      
                recovered.push(`${actor.name} (Exhaustion ${beforeEx} → ${newEx})`);
              }
      
              if (recovered.length) {
                ChatMessage.create({
                  content: `<strong>🛌 ${days}-Day Downtime Recovery:</strong><br>${recovered.join("<br>")}`,
                  whisper: [],
                });
              }
            }
          },
          cancel: { label: "Cancel" }
        },
        default: "rest"
      }).render(true);
    },
    
    //////////////////////////////////////////////////////
    // Long Rest
    //////////////////////////////////////////////////////
    longRest: async function () { 
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

                const hp = actor.system.attributes.hp;
                const maxHP = hp.max;
                const recoveredHP = Math.ceil((maxHP - hp.value) / 2);
                const HD = actor.system.attributes.hd;
                
                // 2. Run long rest
                await actor.longRest({ dialog: false });

                // 3. Mallindor rules: partial HP recovery, calculate spell slot recovery value
                await actor.update({ "system.attributes.hp.value": hp.value + recoveredHP });

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
                console.log("Mallindor Rest Module | Looking for player user for actor:", actor.name, actor.id);
                console.log("Mallindor Rest Module | All users:", game.users.map(u => ({name: u.name, id: u.id, active: u.active, characterId: u.character?.id})));
                console.log("Mallindor Rest Module | Found playerUser:", playerUser);
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
                  console.log("Mallindor Rest Module | GM calling showShortRestDialog for:", actor.name, "to user:", playerUser.name, playerUser.id);
                  console.log("Mallindor Rest Module | Socket object:", socket);
                  try {
                    await socket.executeForUsers("showShortRestDialog", [playerUser.id], actor.id);
                    console.log("Mallindor Rest Module | Socket call completed successfully");
                  } catch (error) {
                    console.error("Mallindor Rest Module | Socket call failed:", error);
                  }
                } else {
                  console.log("Mallindor Rest Module | No playerUser found for actor:", actor.name);
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

                ChatMessage.create({ content: `<strong>${actor.name}</strong> completed a Mallindor Long Rest. HP restoration reduced by ${maxHP - recoveredHP - hp.value}. Spell slots have not been restored yet.`, whisper: [] });
              }
            }
          },
          cancel: { label: "Cancel" }
        },
        default: "rest"
      }).render(true);
    }
  };
});