/**
 * Functions for managing hp before and after a rest
 */

// all keys are actor ids
const preHP = {};
const preHD = {};   // each item is a {class: classObject, spent: number}[]
const maxHP = {};

export const saveHP = function (actor) {
  preHP[actor.id] = actor.system.attributes.hp.value;
  maxHP[actor.id] = actor.system.attributes.hp.max;

  preHD[actor.id] = [];
  for (const cls of actor.system.attributes.hd.classes) {
    preHD[actor.id].push({ class: cls, spent: cls.system.hd.spent });
  }
};

/** returns the number of HP not recovered */
export const restoreHP = async function (actor, longRest = false) {
  if (preHP[actor.id] === null || maxHP[actor.id] === null || preHD[actor.id] === null) {
    return;
  }

  const recoveredHP = longRest ? Math.ceil((maxHP[actor.id] - preHP[actor.id]) / 2) : 0;
  const unrecoveredHP = maxHP[actor.id] - preHP[actor.id] - recoveredHP;

  await actor.update({
    'system.attributes.hp.value': preHP[actor.id] + recoveredHP,
  });

  // HD live on classes - set all back to the prior levels
  for (const cls of preHD[actor.id]) {
    await cls.class.update({ 'system.hd.spent': cls.spent });
  }

  preHP[actor.id] = null;
  maxHP[actor.id] = null;
  preHD[actor.id] = null;

  return unrecoveredHP;
};

/** adds back one of the largest HD available. returns whether we added one or not */
export const addHD = async function (actor) {
  const hd = actor.system.attributes.hd;

  // find the class with the largest HD that are unspent
  const spentClasses = hd.classes.filter((cls) => cls.system.hd.spent > 0);

  // find the class with the largest HD that are unspent - denomination is dN... need to strip the d to compare
  const largestClass = spentClasses.reduce((acc, cls) => ( acc === null ? cls : (cls.system.hd.denomination.replace('d', '') > acc.system.hd.denomination.replace('d', '') ? cls : acc)), null);

  // check for none unspent
  if (largestClass === null) {
    return false;
  }

  // add one HD to the actor
  const updatedSpent = largestClass.system.hd.spent - 1;
  await largestClass.update({ 'system.hd.spent': updatedSpent });

  return true;
};
