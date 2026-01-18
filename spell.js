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
 * Valid values for Range.origin
 */
export const ORIGIN_TYPES = ["self", "touch", "point", "special"];

/**
 * Valid values for Range.unit
 */
export const UNIT_TYPES = ["feet", "miles", "unlimited", ""];

/**
 * Valid values for Range.area and Range.areaUnit
 */
export const AREA_TYPES = [
    "",
    "circle",
    "cone",
    "cube",
    "cylinder",
    "emanation",
    "hemisphere",
    "line",
    "sphere",
    "square",
    "radius",
    "wall",
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
 * Represents the range of a spell (flattened structure).
 * @example { origin: "point", distance: 60, unit: "feet", requiresSight: false, area: "", areaDistance: 0, areaUnit: "", areaHeight: 0, areaHeightUnit: "", targets: 0 }
 * @example { origin: "self", distance: 0, unit: "", requiresSight: false, area: "cone", areaDistance: 15, areaUnit: "feet", areaHeight: 0, areaHeightUnit: "", targets: 0 }
 * @example { origin: "touch", distance: 0, unit: "", requiresSight: false, area: "", areaDistance: 0, areaUnit: "", areaHeight: 0, areaHeightUnit: "", targets: 10 }
 */
export class Range {
    /**
     * @param {Object} data - The range data.
     * @param {string} data.origin - Where the spell originates: "self", "touch", "point".
     * @param {number} [data.distance] - The casting distance (0 for self/touch/unlimited).
     * @param {string} [data.unit] - The distance unit: "feet", "miles", "unlimited", or "" for self/touch.
     * @param {boolean} [data.requiresSight] - Whether the spell requires sight of target.
     * @param {string} [data.area] - The area of effect shape: "cone", "cube", "cylinder", "emanation", "hemisphere", "line", "sphere", "radius", or "".
     * @param {number} [data.areaDistance] - The size/radius of the area of effect.
     * @param {string} [data.areaUnit] - The unit for area size: "feet", "miles", or "".
     * @param {number} [data.areaHeight] - The height of the area (for cylinders).
     * @param {string} [data.areaHeightUnit] - The unit for area height: "feet", "miles", or "".
     * @param {number} [data.targets] - The number of targets (0 if not specified or area-based, -1 if unlimited, -2 if variable).
     */
    constructor({ origin, distance, unit, requiresSight, area, areaDistance, areaUnit, areaHeight, areaHeightUnit, targets }) {
        if (!ORIGIN_TYPES.includes(origin)) {
            throw new Error(
                `Invalid range origin: "${origin}". Expected one of: ${ORIGIN_TYPES.join(", ")}`
            );
        }
        if (unit && !UNIT_TYPES.includes(unit)) {
            throw new Error(
                `Invalid range unit: "${unit}". Expected one of: ${UNIT_TYPES.join(", ")}`
            );
        }
        if (area && !AREA_TYPES.includes(area)) {
            throw new Error(
                `Invalid area type: "${area}". Expected one of: ${AREA_TYPES.join(", ")}`
            );
        }
        this.origin = origin;
        this.distance = distance || 0;
        this.unit = unit || "";
        this.requiresSight = requiresSight || false;
        this.area = area || "";
        this.areaDistance = areaDistance || 0;
        this.areaUnit = areaUnit || "";
        this.areaHeight = areaHeight || 0;
        this.areaHeightUnit = areaHeightUnit || "";
        this.targets = targets || 0;
    }

    toJSON() {
        return {
            origin: this.origin,
            distance: this.distance,
            unit: this.unit,
            requiresSight: this.requiresSight,
            area: this.area,
            areaDistance: this.areaDistance,
            areaUnit: this.areaUnit,
            areaHeight: this.areaHeight,
            areaHeightUnit: this.areaHeightUnit,
            targets: this.targets,
        };
    }

    static fromJSON(json) {
        if (!json) return undefined;
        return new Range(json);
    }
}

/**
 * Represents the duration of a spell (flattened structure).
 * @example { type: "instant", amount: 0, unit: "", ends: [] }
 * @example { type: "timed", amount: 1, unit: "minute", ends: [] }
 * @example { type: "permanent", amount: 0, unit: "", ends: ["dispel", "trigger"] }
 */
export class Duration {
    /**
     * @param {Object} data - The duration data.
     * @param {string} data.type - The duration type: "instant", "timed", "permanent", "special".
     * @param {number} [data.amount] - For "timed" type: the numeric amount.
     * @param {string} [data.unit] - For "timed" type: the time unit ("round", "minute", "hour", "day").
     * @param {string[]} [data.ends] - How the spell ends (for "permanent"): "dispel", "trigger", etc.
     */
    constructor({ type, amount, unit, ends }) {
        if (!DURATION_TYPES.includes(type)) {
            throw new Error(
                `Invalid duration type: "${type}". Expected one of: ${DURATION_TYPES.join(
                    ", "
                )}`
            );
        }
        if (unit && !DURATION_TIME_TYPES.includes(unit)) {
            throw new Error(
                `Invalid duration unit: "${unit}". Expected one of: ${DURATION_TIME_TYPES.join(
                    ", "
                )}`
            );
        }
        this.type = type;
        this.amount = amount || 0;
        this.unit = unit || "";
        this.ends = ends || [];
    }

    toJSON() {
        return {
            type: this.type,
            amount: this.amount,
            unit: this.unit,
            ends: this.ends,
        };
    }

    static fromJSON(json) {
        if (!json) return undefined;
        return new Duration(json);
    }
}

/**
 * Represents the spell components (verbal, somatic, material).
 * @example { v: true, s: true, m: false, hasCost: false, isConsumed: false, description: "" }
 * @example { v: true, s: true, m: true, hasCost: true, isConsumed: true, description: "diamond worth 500 gp, which the spell consumes" }
 */
export class Components {
    /**
     * @param {Object} data - The components data.
     * @param {boolean} [data.v] - Whether the spell has a verbal component.
     * @param {boolean} [data.s] - Whether the spell has a somatic component.
     * @param {boolean} [data.m] - Whether the spell has a material component.
     * @param {boolean} [data.hasCost] - Whether the material component has a specified cost.
     * @param {boolean} [data.isConsumed] - Whether the spell consumes the material component.
     * @param {string} [data.description] - Description text for components (e.g., material component details).
     */
    constructor({ v, s, m, hasCost, isConsumed, description }) {
        this.v = v || false;
        this.s = s || false;
        this.m = m || false;
        // hasCost and isConsumed can only be true if m is true
        this.hasCost = this.m && (hasCost || false);
        this.isConsumed = this.m && (isConsumed || false);
        this.description = description || "";
    }

    toJSON() {
        return {
            v: this.v,
            s: this.s,
            m: this.m,
            hasCost: this.hasCost,
            isConsumed: this.isConsumed,
            description: this.description,
        };
    }

    static fromJSON(json) {
        if (!json) return undefined;
        return new Components(json);
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
     * @param {string} [data.subtitle] - Optional subtitle for the spell.
     * @param {string} data.source - The source book abbreviation.
     * @param {number} [data.page] - The page number in the source book.
     * @param {boolean} data.isSRD - Whether the spell is included in the SRD.
     * @param {number} data.level - The spell level (0 for cantrips).
     * @param {string} data.school - The school of magic (full name).
     * @param {CastingTime|Object} data.time - Casting time information.
     * @param {Range|Object} data.range - Range information.
     * @param {Components|Object} data.components - Component requirements (v, s, m, hasCost, isConsumed, description).
     * @param {Duration|Object} data.duration - Duration information.
     * @param {string} data.description - The spell description (markdown with placeholders).
     * @param {string} [data.upcast] - Description of effects when cast at higher levels (optional).
     * @param {string[]} data.classes - List of classes that can cast this spell.
     * @param {boolean} data.isConcentration - Whether the spell requires concentration.
     * @param {boolean} data.isRitual - Whether the spell can be cast as a ritual.
     */
    constructor({
        name,
        subtitle,
        source,
        page,
        isSRD,
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
    }) {
        this.name = name;
        this.subtitle = subtitle || "";
        this.source = source;
        this.page = page;
        this.isSRD = isSRD || false;
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
    }

    /**
     * Serializes the spell to a plain JSON-serializable object.
     * @returns {Object} A plain object suitable for JSON serialization.
     */
    toJSON() {
        const obj = {
            name: this.name,
            subtitle: this.subtitle,
            source: this.source,
            page: this.page,
            isSRD: this.isSRD,
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
            subtitle: json.subtitle,
            source: json.source,
            page: json.page,
            isSRD: json.isSRD,
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
        });
    }
}
