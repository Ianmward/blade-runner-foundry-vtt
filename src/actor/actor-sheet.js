import { FLBR } from '@system/config.js';
import { ACTOR_TYPES, ITEM_TYPES } from '@system/constants.js';

/**
 * Blade Runner RPG Actor Sheet.
 * @extends {ActorSheet} Extends the basic ActorSheet
 */
export default class BladeRunnerActorSheet extends ActorSheet {

  /* ------------------------------------------ */
  /*  Properties                                */
  /* ------------------------------------------ */

  get rollData() {
    return this.actor.getRollData();
  }

  /* ------------------------------------------ */
  /*  Sheet Data Preparation                    */
  /* ------------------------------------------ */

  /** @override */
  getData(options) {
    const isOwner = this.actor.isOwner;
    const baseData = super.getData(options);
    const sheetData = {
      cssClass: isOwner ? 'editable' : 'locked',
      owner: isOwner,
      limited: this.actor.limited,
      editable: this.isEditable,
      options: this.options,
      isGM: game.user.isGM,
      actor: baseData.actor,
      data: baseData.actor.data.data,
      items: baseData.items,
      effects: baseData.effects,
      rollData: this.rollData,
      config: CONFIG.BLADE_RUNNER,
    };
    return sheetData;
  }

  /* ------------------------------------------ */
  /*  Filtering Dropped Items                   */
  /* ------------------------------------------ */

  /** @override */
  async _onDropItemCreate(itemData) {
    const type = itemData.type;
    const alwaysAllowedItems = FLBR.physicalItems;
    const allowedItems = {
      [ACTOR_TYPES.PC]: [ITEM_TYPES.SPECIALTY, ITEM_TYPES.SYNTHETIC_AUGMENTATION, ITEM_TYPES.CRITICAL_INJURY],
      [ACTOR_TYPES.NPC]: [ITEM_TYPES.SPECIALTY],
      [ACTOR_TYPES.VEHICLE]: [],
    };
    let allowed = true;

    if (!alwaysAllowedItems.includes(type)) {
      if (!allowedItems[this.actor.type].includes(type)) {
        allowed = false;
      }
    }

    if (!allowed) {
      const msg = game.i18n.format('FLBR.ActorSheet.NotifWrongItemType', {
        type: game.i18n.localize(`FLBR.ItemTypes.${type}`),
        actor: game.i18n.localize(`FLBR.ActorTypes.${this.actor.type}`),
      });
      console.warn(`FLBR | ${msg}`);
      ui.notifications.warn(msg);
      return false;
    }
    return super._onDropItemCreate(itemData);
  }

  /* ------------------------------------------ */
  /*  Sheet Listeners                           */
  /* ------------------------------------------ */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Editable-only Listeners
    if (!game.user.isGM && this.actor.limited) return;
    // if (!this.options.editable) return;
    if (!this.isEditable) return;

    // Input Focus & Update
    const inputs = html.find('input');
    inputs.focus(ev => ev.currentTarget.select());

    // Item Management
    html.find('.item-create').click(this._onItemCreate.bind(this));
    html.find('.item-edit').click(this._onItemEdit.bind(this));
    html.find('.item-delete').click(this._onItemDelete.bind(this));

    // // Owner-only listeners.
    // if (this.actor.isOwner) {
    //   html.find('.item-roll').click(this._onItemRoll.bind(this));
    //   html.find('.item[data-item-id]').each((index, elem) => {
    //     elem.setAttribute('draggable', true);
    //     elem.addEventListener('dragstart', ev => this._onDragStart(ev), false);
    //   });
    // }
  }

  /* ------------------------------------------ */

  _onItemCreate(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const type = elem.dataset.type;
    const itemData = {
      name: game.i18n.localize(`FLBR.ActorSheet.NewItem.${type}`),
      type,
    };
    return this.actor.createEmbeddedDocuments('Item', [itemData])
      // Displays the sheet of the newly created item.
      .then(itmData => {
        const itemId = itmData[0].id;
        const item = this.actor.items.get(itemId);
        item.sheet.render(true);
      });
  }

  _onItemEdit(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const itemId = elem.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.sheet.render(true);
  }

  _onItemDelete(event /* :MouseEvent */) {
    event.preventDefault();
    const elem = event.currentTarget;
    const itemId = elem.closest('.item').dataset.itemId;
    return this.actor.deleteEmbeddedDocuments('Item', [itemId]);
  }

  /* ------------------------------------------ */

  /** Left-clic: +1, Right-clic: -1 */
  _onValueChange(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const min = +elem.dataset.min || 0;
    const max = +elem.dataset.max || 10;
    const field = elem.dataset.field;
    const currentCount = foundry.utils.getProperty(this.actor, `data.data.${field}`) || 0;
    let newCount = currentCount;

    if (event.type === 'click') newCount++;
    else newCount--; // contextmenu
    newCount = Math.clamped(newCount, min, max);

    return this.actor.update({ [`data.${field}`]: newCount });
  }
}