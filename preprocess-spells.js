import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Spell, SCHOOL_MAP } from "./js/spell.js";

/**
 * List of text patterns that should be wrapped as icon placeholders.
 * These patterns are replaced with backtick-wrapped text during preprocessing,
 * which the card generator then renders as icons.
 */
const ICON_TEXT_PATTERNS = [
    "action",
    "bonus",
    "reaction",
    "acid damage",
    "cold damage",
    "fire damage",
    "lightning damage",
    "necrotic damage",
    "poison damage",
    "psychic damage",
    "radiant damage",
    "slashing damage",
    "bludgeoning damage",
    "piercing damage",
    "thunder damage",
    "force damage",
    "emanation",
    "line",
    "cone",
    "cube",
    "cylinder",
    "sphere",
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
    throw new Error(
        "data directory not found. Please run the download-spell-data.sh script first."
    );
}

const spellFiles = fs
    .readdirSync(dataDir)
    .filter((file) => file.startsWith("spells-") && file.endsWith(".json"));
const sourcesFile = path.join(dataDir, "sources.json");
if (!fs.existsSync(sourcesFile)) {
    throw new Error(
        "sources.json not found. Please run the download-spell-data.sh script first."
    );
}

const allRawSpells = [];

// Read all spell files
for (const file of spellFiles) {
    const filePath = path.join(dataDir, file);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const spells = JSON.parse(fileContent).spell;
    if (spells) {
        allRawSpells.push(...spells);
    }
}

// Read sources file
const sourcesContent = fs.readFileSync(sourcesFile, "utf-8");
const sourcesData = JSON.parse(sourcesContent);

// Supported classes - Monk is excluded because only a single outdated spell has it
// and we don't have an icon for it
const SUPPORTED_CLASSES = [
    "Artificer",
    "Bard",
    "Cleric",
    "Druid",
    "Paladin",
    "Ranger",
    "Sorcerer",
    "Warlock",
    "Wizard",
];

// Create a map of spell names to classes
const spellClassMap = {};
for (const source in sourcesData) {
    for (const spellName in sourcesData[source]) {
        if (!spellClassMap[spellName]) {
            spellClassMap[spellName] = [];
        }
        const classList =
            sourcesData[source][spellName].class ||
            sourcesData[source][spellName].classVariant ||
            [];
        classList.forEach((c) => {
            // Only include supported classes (excludes Monk, etc.)
            if (
                SUPPORTED_CLASSES.includes(c.name) &&
                !spellClassMap[spellName].includes(c.name)
            ) {
                spellClassMap[spellName].push(c.name);
            }
        });
    }
}

/**
 * Gets the display text from tag parts.
 * Format: {@tag reference|source|display}
 * - 1 part: just the reference → use it
 * - 2 parts: reference|source → use reference (first part)
 * - 3+ parts: reference|source|display → use display (last part)
 * @param {string[]} parts - The parts split by |
 * @returns {string} The display text.
 */
function getDisplayText(parts) {
    if (parts.length >= 3) {
        return parts[parts.length - 1];
    }
    return parts[0];
}

/**
 * Processes a string to replace {@...} tags.
 * @param {string} text - The text to process.
 * @returns {string} The processed text.
 */
function processString(text) {
    if (typeof text !== "string") {
        return "";
    }

    // Tags that should be wrapped in **bold**
    const boldTags = [
        "damage",
        "scaledamage",
        "dice",
        "skill",
        "status",
        "sense",
        "b",
        "scaledice",
        "hazard",
        "hit",
        "condition",
    ];

    // Tags that should be wrapped in *italics*
    const italicTags = ["i"];

    let processedText = text.replace(
        /\{@(\w+)\s([^}]+)\}/g,
        (match, tag, value) => {
            const parts = value.split("|");
            const tagLower = tag.toLowerCase();

            // Special handling for @dc → **DC X**
            if (tagLower === "dc") {
                return `**DC ${parts[0]}**`;
            }

            // Special handling for @variantrule with Area of Effect → `icon`
            if (
                tagLower === "variantrule" &&
                parts[0].includes("[Area of Effect]")
            ) {
                return `\`${getDisplayText(parts)}\``;
            }

            // Bold tags
            if (boldTags.includes(tagLower)) {
                return `**${getDisplayText(parts)}**`;
            }

            // Italic tags
            if (italicTags.includes(tagLower)) {
                return `*${getDisplayText(parts)}*`;
            }

            // Default: just return the display text
            return getDisplayText(parts);
        }
    );

    // Wrap area of effect words in backticks (for older sources without @variantrule tags)
    // These are safe to wrap unconditionally (always used as AoE):
    const safeAoeWords = [
        "cone",
        "cube",
        "cylinder",
        "emanation",
        "hemisphere",
        "sphere",
    ];
    safeAoeWords.forEach((word) => {
        // Match the word not already wrapped in backticks (case insensitive)
        const regex = new RegExp(`(?<!\`)\\b(${word})\\b(?!\`)`, "gi");
        processedText = processedText.replace(regex, "`$1`");
    });

    // "line" needs special handling - only wrap when used as AoE shape
    // Match patterns like "X-foot line", "in a line", "in that line"
    processedText = processedText.replace(
        /(\d+-foot(?:-\w+)?\s+)(line)\b(?!`)/gi,
        "$1`$2`"
    );
    processedText = processedText.replace(
        /\b(in (?:a|that|the)\s+)(line)\b(?!`)/gi,
        "$1`$2`"
    );

    // "square" needs special handling - avoid "square feet" false positives
    // Match patterns like "X-foot square"
    processedText = processedText.replace(
        /(\d+-foot(?:-\w+)?\s+)(square)\b(?!`| feet)/gi,
        "$1`$2`"
    );

    // "circle" needs special handling - avoid "teleportation circle", "Magic Circle", etc.
    // Match patterns like "X-foot-radius circle", "X-foot radius circle", "X-foot-diameter circle"
    processedText = processedText.replace(
        /(\d+-foot(?:-(?:radius|diameter))?\s+(?:radius\s+|diameter\s+)?)(circle)\b(?!`)/gi,
        "$1`$2`"
    );

    // Wrap damage types in backticks for icon replacement
    const damageTypes = [
        "acid",
        "bludgeoning",
        "cold",
        "fire",
        "force",
        "lightning",
        "necrotic",
        "piercing",
        "poison",
        "psychic",
        "radiant",
        "slashing",
        "thunder",
    ];
    const damageTypesPattern = damageTypes.join("|");

    // First, handle immunity/resistance/vulnerability lists like "Immunity to Cold, Poison, and Psychic damage"
    // These need special handling because only the last type has "damage" after it
    // Match the entire phrase and wrap each damage type individually
    processedText = processedText.replace(
        new RegExp(
            `\\b(Immunity|Resistance|Vulnerability) to ([^.]+?)(${damageTypesPattern}) damage\\b`,
            "gi"
        ),
        (match, keyword, middle, lastType) => {
            // Wrap each damage type in the middle part
            const wrappedMiddle = middle.replace(
                new RegExp(`\\b(${damageTypesPattern})\\b`, "gi"),
                "`$1 damage`"
            );
            return `${keyword} to ${wrappedMiddle}\`${lastType} damage\``;
        }
    );

    // Then handle standalone "X damage" patterns
    const damageRegex = new RegExp(
        `\\b(${damageTypesPattern})( damage)\\b(?!\`)`,
        "gi"
    );
    processedText = processedText.replace(damageRegex, "`$1$2`");

    // Wrap currency abbreviations in backticks (for coin icons)
    // Handle numbers with commas like "25,000 gp", with + like "25,000+ gp", and plain numbers like "100 gp"
    processedText = processedText.replace(
        /\b([\d,]+\+?)\s*(gp|sp|cp)\b(?!`)/gi,
        "`$1 $2`"
    );

    // Wrap action economy terms in backticks
    // For "bonus action" - wrap entire phrase for B icon
    // For "action" and "reaction" - wrap only the word itself for A/R icon

    // "Bonus Action(s)" - wrap entire phrase (becomes B icon)
    processedText = processedText.replace(
        /\b(bonus action)s?\b(?!`)/gi,
        "`$1`"
    );

    // "Reaction(s)" - wrap only "reaction" (becomes R icon)
    processedText = processedText.replace(/\b(reactions?)\b(?!`)/gi, "`$1`");

    // "Action" (singular) - only wrap "action" when clearly referring to action economy
    // Avoid: "interaction", "course of action"
    // These patterns match the context but only wrap "action"
    const actionContextPatterns = [
        /\b(an )(action)\b(?!`)/gi,
        /\b(the )(action)\b(?!`)/gi,
        /\b(as an )(action)\b(?!`)/gi,
        /\b(use (?:an |your |its )?)(action)\b(?!`)/gi,
        /\b(uses (?:an |its )?)(action)\b(?!`)/gi,
        /\b(take (?:an |the |its )?)(action)\b(?!`)/gi,
        /\b(takes (?:an |the |its )?)(action)\b(?!`)/gi,
        /\b(no )(action)\b(?!`)/gi,
        /\b(one )(action)\b(?!`)/gi,
        /\b((?:Dodge|Attack|Dash|Disengage|Help|Hide|Ready|Search|Use|Magic|Study|Influence|Utilize) )(action)\b(?!`)/gi,
        /\b(Use an Object )(action)\b(?!`)/gi,
        /\b(1 )(action)\b(?!`)/gi,
        /\b(that )(action)\b(?!`)/gi,
        /\b(what )(action)\b(?!`)/gi,
        /\b(additional )(action)\b(?!`)/gi,
        /\b(wastes? (?:its |their )?)(action)\b(?!`)/gi,
        /\b(only )(action)\b(?!`)/gi,
        /\b((?:your |its |their )?)(action)\b(?!`)/gi,
    ];
    actionContextPatterns.forEach((pattern) => {
        processedText = processedText.replace(pattern, "$1`$2`");
    });

    // "Actions" (plural) - wrap just "actions" when in game mechanics context
    // Avoid: "mimic your actions", "course of actions", "resolves their actions"
    // Match "actions" after specific game-context words
    processedText = processedText.replace(
        /\b(take|takes|no|other|only the|the only|use|can't take|magic|legendary|lair)\s+(actions)\b(?!`)/gi,
        "$1 `$2`"
    );
    // Match "the actions [pronoun] [verb]" patterns (game mechanics context)
    processedText = processedText.replace(
        /\b(the)\s+(actions)\s+(it|you|they)\b(?!`)/gi,
        "$1 `$2` $3"
    );
    // Match possessive + "actions" like "target's actions", "creature's actions"
    processedText = processedText.replace(
        /\b(\w+'s)\s+(actions)\b(?!`)/gi,
        "$1 `$2`"
    );

    // Wrap saving throws in bold (e.g., "Wisdom saving throw" → "**Wisdom saving throw**")
    const abilities = [
        "Strength",
        "Dexterity",
        "Constitution",
        "Intelligence",
        "Wisdom",
        "Charisma",
    ];
    const abilitiesPattern = abilities.join("|");
    processedText = processedText.replace(
        new RegExp(
            `\\b(${abilitiesPattern}) (saving throws?)\\b(?!\\*\\*)`,
            "gi"
        ),
        "**$1 $2**"
    );

    // Wrap spell attacks in bold (e.g., "melee spell attack" → "**melee spell attack**")
    processedText = processedText.replace(
        /\b((?:melee|ranged) spell attacks?)\b(?!\*\*)/gi,
        "**$1**"
    );

    // Wrap ability checks in bold
    // Handles: "Wisdom check", "Wisdom checks", "Wisdom (Perception) check", etc.
    // First, handle checks with skill in parentheses (may have **skill** from earlier processing)
    processedText = processedText.replace(
        new RegExp(
            `\\b(${abilitiesPattern})\\s*\\(\\*\\*([^*]+)\\*\\*\\)\\s*(checks?)\\b`,
            "gi"
        ),
        "**$1 ($2) $3**"
    );
    // Then handle simple ability checks without skill
    processedText = processedText.replace(
        new RegExp(`\\b(${abilitiesPattern})\\s+(checks?)\\b(?!\\*\\*)`, "gi"),
        "**$1 $2**"
    );

    // Wrap light levels in bold (e.g., "Dim Light", "Bright Light")
    processedText = processedText.replace(
        /\b((?:Dim|Bright) Light)\b(?!\*\*)/gi,
        "**$1**"
    );

    return processedText;
}

/**
 * Processes an array of spell description entries into a single markdown string.
 * It handles strings, lists, tables, and nested entries recursively.
 * Placeholders in the format {@...} are converted to readable text or placeholders.
 * @param {Array<string|object>} entries - The array of spell description entries.
 * @param {boolean} [isHigherLevel=false] - Whether these entries are for higher levels.
 * @returns {string} The processed markdown string.
 */
function processEntries(entries, isHigherLevel = false) {
    if (!entries) {
        return "";
    }

    let result = "";

    for (const entry of entries) {
        if (typeof entry === "string") {
            result += processString(entry) + "\n\n";
        } else if (entry.type === "list") {
            result +=
                entry.items
                    .map((item) => {
                        if (typeof item === "string") {
                            return `- ${processString(item)}`;
                        } else if (item.type === "item") {
                            // Handle items with name and entry/entries (XPHB uses entries array)
                            const body =
                                item.entry != null
                                    ? processString(item.entry)
                                    : item.entries
                                    ? processEntries(item.entries).trim()
                                    : "";
                            return `- **${item.name}** ${body}`.trimEnd();
                        }
                        return "";
                    })
                    .join("\n") + "\n\n";
        } else if (entry.type === "table") {
            result += `| ${entry.colLabels
                .map((label) => processString(label))
                .join(" | ")} |\n`;
            result += `| ${entry.colLabels.map(() => "---").join(" | ")} |\n`;
            result +=
                entry.rows
                    .map(
                        (row) =>
                            `| ${row
                                .map((cell) => {
                                    if (typeof cell === "string") {
                                        return processString(cell);
                                    } else if (
                                        cell &&
                                        typeof cell === "object"
                                    ) {
                                        // Handle complex cell objects (e.g., {type: 'cell', roll: {exact: 1}})
                                        if (cell.roll) {
                                            if (cell.roll.exact !== undefined) {
                                                return String(cell.roll.exact);
                                            } else if (
                                                cell.roll.min !== undefined &&
                                                cell.roll.max !== undefined
                                            ) {
                                                return `${cell.roll.min}-${cell.roll.max}`;
                                            }
                                        }
                                        // Fallback: try to extract any text content
                                        if (cell.entry) {
                                            return processString(cell.entry);
                                        }
                                    }
                                    return "";
                                })
                                .join(" | ")} |`
                    )
                    .join("\n") + "\n\n";
        } else if (entry.type === "entries") {
            // Skip upcast headers when processing higher level entries
            const upcastHeaders = [
                "At Higher Levels",
                "Using a Higher-Level Spell Slot",
                "Cantrip Upgrade",
            ];
            const isUpcastHeader =
                isHigherLevel && upcastHeaders.includes(entry.name);
            if (entry.name && !isUpcastHeader) {
                result += `**${entry.name}**\n`;
            }
            result += processEntries(entry.entries, isHigherLevel);
        }
    }
    return result;
}

/**
 * Processes raw components data into a flat structure.
 * @param {Object} rawComponents - The raw components data.
 * @returns {Object} Processed components data with flat structure.
 */
function processComponents(rawComponents) {
    if (!rawComponents) {
        return {
            v: false,
            s: false,
            m: false,
            hasCost: false,
            isConsumed: false,
            description: "",
        };
    }

    let description = "";
    let hasCost = false;
    let isConsumed = false;

    if (rawComponents.m) {
        if (typeof rawComponents.m === "string") {
            description = rawComponents.m;
        } else {
            description = rawComponents.m.text || "";
            hasCost = rawComponents.m.cost !== undefined;
            isConsumed = rawComponents.m.consume || false;
        }
    }

    return {
        v: rawComponents.v || false,
        s: rawComponents.s || false,
        m: rawComponents.m !== undefined,
        hasCost,
        isConsumed,
        description,
    };
}

/**
 * Map of areaTags to area type names.
 * C = Cube (3D volume)
 * Q = sQuare (2D ground area)
 * R = Radius/circle (2D circular ground area)
 * W = Wall (dimensions not parsed - too complex)
 */
const AREA_TAG_MAP = {
    S: "sphere",
    C: "cube",
    L: "line",
    Q: "square",
    Y: "cylinder",
    H: "hemisphere",
    N: "cone",
    R: "circle",
    W: "wall",
};

/**
 * Shape types that indicate the range.type is actually an area of effect.
 */
const SHAPE_TYPES = [
    "cone",
    "sphere",
    "line",
    "cube",
    "emanation",
    "hemisphere",
    "radius",
    "cylinder",
];

/**
 * Parses area dimensions from spell description text.
 * @param {string} text - The spell description text.
 * @param {string} areaType - The area type (sphere, cube, line, etc.).
 * @returns {{ areaDistance: number, areaUnit: string, areaHeight: number, areaHeightUnit: string }} The parsed dimensions.
 */
function parseAreaDimensions(text, areaType) {
    if (!text || !areaType) {
        return {
            areaDistance: 0,
            areaUnit: "",
            areaHeight: 0,
            areaHeightUnit: "",
        };
    }

    let areaDistance = 0;
    let areaUnit = "";
    let areaHeight = 0;
    let areaHeightUnit = "";

    // For cylinders, try to extract both radius and height
    if (areaType === "cylinder") {
        // Pattern: "X-foot-radius, Y-foot-tall/high cylinder" or "X-foot-radius, Y-foot tall/high"
        const cylinderPattern1 =
            /(\d+)-foot-radius[,\s]+(\d+)-foot[- ]?(?:tall|high)/i;
        const cylinderMatch1 = text.match(cylinderPattern1);
        if (cylinderMatch1) {
            areaDistance = parseInt(cylinderMatch1[1], 10);
            areaUnit = "feet";
            areaHeight = parseInt(cylinderMatch1[2], 10);
            areaHeightUnit = "feet";
            return { areaDistance, areaUnit, areaHeight, areaHeightUnit };
        }

        // Pattern: "Y-foot-tall, X-foot-radius Cylinder" (height first, XPHB style)
        const cylinderPattern2 = /(\d+)-foot-tall[,\s]+(\d+)-foot-radius/i;
        const cylinderMatch2 = text.match(cylinderPattern2);
        if (cylinderMatch2) {
            areaHeight = parseInt(cylinderMatch2[1], 10);
            areaHeightUnit = "feet";
            areaDistance = parseInt(cylinderMatch2[2], 10);
            areaUnit = "feet";
            return { areaDistance, areaUnit, areaHeight, areaHeightUnit };
        }

        // Pattern: "Y-foot-tall cylinder with a X-foot radius" (PHB style)
        const cylinderPattern3 =
            /(\d+)-foot-tall\s+cylinder\s+with\s+a\s+(\d+)-foot\s+radius/i;
        const cylinderMatch3 = text.match(cylinderPattern3);
        if (cylinderMatch3) {
            areaHeight = parseInt(cylinderMatch3[1], 10);
            areaHeightUnit = "feet";
            areaDistance = parseInt(cylinderMatch3[2], 10);
            areaUnit = "feet";
            return { areaDistance, areaUnit, areaHeight, areaHeightUnit };
        }

        // Pattern: "Y feet tall with a X-foot radius"
        const tallWithRadiusPattern =
            /(\d+)\s+feet\s+tall\s+with\s+a\s+(\d+)-foot\s+radius/i;
        const tallWithRadiusMatch = text.match(tallWithRadiusPattern);
        if (tallWithRadiusMatch) {
            areaHeight = parseInt(tallWithRadiusMatch[1], 10);
            areaHeightUnit = "feet";
            areaDistance = parseInt(tallWithRadiusMatch[2], 10);
            areaUnit = "feet";
            return { areaDistance, areaUnit, areaHeight, areaHeightUnit };
        }
    }

    // For circles (R tag), parse radius from text
    if (areaType === "circle") {
        // Pattern: "X-foot radius centered on", "X-foot-radius circle"
        const circlePatterns = [
            /(\d+)-foot-radius\s+circle/i,
            /(\d+)-foot\s+radius\s+centered/i,
            /in\s+a\s+(\d+)-foot\s+radius/i,
            /(\d+)-foot-radius\s+(?:centered|area)/i,
        ];
        for (const pattern of circlePatterns) {
            const match = text.match(pattern);
            if (match) {
                return {
                    areaDistance: parseInt(match[1], 10),
                    areaUnit: "feet",
                    areaHeight: 0,
                    areaHeightUnit: "",
                };
            }
        }
    }

    // Patterns to match area dimensions (case-insensitive)
    const patterns = [
        // "20-foot-radius {@variantrule Sphere...}" (XPHB style)
        /(\d+)-foot-radius\s+\{@variantrule\s+(?:Sphere|Cylinder|Emanation|Hemisphere)/i,
        // "20-foot-radius sphere", "10-foot-radius cylinder"
        /(\d+)-foot-radius\s+(?:sphere|cylinder|emanation|hemisphere)/i,
        // "radius of up to 40 feet"
        /radius\s+of\s+(?:up\s+to\s+)?(\d+)\s+feet/i,
        // "20-foot cube", "20-foot square", "15-foot cone"
        /(\d+)-foot\s+(?:cube|square|cone|sphere)/i,
        // "20-foot {@variantrule Cube...}" (XPHB style)
        /(\d+)-foot\s+\{@variantrule\s+(?:Cube|Cone|Line|Square)/i,
        // "cube 5 feet on each side", "cube up to 100 feet on a side"
        /cube\s+(?:up\s+to\s+)?(\d+)\s+feet\s+on\s+(?:each|a)\s+side/i,
        // "30 feet long" (for lines)
        /(\d+)\s+feet\s+long/i,
        // "X-foot line" or "X-foot {@variantrule Line...}"
        /(\d+)-foot(?:\s+\{@variantrule)?\s*line/i,
        // "10 feet tall with a 60-foot radius" - take the radius
        /(\d+)-foot\s+radius/i,
        // "within X feet" for area effects like Cordon of Arrows
        /within\s+(\d+)\s+feet\s+of/i,
        // Generic "X-foot" followed by area type (case insensitive on area)
        new RegExp(
            `(\\d+)-foot(?:-\\w+)?\\s+(?:\\{@variantrule[^}]+\\})?\\s*${areaType}`,
            "i"
        ),
        // "X feet" followed by area type
        new RegExp(`(\\d+)\\s+feet\\s+${areaType}`, "i"),
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return {
                areaDistance: parseInt(match[1], 10),
                areaUnit: "feet",
                areaHeight: 0,
                areaHeightUnit: "",
            };
        }
    }

    // Check for mile-based dimensions (rare)
    const milePattern = /(\d+)-mile(?:-radius)?\s+(?:sphere|radius|area)/i;
    const mileMatch = text.match(milePattern);
    if (mileMatch) {
        return {
            areaDistance: parseInt(mileMatch[1], 10),
            areaUnit: "miles",
            areaHeight: 0,
            areaHeightUnit: "",
        };
    }

    return { areaDistance: 0, areaUnit: "", areaHeight: 0, areaHeightUnit: "" };
}

/**
 * Extracts text from spell entries for area dimension parsing.
 * @param {Array} entries - The spell entries array.
 * @returns {string} Combined text from entries.
 */
function getEntriesText(entries) {
    if (!entries) return "";

    let text = "";
    for (const entry of entries) {
        if (typeof entry === "string") {
            text += entry + " ";
        } else if (entry.entries) {
            text += getEntriesText(entry.entries) + " ";
        }
    }
    return text;
}

/**
 * Map of number words to integers.
 */
const NUMBER_WORDS = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
};

/**
 * Parses the number of targets from spell description text.
 * @param {string} text - The spell description text.
 * @returns {number} The number of targets:
 *   - 0: not found or area-based
 *   - -1: unlimited ("any number")
 *   - -2: variable (1+, depends on level/modifier/choice)
 *   - positive: specific count
 */
function parseTargets(text) {
    if (!text) return 0;

    // Check for unlimited targets patterns first
    if (/any number of/i.test(text)) {
        return -1;
    }
    // "each creature of your choice" or "creatures of your choice" without a specific number = unlimited
    if (/(?:each |all )?creatures? (?:of your choice|you choose)/i.test(text)) {
        // Check if there's NOT a specific number word before "creature(s)"
        // Allow for optional words like "willing" between number and "creatures"
        const hasNumberBefore =
            /(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)(?: \w+)? creatures? (?:of your choice|you choose)/i.test(
                text
            );
        if (!hasNumberBefore) {
            return -1;
        }
    }

    // Check for variable (1+) patterns - return -2
    // These must be checked BEFORE numbered patterns to avoid partial matches
    const variablePatterns = [
        // "one or two creatures" or "choose one creature ... or choose two" (Acid Splash PHB)
        /(?:one|1) or (?:two|2) creatures?/i,
        /choose (?:one|1) creature.+or choose (?:two|2) creatures?/i,
        // Modifier-dependent: "number of objects/creatures is equal to your ... modifier"
        // Must specifically mention objects/creatures/targets, not damage dice
        /number of (?:objects|creatures|targets).+(?:equal to|equals).+modifier/i,
        /maximum number of (?:objects|creatures|targets).+equal.+modifier/i,
        // Level-scaling beams (Eldritch Blast): "more than one beam when you reach higher levels"
        /more than one beam when you reach higher levels/i,
        /creates more than one beam/i,
        // Complex multi-option (Giant Insect PHB): "up to ten centipedes, three spiders, five wasps, or one scorpion"
        /up to \w+ \w+, \w+ \w+, \w+ \w+, or \w+ \w+/i,
    ];

    for (const pattern of variablePatterns) {
        if (pattern.test(text)) {
            return -2;
        }
    }

    // Build number word pattern for matching
    const numWordPattern = Object.keys(NUMBER_WORDS).join("|");

    // Patterns to match target counts (with explicit number)
    const numberedPatterns = [
        // "up to X creatures" or "up to X willing/falling creatures"
        /up to (\w+)(?: \w+)? creatures?/i,
        // "up to X objects" (Animate Objects PHB)
        /up to (\w+)(?: \w+)? objects?/i,
        // "X or fewer creatures" (Mass Suggestion)
        /(\w+) or fewer creatures?/i,
        // "X creatures of your choice" or "X creatures you can see"
        /(\w+) creatures? (?:of your choice|you can see|you choose|within range)/i,
        // "choose X creatures"
        /choose (\w+) creatures?/i,
        // "target X creatures"
        /target (\w+) creatures?/i,
        // "X other targets" (Chain Lightning)
        /(\w+) other targets?/i,
        // "X darts/rays/bolts/beams" with optional adjective (Magic Missile, Scorching Ray)
        // Must start with a number word to avoid matching "create three rays"
        new RegExp(
            `(${numWordPattern}|\\d+)(?: \\w+)? (?:darts?|rays?|bolts?|beams?)`,
            "i"
        ),
        // "X pillars" (Bones of the Earth)
        new RegExp(`(${numWordPattern}|\\d+)(?: \\w+)? pillars?`, "i"),
    ];

    for (const pattern of numberedPatterns) {
        const match = text.match(pattern);
        if (match) {
            const numStr = match[1].toLowerCase();
            // Try to parse as number word
            if (NUMBER_WORDS[numStr] !== undefined) {
                return NUMBER_WORDS[numStr];
            }
            // Try to parse as digit
            const num = parseInt(numStr, 10);
            if (!isNaN(num)) {
                return num;
            }
        }
    }

    // Patterns for "a creature" or "one humanoid" (singular, meaning 1 target)
    const singularPatterns = [
        /choose a (?:willing )?creature/i,
        /a (?:willing )?creature (?:of your choice|you can see|within range)/i,
        /target a creature/i,
        /choose one humanoid/i,
        /one humanoid (?:within range|you can see)/i,
        // "one creature or object" (Eldritch Blast XPHB)
        /one creature or object/i,
        /against one creature/i,
        // "summon a giant X" (Giant Insect XPHB)
        /summon a giant/i,
        // Touch/melee spell patterns
        /a creature within your reach/i,
        /a creature you can reach/i,
        /a creature (?:that )?you (?:try to )?touch/i,
        /attack against a creature/i,
    ];

    for (const pattern of singularPatterns) {
        if (text.match(pattern)) {
            return 1;
        }
    }

    // Check for blade/weapon spells that make multiple attacks (Blade of Disaster)
    // Must explicitly mention "two" or multiple attacks, not just "make a melee spell attack"
    if (
        /you can make two melee spell attacks/i.test(text) ||
        /make up to \w+ (?:melee )?spell attacks/i.test(text)
    ) {
        return -2; // Variable attacks
    }

    return 0;
}

/**
 * Processes raw range data into a flat structure with origin, distance, unit, area info.
 * @param {Object} rawRange - The raw range data.
 * @param {boolean} requiresSight - Whether the spell requires sight of target (from miscTags).
 * @param {string[]} areaTags - The area tags from the spell (e.g., ['S'] for sphere).
 * @param {Array} entries - The spell entries for parsing area dimensions.
 * @returns {Object} Processed range data with flat structure.
 */
function processRange(rawRange, requiresSight, areaTags, entries) {
    const rangeType = rawRange.type;
    const distanceType = rawRange.distance?.type || "";
    const distanceAmount = rawRange.distance?.amount || 0;

    // Default values
    let origin = "point";
    let distance = 0;
    let unit = "";
    let area = "";
    let areaDistance = 0;
    let areaUnit = "";
    let areaHeight = 0;
    let areaHeightUnit = "";

    // If range.type is a shape, it's a self-emanating area effect
    if (SHAPE_TYPES.includes(rangeType)) {
        origin = "self";
        area = rangeType;
        areaDistance = distanceAmount;
        areaUnit =
            distanceType === "feet" || distanceType === "miles"
                ? distanceType
                : "";

        // For self-emanating areas, also try to parse height from text (for cylinders)
        if (area === "cylinder" && entries) {
            const entriesText = getEntriesText(entries);
            const parsed = parseAreaDimensions(entriesText, area);
            if (parsed.areaHeight > 0) {
                areaHeight = parsed.areaHeight;
                areaHeightUnit = parsed.areaHeightUnit;
            }
        }
    }
    // If range.type is "special", use special origin
    else if (rangeType === "special") {
        origin = "special";
    }
    // If range.type is "point", determine origin from distance.type
    else if (rangeType === "point") {
        if (distanceType === "self") {
            origin = "self";
        } else if (distanceType === "touch") {
            origin = "touch";
        } else if (distanceType === "sight") {
            origin = "point";
            unit = "unlimited";
            // requiresSight is already set from miscTags, but sight range implies it
            requiresSight = true;
        } else if (distanceType === "unlimited") {
            origin = "point";
            unit = "unlimited";
        } else if (distanceType === "feet" || distanceType === "miles") {
            origin = "point";
            distance = distanceAmount;
            unit = distanceType;
        }

        // Check areaTags for area type (for spells like Fireball)
        if (areaTags && areaTags.length > 0) {
            for (const tag of areaTags) {
                if (AREA_TAG_MAP[tag]) {
                    area = AREA_TAG_MAP[tag];
                    break;
                }
            }
        }

        // Parse area dimensions from spell text if we have an area type
        if (area && entries) {
            const entriesText = getEntriesText(entries);
            const parsed = parseAreaDimensions(entriesText, area);
            areaDistance = parsed.areaDistance;
            areaUnit = parsed.areaUnit;
            areaHeight = parsed.areaHeight;
            areaHeightUnit = parsed.areaHeightUnit;
        }
    }

    // Parse target count from spell text
    let targets = 0;
    if (entries) {
        const entriesText = getEntriesText(entries);
        targets = parseTargets(entriesText);
    }

    return {
        origin,
        distance,
        unit,
        requiresSight,
        area,
        areaDistance,
        areaUnit,
        areaHeight,
        areaHeightUnit,
        targets,
    };
}

/**
 * Processes raw duration data into a flat structure with type, amount, unit, ends.
 * @param {Object} rawDuration - The raw duration data.
 * @returns {Object} Processed duration data with flat structure.
 */
function processDuration(rawDuration) {
    const type = rawDuration.type;
    let amount = 0;
    let unit = "";
    let ends = [];

    if (type === "timed" && rawDuration.duration) {
        amount = rawDuration.duration.amount || 0;
        unit = rawDuration.duration.type || "";
    }

    if (rawDuration.ends) {
        ends = rawDuration.ends;
    }

    return { type, amount, unit, ends };
}

/**
 * Converts a raw spell object from the source data into a Spell instance.
 * @param {Object} rawSpell - The raw spell data from the source JSON.
 * @returns {Spell} A Spell instance.
 */
function createSpellFromRaw(rawSpell) {
    const schoolName = SCHOOL_MAP[rawSpell.school];
    if (!schoolName) {
        throw new Error(
            `Unknown school: ${rawSpell.school} for spell ${rawSpell.name}`
        );
    }

    // Use the first entry from time and duration arrays
    const primaryTime = { ...rawSpell.time[0] };
    // Process the condition text if present (for reactions)
    if (primaryTime.condition) {
        primaryTime.condition = processString(primaryTime.condition);
    }
    const rawDuration = rawSpell.duration[0];
    const areaTags = rawSpell.areaTags || [];

    // Determine if spell requires sight of target
    // Check SGT miscTag first, then fallback to checking entries text for "you can see" targeting patterns
    let requiresSight = (rawSpell.miscTags || []).includes("SGT");
    if (!requiresSight && rawSpell.entries) {
        const entriesText = JSON.stringify(rawSpell.entries).toLowerCase();
        // Match patterns like "creature you can see", "space you can see", etc.
        // Note: "place" is excluded because spells like Dimension Door use "place you can see" as one option among others
        requiresSight =
            /(?:creature|target|point|humanoid|beast|object|space).{0,20}you can see/i.test(
                entriesText
            );
    }

    return new Spell({
        name: rawSpell.name,
        subtitle: "",
        source: rawSpell.source,
        page: rawSpell.page,
        isSRD: rawSpell.srd || rawSpell.srd52 || false,
        level: rawSpell.level,
        school: schoolName,
        time: primaryTime,
        range: processRange(
            rawSpell.range,
            requiresSight,
            areaTags,
            rawSpell.entries
        ),
        components: processComponents(rawSpell.components),
        duration: processDuration(rawDuration),
        description: processEntries(rawSpell.entries).trim(),
        upcast: rawSpell.entriesHigherLevel
            ? processEntries(rawSpell.entriesHigherLevel, true).trim()
            : undefined,
        classes: spellClassMap[rawSpell.name] || [],
        isConcentration: rawDuration.concentration || false,
        isRitual: rawSpell.meta?.ritual || false,
    });
}

// Process all spells
const processedSpells = allRawSpells.map(createSpellFromRaw);

// Write the processed spells to a new file
const outputPath = path.join(dataDir, "spells.json");
fs.writeFileSync(
    outputPath,
    JSON.stringify(
        processedSpells.map((spell) => spell.toJSON()),
        null,
        2
    )
);

console.log(
    `Successfully processed ${processedSpells.length} spells and saved to ${outputPath}`
);
