/**
 * Functions for managing spells before and after a rest
 */

// all keys are actor ids
let pactSpells = {};

export const savePactSpells = function (actor) {
  const pact = actor.system.spells.pact;
  if (pact?.max != null) {
    pactSpells[actor.id] = actor.system.spells.pact.value;
  }
};

export const restorePactSpells = async function (actor) {
  const pact = actor.system.spells.pact;
  if (pact?.max != null && pactSpells[actor.id] != null) {
    await actor.update({ "system.spells.pact.value": pactSpells[actor.id] });
  }
  pactSpells[actor.id] = null;
}
