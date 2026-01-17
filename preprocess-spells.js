import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Spell, SCHOOL_MAP } from "./spell.js";

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
            if (!spellClassMap[spellName].includes(c.name)) {
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
    const damageRegex = new RegExp(
        `\\b(${damageTypes.join("|")})( damage)\\b(?!\`)`,
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

    // "Bonus Action(s)" - always specific to action type
    processedText = processedText.replace(
        /\b(bonus actions?)\b(?!`)/gi,
        "`$1`"
    );

    // "Reaction(s)" - specific to action type
    processedText = processedText.replace(/\b(reactions?)\b(?!`)/gi, "`$1`");

    // "Action" (singular) - only wrap when clearly referring to action economy
    // Avoid: "interaction", "course of action"
    const actionSingularPatterns = [
        /\b(an action)\b(?!`)/gi,
        /\b(the action)\b(?!`)/gi,
        /\b(as an action)\b(?!`)/gi,
        /\b(use (?:an |your |its )?action)\b(?!`)/gi,
        /\b(uses (?:an |its )?action)\b(?!`)/gi,
        /\b(take (?:an |the |its )?action)\b(?!`)/gi,
        /\b(takes (?:an |the |its )?action)\b(?!`)/gi,
        /\b(no action)\b(?!`)/gi,
        /\b(one action)\b(?!`)/gi,
        /\b((?:Dodge|Attack|Dash|Disengage|Help|Hide|Ready|Search|Use|Magic|Study|Influence|Utilize) action)\b(?!`)/gi,
        /\b(Use an Object action)\b(?!`)/gi,
        /\b(1 action)\b(?!`)/gi,
        /\b(that action)\b(?!`)/gi,
        /\b(what action)\b(?!`)/gi,
        /\b(additional action)\b(?!`)/gi,
        /\b(wastes? (?:its |their )?action)\b(?!`)/gi,
        /\b(only action)\b(?!`)/gi,
        /\b((?:your|its|their) action)\b(?!`)/gi,
    ];
    actionSingularPatterns.forEach((pattern) => {
        processedText = processedText.replace(pattern, "`$1`");
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
                            // Handle items with name and entry, like in some lists.
                            return `- **${item.name}** ${processString(
                                item.entry
                            )}`;
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
                                .map((cell) =>
                                    typeof cell === "string"
                                        ? processString(cell)
                                        : ""
                                )
                                .join(" | ")} |`
                    )
                    .join("\n") + "\n\n";
        } else if (entry.type === "entries") {
            // Skip upcast headers when processing higher level entries
            const upcastHeaders = [
                "At Higher Levels",
                "Using a Higher-Level Spell Slot",
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
 * Processes raw components data to convert cost to hasCost boolean.
 * @param {Object} rawComponents - The raw components data.
 * @returns {Object} Processed components data.
 */
function processComponents(rawComponents) {
    if (!rawComponents) return {};

    const result = {
        v: rawComponents.v,
        s: rawComponents.s,
    };

    if (rawComponents.m) {
        if (typeof rawComponents.m === "string") {
            result.m = rawComponents.m;
        } else {
            result.m = {
                text: rawComponents.m.text,
                hasCost: rawComponents.m.cost !== undefined,
                isConsumed: rawComponents.m.consume || false,
            };
        }
    }

    return result;
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
    const primaryDuration = rawSpell.duration[0];

    return new Spell({
        name: rawSpell.name,
        source: rawSpell.source,
        page: rawSpell.page,
        level: rawSpell.level,
        school: schoolName,
        time: primaryTime,
        range: rawSpell.range,
        components: processComponents(rawSpell.components),
        duration: primaryDuration,
        description: processEntries(rawSpell.entries).trim(),
        upcast: rawSpell.entriesHigherLevel
            ? processEntries(rawSpell.entriesHigherLevel, true).trim()
            : undefined,
        classes: spellClassMap[rawSpell.name] || [],
        isConcentration: primaryDuration.concentration || false,
        isRitual: rawSpell.meta?.ritual || false,
        requiresSight: (rawSpell.miscTags || []).includes("SGT"),
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
