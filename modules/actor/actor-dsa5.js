import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"
import DiceDSA5 from "../system/dice-dsa5.js"
import OpposedDsa5 from "../system/opposed-dsa5.js";
import DSA5Dialog from "../dialog/dialog-dsa5.js"
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js";
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js";
import DSA5StatusEffects from "../status/status_effects.js"
import Itemdsa5 from "../item/item-dsa5.js";
import TraitRulesDSA5 from "../system/trait-rules-dsa5.js";

export default class Actordsa5 extends Actor {
    static async create(data, options) {
        if (data instanceof Array)
            return super.create(data, options);

        if (data.items)
            return super.create(data, options);

        data.items = [];
        data.flags = {}

        if (!data.img || data.img == "icons/svg/mystery-man.svg")
            data.img = "icons/svg/mystery-man-black.svg"

        let skills = await DSA5_Utility.allSkills() || [];
        let combatskills = await DSA5_Utility.allCombatSkills() || [];
        let moneyItems = await DSA5_Utility.allMoneyItems() || [];

        moneyItems = moneyItems.sort((a, b) => (a.data.price.value > b.data.price.value) ? -1 : 1);
        data.items.push(...skills);
        data.items.push(...combatskills);

        data.items.push(...moneyItems.map(m => {
            m.data.quantity.value = 0
            return m
        }));

        if (data.type != "character") {
            data.data = { status: { fatePoints: { current: 0, value: 0 } } }
        }
        return super.create(data, options);
    }


    prepareDerivedData() {
        const data = this.data
        try {
            let itemModifiers = {}
            for (let i of data.items.filter(x => (["meleeweapon", "rangeweapon", "armor", "equipment"].includes(x.type) && getProperty(x, "data.worn.value")) || ["advantage", "specialability", "disadvantage"].includes(x.type))) {
                this._addGearAndAbilityModifiers(itemModifiers, i)
            }
            data.data.itemModifiers = this._applyModiferTransformations(itemModifiers)

            for (let ch of Object.values(data.data.characteristics)) {
                ch.value = ch.initial + ch.advances + (ch.modifier || 0) + ch.gearmodifier;
                ch.cost = game.i18n.format("advancementCost", { cost: DSA5_Utility._calculateAdvCost(ch.initial + ch.advances, "E") })
                ch.refund = game.i18n.format("refundCost", { cost: DSA5_Utility._calculateAdvCost(ch.initial + ch.advances, "E", 0) })
            }

            //We should iterate at some point over the items to prevent multiple loops

            let isFamiliar = data.items.find(x => x.name == game.i18n.localize('LocalizedIDs.familiar') && x.type == "trait") != undefined
            data.canAdvance = (data.type == "character" || isFamiliar) && this.owner
            data.isMage = isFamiliar || data.items.some(x => ["ritual", "spell", "magictrick"].includes(x.type) || (x.type == "specialability" && ["magical", "staff"].includes(x.data.category.value)))
            data.isPriest = data.items.some(x => ["ceremony", "liturgy", "blessing"].includes(x.type) || (x.type == "specialability" && ["ceremonial", "clerical"].includes(x.data.category.value)))
            if (data.canAdvance) {
                data.data.details.experience.current = data.data.details.experience.total - data.data.details.experience.spent;
                data.data.details.experience.description = DSA5_Utility.experienceDescription(data.data.details.experience.total)
            }

            if (data.type == "character" || data.type == "npc") {
                data.data.status.wounds.current = data.data.status.wounds.initial + data.data.characteristics.ko.value * 2
                data.data.status.soulpower.value = (data.data.status.soulpower.initial || 0) + Math.round((data.data.characteristics.mu.value + data.data.characteristics.kl.value + data.data.characteristics.in.value) / 6)
                data.data.status.toughness.value = (data.data.status.toughness.initial || 0) + Math.round((data.data.characteristics.ko.value + data.data.characteristics.ko.value + data.data.characteristics.kk.value) / 6)
                data.data.status.initiative.value = Math.round((data.data.characteristics.mu.value + data.data.characteristics.ge.value) / 2) + (data.data.status.initiative.modifier || 0)
            }

            data.data.status.fatePoints.max = Number(data.data.status.fatePoints.current) + Number(data.data.status.fatePoints.modifier) + data.data.status.fatePoints.gearmodifier

            if (data.type == "creature") {
                data.data.status.wounds.current = data.data.status.wounds.initial
                data.data.status.astralenergy.current = data.data.status.astralenergy.initial
                data.data.status.karmaenergy.current = data.data.status.karmaenergy.initial
                data.data.status.initiative.value = data.data.status.initiative.current + (data.data.status.initiative.modifier || 0)
            }

            data.data.status.wounds.max = data.data.status.wounds.current + data.data.status.wounds.modifier + data.data.status.wounds.advances + data.data.status.wounds.gearmodifier
            data.data.status.astralenergy.max = data.data.status.astralenergy.current + data.data.status.astralenergy.modifier + data.data.status.astralenergy.advances + data.data.status.astralenergy.gearmodifier
            data.data.status.karmaenergy.max = data.data.status.karmaenergy.current + data.data.status.karmaenergy.modifier + data.data.status.karmaenergy.advances + data.data.status.karmaenergy.gearmodifier

            let guide = data.data.guidevalue
            if (guide && data.type != "creature") {
                data.data.status.astralenergy.current = data.data.status.astralenergy.initial
                data.data.status.karmaenergy.current = data.data.status.karmaenergy.initial

                if (data.data.characteristics[guide.magical])
                    data.data.status.astralenergy.current += Math.round(data.data.characteristics[guide.magical].value * data.data.energyfactor.magical)

                if (data.data.characteristics[guide.clerical])
                    data.data.status.karmaenergy.current += Math.round(data.data.characteristics[guide.clerical].value * data.data.energyfactor.clerical)

                data.data.status.astralenergy.max = data.data.status.astralenergy.current + data.data.status.astralenergy.modifier + data.data.status.astralenergy.advances + data.data.status.astralenergy.gearmodifier
                data.data.status.karmaenergy.max = data.data.status.karmaenergy.current + data.data.status.karmaenergy.modifier + data.data.status.karmaenergy.advances + data.data.status.karmaenergy.gearmodifier
            }

            data.data.status.speed.max = data.data.status.speed.initial + (data.data.status.speed.modifier || 0) + data.data.status.speed.gearmodifier
            data.data.status.soulpower.max = data.data.status.soulpower.value + data.data.status.soulpower.modifier + data.data.status.soulpower.gearmodifier
            data.data.status.toughness.max = data.data.status.toughness.value + data.data.status.toughness.modifier + data.data.status.toughness.gearmodifier
            data.data.status.dodge.value = Math.round(data.data.characteristics.ge.value / 2) + data.data.status.dodge.gearmodifier

            let encumbrance = this.hasCondition('encumbered')
            encumbrance = encumbrance ? Number(encumbrance.flags.dsa5.value) : 0

            data.data.status.speed.max = Math.max(0, data.data.status.speed.max - (Math.min(4, encumbrance)))

            data.data.status.initiative.value += data.data.status.initiative.gearmodifier
            data.data.status.initiative.value -= (Math.min(4, encumbrance))
            const baseInit = Number((0.01 * data.data.status.initiative.value).toFixed(2))
            data.data.status.initiative.value *= data.data.status.initiative.multiplier || 1
            data.data.status.initiative.value += baseInit


            data.data.status.dodge.max = Number(data.data.status.dodge.value) + Number(data.data.status.dodge.modifier) + (Number(game.settings.get("dsa5", "higherDefense")) / 2)

            //Prevent double update with multiple GMs, still unsafe
            let activeGM = game.users.find(u => u.active && u.isGM)
            if (activeGM && game.user.id == activeGM.id) {
                let hasDefaultPain = data.type != "creature" || data.data.status.wounds.max >= 20
                let pain = 0
                if (hasDefaultPain) {
                    pain = Math.floor((1 - data.data.status.wounds.value / data.data.status.wounds.max) * 4)
                    if (data.data.status.wounds.value <= 5) pain = 4
                } else {
                    pain = Math.floor(5 - 5 * data.data.status.wounds.value / data.data.status.wounds.max)
                }

                if (pain < 4) pain -= AdvantageRulesDSA5.vantageStep(this, game.i18n.localize('LocalizedIDs.ruggedFighter'))
                if (pain > 0) pain += AdvantageRulesDSA5.vantageStep(this, game.i18n.localize('LocalizedIDs.sensitiveToPain'))

                pain = Math.max(Math.min(4, pain), 0)

                if (AdvantageRulesDSA5.hasVantage(this, game.i18n.localize('LocalizedIDs.blind'))) this.addCondition("blind")
                if (AdvantageRulesDSA5.hasVantage(this, game.i18n.localize('LocalizedIDs.mute'))) this.addCondition("mute")
                if (AdvantageRulesDSA5.hasVantage(this, game.i18n.localize('LocalizedIDs.deaf'))) this.addCondition("deaf")

                if (!TraitRulesDSA5.hasTrait(this, game.i18n.localize('LocalizedIDs.painImmunity'))) this.addCondition("inpain", pain, true)

                data.data.status.speed.max = Math.max(0, data.data.status.speed.max - pain)
            }

            let paralysis = this.hasCondition("paralysed")
            if (paralysis)
                data.data.status.speed.max = Math.round(data.data.status.speed.max * (1 - paralysis.flags.dsa5.value * 0.25))
            if (this.hasCondition("fixated")) {
                data.data.status.speed.max = 0
                data.data.status.dodge.max = Math.max(0, data.data.status.dodge.max - 4)
            } else if (this.hasCondition("rooted") || this.hasCondition("incapacitated"))
                data.data.status.speed.max = 0
            else if (this.hasCondition("prone"))
                data.data.status.speed.max = Math.min(1, data.data.status.speed.max)


        } catch (error) {
            console.error("Something went wrong with preparing actor data: " + error + error.stack)
            ui.notifications.error(game.i18n.localize("ACTOR.PreparationError") + error + error.stack)
        }
    }

    prepareEmbeddedEntities() {
        super.prepareEmbeddedEntities()
        let notAppliedEffects = []
        for (let ef of this.effects) {
            if (ef.data.origin) {
                let id = ef.data.origin.match(/[^.]+$/)[0]
                let item = this.items.get(id)
                if (!item) continue
                let apply = true
                switch (item.data.type) {
                    case "meleeweapon":
                    case "rangeweapon":
                    case "armor":
                        apply = item.data.data.worn.value
                        break
                    case "equipment":
                        apply = item.data.data.worn.wearable && item.data.data.worn.value
                        break
                    case "spell":
                    case "liturgy":
                    case "ceremony":
                    case "ritual":
                        apply = false
                }
                if (!apply) notAppliedEffects.push(ef.id)
            }
        }
        for (let id of notAppliedEffects) {
            this.effects.delete(id)
        }
    }

    prepareBaseData() {
        const data = this.data;

        mergeObject(data, {
            data: {
                skillModifiers: {
                    FP: [],
                    step: [],
                    QL: [],
                    TPM: [],
                    FW: [],
                    botch: 20,
                    crit: 1,
                    global: []
                },
                totalArmor: 0,
                carryModifier: 0,
                aspModifier: 0,
                kapModifier: 0,
                immunities: [],
                meleeStats: {
                    parry: 0,
                    attack: 0,
                    damage: "0",
                    defenseMalus: 0,
                    botch: 20,
                    crit: 1
                },
                rangeStats: {
                    attack: 0,
                    damage: "0",
                    defenseMalus: 0,
                    botch: 20,
                    crit: 1
                }
            }
        })

        for (const k of DSA5.gearModifyableCalculatedAttributes)
            if (data.data.status[k]) data.data.status[k].gearmodifier = 0

        for (let ch of Object.values(data.data.characteristics))
            ch.gearmodifier = 0

    }

    getSkillModifier(name) {
        let result = []
        const keys = ["FP", "step", "QL", "TPM", "FW"]
        for (const k of keys) {
            const type = k == "step" ? "" : k
            result.push(...this.data.data.skillModifiers[k].filter(x => x.target == name).map((f) => {
                return {
                    name: f.source,
                    value: f.value,
                    type
                }
            }))
        }

        return result
    }

    prepare() {
        let preparedData = duplicate(this.data)
        if (preparedData.canAdvance) {
            const attrs = ["wounds", "astralenergy", "karmaenergy"]
            for (const k of attrs) {
                preparedData.data.status[k].cost = game.i18n.format("advancementCost", { cost: DSA5_Utility._calculateAdvCost(preparedData.data.status[k].advances, "D") })
                preparedData.data.status[k].refund = game.i18n.format("refundCost", { cost: DSA5_Utility._calculateAdvCost(preparedData.data.status[k].advances, "D", 0) })
            }
        }
        mergeObject(preparedData, this.prepareItems())
        return preparedData;
    }

    static canAdvance(actorData) {
        return actorData.canAdvance
    }

    static armorValue(actor) {
        let wornArmor = actor.items.filter(x => x.type == "armor" && x.data.worn.value == true).reduce((a, b) => a + Number(b.data.protection.value), 0)
        let animalArmor = actor.items.filter(x => x.type == "trait" && x.data.traitType.value == "armor").reduce((a, b) => a + Number(b.data.at.value), 0)
        return wornArmor + animalArmor + (actor.data.totalArmor || 0)
    }

    static _calculateCombatSkillValues(i, actorData) {
        if (i.data.weapontype.value == "melee") {
            let vals = i.data.guidevalue.value.split('/').map(x =>
                Number(actorData.data.characteristics[x].initial) + Number(actorData.data.characteristics[x].modifier) + Number(actorData.data.characteristics[x].advances)
            );
            let parryChar = Math.max(...vals);
            i.data.parry.value = Math.ceil(i.data.talentValue.value / 2) + Math.max(0, Math.floor((parryChar - 8) / 3)) + Number(game.settings.get("dsa5", "higherDefense"))
            let attackChar = actorData.data.characteristics.mu.initial + actorData.data.characteristics.mu.modifier + actorData.data.characteristics.mu.advances;
            i.data.attack.value = i.data.talentValue.value + Math.max(0, Math.floor((attackChar - 8) / 3));
        } else {
            i.data.parry.value = 0;
            let attackChar = actorData.data.characteristics.ff.initial + actorData.data.characteristics.ff.modifier + actorData.data.characteristics.ff.advances;
            i.data.attack.value = i.data.talentValue.value + Math.max(0, Math.floor((attackChar - 8) / 3));
        }
        i.cost = game.i18n.format("advancementCost", { cost: DSA5_Utility._calculateAdvCost(i.data.talentValue.value, i.data.StF.value) })
        i.canAdvance = Actordsa5.canAdvance(actorData)
        return i;
    }

    _perpareItemAdvancementCost(item) {
        item.cost = game.i18n.format("advancementCost", { cost: DSA5_Utility._calculateAdvCost(item.data.talentValue.value, item.data.StF.value) })
        item.refund = game.i18n.format("refundCost", { cost: DSA5_Utility._calculateAdvCost(item.data.talentValue.value, item.data.StF.value, 0) })
        item.canAdvance = Actordsa5.canAdvance(this.data)
        return item
    }

    prepareItems() {
        let actorData = duplicate(this.data)
        let combatskills = [];
        let advantages = [];
        let disadvantages = []
        let aggregatedtests = []

        let specAbs = {
            general: [],
            Combat: [],
            fatePoints: [],
            magical: [],
            staff: [],
            clerical: [],
            language: [],
            animal: [],
            ceremonial: []
        }

        let armor = [];
        let rangeweapons = [];
        let meleeweapons = [];

        let magic = {
            hasSpells: this.data.isMage,
            hasPrayers: this.data.isPriest,
            liturgy: [],
            spell: [],
            ritual: [],
            ceremony: [],
            blessing: [],
            magictrick: []
        }

        let traits = {
            rangeAttack: [],
            meleeAttack: [],
            general: [],
            animal: [],
            familiar: [],
            armor: []
        }

        let schips = []
        for (let i = 1; i <= Number(actorData.data.status.fatePoints.max); i++) {
            schips.push({
                value: i,
                cssClass: i <= Number(actorData.data.status.fatePoints.value) ? "fullSchip" : "emptySchip"
            })
        }

        const inventory = {
            meleeweapons: {
                items: [],
                show: false,
                dataType: "meleeweapon"
            },
            rangeweapons: {
                items: [],
                show: false,
                dataType: "rangeweapon"
            },
            armor: {
                items: [],
                show: false,
                dataType: "armor"
            },
            ammunition: {
                items: [],
                show: false,
                dataType: "ammunition"
            },
        };

        for (let t in DSA5.equipmentTypes) {
            inventory[t] = {
                items: [],
                show: false,
                dataType: t
            }
        }

        inventory["poison"] = {
            items: [],
            show: false,
            dataType: "poison"
        }

        inventory["misc"].show = true

        const money = {
            coins: [],
            total: 0,
            show: true
        }

        actorData.items = actorData.items.sort((a, b) => { return a.name.localeCompare(b.name) })

        //we can later make equipment sortable
        //actorData.items = actorData.items.sort((a, b) => (a.sort || 0) - (b.sort || 0))

        let totalArmor = actorData.data.totalArmor || 0;
        let totalWeight = 0;
        let encumbrance = 0;

        let skills = {
            body: [],
            social: [],
            knowledge: [],
            trade: [],
            nature: []
        }

        for (let i of actorData.items) {
            try {
                switch (i.type) {
                    case "skill":
                        skills[i.data.group.value].push(this._perpareItemAdvancementCost(i))
                        break;
                    case "aggregatedTest":
                        aggregatedtests.push(i)
                        break
                    case "ritual":
                    case "spell":
                    case "liturgy":
                    case "ceremony":
                        magic[i.type].push(this._perpareItemAdvancementCost(i))
                        break;
                    case "magictrick":
                    case "blessing":
                        magic[i.type].push(i)
                        break;
                    case "trait":
                        switch (i.data.traitType.value) {
                            case "rangeAttack":
                                i = Actordsa5._prepareRangeTrait(i)
                                break
                            case "meleeAttack":
                                i = Actordsa5._prepareMeleetrait(i)
                                break
                            case "armor":
                                totalArmor += Number(i.data.at.value);
                                break
                        }
                        traits[i.data.traitType.value].push(i)
                        break
                    case "combatskill":
                        combatskills.push(Actordsa5._calculateCombatSkillValues(i, actorData));
                        break;
                    case "ammunition":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        inventory.ammunition.items.push(i);
                        inventory.ammunition.show = true;
                        totalWeight += Number(i.weight);
                        break;
                    case "meleeweapon":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        i.toggleValue = i.data.worn.value || false;
                        i.toggle = true
                        inventory.meleeweapons.items.push(Actordsa5._prepareitemStructure(i));
                        inventory.meleeweapons.show = true;
                        totalWeight += Number(i.weight);
                        break;
                    case "rangeweapon":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        i.toggleValue = i.data.worn.value || false;
                        i.toggle = true
                        inventory.rangeweapons.items.push(Actordsa5._prepareitemStructure(i));
                        inventory.rangeweapons.show = true;
                        totalWeight += Number(i.weight);
                        break;
                    case "armor":
                        i.toggleValue = i.data.worn.value || false;
                        inventory.armor.items.push(Actordsa5._prepareitemStructure(i));
                        inventory.armor.show = true;
                        i.toggle = true
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        totalWeight += parseFloat((i.data.weight.value * (i.toggleValue ? Math.max(0, i.data.quantity.value - 1) : i.data.quantity.value)).toFixed(3))

                        if (i.data.worn.value) {
                            encumbrance += Number(i.data.encumbrance.value);
                            totalArmor += Number(i.data.protection.value);
                            armor.push(i);
                        }
                        break;
                    case "poison":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        inventory["poison"].items.push(i);
                        inventory["poison"].show = true;
                        totalWeight += Number(i.weight);
                        break
                    case "consumable":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        inventory[i.data.equipmentType.value].items.push(Actordsa5._prepareConsumable(i));
                        inventory[i.data.equipmentType.value].show = true;
                        totalWeight += Number(i.weight);
                        break
                    case "consumable":
                    case "equipment":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        i.toggle = getProperty(i, "data.worn.wearable") || false

                        if (i.toggle) i.toggleValue = i.data.worn.value || false

                        inventory[i.data.equipmentType.value].items.push(Actordsa5._prepareitemStructure(i));
                        inventory[i.data.equipmentType.value].show = true;
                        totalWeight += Number(i.weight);
                        break;
                    case "money":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        money.coins.push(i);
                        totalWeight += Number(i.weight);
                        money.total += i.data.quantity.value * i.data.price.value;
                        break;
                    case "advantage":
                        advantages.push(i)
                        break;
                    case "disadvantage":
                        disadvantages.push(i)
                        break;
                    case "specialability":
                        specAbs[i.data.category.value].push(i)
                        break;
                }

            } catch (error) {
                this._itemPreparationError(i, error)
            }
        }

        for (let wep of inventory.rangeweapons.items) {
            try {
                if (wep.data.worn.value) rangeweapons.push(Actordsa5._prepareRangeWeapon(wep, inventory.ammunition.items, combatskills, this));
            } catch (error) {
                this._itemPreparationError(wep, error)
            }
        }

        let wornweapons = inventory.meleeweapons.items.filter(x => x.data.worn.value)
        let regex2h = /\(2H/

        for (let wep of wornweapons) {
            try {
                meleeweapons.push(Actordsa5._prepareMeleeWeapon(wep, combatskills, actorData, wornweapons.filter(x => x._id != wep._id && !regex2h.test(x.name))))
            } catch (error) {
                this._itemPreparationError(wep, error)
            }
        }

        money.coins = money.coins.sort((a, b) => (a.data.price.value > b.data.price.value) ? -1 : 1);

        //TODO move the encumbrance calculation to a better location
        encumbrance = Math.max(0, encumbrance - SpecialabilityRulesDSA5.abilityStep(this.data, game.i18n.localize('LocalizedIDs.inuredToEncumbrance')))

        let carrycapacity = actorData.data.characteristics.kk.value * 2 + actorData.data.carryModifier;

        if ((actorData.type != "creature" || actorData.canAdvance) && !this.isMerchant()) {
            encumbrance += Math.max(0, Math.ceil((totalWeight - carrycapacity - 4) / 4))
        }
        this.addCondition("encumbered", encumbrance, true)

        totalWeight = parseFloat(totalWeight.toFixed(3))

        specAbs.magical = specAbs.magical.concat(specAbs.staff)
        specAbs.clerical = specAbs.clerical.concat(specAbs.ceremonial)

        let characteristics = duplicate(DSA5.characteristics)
        characteristics["-"] = "-"

        return {
            totalWeight,
            totalArmor,
            money,
            encumbrance,
            carrycapacity,
            wornRangedWeapons: rangeweapons,
            wornMeleeWeapons: meleeweapons,
            advantages,
            disadvantages,
            specAbs,
            aggregatedtests,
            wornArmor: armor,
            inventory,
            itemModifiers: actorData.data.itemModifiers,
            languagePoints: {
                used: actorData.data.freeLanguagePoints ? actorData.data.freeLanguagePoints.used : 0,
                available: actorData.data.freeLanguagePoints ? actorData.data.freeLanguagePoints.value : 0
            },
            schips,
            guidevalues: characteristics,
            magic,
            traits,
            combatskills,
            canAdvance: this.data.canAdvance,
            sheetLocked: actorData.data.sheetLocked.value,
            allSkillsLeft: {
                body: skills.body,
                social: skills.social,
                nature: skills.nature
            },
            allSkillsRight: {
                knowledge: skills.knowledge,
                trade: skills.trade
            }
        }
    }

    isMerchant() {
        return ["merchant", "loot"].includes(getProperty(this.data, "data.merchant.merchantType"))
    }

    _itemPreparationError(item, error) {
        console.error("Something went wrong with preparing item " + item.name + ": " + error)
        console.log(error)
        console.log(wep)
        ui.notifications.error("Something went wrong with preparing item " + item.name + ": " + error)
    }

    _applyModiferTransformations(itemModifiers) {
        for (const [key, value] of Object.entries(itemModifiers)) {
            let shortCut = game.dsa5.config.knownShortcuts[key.toLowerCase()]
            if (shortCut)
                this.data.data[shortCut[0]][shortCut[1]][shortCut[2]] += value.value
            else
                delete itemModifiers[key]
        }
        return itemModifiers
    }

    _addGearAndAbilityModifiers(itemModifiers, i) {
        if (!i.data.effect || i.data.effect.value == undefined)
            return

        for (let mod of i.data.effect.value.split(/[,;]/).map(x => x.trim())) {
            let vals = mod.replace(/(\s+)/g, ' ').trim().split(" ")
            if (vals.length == 2 && !isNaN(vals[0]) && isNaN(vals[1])) {
                if (itemModifiers[vals[1]] == undefined) {
                    itemModifiers[vals[1]] = {
                        value: Number(vals[0]) * (i.data.step ? (Number(i.data.step.value) || 1) : 1),
                        sources: [i.name]
                    }
                } else {
                    itemModifiers[vals[1]].value += Number(vals[0]) * (i.data.step ? (Number(i.data.step.value) || 1) : 1)
                    itemModifiers[vals[1]].sources.push(i.name)
                }
            }
        }
    }

    async _updateAPs(APValue) {
        if (Actordsa5.canAdvance(this.data)) {
            if (!isNaN(APValue) && !(APValue == null)) {
                await this.update({
                    "data.details.experience.spent": Number(this.data.data.details.experience.spent) + Number(APValue),
                });
            } else {
                ui.notifications.error(game.i18n.localize("DSAError.APUpdateError"))
            }
        }
    }

    async checkEnoughXP(cost) {
        if (!Actordsa5.canAdvance(this.data)) return true
        if (isNaN(cost) || cost == null) return true

        if (Number(this.data.data.details.experience.total) - Number(this.data.data.details.experience.spent) >= cost) {
            return true
        } else if (Number(this.data.data.details.experience.total == 0)) {
            let selOptions = Object.entries(DSA5.startXP).map(([key, val]) => `<option value="${key}">${game.i18n.localize(val)} (${key})</option>`).join("")
            let template = `<p>${game.i18n.localize("DSAError.zeroXP")}</p><label>${game.i18n.localize('APValue')}: </label><select name ="APsel">${selOptions}</select>`
            let newXp = 0;
            let result = false;

            [result, newXp] = await new Promise((resolve, reject) => {
                new Dialog({
                    title: game.i18n.localize("DSAError.NotEnoughXP"),
                    content: template,
                    default: 'yes',
                    buttons: {
                        Yes: {
                            icon: '<i class="fa fa-check"></i>',
                            label: game.i18n.localize("yes"),
                            callback: dlg => {
                                resolve([true, dlg.find('[name="APsel"]')[0].value])
                            }
                        },
                        cancel: {
                            icon: '<i class="fas fa-times"></i>',
                            label: game.i18n.localize("cancel"),
                            callback: () => {
                                resolve([false, 0])
                            }
                        }
                    }
                }).render(true)
            })
            if (result) {
                await this.update({
                    "data.details.experience.total": Number(newXp)
                });
                return true
            }
        }
        ui.notifications.error(game.i18n.localize("DSAError.NotEnoughXP"))
        return false
    }

    setupWeapon(item, mode, options, tokenId) {
        options["mode"] = mode
        return Itemdsa5.getSubClass(item.type).setupDialog(null, options, item, this, tokenId)
    }

    setupWeaponless(statusId, options = {}, tokenId) {
        let item = duplicate(DSA5.defaultWeapon)
        item.name = game.i18n.localize(`${statusId}Weaponless`)
        item.data.data.combatskill = { value: game.i18n.localize("LocalizedIDs.wrestle") }
        item.data.type = "meleeweapon"
        item.data.data.damageThreshold.value = 14
        options["mode"] = statusId
        return Itemdsa5.getSubClass(item.type).setupDialog(null, options, item, this, tokenId)
    }

    setupSpell(spell, options = {}, tokenId) {
        return Itemdsa5.getSubClass(spell.type).setupDialog(null, options, spell, this, tokenId)
    }

    setupSkill(skill, options = {}, tokenId) {
        return Itemdsa5.getSubClass(skill.type).setupDialog(null, options, skill, this, tokenId)
    }

    applyDamage(amount) {
        const newVal = Math.min(this.data.data.status.wounds.max, this.data.data.status.wounds.value - amount)
        this.update({ "data.status.wounds.value": newVal })
    }

    applyMana(amount, type) {
        let state = type == "AsP" ? "astralenergy" : "karmaenergy"

        const newVal = Math.min(this.data.data.status[state].max, this.data.data.status[state].value - amount)
        if (newVal >= 0) {
            this.update({
                [`data.status.${state}.value`]: newVal
            })
        } else {
            ui.notifications.error(game.i18n.localize(`DSAError.NotEnough${type}`))
        }
    }

    preparePostRollAction(message) {
        let data = message.data.flags.data;
        let cardOptions = {
            flags: { img: message.data.flags.img },
            rollMode: data.rollMode,
            speaker: message.data.speaker,
            template: data.template,
            title: data.title,
            user: message.data.user
        };
        if (data.attackerMessage)
            cardOptions.attackerMessage = data.attackerMessage;
        if (data.defenderMessage)
            cardOptions.defenderMessage = data.defenderMessage;
        if (data.unopposedStartMessage)
            cardOptions.unopposedStartMessage = data.unopposedStartMessage;
        return cardOptions;
    }

    resetTargetAndMessage(data, cardOptions) {
        if (data.originalTargets && data.originalTargets.size > 0) {
            game.user.targets = data.originalTargets;
            game.user.targets.user = game.user;
        }
        if (!data.defenderMessage && data.startMessagesList) {
            cardOptions.startMessagesList = data.startMessagesList;
        }
    }

    async fatererollDamage(infoMsg, cardOptions, newTestData, message, data) {
        cardOptions.fatePointDamageRerollUsed = true;

        this.resetTargetAndMessage(data, cardOptions)

        let oldDamageRoll = duplicate(data.postData.damageRoll)
        let newRoll = await DiceDSA5.manualRolls(Roll.fromData(oldDamageRoll).reroll(), "CHATCONTEXT.rerollDamage")

        for (let i = 0; i < newRoll.dice.length; i++)
            newRoll.dice[i].options.colorset = "black"

        DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode)

        ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
        newTestData.damageRoll = duplicate(newRoll)

        this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
        await message.update({ "flags.data.fatePointDamageRerollUsed": true });
        this.update({ "data.status.fatePoints.value": this.data.data.status.fatePoints.value - 1 })
    }

    async fateisTalented(infoMsg, cardOptions, newTestData, message, data) {
            cardOptions.talentedRerollUsed = true;

            this.resetTargetAndMessage(data, cardOptions)

            infoMsg = `<h3 class="center"><b>${game.i18n.localize("CHATFATE.faitepointUsed")}</b></h3>
            ${game.i18n.format("CHATFATE.isTalented", { character: '<b>' + this.name + '</b>' })}<br>`;
            renderTemplate('systems/dsa5/templates/dialog/isTalentedReroll-dialog.html', { testData: newTestData, postData: data.postData }).then(html => {
                        new DSA5Dialog({
                                    title: game.i18n.localize("CHATFATE.selectDice"),
                                    content: html,
                                    buttons: {
                                        Yes: {
                                            icon: '<i class="fa fa-check"></i>',
                                            label: game.i18n.localize("Ok"),
                                            callback: async dlg => {

                                                    let diesToReroll = dlg.find('.dieSelected').map(function() { return Number($(this).attr('data-index')) }).get()
                                                    if (diesToReroll.length > 0) {

                                                        let newRoll = []
                                                        for (let k of diesToReroll) {
                                                            let term = newTestData.roll.terms[k * 2]
                                                            newRoll.push(term.number + "d" + term.faces + "[" + term.options.colorset + "]")
                                                        }
                                                        newRoll = await DiceDSA5.manualRolls(new Roll(newRoll.join("+")).roll(), "CHATCONTEXT.talentedReroll")
                                                        DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode)

                                                        let ind = 0
                                                        let changedRolls = []
                                                        for (let k of diesToReroll) {
                                                            const characteristic = newTestData.source.data[`characteristic${k + 1}`]
                                                            const attr = characteristic ? `${game.i18n.localize(`CHARAbbrev.${characteristic.value.toUpperCase()}`)} - ` : ""
                                    changedRolls.push(`${attr}${newTestData.roll.results[k * 2]}/${newRoll.results[ind * 2]}`)
                                    newTestData.roll.results[k * 2] = Math.min(newRoll.results[ind * 2], newTestData.roll.results[k * 2])
                                    newTestData.roll.terms[k * 2].results[0].result = Math.min(newRoll.results[ind * 2], newTestData.roll.terms[k * 2].results[0].result)
                                    ind += 1
                                }
                                infoMsg += `<b>${game.i18n.localize('Roll')}</b>: ${changedRolls.join(", ")}`
                                ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));

                                this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
                                message.update({
                                    "flags.data.talentedRerollUsed": true
                                });
                            }
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize("cancel")
                    },
                },
                default: 'Yes'
            }).render(true)
        });
    }

    async fatereroll(infoMsg, cardOptions, newTestData, message, data) {
        cardOptions.fatePointDamageRerollUsed = true;
        this.resetTargetAndMessage(data, cardOptions)

        renderTemplate('systems/dsa5/templates/dialog/fateReroll-dialog.html', { testData: newTestData, postData: data.postData }).then(html => {
            new DSA5Dialog({
                title: game.i18n.localize("CHATFATE.selectDice"),
                content: html,
                buttons: {
                    Yes: {
                        icon: '<i class="fa fa-check"></i>',
                        label: game.i18n.localize("Ok"),
                        callback: async dlg => {

                            let diesToReroll = dlg.find('.dieSelected').map(function() { return Number($(this).attr('data-index')) }).get()
                            if (diesToReroll.length > 0) {

                                let newRoll = []
                                for (let k of diesToReroll) {
                                    let term = newTestData.roll.terms[k * 2]
                                    newRoll.push(term.number + "d" + term.faces + "[" + term.options.colorset + "]")
                                }
                                newRoll = await DiceDSA5.manualRolls(new Roll(newRoll.join("+")).roll(), "CHATCONTEXT.Reroll")
                                DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode)

                                let ind = 0
                                let changedRolls = []
                                for (let k of diesToReroll) {
                                    const characteristic = newTestData.source.data[`characteristic${k + 1}`]
                                    const attr = characteristic ? `${game.i18n.localize(`CHARAbbrev.${characteristic.value.toUpperCase()}`)} - ` : ""
                                    changedRolls.push(`${attr}${newTestData.roll.results[k * 2]}/${newRoll.results[ind * 2]}`)
                                    newTestData.roll.results[k * 2] = newRoll.results[ind * 2]
                                    newTestData.roll.terms[k * 2].results[0].result = newRoll.results[ind * 2]
                                    ind += 1
                                }

                                infoMsg += `<br><b>${game.i18n.localize('Roll')}</b>: ${changedRolls.join(", ")}`
                                ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));

                                this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
                                message.update({ "flags.data.fatePointRerollUsed": true });
                                this.update({ "data.status.fatePoints.value": this.data.data.status.fatePoints.value - 1 })
                            }
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize("cancel")
                    },
                },
                default: 'Yes'
            }).render(true)
        });
    }

    async fateaddQS(infoMsg, cardOptions, newTestData, message, data) {
        ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
        game.user.targets.forEach(t => t.setTarget(false, { user: game.user, releaseOthers: false, groupSelection: true }));

        cardOptions.fatePointAddQSUsed = true;
        newTestData.qualityStep = 1

        this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
        message.update({ "flags.data.fatePointAddQSUsed": true });
        this.update({ "data.status.fatePoints.value": this.data.data.status.fatePoints.value - 1 })
    }

    async useFateOnRoll(message, type) {
        if (this.data.data.status.fatePoints.value > 0) {
            let data = message.data.flags.data
            let cardOptions = this.preparePostRollAction(message);

            let infoMsg = `<h3 class="center"><b>${game.i18n.localize("CHATFATE.faitepointUsed")}</b></h3>
                ${game.i18n.format("CHATFATE." + type, { character: '<b>' + this.name + '</b>' })}<br>
                <b>${game.i18n.localize("CHATFATE.PointsRemaining")}</b>: ${this.data.data.status.fatePoints.value - 1}`;

            let newTestData = data.preData
            newTestData.extra.actor = DSA5_Utility.getSpeaker(newTestData.extra.speaker).data
            this[`fate${type}`](infoMsg, cardOptions, newTestData, message, data)
        }
    }

    setupRegeneration(statusId, options = {}, tokenId) {
        let title = game.i18n.localize("regenerationTest");

        let testData = {
            source: {
                type: "regenerate",
                data: {}
            },
            opposable: false,
            extra: {
                statusId: statusId,
                actor: duplicate(this),
                options: options,
                speaker: {
                    token: tokenId,
                    actor: this.data._id
                }
            }
        };

        testData.extra.actor.isMage = this.data.isMage
        testData.extra.actor.isPriest = this.data.isPriest

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/regeneration-dialog.html",
            data: {
                rollMode: options.rollMode,
                regenerationInterruptOptions: DSA5.regenerationInterruptOptions,
                regnerationCampLocations: DSA5.regnerationCampLocations
            },
            callback: (html) => {
                testData.situationalModifiers = Actordsa5._parseModifiers('[name="situationalModifiers"]')
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers.push({
                    name: game.i18n.localize("camplocation") + " - " + html.find('[name="regnerationCampLocations"] option:selected').text(),
                    value: html.find('[name="regnerationCampLocations"]').val()
                }, {
                    name: game.i18n.localize("interruption") + " - " + html.find('[name="regenerationInterruptOptions"] option:selected').text(),
                    value: html.find('[name="regenerationInterruptOptions"]').val()
                })
                testData.regenerationFactor = html.find('[name="badEnvironment"]').is(":checked") ? 0.5 : 1
                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/regeneration-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    setupDodge(options = {}, tokenId) {
        const statusId = "dodge"
        let char = this.data.data.status[statusId];
        let title = game.i18n.localize(statusId) + " " + game.i18n.localize("Test");

        let testData = {
            source: {
                data: char,
                type: statusId
            },
            opposable: false,
            extra: {
                statusId: statusId,
                actor: duplicate(this),
                options: options,
                speaker: {
                    token: tokenId,
                    actor: this.data._id
                }
            }
        };

        let toSearch = [game.i18n.localize(statusId)]
        let combatskills = Itemdsa5.buildCombatSpecAbs(this, ["Combat"], toSearch, "parry")
        let situationalModifiers = DSA5StatusEffects.getRollModifiers(testData.extra.actor, testData.source)
        Itemdsa5.getDefenseMalus(situationalModifiers, this)

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/combatskill-enhanced-dialog.html",
            data: {
                rollMode: options.rollMode,
                combatSpecAbs: combatskills,
                showDefense: true,
                defenseCount: 0,
                situationalModifiers
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = Actordsa5._parseModifiers('[name="situationalModifiers"]')
                testData.situationalModifiers.push(...Itemdsa5.getSpecAbModifiers(html, "parry"))
                testData.situationalModifiers.push({
                    name: game.i18n.localize("attackFromBehind"),
                    value: html.find('[name="attackFromBehind"]').is(":checked") ? -4 : 0
                }, {
                    name: game.i18n.localize("defenseCount"),
                    value: (Number(html.find('[name="defenseCount"]').val()) || 0) * -3
                })
                return { testData, cardOptions };
            }
        };


        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/status-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    setupCharacteristic(characteristicId, options = {}, tokenId) {
        let char = this.data.data.characteristics[characteristicId];
        let title = game.i18n.localize(char.label) + " " + game.i18n.localize("Test");

        let testData = {
            opposable: false,
            source: {
                type: "char",
                data: char,
            },
            extra: {
                characteristicId: characteristicId,
                actor: duplicate(this),
                options: options,
                speaker: {
                    token: tokenId,
                    actor: this.data._id
                }
            }
        };

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/characteristic-dialog.html",
            data: {
                rollMode: options.rollMode,
                difficultyLabels: (DSA5.attributeDifficultyLabels),
                modifier: options.modifier || 0
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.testDifficulty = DSA5.attributeDifficultyModifiers[html.find('[name="testDifficulty"]').val()];
                testData.situationalModifiers = Actordsa5._parseModifiers('[name="situationalModifiers"]')
                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/characteristic-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    static _parseModifiers(search) {
        let res = []
        $(search + " option:selected").each(function() {
            const val = $(this).val()
            res.push({
                name: $(this).text().trim().split("[")[0],
                value: isNaN(val) ? val : Number(val),
                type: $(this).attr("data-type")
            })
        })
        return res
    }

    static _prepareConsumable(item) {
        item.consumable = true
        item.structureMax = item.data.maxCharges
        item.structureCurrent = item.data.charges
        return item
    }

    static _prepareitemStructure(item) {
        if (item.data.structure && item.data.structure.max != 0) {
            item.structureMax = item.data.structure.max
            item.structureCurrent = item.data.structure.value
        }
        return item
    }

    static _prepareMeleetrait(item) {
        item.attack = Number(item.data.at.value)
        if (item.data.pa != 0) item.parry = item.data.pa

        return this._parseDmg(item)
    }

    static _prepareMeleeWeapon(item, combatskills, actorData, wornWeapons = null) {
        let skill = combatskills.find(i => i.name == item.data.combatskill.value)
        if (skill) {
            item.attack = Number(skill.data.attack.value) + Number(item.data.atmod.value)
            item.parry = Number(skill.data.parry.value) + Number(item.data.pamod.value) + (item.data.combatskill.value == game.i18n.localize('LocalizedIDs.shields') ? Number(item.data.pamod.value) : 0)

            let regex2h = /\(2H/
            if (!regex2h.test(item.name)) {
                if (!wornWeapons)
                    wornWeapons = actorData.items.filter(x => (x.type == "meleeweapon" && x.data.worn.value && x._id != item._id && !regex2h.test(x.name)))

                if (wornWeapons.length > 0) {
                    item.parry += Math.max(...wornWeapons.map(x => x.data.pamod.offhandMod))
                    item.attack += Math.max(...wornWeapons.map(x => x.data.atmod.offhandMod))
                }
            }

            item = this._parseDmg(item)
            if (item.data.guidevalue.value != "-") {
                let val = Math.max(...(item.data.guidevalue.value.split("/").map(x => Number(actorData.data.characteristics[x].value))));
                let extra = val - Number(item.data.damageThreshold.value)

                if (extra > 0) {
                    item.extraDamage = extra;
                    item.damageAdd = Roll.MATH_PROXY.safeEval(item.damageAdd + " + " + Number(extra))
                    item.damageAdd = (item.damageAdd > 0 ? "+" : "") + item.damageAdd
                }
            }
        } else {
            ui.notifications.error(game.i18n.format("DSAError.unknownCombatSkill", { skill: item.data.combatskill.value, item: item.name }))
        }
        return item;
    }

    static _prepareRangeTrait(item) {
        item.attack = Number(item.data.at.value)
        return this._parseDmg(item)
    }

    static _parseDmg(item) {
        let parseDamage = new Roll(item.data.damage.value.replace(/[Ww]/g, "d"))
        let damageDie = "",
            damageTerm = ""
        for (let k of parseDamage.terms) {
            if (typeof(k) == 'object') damageDie = k.number + "d" + k.faces
            else damageTerm += k
        }
        damageTerm = Roll.MATH_PROXY.safeEval(damageTerm)
        item.damagedie = damageDie ? damageDie : "0d6"
        item.damageAdd = damageTerm != undefined ? (Number(damageTerm) > 0 ? "+" : "") + damageTerm : ""
        return item
    }

    static _prepareRangeWeapon(item, ammunitions, combatskills, actor) {
        let skill = combatskills.find(i => i.name == item.data.combatskill.value)
        if (skill) {
            item.attack = Number(skill.data.attack.value)

            if (item.data.ammunitiongroup.value != "-") {
                if (ammunitions) item.ammo = ammunitions.filter(x => x.data.ammunitiongroup.value == item.data.ammunitiongroup.value)
                else item.ammo = actorData.inventory.ammunition.items.filter(x => x.data.ammunitiongroup.value == item.data.ammunitiongroup.value)
            }
            item.LZ = Math.max(0, Number(item.data.reloadTime.value) - SpecialabilityRulesDSA5.abilityStep(actor, `${game.i18n.localize('LocalizedIDs.quickload')} (${game.i18n.localize(item.data.combatskill.value)})`))
        } else {
            ui.notifications.error(game.i18n.format("DSAError.unknownCombatSkill", { skill: item.data.combatskill.value, item: item.name }))
        }
        return this._parseDmg(item)
    }

    _setupCardOptions(template, title) {
        let cardOptions = {
            speaker: {
                alias: this.data.token.name,
                actor: this.data._id,
            },
            title: title,
            template: template,
            flags: { img: this.data.token.randomImg ? this.data.img : this.data.token.img }
        }
        if (this.token) {
            cardOptions.speaker.alias = this.token.data.name;
            cardOptions.speaker.token = this.token.data._id;
            cardOptions.speaker.scene = canvas.scene._id
            cardOptions.flags.img = this.token.data.img;
        } else {
            let speaker = ChatMessage.getSpeaker()
            if (speaker.actor == this.data._id) {
                cardOptions.speaker.alias = speaker.alias
                cardOptions.speaker.token = speaker.token
                cardOptions.speaker.scene = speaker.scene
                cardOptions.flags.img = speaker.token ? canvas.tokens.get(speaker.token).data.img : cardOptions.flags.img
            }
        }
        return cardOptions
    }

    async basicTest({ testData, cardOptions }, options = {}) {
        testData = await DiceDSA5.rollDices(testData, cardOptions);
        let result = await DiceDSA5.rollTest(testData);

        result.postFunction = "basicTest";

        if (game.user.targets.size) {
            cardOptions.isOpposedTest = testData.opposable
            if (cardOptions.isOpposedTest) cardOptions.title += ` - ${game.i18n.localize("Opposed")}`;
            else if (game.settings.get("dsa5", "clearTargets")) game.user.updateTokenTargets([]);
        }

        if (testData.extra.ammo && !testData.extra.ammoDecreased) {
            testData.extra.ammoDecreased = true
            testData.extra.ammo.data.quantity.value--;
            this.updateEmbeddedEntity("OwnedItem", { _id: testData.extra.ammo._id, "data.quantity.value": testData.extra.ammo.data.quantity.value });
        }

        if (!options.suppressMessage)
            DiceDSA5.renderRollCard(cardOptions, result, options.rerenderMessage).then(msg => {
                OpposedDsa5.handleOpposedTarget(msg)
            })
        return { result, cardOptions };
    }

    async addCondition(effect, value = 1, absolute = false, auto = true) {
        return await DSA5StatusEffects.addCondition(this, effect, value, absolute, auto)
    }

    async _dependentEffects(statusId, effect, delta) {
        if (effect.flags.dsa5.value == 4 && ["encumbered", "stunned", "feared", "inpain", "confused"].includes(statusId)) await this.addCondition("incapacitated")

        if (effect.flags.dsa5.value == 4 && (statusId == "paralysed")) await this.addCondition("rooted")

        if (statusId == "unconscious") await this.addCondition("prone")

        if (delta > 0 && statusId == "inpain" && !this.hasCondition("bloodrush") && AdvantageRulesDSA5.hasVantage(this, game.i18n.localize('LocalizedIDs.frenzy'))) {
            await this.addCondition("bloodrush")
            let msg = DSA5_Utility.replaceConditions(`${game.i18n.format("CHATNOTIFICATION.gainsBloodrush", {character: "<b>" + this.name + "</b>"})}`);
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
        }
    }

    async removeCondition(effect, value = 1, auto = true, absolute = false) {
        return await DSA5StatusEffects.removeCondition(this, effect, value, auto, absolute)
    }

    hasCondition(conditionKey) {
        return DSA5StatusEffects.hasCondition(this, conditionKey)
    }
}