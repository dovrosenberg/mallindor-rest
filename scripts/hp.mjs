/**
 * Functions for managing hp before and after a rest
 */

// all keys are actor ids
let preHP = {};
let preHD = {};
let maxHP = {};

export const saveHP = function (actor) {
  preHP[actor.id] = actor.system.attributes.hp.value;
  maxHP[actor.id] = actor.system.attributes.hp.max;
  preHD[actor.id] = actor.system.attributes.hd;
};

/** returns the number of HP not recovered */
export const restoreHP = async function (actor, longRest = false) {
  if (preHP[actor.id] == null || maxHP[actor.id] == null || preHD[actor.id] == null) 
    return;
  
  const recoveredHP = longRest ? Math.ceil((maxHP[actor.id] - preHP[actor.id]) / 2) : 0;
  const unrecoveredHP = maxHP[actor.id] - preHP[actor.id] - recoveredHP;

  await actor.update({
    "system.attributes.hp.value": preHP[actor.id] + recoveredHP,
    "system.attributes.hd": preHD[actor.id]
  });

  preHP[actor.id] = null;
  maxHP[actor.id] = null;
  preHD[actor.id] = null;

  return unrecoveredHP;
};
