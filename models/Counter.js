const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({

    number: {
        type: Number,
        required: true,
        unique: true,
        min: 1
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Counter", counterSchema);
