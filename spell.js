/**
 * Map of spell school abbreviations to full names.
 */
export const SCHOOL_MAP = {
    A: "Abjuration",
    C: "Conjuration",
    D: "Divination",
    E: "Enchantment",
    V: "Evocation",
    I: "Illusion",
    N: "Necromancy",
    T: "Transmutation",
};

/**
 * Valid values for Distance.type
 */
export const DISTANCE_TYPES = [
    "feet",
    "miles",
    "touch",
    "self",
    "sight",
    "unlimited",
];

/**
 * Valid values for Range.type
 */
export const RANGE_TYPES = [
    "point",
    "cone",
    "sphere",
    "line",
    "cube",
    "emanation",
    "hemisphere",
    "radius",
    "special",
];

/**
 * Valid values for Duration.type
 */
export const DURATION_TYPES = ["instant", "timed", "permanent", "special"];

/**
 * Valid values for DurationTime.type
 */
export const DURATION_TIME_TYPES = ["round", "minute", "hour", "day"];

/**
 * Valid values for CastingTime.unit
 */
export const CASTING_TIME_UNITS = [
    "action",
    "bonus",
    "reaction",
    "minute",
    "hour",
];

/**
 * Represents a distance measurement.
 * @example { type: "feet", amount: 60 }
 * @example { type: "touch" }
 * @example { type: "self" }
 */
export class Distance {
    /**
     * @param {Object} data - The distance data.
     * @param {string} data.type - The distance type: "feet", "miles", "touch", "self", "sight", "unlimited".
     * @param {number} [data.amount] - The numeric distance (only for "feet" or "miles").
     */
    constructor({ type, amount }) {
        if (!DISTANCE_TYPES.includes(type)) {
            throw new Error(
                `Invalid distance type: "${type}". Expected one of: ${DISTANCE_TYPES.join(
                    ", "
                )}`
            );
        }
        this.type = type;
        this.amount = amount;
    }

    toJSON() {
        const obj = { type: this.type };
        if (this.amount !== undefined) {
            obj.amount = this.amount;
        }
        return obj;
    }

    static fromJSON(json) {
        if (!json) return undefined;
        return new Distance(json);
    }
}

/**
 * Represents the range of a spell.
 * @example { type: "point", distance: { type: "feet", amount: 60 } }
 * @example { type: "cone", distance: { type: "feet", amount: 30 } }
 * @example { type: "special" } (no distance, e.g., Dream spell)
 */
export class Range {
    /**
     * @param {Object} data - The range data.
     * @param {string} data.type - The range type: "point", "cone", "sphere", "line", "cube", "emanation", "hemisphere", "radius", "special".
     * @param {Object} [data.distance] - The distance information (optional for "special" type).
     */
    constructor({ type, distance }) {
        if (!RANGE_TYPES.includes(type)) {
            throw new Error(
                `Invalid range type: "${type}". Expected one of: ${RANGE_TYPES.join(
                    ", "
                )}`
            );
        }
        this.type = type;
        this.distance = distance
            ? distance instanceof Distance
                ? distance
                : new Distance(distance)
            : undefined;
    }

    toJSON() {
        const obj = { type: this.type };
        if (this.distance) {
            obj.distance = this.distance.toJSON();
        }
        return obj;
    }

    static fromJSON(json) {
        if (!json) return undefined;
        return new Range({
            type: json.type,
            distance: json.distance
                ? Distance.fromJSON(json.distance)
                : undefined,
        });
    }
}

/**
 * Represents the time portion of a timed duration.
 * @example { type: "minute", amount: 1 }
 * @example { type: "hour", amount: 8 }
 */
export class DurationTime {
    /**
     * @param {Object} data - The duration time data.
     * @param {string} data.type - The time unit: "round", "minute", "hour", "day".
     * @param {number} data.amount - The numeric amount.
     */
    constructor({ type, amount }) {
        if (!DURATION_TIME_TYPES.includes(type)) {
            throw new Error(
                `Invalid duration time type: "${type}". Expected one of: ${DURATION_TIME_TYPES.join(
                    ", "
                )}`
            );
        }
        this.type = type;
        this.amount = amount;
    }

    toJSON() {
        return {
            type: this.type,
            amount: this.amount,
        };
    }

    static fromJSON(json) {
        if (!json) return undefined;
        return new DurationTime(json);
    }
}

/**
 * Represents the duration of a spell.
 * @example { type: "instant" }
 * @example { type: "timed", duration: { type: "minute", amount: 1 } }
 * @example { type: "permanent", ends: ["dispel", "trigger"] }
 */
export class Duration {
    /**
     * @param {Object} data - The duration data.
     * @param {string} data.type - The duration type: "instant", "timed", "permanent", "special".
     * @param {Object} [data.duration] - For "timed" type: the time duration.
     * @param {string[]} [data.ends] - How the spell ends (for "permanent"): "dispel", "trigger", etc.
     */
    constructor({ type, duration, ends }) {
        if (!DURATION_TYPES.includes(type)) {
            throw new Error(
                `Invalid duration type: "${type}". Expected one of: ${DURATION_TYPES.join(
                    ", "
                )}`
            );
        }
        this.type = type;
        this.duration =
            duration instanceof DurationTime
                ? duration
                : duration
                ? new DurationTime(duration)
                : undefined;
        this.ends = ends;
    }

    toJSON() {
        const obj = { type: this.type };
        if (this.duration) {
            obj.duration = this.duration.toJSON();
        }
        if (this.ends) {
            obj.ends = this.ends;
        }
        return obj;
    }

    static fromJSON(json) {
        if (!json) return undefined;
        return new Duration({
            type: json.type,
            duration: json.duration
                ? DurationTime.fromJSON(json.duration)
                : undefined,
            ends: json.ends,
        });
    }
}

/**
 * Represents material component details when the component has special properties.
 * @example { text: "a gem worth at least 50 gp", hasCost: true }
 * @example { text: "incense worth at least 300 gp, which the spell consumes", hasCost: true, isConsumed: true }
 */
export class MaterialComponent {
    /**
     * @param {Object} data - The material component data.
     * @param {string} data.text - The description of the material component.
     * @param {boolean} [data.hasCost] - Whether the component has a specified cost.
     * @param {boolean} [data.isConsumed] - Whether the spell consumes the component.
     */
    constructor({ text, hasCost, isConsumed }) {
        this.text = text;
        this.hasCost = hasCost || false;
        this.isConsumed = isConsumed || false;
    }

    toJSON() {
        const obj = { text: this.text };
        if (this.hasCost) {
            obj.hasCost = true;
        }
        if (this.isConsumed) {
            obj.isConsumed = true;
        }
        return obj;
    }

    static fromJSON(json) {
        if (!json) return undefined;
        if (typeof json === "string") {
            return json; // Simple string material component
        }
        return new MaterialComponent(json);
    }
}

/**
 * Represents the spell components (verbal, somatic, material).
 * @example { v: true, s: true }
 * @example { v: true, s: true, m: "a feather" }
 * @example { v: true, s: true, m: { text: "diamond worth 500 gp", hasCost: true, isConsumed: true } }
 */
export class Components {
    /**
     * @param {Object} data - The components data.
     * @param {boolean} [data.v] - Whether the spell has a verbal component.
     * @param {boolean} [data.s] - Whether the spell has a somatic component.
     * @param {string|Object} [data.m] - The material component (string or MaterialComponent).
     */
    constructor({ v, s, m }) {
        this.v = v || false;
        this.s = s || false;
        this.m =
            m !== undefined
                ? typeof m === "string" || m instanceof MaterialComponent
                    ? m
                    : new MaterialComponent(m)
                : undefined;
    }

    /**
     * Returns the material component text (if any).
     * @returns {string|undefined}
     */
    getMaterialText() {
        if (!this.m) return undefined;
        if (typeof this.m === "string") return this.m;
        return this.m.text;
    }

    toJSON() {
        const obj = {};
        if (this.v) obj.v = true;
        if (this.s) obj.s = true;
        if (this.m) {
            obj.m = typeof this.m === "string" ? this.m : this.m.toJSON();
        }
        return obj;
    }

    static fromJSON(json) {
        if (!json) return undefined;
        return new Components({
            v: json.v,
            s: json.s,
            m: json.m ? MaterialComponent.fromJSON(json.m) : undefined,
        });
    }
}

/**
 * Represents the casting time of a spell.
 * @example { number: 1, unit: "action" }
 * @example { number: 1, unit: "reaction", condition: "which you take when you see a creature casting a spell" }
 * @example { number: 10, unit: "minute" }
 */
export class CastingTime {
    /**
     * @param {Object} data - The casting time data.
     * @param {number} data.number - The numeric amount.
     * @param {string} data.unit - The time unit: "action", "bonus", "reaction", "minute", "hour".
     * @param {string} [data.condition] - The trigger condition (for reactions).
     */
    constructor({ number, unit, condition }) {
        if (!CASTING_TIME_UNITS.includes(unit)) {
            throw new Error(
                `Invalid casting time unit: "${unit}". Expected one of: ${CASTING_TIME_UNITS.join(
                    ", "
                )}`
            );
        }
        this.number = number;
        this.unit = unit;
        this.condition = condition;
    }

    toJSON() {
        const obj = {
            number: this.number,
            unit: this.unit,
        };
        if (this.condition) {
            obj.condition = this.condition;
        }
        return obj;
    }

    static fromJSON(json) {
        if (!json) return undefined;
        return new CastingTime(json);
    }
}

/**
 * Represents a D&D spell with all necessary data for card generation.
 */
export class Spell {
    /**
     * @param {Object} data - The spell data.
     * @param {string} data.name - The name of the spell.
     * @param {string} data.source - The source book abbreviation.
     * @param {number} [data.page] - The page number in the source book.
     * @param {number} data.level - The spell level (0 for cantrips).
     * @param {string} data.school - The school of magic (full name).
     * @param {CastingTime|Object} data.time - Casting time information.
     * @param {Range|Object} data.range - Range information.
     * @param {Components|Object} data.components - Component requirements (v, s, m).
     * @param {Duration|Object} data.duration - Duration information.
     * @param {string} data.description - The spell description (markdown with placeholders).
     * @param {string} [data.upcast] - Description of effects when cast at higher levels (optional).
     * @param {string[]} data.classes - List of classes that can cast this spell.
     * @param {boolean} data.isConcentration - Whether the spell requires concentration.
     * @param {boolean} data.isRitual - Whether the spell can be cast as a ritual.
     * @param {boolean} data.requiresSight - Whether the spell requires sight of target.
     */
    constructor({
        name,
        source,
        page,
        level,
        school,
        time,
        range,
        components,
        duration,
        description,
        upcast,
        classes,
        isConcentration,
        isRitual,
        requiresSight,
    }) {
        this.name = name;
        this.source = source;
        this.page = page;
        this.level = level;
        this.school = school;

        // Convert time to CastingTime instance
        this.time = time instanceof CastingTime ? time : new CastingTime(time);

        // Convert range to Range instance
        this.range = range instanceof Range ? range : new Range(range);

        // Convert components to Components instance
        this.components =
            components instanceof Components
                ? components
                : new Components(components);

        // Convert duration to Duration instance
        this.duration =
            duration instanceof Duration ? duration : new Duration(duration);

        this.description = description;
        this.upcast = upcast;
        this.classes = classes || [];
        this.isConcentration = isConcentration || false;
        this.isRitual = isRitual || false;
        this.requiresSight = requiresSight || false;
    }

    /**
     * Serializes the spell to a plain JSON-serializable object.
     * @returns {Object} A plain object suitable for JSON serialization.
     */
    toJSON() {
        const obj = {
            name: this.name,
            source: this.source,
            page: this.page,
            level: this.level,
            school: this.school,
            time: this.time.toJSON(),
            range: this.range.toJSON(),
            components: this.components.toJSON(),
            duration: this.duration.toJSON(),
            description: this.description,
            classes: this.classes,
            isConcentration: this.isConcentration,
            isRitual: this.isRitual,
            requiresSight: this.requiresSight,
        };

        if (this.upcast) {
            obj.upcast = this.upcast;
        }

        return obj;
    }

    /**
     * Creates a Spell instance from a JSON object (e.g., from spells.json).
     * @param {Object} json - The JSON object representing a spell.
     * @returns {Spell} A new Spell instance.
     */
    static fromJSON(json) {
        return new Spell({
            name: json.name,
            source: json.source,
            page: json.page,
            level: json.level,
            school: json.school,
            time: CastingTime.fromJSON(json.time),
            range: Range.fromJSON(json.range),
            components: Components.fromJSON(json.components),
            duration: Duration.fromJSON(json.duration),
            description: json.description,
            upcast: json.upcast,
            classes: json.classes,
            isConcentration: json.isConcentration,
            isRitual: json.isRitual,
            requiresSight: json.requiresSight,
        });
    }
}
