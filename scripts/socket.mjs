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
