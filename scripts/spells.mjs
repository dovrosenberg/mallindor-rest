/**
 * Functions for managing spells before and after a rest
 */

// all keys are actor ids
const pactSpells = {};
const savedSlots = {};   // each is an object keyed by `spell${lvl}`

/** save to memory the number of pact spells available */
export const savePactSpells = function (actor) {
  const pact = actor.system.spells.pact;
  if (pact?.max !== null) {
    pactSpells[actor.id] = actor.system.spells.pact.value;
  } else {
    pactSpells[actor.id] = null;
  }
};

/** save to memory the number of spell slots available; returns the number available for reallocation */
export const saveSpells = function (actor) {
  savedSlots[actor.id] = {};
  let totalUsed = 0;

  for (let lvl = 1; lvl <= 9; lvl++) {
    const slot = actor.system.spells[`spell${lvl}`];
    savedSlots[`spell${lvl}`] = slot.value;
    totalUsed += (slot.max - slot.value) * lvl;
  }
  const toRestore = Math.ceil(totalUsed / 2);

  return toRestore;
};

/** restore the number of pact spells available to the saved number*/
/** penalty is used on long rest; false is for doing a HD recover rest without recovering any pact spells */
export const restorePactSpells = async function (actor, penalty = true) {
  const pact = actor.system.spells.pact;
  if (pact?.max !== null && pactSpells[actor.id] !== null) {
    if (penalty) {
      await actor.update({ 'system.spells.pact.value': pactSpells[actor.id] });
    } else {
      await actor.update({ 'system.spells.pact.value': actor.system.spells.pact.max });
    }

    pactSpells[actor.id] = null;
  }
};

/** restore the number of spell slots available to the saved number */
export const restoreSlots = async function (actor) {
  const slots = savedSlots[actor.id];
  for (let lvl = 1; lvl <= 9; lvl++) {
    slots[`system.spells.spell${lvl}.value`] = savedSlots[`spell${lvl}`];
  }
  await actor.update(slots);
};
