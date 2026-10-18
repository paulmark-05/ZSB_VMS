const mongoose = require("mongoose");

const workSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    counter: {
        type: Number,
        required: true,
        min: 1
    },

    requiresZsbId: {
        type: Boolean,
        default: true
    },

    order: {
        type: Number,
        default: 0
    }

}, {
    timestamps: true
});

// Work names are shown to visitors and stored on every booking, so two works
// that differ only by letter case would be indistinguishable.
workSchema.index(
    { name: 1 },
    { unique: true, collation: { locale: "en", strength: 2 } }
);

module.exports = mongoose.model("Work", workSchema);
