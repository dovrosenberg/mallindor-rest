/**
 * Functions for managing spells before and after a rest
 */

// all keys are actor ids
// const pactSpells = {};
const savedSlots = {};   // each is an object keyed by `spell${lvl}`

/** save to memory the number of spell slots available; returns the number available for reallocation */
/** returns =1 if all slots should be restored */
export const saveSpells = function (actor) {
  savedSlots[actor.id] = {};
  let totalUsed = 0;

  for (let lvl = 1; lvl <= 9; lvl++) {
    const slot = actor.system.spells[`spell${lvl}`];
    savedSlots[`spell${lvl}`] = slot.value;
    totalUsed += (slot.max - slot.value) * lvl;
  }

  // we restore a base amount of totalUsed/2 but with a minimum of (proficiency bonus - 1)*(spellcasting ability modifier)
  const baseRestore = Math.floor(totalUsed / 2);

  // get all the spell casting abilities
  let totalMod = 0;
  let countedClasses = 0;
  const scClasses = actor.spellcastingClasses;
  for (const cls of Object.values(scClasses)) {
    const ability = actor.system.abilities[cls.spellcasting.ability];
    totalMod += ability?.mod ?? 0;
    countedClasses += ability?.mod !== null && ability.mod > 0 ? 1 : 0;
  }
  
  const proficiencyBonus = actor.system.attributes.prof;
  const minRestore = Math.floor((proficiencyBonus - 1) * totalMod / countedClasses);
  const amountToRestore = Math.max(baseRestore, minRestore);

  if (amountToRestore >= totalUsed) {
    return -1;
  }
  return amountToRestore;
};

/** restore the number of spell slots available to the saved number */
export const restoreSlots = async function (actor) {
  const slots = savedSlots[actor.id];
  for (let lvl = 1; lvl <= 9; lvl++) {
    slots[`system.spells.spell${lvl}.value`] = savedSlots[`spell${lvl}`];
  }
  await actor.update(slots);
};

////////////////////
// No need for these, as we allow warlocks to fully recover on short and long rest
// /** save to memory the number of pact spells available */
// export const savePactSpells = function (actor) {
//   const pact = actor.system.spells.pact;
//   if (pact?.max !== null) {
//     pactSpells[actor.id] = actor.system.spells.pact.value;
//   } else {
//     pactSpells[actor.id] = null;
//   }
// };


// /** restore all pact spells available to the saved number*/
// /** penalty is used on long rest; false is for doing a HD recover rest without recovering any pact spells */
// /** returns the number of pact slots not recovered */
// export const restorePactSpells = async function (actor, penalty = true) {
//   const pact = actor.system.spells.pact;
//   let unrecoveredSlots = 0;

//   if (pact?.max !== null && pactSpells[actor.id] !== null) {
//     if (penalty) {
//       unrecoveredSlots = Math.floor((actor.system.spells.pact.max - pactSpells[actor.id]) / 2);
//       await actor.update({ 'system.spells.pact.value': actor.system.spells.pact.max - unrecoveredSlots });
//     } else {
//       await actor.update({ 'system.spells.pact.value': pactSpells[actor.id] });
//     }

//     pactSpells[actor.id] = null;
//   }

//   return unrecoveredSlots;
// };

