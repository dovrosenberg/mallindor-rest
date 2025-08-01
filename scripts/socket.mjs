/**
 * Manage the socket calls
 */

// Keep the original hook as backup in case it does fire
Hooks.once('socketlib.ready', () => {
  if (!SocketManager._socket) {
    SocketManager._socket = socketlib.registerModule('mallindor-rest');
    console.log('Mallindor Rest Module | Socket registered via hook:', SocketManager._socket);

    // register the assign hit dice socket
    SocketManager._socket.register('assignHitDice', assignHitDice);

    // register the assign spell slots socket
    SocketManager._socket.register('assignSpellSlots', assignSpellSlots);
  }
});

export class SocketManager {
  static _socket;

  /** call this during init; it registers to run later */
  static init() {
    /** we have CSS change to the short rest box since we use it for other things */
    Hooks.once('ready', async () => {
      SocketManager._setupCSS();
    });
  }

  static async assignHitDice(userId, actorId) {
    await SocketManager._socket.executeForUsers('assignHitDice', [userId], actorId);
  }

  static async assignSpellSlots(userId, actorId, slotsToRestore) {
    await SocketManager._socket.executeForUsers('assignSpellSlots', [userId], actorId, slotsToRestore);
  }

  static _setupCSS() {
    // Add CSS rule to hide the Rest Configuration fieldset with newDay checkbox and then the button
    const style = document.createElement('style');
    style.textContent = 'fieldset:has([name="newDay"]) { display: none !important; }';
    document.head.appendChild(style);

    const buttonStyle = document.createElement('style');
    buttonStyle.textContent = '.dnd5e2.short-rest .form-footer { display: none !important; }';
    document.head.appendChild(buttonStyle);

    // // Socket listener to trigger above hook remotely (e.g. GM initiates for players)
    // game.socket.on("module.mallindor-rest", (data) => {
    //   if (data.type === "shortRestPrompt" && game.user.id === data.userId) {
    //     Hooks.callAll("mallindor:shortRestPrompt", data.actorId);
    //   }
    // });

    console.log('Mallindor Rest Module | All rest functions loaded and assigned');
  }
}

// show the dialog to allow the player to use HD
const assignHitDice = async (actorId) => {
  debugger;
  const actor = game.actors.get(actorId);

  if (!actor || !actor.isOwner) {
    console.log('Mallindor Rest Module | Exiting - no actor or not owner');
    return;
  }

  // no need to handle warlocks because they get full recovery on short and long rest, so they just got
  //    recovered before we got here anyway
  // show the dialog to allow the player to use HD
  await actor.shortRest({ dialog: true });
};

// show the dialog to allow the player to allocate recovered spell slots
const assignSpellSlots = async (actorId, slotsToRestore) => {
  const actor = game.actors.get(actorId);

  if (!actor || !actor.isOwner) {
    console.log('Mallindor Rest Module | Exiting - no actor or not owner');
    return;
  }

  // Get all spellcasting classes and their available slots
  const levelDetails = [];

  for (let lvl = 1; lvl <= 9; lvl++) {
    const slot = actor.system.spells[`spell${lvl}`];

    if (slot.max > 0)   {
      const level = {
        level: lvl,
        max: slot.max,
        current: slot.value,
      };

      levelDetails.push(level);
    }
  }

  if (levelDetails.length === 0) {
    return;
  }

  // Create the dialog content with table layout
  let content = `
    <form id="spell-slot-form">
      <div style="margin-bottom: 1em;">
        <strong>Spell Slots to Allocate: ${slotsToRestore}</strong>
        <div id="remaining-counter" style="font-weight: bold; color: #666;">Remaining: ${slotsToRestore}</div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f5f5f5; color: black; text-shadow:none">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Level</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Max</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Current</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Allocate</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const level of levelDetails) {
    const available = level.max - level.current;
    content += `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Level ${level.level}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${level.max}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${level.current}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
              <input type="number"
                     name="spell-${level.level}"
                     min="0"
                     max="${available}"
                     value="0"
                     style="width: 60px; text-align: center;"
                     data-level="${level.level}"
                     data-available="${available}">
            </td>
          </tr>
    `;
  }

  content += `
        </tbody>
      </table>
    </form>
  `;

  // Create and show the dialog
  new Dialog({
    title: 'Allocate Recovered Spell Slots',
    content: content,
    buttons: {
      ok: {
        label: 'Allocate Slots',
        icon: '<i class="fas fa-check"></i>',
        callback: async (html) => {
          const form = html[0].querySelector('#spell-slot-form');
          const inputs = form.querySelectorAll('input[type="number"]');

          // Apply the allocations
          const updates = {};
          for (const input of inputs) {
            const allocation = parseInt(input.value) || 0;
            if (allocation > 0) {
              const [, level] = input.name.split('-');
              const currentSlots = actor.system.spells[`spell${level}`].value;
              updates[`system.spells.spell${level}.value`] = currentSlots + allocation;
            }
          }

          if (Object.keys(updates).length > 0) {
            await actor.update(updates);
            ui.notifications.info('Spell slots allocated successfully!');
          }
        }
      },
    },
    default: 'ok',
    render: (html) => {
      const form = html[0].querySelector('#spell-slot-form');
      const inputs = form.querySelectorAll('input[type="number"]');
      const okButton = html[0].parentElement.querySelector('.dialog-button');
      const remainingCounter = html[0].querySelector('#remaining-counter');

      // Function to update the remaining counter and button state
      const updateState = () => {
        let totalLevels = 0;

        for (const input of inputs) {
          const allocation = parseInt(input.value) || 0;
          const level = parseInt(input.dataset.level);
          totalLevels += allocation * level;
        }

        const remaining = slotsToRestore - totalLevels;
        remainingCounter.textContent = `Remaining: ${remaining}`;
        remainingCounter.style.color = remaining === 0 ? '#28a745' : remaining < 0 ? '#dc3545' : '#666';

        // Enable OK button only when exactly the right amount is allocated
        okButton.disabled = (remaining !== 0);
      };

      // Add event listeners to all inputs
      for (const input of inputs) {
        input.addEventListener('input', (e) => {
          const value = parseInt(e.target.value) || 0;
          const available = parseInt(e.target.dataset.available);

          // Clamp value to available slots
          if (value > available) {
            e.target.value = available;
          } else if (value < 0) {
            e.target.value = 0;
          }

          updateState();
        });
      }

      // Initial state update
      updateState();
    }
  }).render(true);
};
