const express = require("express");
const mongoose = require("mongoose");

const Counter = require("../models/Counter");
const Work = require("../models/Work");
const AdminUser = require("../models/AdminUser");

const requireSuperAdmin = require("../middleware/requireSuperAdmin");

const router = express.Router();

// The TV board lays 9+ counters out in two rows, and beyond 12 each column
// gets too narrow to read from across a room.
const MAX_COUNTERS = 12;

const caseInsensitive = { locale: "en", strength: 2 };

function handle(fn) {

    return async (req, res) => {

        try {

            await fn(req, res);

        } catch (err) {

            console.error(err);

            res.status(500).json({
                success: false,
                message: "Something went wrong. Please try again."
            });

        }

    };

}

function fail(res, status, message) {

    return res.status(status).json({ success: false, message });

}

// Booking forms, the admin tables and the TV board all render these names as
// HTML, so angle brackets are rejected outright rather than escaped.
function cleanName(value) {

    if (typeof value !== "string") return null;

    const name = value.trim().replace(/\s+/g, " ");

    if (name.length < 3 || name.length > 120) return null;
    if (/[<>]/.test(name)) return null;

    return name;

}

const NAME_ERROR =
    "Enter a work name of 3 to 120 characters, without < or >.";

function notifyChange(req) {

    const io = req.app.get("io");

    if (!io) return;

    io.emit("config-update");
    io.emit("queue-update");

}

async function counterExists(number) {

    return Number.isInteger(number) &&
        await Counter.exists({ number });

}

/*
======================================================
PUBLIC: what the booking form, admin dropdowns and
the TV board need to know
======================================================
*/

router.get(
    "/config/form",
    handle(async (req, res) => {

        const [counters, works] = await Promise.all([

            Counter.find().sort({ number: 1 }).select("number -_id").lean(),

            Work.find()
                .sort({ counter: 1, order: 1 })
                .select("name counter requiresZsbId -_id")
                .lean()

        ]);

        res.json({

            counters: counters.map(c => c.number),

            works,

            maxCounters: MAX_COUNTERS

        });

    })
);

/*
======================================================
SUPER ADMIN: everything the Setup tab shows
======================================================
*/

router.get(
    "/admin/setup",
    requireSuperAdmin,
    handle(async (req, res) => {

        const [counters, works, logins] = await Promise.all([

            Counter.find().sort({ number: 1 }).lean(),

            Work.find().sort({ counter: 1, order: 1 }).lean(),

            AdminUser.find({ role: "counter" })
                .select("username assignedCounter active -_id")
                .lean()

        ]);

        res.json({

            success: true,

            maxCounters: MAX_COUNTERS,

            counters: counters.map(c => ({

                number: c.number,

                workCount:
                    works.filter(w => w.counter === c.number).length,

                logins:
                    logins
                        .filter(l => l.assignedCounter === c.number)
                        .map(l => ({
                            username: l.username,
                            active: l.active
                        }))

            })),

            works: works.map(w => ({

                _id: w._id,
                name: w.name,
                counter: w.counter,
                requiresZsbId: w.requiresZsbId

            }))

        });

    })
);

/*
======================================================
COUNTERS
======================================================
*/

router.post(
    "/admin/setup/counters",
    requireSuperAdmin,
    handle(async (req, res) => {

        const count = await Counter.countDocuments();

        if (count >= MAX_COUNTERS) {

            return fail(
                res,
                400,
                `The board can show at most ${MAX_COUNTERS} counters.`
            );

        }

        const last =
            await Counter.findOne().sort({ number: -1 }).lean();

        const number = (last?.number || 0) + 1;

        try {

            await Counter.create({ number });

        } catch (err) {

            if (err.code === 11000) {

                return fail(res, 409, "Another counter was just added. Try again.");

            }

            throw err;

        }

        notifyChange(req);

        res.status(201).json({ success: true, number });

    })
);

router.delete(
    "/admin/setup/counters/:number",
    requireSuperAdmin,
    handle(async (req, res) => {

        const number = Number(req.params.number);

        if (!await counterExists(number)) {

            return fail(res, 404, "Counter not found.");

        }

        if (await Counter.countDocuments() <= 1) {

            return fail(res, 400, "At least one counter must remain.");

        }

        const workCount = await Work.countDocuments({ counter: number });

        if (workCount > 0) {

            return fail(
                res,
                409,
                `Move or delete the ${workCount} work(s) on Counter ${number} first.`
            );

        }

        if (await AdminUser.exists({
            role: "counter",
            assignedCounter: number,
            active: true
        })) {

            return fail(
                res,
                409,
                `Disable the login for Counter ${number} in User Management first.`
            );

        }

        if (await mongoose.model("Visitor").exists({ counter: number })) {

            return fail(
                res,
                409,
                `Counter ${number} has booking history, so it can't be removed. ` +
                "Close it from Counter Control instead."
            );

        }

        await Counter.deleteOne({ number });

        notifyChange(req);

        res.json({ success: true });

    })
);

/*
======================================================
WORKS
======================================================
*/

router.post(
    "/admin/setup/works",
    requireSuperAdmin,
    handle(async (req, res) => {

        const name = cleanName(req.body.name);
        const counter = Number(req.body.counter);

        if (!name) return fail(res, 400, NAME_ERROR);

        if (!await counterExists(counter)) {

            return fail(res, 400, "Choose a counter that exists.");

        }

        if (await Work.findOne({ name }).collation(caseInsensitive)) {

            return fail(res, 409, "A work with this name already exists.");

        }

        const last = await Work.findOne().sort({ order: -1 }).lean();

        const work = await Work.create({

            name,

            counter,

            requiresZsbId: req.body.requiresZsbId !== false,

            order: (last?.order || 0) + 1

        });

        notifyChange(req);

        res.status(201).json({ success: true, id: work._id });

    })
);

router.patch(
    "/admin/setup/works/:id",
    requireSuperAdmin,
    handle(async (req, res) => {

        if (!mongoose.isValidObjectId(req.params.id)) {

            return fail(res, 404, "Work not found.");

        }

        const work = await Work.findById(req.params.id);

        if (!work) return fail(res, 404, "Work not found.");

        if (req.body.name !== undefined) {

            const name = cleanName(req.body.name);

            if (!name) return fail(res, 400, NAME_ERROR);

            const clash = await Work.findOne({
                name,
                _id: { $ne: work._id }
            }).collation(caseInsensitive);

            if (clash) {

                return fail(res, 409, "A work with this name already exists.");

            }

            work.name = name;

        }

        if (req.body.counter !== undefined) {

            const counter = Number(req.body.counter);

            if (!await counterExists(counter)) {

                return fail(res, 400, "Choose a counter that exists.");

            }

            work.counter = counter;

        }

        if (req.body.requiresZsbId !== undefined) {

            if (typeof req.body.requiresZsbId !== "boolean") {

                return fail(res, 400, "requiresZsbId must be true or false.");

            }

            work.requiresZsbId = req.body.requiresZsbId;

        }

        await work.save();

        notifyChange(req);

        res.json({ success: true });

    })
);

router.delete(
    "/admin/setup/works/:id",
    requireSuperAdmin,
    handle(async (req, res) => {

        if (!mongoose.isValidObjectId(req.params.id)) {

            return fail(res, 404, "Work not found.");

        }

        const work = await Work.findByIdAndDelete(req.params.id);

        if (!work) return fail(res, 404, "Work not found.");

        notifyChange(req);

        res.json({ success: true });

    })
);

module.exports = router;
