import { FLBR } from './config';

/**
 * Creates a Macro from an Item or stat (attribute/skill) drop.
 * Gets an existing item macro if one exists, otherwise create a new one.
 * ! Do not return a Promise or conflict with Foundry's default drop
 * @param {Object} data The dropped data
 * @param {number} slot The hotbar slot to use
 */
export function createBladeRunnerMacro(data, slot) {
  if (data.type === 'Stat') {
    // ! Do not use await or conflict with Foundry
    _createBladeRunnerStatMacro(data, slot);
    return false;
  }
  if (data.type === 'Item' && typeof data.uuid === 'string') {
    if (!data.uuid.includes('Actor') && !data.uuid.includes('Token')) return;

    // ! Use synced method or conflict with Foundry
    // eslint-disable-next-line no-undef
    const item = fromUuidSync(data.uuid);
    if (!item) return;
    if (!item.system.rollable) return;

    // ! Do not use await or conflict with Foundry
    _createBladeRunnerItemMacro(item, slot);
    return false;
  }
}

export async function setupMacroFolder() {
  if (!game.user.isGM) return;
  const folderName = FLBR.systemMacroFolder;
  const folder = game.folders
    .filter(f => f.type === 'Macro')
    .find(f => f.name === folderName);

  if (!folder) {
    await Folder.create({
      name: folderName,
      type: 'Macro',
      parent: null,
    });
  }
}

/* ------------------------------------------ */
/*  Hotbar Macros                             */
/* ------------------------------------------ */

async function _createBladeRunnerStatMacro(data, slot) {
  const folder = game.folders.find(f => f.type === 'Macro' && f.name === FLBR.systemMacroFolder);
  const command = `game.bladerunner.macros.rollStat("${data.attribute}"`
    + (data.skill ? `, "${data.skill}"` : '')
    + ');';
  const actor = await fromUuid(data.uuid);
  if (!actor) return;

  const commandName = game.i18n.format('FLBR.MACRO.RollStat', {
    stat: game.i18n.localize(data.skill
      ? `FLBR.SKILL.${data.skill.capitalize()}`
      : `FLBR.ATTRIBUTE.${data.attribute.toUpperCase()}`,
    ),
  });

  let macro = findMacro(commandName, command);
  if (!macro) {
    macro = await Macro.create({
      name: commandName,
      type: 'script',
      img: 'icons/svg/dice-target.svg',
      command: command,
      flags: { 'bladerunner.statMacro': true },
      folder: folder.id,
      'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
    });
  }
  game.user.assignHotbarMacro(macro, slot);
}

async function _createBladeRunnerItemMacro(item, slot) {
  const folder = game.folders.find(f => f.type === 'Macro' && f.name === FLBR.systemMacroFolder);
  const command = `game.bladerunner.macros.rollItem("${item.name}");`;
  let macro = findMacro(item.name, command);
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'bladerunner.itemMacro': true },
      folder: folder.id,
      'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
    });
  }
  game.user.assignHotbarMacro(macro, slot);
}

/* ------------------------------------------ */

/**
 * Rolls a stat.
 * @param {string} attributeKey
 * @param {string} skillKey
 */
export async function rollStat(attributeKey, skillKey) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  if (!actor) {
    return ui.notifications.warn(game.i18n.format('FLBR.MACRO.NoActor', {
      actor: JSON.stringify(speaker),
    }));
  }
  return actor.rollStat(attributeKey, skillKey);
}

/* ------------------------------------------ */

/**
 * Rolls an item.
 * @param {string} itemName
 */
export async function rollItem(itemName) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  if (!actor) {
    return ui.notifications.warn(game.i18n.format('FLBR.MACRO.NoActor', {
      actor: speaker,
    }));
  }

  // Gets matching items.
  const items = actor ? actor.items.filter(i => i.name === itemName) : [];
  if (items.length > 1) {
    ui.notifications.warn(game.i18n.format('FLBR.MACRO.MultipleItems', {
      actor: actor.name,
      item: itemName,
    }),
    );
  }
  else if (items.length === 0) {
    return ui.notifications.warn(game.i18n.format('FLBR.MACRO.NoItem', {
      actor: actor.name,
      item: itemName,
    }));
  }

  return items[0].roll();
}

/* ------------------------------------------ */

/**
 * Renders a roll dialog.
 * @param {Object} data
 */
export function showRollDialog(data = {}) {
  return game.bladerunner.roller.create({
    title: 'Generic Roll',
    actor: null,
    attributeKey: null,
    skillKey: null,
    dice: [],
    maxPush: 1,
    ...data,
  });
}

/* ------------------------------------------ */
/*  Utilities                                 */
/* ------------------------------------------ */

export function findMacro(commandName, command) {
  return game.macros.find(m => (
    m.name === commandName &&
    m.command === command &&
    (
      m.author === game.user.id ||
      m.ownership.default >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER ||
      m.ownership[game.user.id] >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
    )
  ));
}