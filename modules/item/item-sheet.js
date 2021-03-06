import DSA5_Utility from "../system/utility-dsa5.js"
import DSA5 from "../system/config-dsa5.js"
import DSA5StatusEffects from "../status/status_effects.js"
import DSA5ChatListeners from "../system/chat_listeners.js"
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js"
import { svgAutoFit } from "../system/view_helper.js"


export default class ItemSheetdsa5 extends ItemSheet {
    constructor(item, options) {
        super(item, options);
        this.mce = null;
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "description" }]
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "item"]),
            width: 450,
            height: 500,
        });
        return options;
    }

    static setupSheets() {
        Items.unregisterSheet("core", ItemSheet);
        Items.registerSheet("dsa5", ItemSheetdsa5, { makeDefault: true });
        Items.registerSheet("dsa5", ItemSpeciesDSA5, { makeDefault: true, types: ["species"] });
        Items.registerSheet("dsa5", ItemCareerDSA5, { makeDefault: true, types: ["career"] });
        Items.registerSheet("dsa5", ItemCultureDSA5, { makeDefault: true, types: ["culture"] });
        Items.registerSheet("dsa5", VantageSheetDSA5, { makeDefault: true, types: ["advantage", "disadvantage"] });
        Items.registerSheet("dsa5", SpellSheetDSA5, { makeDefault: true, types: ["ritual", "ceremony", "liturgy", "spell"] });
        Items.registerSheet("dsa5", SpecialAbilitySheetDSA5, { makeDefault: true, types: ["specialability"] });
        Items.registerSheet("dsa5", MeleeweaponSheetDSA5, { makeDefault: true, types: ["meleeweapon"] });
        Items.registerSheet("dsa5", PoisonSheetDSA5, { makeDefault: true, types: ["poison"] });
        Items.registerSheet("dsa5", DiseaseSheetDSA5, { makeDefault: true, types: ["disease"] });
        Items.registerSheet("dsa5", ConsumableSheetDSA5, { makeDefault: true, types: ["consumable"] });
        Items.registerSheet("dsa5", SpellExtensionSheetDSA5, { makeDefault: true, types: ["spellextension"] });
        Items.registerSheet("dsa5", MagictrickSheetDSA5, { makeDefault: true, types: ["magictrick"] });
        Items.registerSheet("dsa5", BlessingSheetDSA5, { makeDefault: true, types: ["blessing"] });
        Items.unregisterSheet("dsa5", ItemSheetdsa5, { types: ["blessing", "magictrick", "spellextension", "consumable", "species", "career", "culture", "advantage", "specialability", "disadvantage", "ritual", "ceremony", "liturgy", "spell", "disease", "poison", "meleeweapon"] });
    }

    async _render(force = false, options = {}) {
        await super._render(force, options);

        $(this._element).find(".close").attr("title", game.i18n.localize("SHEET.Close"));
        $(this._element).find(".configure-sheet").attr("title", game.i18n.localize("SHEET.Configure"));
        $(this._element).find(".import").attr("title", game.i18n.localize("SHEET.Import"));
        $(this._element).find(".rolleffect").attr("title", game.i18n.localize("SHEET.RollEffect"));
        $(this._element).find(".showItemHead").attr("title", game.i18n.localize("SHEET.PostItem"));
        $(this._element).find(".consumeItem").attr("title", game.i18n.localize("SHEET.ConsumeItem"));
    }

    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        buttons.unshift({
            class: "showItemHead",
            icon: `fas fa-comment`,
            onclick: async() => this.item.postItem()
        })
        return buttons
    }

    setupEffect(ev) {
        this.item.setupEffect().then(setupData => {
            this.item.itemTest(setupData)
        });
    }


    get template() {
        let type = this.item.type;
        return `systems/dsa5/templates/items/item-${type}-sheet.html`;
    }

    _getItemId(ev) {
        return $(ev.currentTarget).parents(".item").attr("data-item-id")
    }

    _advanceStep() {}

    _refundStep() {}

    async advanceWrapper(ev, funct) {
        let elem = $(ev.currentTarget)
        let i = elem.find('i')
        if (!i.hasClass("fa-spin")) {
            i.addClass("fa-spin fa-spinner")
            await this[funct]()
            i.removeClass("fa-spin fa-spinner")
        }
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find(".advance-step").mousedown(ev => {
            this.advanceWrapper(ev, "_advanceStep")
        })
        html.find(".refund-step").mousedown(ev => {
            this.advanceWrapper(ev, "_refundStep")
        })

        html.find('[data-edit="img"]').mousedown(ev => {
            if (ev.button == 2) DSA5_Utility.showArtwork(this.item)
        })

        html.find(".status-add").click(ev => {
            DSA5StatusEffects.createCustomEffect(this.item, "", this.item.name)
        })

        html.find('.condition-show').mousedown(ev => {
            ev.preventDefault()
            const id = $(ev.currentTarget).attr("data-id")
            if (ev.button == 0) {
                const effect = this.item.effects.get(id)
                effect.sheet.render(true)
            } else if (ev.button == 2) {
                this.item.deleteEmbeddedEntity("ActiveEffect", id)
            }
        })

        html.find(".condition-toggle").mousedown(ev => {
            let condKey = $(ev.currentTarget).parents(".statusEffect").attr("data-id")
            let ef = this.item.effects.get(condKey)
            ef.update({ disabled: !ef.data.disabled })
        })

        html.find('.condition-edit').click(ev => {
            const effect = this.item.effects.get($(ev.currentTarget).attr("data-id"))
            effect.sheet.render(true)
        })

        DSA5StatusEffects.bindButtons(html)
        html.on('click', '.chat-condition', ev => {
            DSA5ChatListeners.postStatus($(ev.currentTarget).attr("data-id"))
        })

        let toObserve = html.find(".item-header")
        if (toObserve.length) {
            let svg = toObserve.find('svg')
            if (svg) {
                let observer = new ResizeObserver(function(entries) {
                    let entry = entries[0]
                    svgAutoFit(svg, entry.contentRect.width)
                });
                observer.observe(toObserve.get(0));
                let input = toObserve.find('input')
                if (!input.get(0).disabled) {
                    svg.click(() => {
                        svg.hide()
                        input.show()
                        input.focus()
                    })
                    input.blur(function() {
                        svg.show()
                        input.hide()
                    })
                }
            }
        }
    }

    async getData() {
        const data = super.getData();

        switch (this.item.type) {
            case "skill":
                data['characteristics'] = DSA5.characteristics;
                data['skillGroups'] = DSA5.skillGroups;
                data['skillBurdens'] = DSA5.skillBurdens;
                data['hasLocalization'] = game.i18n.has(`SKILLdescr.${this.item.name}`)
                data['StFs'] = DSA5.StFs;
                break;
            case "combatskill":
                data['weapontypes'] = DSA5.weapontypes;
                data['guidevalues'] = DSA5.combatskillsGuidevalues;
                data['hasLocalization'] = game.i18n.has(`Combatskilldescr.${this.item.name}`)
                data['StFs'] = DSA5.StFs;
                break;
            case "rangeweapon":
                data['ammunitiongroups'] = DSA5.ammunitiongroups;
                data['combatskills'] = await DSA5_Utility.allCombatSkillsList("range");
                break;
            case "ammunition":
                data['ammunitiongroups'] = DSA5.ammunitiongroups;
                break;
            case "trait":
                data["traitCategories"] = DSA5.traitCategories
                data['ranges'] = DSA5.meleeRanges;
                break
            case "equipment":
                data['equipmentTypes'] = DSA5.equipmentTypes;
                break;
            case "aggregatedTest":
                data["allSkills"] = await DSA5_Utility.allSkillsList()
                break
        }
        data.isOwned = this.item.isOwned
        if (data.isOwned)
            data.canAdvance = this.item.options.actor.data.canAdvance && this._advancable()

        DSA5StatusEffects.prepareActiveEffects(this.item, data)

        return data;
    }

    _advancable() {
        return false
    }
}


class BlessingSheetDSA5 extends ItemSheetdsa5 {
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned) {
            buttons.unshift({
                class: "rolleffect",
                icon: `fas fa-dice-d20`,
                onclick: async ev => this.setupEffect(ev)
            })
        }
        return buttons
    }

    setupEffect(ev) {
        if (this.item.options.actor.data.data.status.karmaenergy.value < 1)
            return ui.notifications.error(game.i18n.localize("DSAError.NotEnoughKaP"))

        const cantrip = game.dsa5.config.ItemSubclasses.magictrick
        this.item.options.actor.update({ "data.status.karmaenergy.value": this.item.options.actor.data.data.status.karmaenergy.value -= 1 })
        let chatMessage = `<p><b>${this.item.name} - ${game.i18n.localize('blessing')} ${game.i18n.localize('probe')}</b></p><p>${this.item.data.data.description.value}</p><p>${cantrip.chatData(this.item.data.data, "").join("</br>")}</p>`
        ChatMessage.create(DSA5_Utility.chatDataSetup(chatMessage));

    }
}

class ItemCareerDSA5 extends ItemSheetdsa5 {
    constructor(item, options) {
        options.width = 700
        options.height = 700
        super(item, options);
        this.mce = null;
    }

    async getData() {
        const data = await super.getData();
        let chars = duplicate(DSA5.characteristics)
        chars["-"] = "-"
        data["mageLevels"] = DSA5.mageLevels
        data['guidevalues'] = chars;
        return data
    }
}

class ConsumableSheetDSA5 extends ItemSheetdsa5 {
    constructor(item, options) {
        options.width = 480
        super(item, options);
        this.mce = null;
    }
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned) {
            buttons.unshift({
                class: "consumeItem",
                icon: `fas fa-dice-d20`,
                onclick: async ev => this.setupEffect(ev)
            })
        }
        return buttons
    }
    async getData() {
        const data = await super.getData()
        data["calculatedPrice"] = (data.data.price.value * data.data.QL) || 0
        data["availableSteps"] = data.data.QLList.split("\n").map((x, i) => i + 1)
        data['equipmentTypes'] = DSA5.equipmentTypes;
        return data
    }
    setupEffect(ev) {
        this.item.setupEffect()
    }
}


class ItemCultureDSA5 extends ItemSheetdsa5 {
    constructor(item, options) {
        options.width = 700
        options.height = 700
        super(item, options);
        this.mce = null;
    }
}

class DiseaseSheetDSA5 extends ItemSheetdsa5 {
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        buttons.unshift({
            class: "rolleffect",
            icon: `fas fa-dice-d20`,
            onclick: async ev => this.setupEffect(ev)
        })
        return buttons
    }
    async getData() {
        const data = await super.getData()
        data["resistances"] = DSA5.magicResistanceModifiers
        return data
    }
}

class MagictrickSheetDSA5 extends ItemSheetdsa5 {
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned) {
            buttons.unshift({
                class: "rolleffect",
                icon: `fas fa-dice-d20`,
                onclick: async ev => this.setupEffect(ev)
            })
        }
        return buttons
    }

    setupEffect(ev) {
        if (this.item.options.actor.data.data.status.astralenergy.value < 1)
            return ui.notifications.error(game.i18n.localize("DSAError.NotEnoughAsP"))

        const cantrip = game.dsa5.config.ItemSubclasses.magictrick
        this.item.options.actor.update({ "data.status.astralenergy.value": this.item.options.actor.data.data.status.astralenergy.value -= 1 })
        let chatMessage = `<p><b>${this.item.name} - ${game.i18n.localize('magictrick')} ${game.i18n.localize('probe')}</b></p><p>${this.item.data.data.description.value}</p><p>${cantrip.chatData(this.item.data.data, "").join("</br>")}</p>`
        ChatMessage.create(DSA5_Utility.chatDataSetup(chatMessage));
    }
}

class MeleeweaponSheetDSA5 extends ItemSheetdsa5 {
    async getData() {
        const data = await super.getData()
        let chars = DSA5.characteristics;
        chars["ge/kk"] = game.i18n.localize("CHAR.GEKK")
        chars["-"] = "-";
        data['characteristics'] = chars;
        data['twoHanded'] = /\(2H/.test(this.item.name)
        data['combatskills'] = await DSA5_Utility.allCombatSkillsList("melee")
        data['ranges'] = DSA5.meleeRanges;
        if (this.item.options.actor) {
            let combatSkill = this.item.options.actor.data.items.find(x => x.type == "combatskill" && x.name == this.item.data.data.combatskill.value)
            data['canBeOffHand'] = combatSkill && !(combatSkill.data.weapontype.twoHanded) && this.item.data.data.worn.value
        }
        data['isShield'] = this.item.data.data.combatskill.value == game.i18n.localize("LocalizedIDs.shields")
        data['shieldSizes'] = DSA5.shieldSizes
        return data
    }
}

class PoisonSheetDSA5 extends ItemSheetdsa5 {
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        buttons.unshift({
            class: "rolleffect",
            icon: `fas fa-dice-d20`,
            onclick: async ev => this.setupEffect(ev)
        })
        return buttons
    }
    async getData() {
        const data = await super.getData()
        data["resistances"] = DSA5.magicResistanceModifiers
        return data
    }
}

class SpecialAbilitySheetDSA5 extends ItemSheetdsa5 {
    async _refundStep() {
        let xpCost, steps
        if (this.item.data.data.step.value > 1) {
            xpCost = this.item.data.data.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.data.data.step.value - 1]
            }
            xpCost = await SpecialabilityRulesDSA5.refundFreelanguage(this.item.data, this.item.options.actor, xpCost)
            await this.item.options.actor._updateAPs(xpCost * -1)
            await this.item.update({ "data.step.value": this.item.data.data.step.value - 1 })
        }
    }

    async _advanceStep() {
        let xpCost, steps
        if (this.item.data.data.step.value < this.item.data.data.maxRank.value) {
            xpCost = this.item.data.data.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.data.data.step.value]
            }
            xpCost = await SpecialabilityRulesDSA5.isFreeLanguage(this.item.data, this.item.options.actor, xpCost)
            if (await this.item.options.actor.checkEnoughXP(xpCost)) {
                await this.item.options.actor._updateAPs(xpCost)
                await this.item.update({ "data.step.value": this.item.data.data.step.value + 1 })
            }
        }
    }

    _advancable() {
        return this.item.data.data.maxRank.value > 0
    }

    async getData() {
        const data = await super.getData()
        data['categories'] = DSA5.specialAbilityCategories;
        return data
    }
}

class ItemSpeciesDSA5 extends ItemSheetdsa5 {
    constructor(item, options) {
        options.width = 530
        options.height = 570
        super(item, options);
        this.mce = null;
    }

    async getData() {
        const data = await super.getData();
        data['hasLocalization'] = game.i18n.has(`Racedescr.${this.item.name}`)
        return data
    }
}

class SpellSheetDSA5 extends ItemSheetdsa5 {
    async getData() {
        const data = await super.getData();
        data['characteristics'] = DSA5.characteristics;
        data['StFs'] = DSA5.StFs;
        data['resistances'] = DSA5.magicResistanceModifiers
        if (data.isOwned) {
            data['extensions'] = this.item.options.actor.data.items.filter(x => { return x.type == "spellextension" && x.data.source == this.item.name && this.item.type == x.data.category })
        }
        return data
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.item-edit').click(ev => {
            ev.preventDefault()
            let itemId = this._getItemId(ev)
            const item = this.item.options.actor.items.find(i => i.data._id == itemId)
            item.sheet.render(true);
        });

        html.find('.item-delete').click(ev => {
            this._deleteItem(ev)
        });
    }

    _deleteItem(ev) {
        let itemId = this._getItemId(ev);
        let item = this.actor.data.items.find(x => x._id == itemId)
        let message = game.i18n.format("DIALOG.DeleteItemDetail", { item: item.name })
        renderTemplate('systems/dsa5/templates/dialog/delete-item-dialog.html', { message: message }).then(html => {
            new Dialog({
                title: game.i18n.localize("Delete Confirmation"),
                content: html,
                buttons: {
                    Yes: {
                        icon: '<i class="fa fa-check"></i>',
                        label: game.i18n.localize("yes"),
                        callback: dlg => {
                            this._cleverDeleteItem(itemId)
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize("cancel")
                    }
                },
                default: 'Yes'
            }).render(true)
        });
    }

    async _cleverDeleteItem(itemId) {
        let item = this.item.options.actor.data.items.find(x => x._id == itemId)
        await this.item.options.actor._updateAPs(-1 * item.data.APValue.value)
        this.item.options.actor.deleteEmbeddedEntity("OwnedItem", itemId);
    }
}

class SpellExtensionSheetDSA5 extends ItemSheetdsa5 {
    async getData() {
        const data = await super.getData();
        data['categories'] = ["spell", "liturgy", "ritual", "ceremony"]
        return data
    }
}

class VantageSheetDSA5 extends ItemSheetdsa5 {
    _advancable() {
        return this.item.data.data.max.value > 0
    }

    async _refundStep() {
        let xpCost, steps
        if (this.item.data.data.step.value > 1) {
            xpCost = this.item.data.data.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.data.data.step.value - 1]
            }
            await this.item.options.actor._updateAPs(xpCost * -1)
            await this.item.update({ "data.step.value": this.item.data.data.step.value - 1 })
        }
    }

    async _advanceStep() {
        let xpCost, steps
        if (this.item.data.data.step.value < this.item.data.data.max.value) {
            xpCost = this.item.data.data.APValue.value
            if (/;/.test(xpCost)) {
                steps = xpCost.split(";").map(x => Number(x.trim()))
                xpCost = steps[this.item.data.data.step.value]
            }
            if (await this.item.options.actor.checkEnoughXP(xpCost)) {
                await this.item.options.actor._updateAPs(xpCost)
                await this.item.update({ "data.step.value": this.item.data.data.step.value + 1 })
            }
        }
    }
}