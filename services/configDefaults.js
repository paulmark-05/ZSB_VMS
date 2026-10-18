const Counter = require("../models/Counter");
const Work = require("../models/Work");

// First-run content only. Once the Counter collection has any document these
// are never applied again, so everything after that is edited from the
// Super Admin panel instead of here.
const DEFAULT_COUNTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const DEFAULT_WORKS = [
    { name: "Registration for ESM / Widow I-card", counter: 1, requiresZsbId: false },
    { name: "Issue of ESM / Widow I-card", counter: 1, requiresZsbId: false },
    { name: "Issue of NOC for Shifting to new ZSB", counter: 1, requiresZsbId: false },
    { name: "RSB I-card registration", counter: 1, requiresZsbId: false },

    { name: "Change of Home Address", counter: 2 },
    { name: "Submission of NOC from other ZSB", counter: 2 },

    { name: "Issue of Relationship certificate from Record office", counter: 3 },
    { name: "Change of Name and/or DOB", counter: 3 },
    { name: "Publication/entry of NE Part II order", counter: 3 },

    { name: "Registration of Dependent I-card", counter: 4 },
    { name: "Issue of Dependent I-card", counter: 4 },

    { name: "Pension & PPO related Job", counter: 5 },
    { name: "Processing of Grants (CEG) - (KSB/WB/Army/Navy/AF)", counter: 5 },
    { name: "Dependancy Certificate", counter: 5 },

    { name: "Grant-in-Aid WWII", counter: 6 },
    { name: "Life certificate Penury", counter: 6 },
    { name: "AFFD Payment", counter: 6 },

    { name: "Veer Pariwar Yojna DLSA", counter: 7 },
    { name: "Job Sponsoring", counter: 7 },
    { name: "Family Dispute", counter: 7 },
    { name: "Grievance", counter: 7 },
    { name: "Other Work", counter: 7 },

    { name: "Canteen related assistance", counter: 8, requiresZsbId: false }
];

async function seedConfigDefaults() {

    // Counters can never be emptied (the last one can't be removed), so an
    // empty collection reliably means "first run". Works are seeded in the
    // same step, which means deleting every work later can't bring them back.
    if (await Counter.estimatedDocumentCount() > 0) return;

    await Counter.insertMany(DEFAULT_COUNTERS.map(number => ({ number })));

    await Work.insertMany(
        DEFAULT_WORKS.map((work, index) => ({
            requiresZsbId: true,
            ...work,
            order: index + 1
        }))
    );

    console.log(
        `✅ Seeded ${DEFAULT_COUNTERS.length} counters and ${DEFAULT_WORKS.length} works`
    );
}

module.exports = { seedConfigDefaults };
